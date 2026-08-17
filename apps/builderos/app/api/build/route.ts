import { generateApp } from "@/lib/ai/app-generator";
import type {
  Attachment,
  Brand,
  BuildStreamEvent,
  GenerateResult,
} from "@/lib/builder/types";
import { getConfig, isAuthorized } from "@/lib/env";

const encoder = new TextEncoder();
/** Cadence for progress pings; also keeps the ndjson connection warm. */
const PROGRESS_INTERVAL_MS = 1_500;

function encode(event: BuildStreamEvent) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  const config = getConfig();

  if (!isAuthorized(request, config)) {
    return immediate({ success: false, error: "Invalid access code." }, 401);
  }

  let prompt = "";
  let previousHtml: string | undefined;
  let brand: Brand | undefined;
  let attachments: Attachment[] | undefined;
  try {
    const body = (await request.json()) as {
      prompt?: string;
      previousHtml?: string;
      brand?: Brand;
      attachments?: Attachment[];
    };
    prompt = body.prompt?.trim() ?? "";
    previousHtml = body.previousHtml?.trim() || undefined;
    // Both are validated and clamped inside generateApp, so malformed or
    // oversized assets degrade to "no brand" instead of failing the build.
    brand = body.brand;
    attachments = body.attachments;
  } catch {
    return immediate({ success: false, error: "Invalid build request." }, 400);
  }

  if (!prompt) {
    return immediate({ success: false, error: "Enter a build instruction." }, 400);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: BuildStreamEvent) => {
        if (!closed) controller.enqueue(encode(event));
      };

      send({
        type: "status",
        status: "Planning",
        detail: previousHtml ? "Reading the current app" : "Designing the app",
      });

      let lastPing = 0;
      let characters = 0;

      try {
        const app = await generateApp({
          prompt,
          previousHtml,
          brand,
          attachments,
          config,
          onProgress: (count) => {
            characters = count;
            const now = Date.now();
            if (now - lastPing < PROGRESS_INTERVAL_MS) return;
            lastPing = now;
            send({
              type: "status",
              status: "Writing code",
              detail: `${Math.round(characters / 1000)}k characters written`,
            });
          },
        });

        send({ type: "status", status: "Rendering preview", detail: app.name });
        send({
          type: "result",
          result: {
            success: true,
            message: previousHtml
              ? `Updated “${app.name}”.`
              : `“${app.name}” is ready. Review the preview, then publish it.`,
            app,
          },
        });
      } catch (error) {
        send({
          type: "result",
          result: {
            success: false,
            error: error instanceof Error ? error.message : "Build failed.",
          },
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: streamHeaders() });
}

function immediate(result: GenerateResult, status: number) {
  return new Response(encode({ type: "result", result }), {
    status,
    headers: streamHeaders(),
  });
}

function streamHeaders() {
  return {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Content-Type-Options": "nosniff",
  };
}
