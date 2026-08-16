import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);

const built = await access(workerUrl).then(
  () => true,
  () => false,
);

test(
  "the built worker server-renders the BuilderOS workspace",
  { skip: built ? false : "run `npm run build` first" },
  async () => {
    const { default: worker } = await import(workerUrl.href);

    const response = await worker.fetch(
      new Request("http://localhost/", { headers: { accept: "text/html" } }),
      { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, /<title>BuilderOS/i);
    assert.match(html, /Build what comes next/);
  },
);
