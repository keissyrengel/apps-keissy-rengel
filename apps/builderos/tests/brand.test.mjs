import assert from "node:assert/strict";
import test from "node:test";

import { applyLogo } from "../lib/ai/app-generator.ts";
import {
  LOGO_PLACEHOLDER,
  MAX_ATTACHMENTS,
  describeAttachments,
  describeBrand,
  sanitizeAttachments,
  sanitizeBrand,
} from "../lib/ai/brand-brief.ts";

const LOGO = `data:image/webp;base64,${"A".repeat(64)}`;

test("brand fields become instructions the model can act on", () => {
  const brief = describeBrand({
    name: "Konvertis",
    primaryColor: "#0B1F3A",
    accentColor: "#E0FF05",
    fontFamily: "Poppins",
    logoDataUrl: LOGO,
  });

  assert.match(brief, /Konvertis/);
  assert.match(brief, /#0B1F3A/);
  assert.match(brief, /#E0FF05/);
  assert.match(brief, /Poppins/);
  assert.ok(brief.includes(LOGO_PLACEHOLDER), "expected the logo placeholder");
  assert.ok(!brief.includes(LOGO), "the logo bytes must never reach the prompt");
});

test("an empty brand produces no instructions", () => {
  assert.equal(describeBrand({}), "");
  assert.equal(describeBrand(sanitizeBrand(undefined)), "");
});

test("malformed brand values are dropped rather than passed through", () => {
  const brand = sanitizeBrand({
    name: "   ",
    primaryColor: "rojo",
    accentColor: "#ABC",
    logoDataUrl: "https://example.com/logo.png",
    fontFamily: "  Inter  ",
  });

  assert.equal(brand.name, undefined);
  assert.equal(brand.primaryColor, undefined, "non-hex colour should be dropped");
  assert.equal(brand.accentColor, "#ABC");
  assert.equal(brand.logoDataUrl, undefined, "remote URLs would break the single-file guarantee");
  assert.equal(brand.fontFamily, "Inter");
});

test("an oversized logo is dropped instead of blowing up the request", () => {
  const huge = `data:image/png;base64,${"A".repeat(700_000)}`;
  assert.equal(sanitizeBrand({ logoDataUrl: huge }).logoDataUrl, undefined);
});

test("the logo is spliced in after generation", () => {
  const html = `<html><body><img src="${LOGO_PLACEHOLDER}" alt="Logo"></body></html>`;
  assert.equal(applyLogo(html, LOGO), `<html><body><img src="${LOGO}" alt="Logo"></body></html>`);
});

test("a stray placeholder is removed when there is no logo", () => {
  const html = `<html><body><img src="${LOGO_PLACEHOLDER}" alt="Logo"><h1>Hola</h1></body></html>`;
  const result = applyLogo(html, undefined);

  assert.ok(!result.includes(LOGO_PLACEHOLDER), "placeholder must not survive");
  assert.ok(!result.includes("<img"), "the broken image tag must be removed");
  assert.match(result, /<h1>Hola<\/h1>/);
});

test("attachments are validated and capped", () => {
  const attachments = sanitizeAttachments([
    { kind: "image", name: "captura.png", dataUrl: `data:image/png;base64,${"A".repeat(32)}` },
    { kind: "image", name: "malo.png", dataUrl: "javascript:alert(1)" },
    { kind: "text", name: "datos.csv", content: "a,b\n1,2" },
    { kind: "text", name: "vacio.txt", content: "   " },
    ...Array.from({ length: 10 }, (_, index) => ({
      kind: "text",
      name: `extra-${index}.txt`,
      content: "x",
    })),
  ]);

  assert.equal(attachments.length, MAX_ATTACHMENTS);
  assert.ok(!attachments.some((item) => item.name === "malo.png"), "non-data URLs are rejected");
  assert.ok(!attachments.some((item) => item.name === "vacio.txt"), "empty text is dropped");
});

test("long text attachments are truncated", () => {
  const [attachment] = sanitizeAttachments([
    { kind: "text", name: "largo.txt", content: "x".repeat(50_000) },
  ]);
  assert.equal(attachment.content.length, 20_000);
});

test("attachments are described so the model knows how to use them", () => {
  const brief = describeAttachments([
    { kind: "image", name: "referencia.png", dataUrl: LOGO },
    { kind: "text", name: "clientes.csv", content: "nombre,ciudad\nAna,Madrid" },
  ]);

  assert.match(brief, /referencia\.png/);
  assert.match(brief, /clientes\.csv/);
  assert.match(brief, /Ana,Madrid/, "text content must be inlined for the model to use it");
});
