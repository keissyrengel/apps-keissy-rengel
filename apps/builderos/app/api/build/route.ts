import type { BuildStreamEvent } from "@/lib/builder/types";
import { createRuntime } from "@/lib/runtime/runtime-manager";

const encoder = new TextEncoder();

function encode(event: BuildStreamEvent) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  let prompt = "";
  try {
    const body = await request.json() as { prompt?: string };
    prompt = body.prompt?.trim() ?? "";
  } catch {
    return streamResult({ success: false, changes: [], error: "Invalid build request." }, 400);
  }

  if (!prompt) return streamResult({ success: false, changes: [], error: "Enter a build instruction." }, 400);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const runtime = await createRuntime();
        const result = await runtime.build(prompt, (event) => {
          controller.enqueue(encode({ type: "status", ...event }));
        });
        controller.enqueue(encode({ type: "result", result }));
      } catch (error) {
        controller.enqueue(encode({
          type: "result",
          result: {
            success: false,
            changes: [],
            error: error instanceof Error ? error.message : "Build failed.",
          },
        }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: streamHeaders() });
}

function streamResult(result: Extract<BuildStreamEvent, { type: "result" }>["result"], status: number) {
  return new Response(encode({ type: "result", result }), { status, headers: streamHeaders() });
}

function streamHeaders() {
  return {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Content-Type-Options": "nosniff",
  };
}
