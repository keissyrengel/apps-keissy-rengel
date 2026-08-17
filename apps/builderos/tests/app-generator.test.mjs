import assert from "node:assert/strict";
import test from "node:test";

import {
  extractHtmlDocument,
  readTitle,
  slugify,
} from "../lib/ai/app-generator.ts";
import { toBase64 } from "../lib/github/publisher.ts";

const DOCUMENT = `<!DOCTYPE html>
<html lang="es"><head><title>Gestor de Citas</title></head><body><h1>Hola</h1></body></html>`;

test("extracts a bare HTML document", () => {
  assert.equal(extractHtmlDocument(DOCUMENT), DOCUMENT);
});

test("extracts a document wrapped in a markdown fence", () => {
  const fenced = "Here you go:\n\n```html\n" + DOCUMENT + "\n```\n";
  assert.equal(extractHtmlDocument(fenced), DOCUMENT);
});

test("strips commentary around the document", () => {
  const noisy = `Sure! Here is the app.\n\n${DOCUMENT}\n\nLet me know if you want changes.`;
  assert.equal(extractHtmlDocument(noisy), DOCUMENT);
});

test("rejects a response with no document", () => {
  assert.throws(() => extractHtmlDocument("I cannot help with that."), /complete HTML document/);
});

test("rejects a truncated document", () => {
  assert.throws(
    () => extractHtmlDocument("<!DOCTYPE html><html><body>cut off"),
    /truncated/,
  );
});

test("reads the document title", () => {
  assert.equal(readTitle(DOCUMENT), "Gestor de Citas");
  assert.equal(readTitle("<html><body>no title</body></html>"), null);
});

test("slugifies titles into safe folder names", () => {
  assert.equal(slugify("Gestor de Citas"), "gestor-de-citas");
  assert.equal(slugify("Calculadora de ROI — v2"), "calculadora-de-roi-v2");
  assert.equal(slugify("¡Épica!"), "epica");
  assert.equal(slugify("   "), "app");
  assert.ok(slugify("x".repeat(200)).length <= 60);
});

test("base64 round-trips UTF-8 content of any size", () => {
  const text = `${DOCUMENT}\n${"ñ€✓".repeat(20_000)}`;
  const decoded = Buffer.from(toBase64(text), "base64").toString("utf8");
  assert.equal(decoded, text);
});
