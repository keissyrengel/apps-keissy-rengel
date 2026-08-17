import { getConfig, isAuthorized } from "@/lib/env";
import { listPublishedApps } from "@/lib/github/publisher";

/** Lists the apps already published to the repository. */
export async function GET(request: Request) {
  const config = getConfig();

  if (!isAuthorized(request, config)) {
    return json({ error: "Invalid access code." }, 401);
  }
  if (!config.githubToken) {
    return json({ error: "GITHUB_TOKEN is not configured." }, 503);
  }

  try {
    return json({ apps: await listPublishedApps(config) }, 200);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "No se pudo leer el repositorio." },
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
