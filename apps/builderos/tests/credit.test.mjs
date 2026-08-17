import assert from "node:assert/strict";
import test from "node:test";

import { applyCredit } from "../lib/ai/credit.ts";

const CONFIG = {
  creditText: "Esta app fue hecha con 💜 por",
  creditLinkText: "Konvertis Agency",
  creditUrl: "https://www.konvertisagency.com",
};

const PAGE = `<!DOCTYPE html>
<html lang="es"><head><title>App</title></head><body><h1>Hola</h1></body></html>`;

function creditCount(html) {
  return html.match(/data-builderos-credit/g)?.length ?? 0;
}

test("the credit is appended just before </body>", () => {
  const html = applyCredit(PAGE, CONFIG);

  assert.match(html, /Esta app fue hecha con 💜 por/);
  assert.match(html, /<a href="https:\/\/www\.konvertisagency\.com"/);
  assert.match(html, />Konvertis Agency<\/a>/);
  assert.ok(
    html.indexOf("data-builderos-credit") < html.indexOf("</body>"),
    "the footer must sit inside the body",
  );
});

test("the link opens safely in a new tab", () => {
  const html = applyCredit(PAGE, CONFIG);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("iterating on an app never duplicates the credit", () => {
  // Simulates the edit loop: the model is sent the previous document, which
  // already contains the footer, and returns it unchanged.
  let html = applyCredit(PAGE, CONFIG);
  html = applyCredit(html, CONFIG);
  html = applyCredit(html, CONFIG);

  assert.equal(creditCount(html), 1);
  assert.equal(html.match(/Konvertis Agency/g).length, 1);
});

test("a credit the model moved or restyled is replaced by the canonical one", () => {
  const tampered = PAGE.replace(
    "<h1>Hola</h1>",
    '<h1>Hola</h1><footer data-builderos-credit style="color:red">Hecho por Otra Agencia</footer>',
  );
  const html = applyCredit(tampered, CONFIG);

  assert.equal(creditCount(html), 1);
  assert.ok(!html.includes("Otra Agencia"), "the tampered credit must not survive");
  assert.match(html, /Konvertis Agency/);
});

test("a document with no </body> still gets the credit", () => {
  const fragment = "<html><h1>Hola</h1></html>";
  const html = applyCredit(fragment, CONFIG);
  assert.equal(creditCount(html), 1);
  assert.ok(html.indexOf("data-builderos-credit") < html.indexOf("</html>"));
});

test("the credit can be turned off with empty configuration", () => {
  const html = applyCredit(PAGE, { creditText: "", creditLinkText: "", creditUrl: "" });
  assert.equal(creditCount(html), 0);
});

test("a non-http link degrades to plain text instead of rendering", () => {
  const html = applyCredit(PAGE, { ...CONFIG, creditUrl: "javascript:alert(1)" });
  assert.ok(!html.includes("javascript:"), "unsafe schemes must not reach the document");
  assert.match(html, /Konvertis Agency/);
  assert.ok(!/<a href/.test(html), "no anchor should be rendered without a safe URL");
});

test("configured text is HTML-escaped", () => {
  const html = applyCredit(PAGE, {
    ...CONFIG,
    creditLinkText: '<script>alert("x")</script>',
  });
  assert.ok(!html.includes("<script>alert"), "markup in configuration must not be executable");
  assert.match(html, /&lt;script&gt;/);
});
