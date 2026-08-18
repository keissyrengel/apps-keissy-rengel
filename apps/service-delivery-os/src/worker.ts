interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
}

interface WorkspaceRow {
  data: string;
  revision: number;
  updated_at: string;
}

const WORKSPACE_ID = "default";
const COOKIE_NAME = "sdo_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const MAX_STATE_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();

function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signature(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return mismatch === 0;
}

async function createSession(secret: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const nonce = crypto.randomUUID();
  const payload = `${expires}.${nonce}`;
  return `${payload}.${await signature(payload, secret)}`;
}

async function hasValidSession(request: Request, secret: string): Promise<boolean> {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return false;
  const value = cookie.slice(COOKIE_NAME.length + 1);
  const parts = value.split(".");
  if (parts.length !== 3 || Number(parts[0]) < Math.floor(Date.now() / 1000)) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  return constantTimeEqual(parts[2], await signature(payload, secret));
}

function loginPage(error = false): Response {
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso | Service Delivery OS</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f3ea;color:#151515;font:16px/1.5 Arial,sans-serif}.box{width:min(430px,calc(100% - 32px));background:#fff;border:2px solid #151515;padding:32px;box-shadow:8px 8px 0 #e41e2b}h1{margin:0 0 8px;font-size:30px}p{margin:0 0 24px}label{display:block;font-weight:700;margin-bottom:7px}input{width:100%;padding:13px;border:2px solid #151515;font:inherit}button{width:100%;margin-top:14px;padding:13px;border:2px solid #151515;background:#e41e2b;color:#fff;font:700 15px Arial;cursor:pointer}.error{padding:10px;background:#ffd9dc;border:2px solid #e41e2b;margin-bottom:16px}</style></head><body><main class="box"><h1>Service Delivery OS</h1><p>Acceso privado de Konvertis.</p>${error ? '<div class="error">La contraseña no es correcta.</div>' : ""}<form method="post" action="./login"><label for="password">Contraseña</label><input id="password" name="password" type="password" required autofocus autocomplete="current-password"><button type="submit">Entrar</button></form></main></body></html>`, { status: error ? 401 : 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function appPath(pathname: string): string {
  const prefix = "/apps/service-delivery-os";
  if (pathname === prefix || pathname === `${prefix}/`) return "/";
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

async function handleApi(request: Request, env: Env, pathname: string): Promise<Response> {
  if (pathname !== "/api/state") return json({ error: "Not found" }, 404);

  if (request.method === "GET") {
    const row = await env.DB.prepare("SELECT data, revision, updated_at FROM workspace_state WHERE workspace_id = ?")
      .bind(WORKSPACE_ID).first<WorkspaceRow>();
    if (!row) return json({ initialized: false, revision: 0, data: null });
    return json({ initialized: true, revision: row.revision, updatedAt: row.updated_at, data: JSON.parse(row.data) });
  }

  if (request.method === "PUT") {
    const raw = await request.text();
    if (encoder.encode(raw).byteLength > MAX_STATE_BYTES) return json({ error: "State is too large" }, 413);
    let body: { data?: unknown; revision?: number };
    try { body = JSON.parse(raw) as { data?: unknown; revision?: number }; }
    catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) return json({ error: "Invalid state" }, 400);

    const current = await env.DB.prepare("SELECT revision FROM workspace_state WHERE workspace_id = ?").bind(WORKSPACE_ID).first<{ revision: number }>();
    if (current && body.revision !== current.revision) return json({ error: "Revision conflict", revision: current.revision }, 409);
    const nextRevision = (current?.revision ?? 0) + 1;
    await env.DB.prepare(`INSERT INTO workspace_state (workspace_id, data, revision, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(workspace_id) DO UPDATE SET data = excluded.data, revision = excluded.revision, updated_at = CURRENT_TIMESTAMP`)
      .bind(WORKSPACE_ID, JSON.stringify(body.data), nextRevision).run();
    return json({ initialized: true, revision: nextRevision });
  }

  return json({ error: "Method not allowed" }, 405, { allow: "GET, PUT" });
}

export default {
  async fetch(request, env): Promise<Response> {
    if (!env.APP_PASSWORD || !env.SESSION_SECRET) return new Response("Service Delivery OS is not configured.", { status: 503 });
    const url = new URL(request.url);
    const pathname = appPath(url.pathname);

    if (pathname === "/login" && request.method === "POST") {
      const form = await request.formData();
      const password = String(form.get("password") ?? "");
      if (!constantTimeEqual(password, env.APP_PASSWORD)) return loginPage(true);
      const session = await createSession(env.SESSION_SECRET);
      const destination = url.pathname.startsWith("/apps/service-delivery-os") ? "/apps/service-delivery-os/" : "/";
      return new Response(null, { status: 303, headers: { location: destination, "set-cookie": `${COOKIE_NAME}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}` } });
    }

    if (!(await hasValidSession(request, env.SESSION_SECRET))) {
      if (pathname.startsWith("/api/")) return json({ error: "Unauthorized" }, 401);
      return loginPage();
    }

    if (pathname.startsWith("/api/")) return handleApi(request, env, pathname);
    if (!new Set(["GET", "HEAD"]).has(request.method)) return new Response("Method not allowed", { status: 405 });

    const assetUrl = new URL(request.url);
    assetUrl.pathname = pathname === "/" ? "/index.html" : pathname;
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
} satisfies ExportedHandler<Env>;
