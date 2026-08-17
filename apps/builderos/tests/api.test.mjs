import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { createServer } from "node:http";
import test, { after, before } from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
const built = await access(workerUrl).then(
  () => true,
  () => false,
);

const APP_HTML = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Lista de Tareas</title></head>
<body><h1>Lista de Tareas</h1><script>console.log("ok")</script></body></html>`;

/** Minimal stand-in for the OpenAI and GitHub APIs. */
let server;
let baseUrl;
const received = { chatBodies: [], githubRequests: [] };

before(async () => {
  server = createServer(async (request, response) => {
    const body = await readBody(request);

    if (request.url?.startsWith("/v1/chat/completions")) {
      received.chatBodies.push(JSON.parse(body));
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      // Split into several deltas so the SSE reader is exercised.
      for (const piece of chunk(APP_HTML, 40)) {
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`,
        );
      }
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    if (request.url?.includes("/contents/")) {
      received.githubRequests.push({ method: request.method, url: request.url, body });
      if (request.method === "GET") {
        response.writeHead(404).end("{}");
        return;
      }
      response.writeHead(201, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({ commit: { html_url: "https://github.com/o/r/commit/abc" } }),
      );
      return;
    }

    response.writeHead(404).end("{}");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = `${baseUrl}/v1`;
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_API_URL = baseUrl;
  process.env.PUBLIC_BASE_URL = "https://apps.example.com";
  process.env.BUILDER_ACCESS_CODE = "secreto";
});

after(() => server?.close());

const options = { skip: built ? false : "run `npm run build` first" };

test("POST /api/build streams status events and returns the generated app", options, async () => {
  const events = await buildStream({ prompt: "una lista de tareas" }, "secreto");

  const statuses = events.filter((event) => event.type === "status").map((event) => event.status);
  assert.ok(statuses.includes("Planning"), "expected a Planning status");

  const result = events.at(-1);
  assert.equal(result.type, "result");
  assert.equal(result.result.success, true, result.result.error);
  assert.equal(result.result.app.name, "Lista de Tareas");
  assert.equal(result.result.app.slug, "lista-de-tareas");

  // The document comes back as generated, plus the agency credit the Worker
  // appends to every app.
  const { html } = result.result.app;
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<h1>Lista de Tareas<\/h1>/);
  assert.match(html, /data-builderos-credit/);
  assert.match(html, /Konvertis Agency/);
  assert.ok(html.trimEnd().endsWith("</html>"));
});

test("POST /api/build rejects a wrong access code", options, async () => {
  const events = await buildStream({ prompt: "hola" }, "incorrecto");
  assert.equal(events.at(-1).result.success, false);
  assert.match(events.at(-1).result.error, /access code/i);
});

test("POST /api/build rejects an empty prompt", options, async () => {
  const events = await buildStream({ prompt: "   " }, "secreto");
  assert.equal(events.at(-1).result.success, false);
  assert.match(events.at(-1).result.error, /build instruction/i);
});

test("a follow-up prompt sends the current document back to the model", options, async () => {
  received.chatBodies.length = 0;
  await buildStream({ prompt: "haz el botón azul", previousHtml: APP_HTML }, "secreto");

  const sent = received.chatBodies.at(-1);
  const userMessage = sent.messages.at(-1).content;
  assert.match(userMessage, /haz el botón azul/);
  assert.ok(userMessage.includes(APP_HTML), "expected the current document in the prompt");
});

test("POST /api/publish commits the app and returns the live URL", options, async () => {
  received.githubRequests.length = 0;
  const { default: worker } = await loadWorker();

  const response = await worker.fetch(
    new Request("http://localhost/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-builderos-key": "secreto" },
      body: JSON.stringify({ slug: "Lista de Tareas", html: APP_HTML, prompt: "una lista" }),
    }),
    { ASSETS: assets() },
    context(),
  );

  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.success, true);
  assert.equal(result.url, "https://apps.example.com/apps/lista-de-tareas/");

  const put = received.githubRequests.find((entry) => entry.method === "PUT");
  assert.ok(put, "expected a PUT to the GitHub contents API");
  assert.match(put.url, /\/contents\/apps\/lista-de-tareas\/index\.html$/);
  assert.equal(
    Buffer.from(JSON.parse(put.body).content, "base64").toString("utf8"),
    APP_HTML,
  );
});

test("POST /api/publish refuses an empty document", options, async () => {
  const { default: worker } = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-builderos-key": "secreto" },
      body: JSON.stringify({ slug: "x", html: "" }),
    }),
    { ASSETS: assets() },
    context(),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).success, false);
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function loadWorker() {
  const url = new URL(workerUrl);
  url.searchParams.set("t", `${process.pid}-${received.chatBodies.length}-${Math.random()}`);
  return import(url.href);
}

async function buildStream(body, accessCode) {
  const { default: worker } = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-builderos-key": accessCode },
      body: JSON.stringify(body),
    }),
    { ASSETS: assets() },
    context(),
  );
  return parseNdjson(await response.text());
}

function parseNdjson(text) {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function assets() {
  return { fetch: async () => new Response("Not found", { status: 404 }) };
}

function context() {
  return { waitUntil() {}, passThroughOnException() {} };
}

function chunk(text, size) {
  const pieces = [];
  for (let index = 0; index < text.length; index += size) {
    pieces.push(text.slice(index, index + size));
  }
  return pieces;
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (part) => chunks.push(part));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}
