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
<html lang="es"><head><title>Calculadora de ROI</title></head><body><h1>ROI</h1></body></html>`;

/**
 * Stands in for the GitHub contents API. `existing` is the set of paths the
 * fake repository already has, so tests can drive the conflict logic.
 */
let server;
let baseUrl;
const existing = new Set();
const puts = [];
/** Number of upcoming PUTs that should answer 503, to emulate a GitHub blip. */
let failNextPuts = 0;

before(async () => {
  server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const path = decodeURIComponent(url.pathname);
    const body = await readBody(request);
    const json = (status, value) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    };

    if (request.method === "PUT") {
      puts.push({ path, body: JSON.parse(body) });
      if (failNextPuts > 0) {
        failNextPuts -= 1;
        return json(503, {
          message: "No server is currently available to service your request.",
        });
      }
      existing.add(path);
      return json(201, { commit: { html_url: "https://github.com/o/r/commit/abc" } });
    }

    // Directory listing for /contents/apps
    if (path.endsWith("/contents/apps")) {
      const slugs = [...existing]
        .map((item) => item.match(/\/contents\/apps\/([^/]+)\/index\.html$/)?.[1])
        .filter(Boolean);
      return json(200, [
        ...new Set(slugs.map((name) => ({ name, type: "dir" })).map((e) => JSON.stringify(e))),
      ].map((e) => JSON.parse(e)));
    }

    if (!existing.has(path)) return json(404, { message: "Not Found" });

    if (request.headers.accept?.includes("raw")) {
      response.writeHead(200, { "Content-Type": "text/plain" });
      return response.end(APP_HTML);
    }
    return json(200, { sha: "sha-of-existing-file" });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_API_URL = baseUrl;
  process.env.PUBLIC_BASE_URL = "https://apps.example.com";
  delete process.env.BUILDER_ACCESS_CODE;
});

after(() => server?.close());

const options = { skip: built ? false : "run `npm run build` first" };

test("GET /api/apps lists what is already published", options, async () => {
  existing.clear();
  existing.add("/repos/keissyrengel/apps-keissy-rengel/contents/apps/roi-meta-ads/index.html");
  existing.add("/repos/keissyrengel/apps-keissy-rengel/contents/apps/offer-score-lab/index.html");

  const { apps } = await call("GET", "/api/apps");

  assert.deepEqual(
    apps.map((app) => app.slug),
    ["offer-score-lab", "roi-meta-ads"],
    "expected alphabetical slugs",
  );
  assert.equal(apps[1].url, "https://apps.example.com/apps/roi-meta-ads/");
});

test("GET /api/apps is empty when nothing has been published", options, async () => {
  existing.clear();
  const { apps } = await call("GET", "/api/apps");
  assert.deepEqual(apps, []);
});

test("a published app can be reopened with its real title", options, async () => {
  existing.clear();
  existing.add("/repos/keissyrengel/apps-keissy-rengel/contents/apps/roi-meta-ads/index.html");

  const { app } = await call("GET", "/api/apps/roi-meta-ads");

  assert.equal(app.slug, "roi-meta-ads");
  assert.equal(app.name, "Calculadora de ROI");
  assert.equal(app.html, APP_HTML);
});

test("opening an app that does not exist returns 404", options, async () => {
  existing.clear();
  const { status, body } = await callRaw("GET", "/api/apps/no-existe");
  assert.equal(status, 404);
  assert.match(body.error, /no existe/i);
});

test("a slug with path traversal cannot escape the publish directory", options, async () => {
  existing.clear();
  const { status } = await callRaw("GET", "/api/apps/..%2F..%2Fsecret");
  // slugify flattens it to a harmless name, which simply is not published.
  assert.equal(status, 404);
});

test("publishing over an existing app asks before overwriting", options, async () => {
  existing.clear();
  existing.add("/repos/keissyrengel/apps-keissy-rengel/contents/apps/roi-meta-ads/index.html");
  puts.length = 0;

  const { status, body } = await callRaw("POST", "/api/publish", {
    slug: "roi-meta-ads",
    html: APP_HTML,
  });

  assert.equal(status, 409);
  assert.equal(body.conflict, true);
  assert.equal(body.slug, "roi-meta-ads");
  assert.equal(puts.length, 0, "nothing may be written before the user decides");
});

test("mode update overwrites the live app in place", options, async () => {
  existing.clear();
  existing.add("/repos/keissyrengel/apps-keissy-rengel/contents/apps/roi-meta-ads/index.html");
  puts.length = 0;

  const { status, body } = await callRaw("POST", "/api/publish", {
    slug: "roi-meta-ads",
    html: APP_HTML,
    mode: "update",
  });

  assert.equal(status, 200);
  assert.equal(body.slug, "roi-meta-ads");
  assert.equal(body.url, "https://apps.example.com/apps/roi-meta-ads/");
  assert.equal(puts.length, 1);
  assert.equal(puts[0].body.sha, "sha-of-existing-file", "update must reference the existing file");
});

test("mode copy publishes to the next free slug", options, async () => {
  existing.clear();
  existing.add("/repos/keissyrengel/apps-keissy-rengel/contents/apps/roi-meta-ads/index.html");
  existing.add("/repos/keissyrengel/apps-keissy-rengel/contents/apps/roi-meta-ads-2/index.html");
  puts.length = 0;

  const { status, body } = await callRaw("POST", "/api/publish", {
    slug: "roi-meta-ads",
    html: APP_HTML,
    mode: "copy",
  });

  assert.equal(status, 200);
  assert.equal(body.slug, "roi-meta-ads-3", "should skip the slug already taken");
  assert.match(puts[0].path, /roi-meta-ads-3\/index\.html$/);
  assert.equal(puts[0].body.sha, undefined, "a copy creates a new file");
});

test("publishing a brand new app needs no mode", options, async () => {
  existing.clear();
  puts.length = 0;

  const { status, body } = await callRaw("POST", "/api/publish", {
    slug: "nueva-app",
    html: APP_HTML,
  });

  assert.equal(status, 200);
  assert.equal(body.slug, "nueva-app");
  assert.equal(puts.length, 1);
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function callRaw(method, path, body) {
  const url = new URL(workerUrl);
  url.searchParams.set("t", `${process.pid}-${puts.length}-${Math.random()}`);
  const { default: worker } = await import(url.href);

  const response = await worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  return { status: response.status, body: await response.json() };
}

async function call(method, path, body) {
  const { status, body: parsed } = await callRaw(method, path, body);
  assert.equal(status, 200, JSON.stringify(parsed));
  return parsed;
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (part) => chunks.push(part));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

test("a transient GitHub 503 is retried instead of failing the publish", options, async () => {
  existing.clear();
  puts.length = 0;
  // Fail the first PUT the way GitHub did in production, then behave normally.
  failNextPuts = 1;

  const { status, body } = await callRaw("POST", "/api/publish", {
    slug: "nueva-app",
    html: APP_HTML,
  });

  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.slug, "nueva-app");
  assert.equal(puts.length, 2, "expected one failed attempt and one that landed");
});

test("a persistent outage explains itself instead of looking like a bug", options, async () => {
  existing.clear();
  puts.length = 0;
  failNextPuts = 99;

  const { status, body } = await callRaw("POST", "/api/publish", {
    slug: "otra-app",
    html: APP_HTML,
  });

  failNextPuts = 0;
  assert.equal(status, 502);
  assert.equal(body.success, false);
  assert.match(body.error, /vuelve a pulsar Publish/i);
  assert.equal(puts.length, 3, "expected the configured number of attempts");
});
