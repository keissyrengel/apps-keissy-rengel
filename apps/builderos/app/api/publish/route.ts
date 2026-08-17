import { slugify } from "@/lib/ai/app-generator";
import type { PublishMode, PublishResult } from "@/lib/builder/types";
import { getConfig, isAuthorized } from "@/lib/env";
import { publishApp } from "@/lib/github/publisher";

export async function POST(request: Request) {
  const config = getConfig();

  if (!isAuthorized(request, config)) {
    return json({ success: false, error: "Invalid access code." }, 401);
  }

  let slug = "";
  let html = "";
  let prompt = "";
  let mode: PublishMode | undefined;
  try {
    const body = (await request.json()) as {
      slug?: string;
      html?: string;
      prompt?: string;
      mode?: string;
    };
    slug = slugify(body.slug?.trim() ?? "");
    html = body.html ?? "";
    prompt = body.prompt?.trim() ?? "";
    mode = body.mode === "update" || body.mode === "copy" ? body.mode : undefined;
  } catch {
    return json({ success: false, error: "Invalid publish request." }, 400);
  }

  if (!html.trim()) {
    return json({ success: false, error: "There is no app to publish yet." }, 400);
  }

  try {
    const result = await publishApp({ slug, html, prompt, mode, config });
    // A conflict is a question for the user, not a failure: 409 lets the UI
    // ask whether to update the live app or publish a copy.
    if (result.conflict) return json(result, 409);
    return json(result, result.success ? 200 : 502);
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Publish failed.",
      },
      500,
    );
  }
}

function json(result: PublishResult, status: number) {
  return new Response(JSON.stringify(result), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
