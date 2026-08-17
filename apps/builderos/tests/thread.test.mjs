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
<html lang="es"><head><title>Panel</title></head><body><h1>Panel</h1></body></html>`;
const SCREENSHOT = `data:image/png;base64,${"A".repeat(64)}`;

let server;
let baseUrl;
const chatBodies = [];

before(async () => {
  server = createServer(async (request, response) => {
    const body = await readBody(request);
    if (request.url?.startsWith("/v1/chat/completions")) {
      chatBodies.push(JSON.parse(body));
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: APP_HTML } }] })}\n\n`,
      );
      response.write("data: [DONE]\n\n");
      return response.end();
    }
    response.writeHead(404).end("{}");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = `${baseUrl}/v1`;
  delete process.env.BUILDER_ACCESS_CODE;
});

after(() => server?.close());

const options = { skip: built ? false : "run `npm run build` first" };

test("a screenshot attached to a message reaches the model as an image", options, async () => {
  chatBodies.length = 0;

  await build({
    prompt: "el botón de guardar no se ve, mira la captura",
    attachments: [{ kind: "image", name: "fallo.png", dataUrl: SCREENSHOT }],
  });

  const { content } = chatBodies.at(-1).messages.at(-1);
  assert.ok(Array.isArray(content), "a message with an image must use content parts");

  const image = content.find((part) => part.type === "image_url");
  assert.ok(image, "expected the screenshot to be sent as an image");
  assert.equal(image.image_url.url, SCREENSHOT);

  const text = content.find((part) => part.type === "text");
  assert.match(text.text, /el botón de guardar no se ve/);
  assert.match(text.text, /fallo\.png/, "the model should be told what it is looking at");
});

test("brand references and message attachments arrive together", options, async () => {
  chatBodies.length = 0;

  await build({
    prompt: "usa estos datos",
    attachments: [
      { kind: "text", name: "clientes.csv", content: "nombre\nAna" },
      { kind: "image", name: "referencia.png", dataUrl: SCREENSHOT },
    ],
  });

  const { content } = chatBodies.at(-1).messages.at(-1);
  const text = content.find((part) => part.type === "text").text;

  assert.match(text, /clientes\.csv/);
  assert.match(text, /Ana/, "text attachments are inlined for the model to use");
  assert.equal(content.filter((part) => part.type === "image_url").length, 1);
});

test("a message with no attachments keeps the simple request shape", options, async () => {
  chatBodies.length = 0;
  await build({ prompt: "una app de notas" });

  const { content } = chatBodies.at(-1).messages.at(-1);
  assert.equal(typeof content, "string", "no attachments should mean no content parts");
});

async function build(body) {
  const url = new URL(workerUrl);
  url.searchParams.set("t", `${process.pid}-${chatBodies.length}-${Math.random()}`);
  const { default: worker } = await import(url.href);

  const response = await worker.fetch(
    new Request("http://localhost/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { ASSETS: { fetch: async () => new Response("", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  return response.text();
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (part) => chunks.push(part));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}
