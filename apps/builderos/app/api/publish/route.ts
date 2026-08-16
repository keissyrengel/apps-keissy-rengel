import { slugify } from "@/lib/ai/app-generator";
import type { PublishResult } from "@/lib/builder/types";
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
  try {
    const body = (await request.json()) as {
      slug?: string;
      html?: string;
      prompt?: string;
    };
    slug = slugify(body.slug?.trim() ?? "");
    html = body.html ?? "";
    prompt = body.prompt?.trim() ?? "";
  } catch {
    return json({ success: false, error: "Invalid publish request." }, 400);
  }

  if (!html.trim()) {
    return json({ success: false, error: "There is no app to publish yet." }, 400);
  }

  try {
    const result = await publishApp({ slug, html, prompt, config });
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
