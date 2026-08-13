import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import type { BuilderStatus, BuildStreamEvent } from "../lib/builder/types";
import { LocalRuntime } from "../lib/runtime/local-runtime";
import type { LocalBuilderEngine } from "../lib/runtime/types";

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as { prompt?: string };
}

function send(response: ServerResponse, event: BuildStreamEvent) {
  response.write(`${JSON.stringify(event)}\n`);
}

function status(response: ServerResponse, value: BuilderStatus, detail?: string) {
  send(response, { type: "status", status: value, detail });
}

export function localBuilder(selectedEngine?: LocalBuilderEngine): Plugin {
  const engine = selectedEngine ?? (process.env.BUILDER_ENGINE === "local" ? "local" : "codex");
  const runtimePromise = Promise.resolve(new LocalRuntime(engine));
  return {
    name: "builderos-engine",
    configureServer(server) {
      void runtimePromise.then((runtime) => runtime.start?.()).catch((error) => {
          server.config.logger.warn(`Builder runtime unavailable: ${error instanceof Error ? error.message : "startup failed"}`);
        });
      server.httpServer?.once("close", () => { void runtimePromise.then((runtime) => runtime.shutdown?.()); });
      server.middlewares.use("/api/build", async (request: IncomingMessage, response: ServerResponse) => {
        response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("X-Content-Type-Options", "nosniff");
        if (request.method !== "POST") {
          response.statusCode = 405;
          send(response, { type: "result", result: { success: false, error: "Method not allowed", changes: [] } });
          response.end();
          return;
        }
        try {
          const body = await readJson(request);
          const prompt = body.prompt?.trim() ?? "";
          if (!prompt) {
            response.statusCode = 400;
            send(response, { type: "result", result: { success: false, error: "Enter a build instruction.", changes: [] } });
            response.end();
            return;
          }
          const runtime = await runtimePromise;
          const result = await runtime.build(prompt, (event) => status(response, event.status, event.detail));
          send(response, { type: "result", result });
        } catch (error) {
          send(response, { type: "result", result: { success: false, changes: [], error: error instanceof Error ? error.message : "Build failed" } });
        } finally {
          response.end();
        }
      });
    },
  };
}
