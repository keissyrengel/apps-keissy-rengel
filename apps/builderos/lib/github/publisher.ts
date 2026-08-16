import type { BuilderConfig } from "../env";
import type { PublishResult } from "../builder/types";

const USER_AGENT = "BuilderOS";

interface PublishOptions {
  slug: string;
  html: string;
  prompt: string;
  config: BuilderConfig;
}

/**
 * Commits the generated app to `<publishDirectory>/<slug>/index.html` on the
 * configured branch. GitHub Pages serves that path, so the app is live a few
 * seconds after the commit lands.
 */
export async function publishApp({
  slug,
  html,
  prompt,
  config,
}: PublishOptions): Promise<PublishResult> {
  if (!config.githubToken) {
    return {
      success: false,
      error:
        "GITHUB_TOKEN is not configured. Add it as a Worker secret with `npx wrangler secret put GITHUB_TOKEN`.",
    };
  }

  const path = `${config.publishDirectory}/${slug}/index.html`;
  const api = config.githubApiUrl.replace(/\/+$/, "");
  const endpoint = `${api}/repos/${config.githubOwner}/${config.githubRepo}/contents/${path}`;

  const existingSha = await readExistingSha(endpoint, config);

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: githubHeaders(config),
    body: JSON.stringify({
      message: `Publish ${slug} from BuilderOS\n\nPrompt: ${prompt.slice(0, 500)}`,
      content: toBase64(html),
      branch: config.githubBranch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  if (!response.ok) {
    return { success: false, error: await describeGithubError(response) };
  }

  const body = (await response.json()) as { commit?: { html_url?: string } };

  return {
    success: true,
    url: `${config.publicBaseUrl.replace(/\/+$/, "")}/${path.replace(/\/index\.html$/, "")}/`,
    commitUrl: body.commit?.html_url,
  };
}

async function readExistingSha(
  endpoint: string,
  config: BuilderConfig,
): Promise<string | undefined> {
  const url = `${endpoint}?ref=${encodeURIComponent(config.githubBranch)}`;
  const response = await fetch(url, { headers: githubHeaders(config) });
  if (!response.ok) return undefined;
  const body = (await response.json()) as { sha?: string };
  return body.sha;
}

function githubHeaders(config: BuilderConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.githubToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };
}

async function describeGithubError(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "");
  let detail = raw.slice(0, 300);
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed.message) detail = parsed.message;
  } catch {
    // Non-JSON error bodies are used verbatim.
  }
  if (response.status === 401 || response.status === 403) {
    return `GitHub rejected the token (${response.status}). It needs "Contents: read and write" permission on the repository. ${detail}`;
  }
  if (response.status === 404) {
    return `GitHub returned 404. Check GITHUB_OWNER, GITHUB_REPO and GITHUB_BRANCH, and that the token can see the repository. ${detail}`;
  }
  return `GitHub returned HTTP ${response.status}. ${detail}`.trim();
}

/** Base64-encodes UTF-8 text in fixed chunks so large documents cannot overflow the call stack. */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const CHUNK = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}
