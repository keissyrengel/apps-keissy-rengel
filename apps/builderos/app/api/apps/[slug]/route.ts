import { readTitle, slugify } from "@/lib/ai/app-generator.ts";
import { getConfig, isAuthorized } from "@/lib/env";
import { readPublishedApp } from "@/lib/github/publisher";

/** Reads one published app back so it can be reopened and edited. */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const config = getConfig();

  if (!isAuthorized(request, config)) {
    return json({ error: "Invalid access code." }, 401);
  }
  if (!config.githubToken) {
    return json({ error: "GITHUB_TOKEN is not configured." }, 503);
  }

  const { slug: rawSlug } = await context.params;
  // Re-slugifying is what keeps the path safe: no traversal, no stray segments.
  const slug = slugify(rawSlug ?? "");

  try {
    const html = await readPublishedApp(config, slug);
    if (html === null) return json({ error: "Esa app no existe en el repositorio." }, 404);

    return json({ app: { slug, name: readTitle(html) ?? slug, html } }, 200);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "No se pudo leer la app." },
      502,
    );
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
