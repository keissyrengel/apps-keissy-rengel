import type { BuilderConfig } from "../env";
import type { PublishedApp, PublishMode, PublishResult } from "../builder/types";

const USER_AGENT = "BuilderOS";
/**
 * GitHub's contents API occasionally answers 503 "No server is currently
 * available to service your request" and asks the caller to resubmit. Left
 * unhandled that surfaces as a failed publish for something that heals itself
 * in a second, so transient failures are retried here instead of by the user.
 */
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 600;

function isTransient(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Retries transient failures with a widening delay; other responses pass straight through. */
async function githubFetch(
  url: string,
  init: RequestInit,
  onRetry?: (attempt: number) => Promise<RequestInit> | RequestInit,
): Promise<Response> {
  let request = init;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await wait(RETRY_BASE_DELAY_MS * 2 ** (attempt - 2));
      if (onRetry) request = await onRetry(attempt);
    }

    lastResponse = await fetch(url, request);
    if (!isTransient(lastResponse.status)) return lastResponse;
  }

  return lastResponse as Response;
}
/** Bound on the `slug-2`, `slug-3`… search so a pathological repo cannot spin. */
const MAX_COPY_SUFFIX = 50;

interface PublishOptions {
  slug: string;
  html: string;
  prompt: string;
  mode?: PublishMode;
  config: BuilderConfig;
}

/**
 * Commits the generated app to `<publishDirectory>/<slug>/index.html` on the
 * configured branch. GitHub Pages serves that path, so the app is live a few
 * seconds after the commit lands.
 *
 * Overwriting is never implicit: if the target exists and the caller did not
 * say what to do, this reports a conflict and writes nothing.
 */
export async function publishApp({
  slug,
  html,
  prompt,
  mode,
  config,
}: PublishOptions): Promise<PublishResult> {
  if (!config.githubToken) {
    return {
      success: false,
      error:
        "GITHUB_TOKEN is not configured. Add it as a Worker secret with `npx wrangler secret put GITHUB_TOKEN`.",
    };
  }

  let targetSlug = slug;
  let existingSha = await readSha(pathFor(config, targetSlug), config);

  if (existingSha && !mode) {
    return { success: false, conflict: true, slug: targetSlug };
  }

  if (existingSha && mode === "copy") {
    const free = await findFreeSlug(slug, config);
    if (!free) {
      return { success: false, error: `Ya existen demasiadas copias de "${slug}".` };
    }
    targetSlug = free;
    existingSha = undefined;
  }

  const path = pathFor(config, targetSlug);
  const requestBody = (sha: string | undefined) =>
    JSON.stringify({
      message: `Publish ${targetSlug} from BuilderOS\n\nPrompt: ${prompt.slice(0, 500)}`,
      content: toBase64(html),
      branch: config.githubBranch,
      ...(sha ? { sha } : {}),
    });

  const response = await githubFetch(
    endpointFor(config, path),
    { method: "PUT", headers: githubHeaders(config), body: requestBody(existingSha) },
    // A retry re-reads the sha first: if the failed attempt actually landed,
    // the stale sha would make GitHub reject the retry as a conflict.
    async () => ({
      method: "PUT",
      headers: githubHeaders(config),
      body: requestBody(await readSha(path, config)),
    }),
  );

  if (!response.ok) {
    return { success: false, error: await describeGithubError(response) };
  }

  const body = (await response.json()) as { commit?: { html_url?: string } };

  return {
    success: true,
    slug: targetSlug,
    url: publicUrlFor(config, targetSlug),
    commitUrl: body.commit?.html_url,
  };
}

/** Every app already published, newest-first ordering left to the caller. */
export async function listPublishedApps(config: BuilderConfig): Promise<PublishedApp[]> {
  const slugs = await readPublishedSlugs(config);
  return slugs.map((slug) => ({ slug, url: publicUrlFor(config, slug) }));
}

/** Reads a published app back so it can be reopened and edited. */
export async function readPublishedApp(
  config: BuilderConfig,
  slug: string,
): Promise<string | null> {
  const response = await githubFetch(
    `${endpointFor(config, pathFor(config, slug))}?ref=${encodeURIComponent(config.githubBranch)}`,
    { headers: { ...githubHeaders(config), Accept: "application/vnd.github.raw+json" } },
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await describeGithubError(response));
  return response.text();
}

async function readPublishedSlugs(config: BuilderConfig): Promise<string[]> {
  const directory = config.publishDirectory.replace(/^\/+|\/+$/g, "");
  const response = await githubFetch(
    `${endpointFor(config, directory)}?ref=${encodeURIComponent(config.githubBranch)}`,
    { headers: githubHeaders(config) },
  );

  // An empty publish directory simply has no apps yet.
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(await describeGithubError(response));

  const entries = (await response.json()) as Array<{ name?: string; type?: string }>;
  if (!Array.isArray(entries)) return [];

  return entries
    .filter((entry) => entry.type === "dir" && typeof entry.name === "string")
    .map((entry) => entry.name as string)
    .sort((left, right) => left.localeCompare(right));
}

async function findFreeSlug(slug: string, config: BuilderConfig): Promise<string | null> {
  const taken = new Set(await readPublishedSlugs(config));
  for (let suffix = 2; suffix <= MAX_COPY_SUFFIX; suffix += 1) {
    const candidate = `${slug}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

async function readSha(path: string, config: BuilderConfig): Promise<string | undefined> {
  const response = await githubFetch(
    `${endpointFor(config, path)}?ref=${encodeURIComponent(config.githubBranch)}`,
    { headers: githubHeaders(config) },
  );
  if (!response.ok) return undefined;
  const body = (await response.json()) as { sha?: string };
  return body.sha;
}

function pathFor(config: BuilderConfig, slug: string): string {
  return `${config.publishDirectory.replace(/^\/+|\/+$/g, "")}/${slug}/index.html`;
}

function endpointFor(config: BuilderConfig, path: string): string {
  const api = config.githubApiUrl.replace(/\/+$/, "");
  return `${api}/repos/${config.githubOwner}/${config.githubRepo}/contents/${path}`;
}

function publicUrlFor(config: BuilderConfig, slug: string): string {
  const base = config.publicBaseUrl.replace(/\/+$/, "");
  const directory = config.publishDirectory.replace(/^\/+|\/+$/g, "");
  return `${base}/${directory}/${slug}/`;
}

function githubHeaders(config: BuilderConfig): Record<string, string> {
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
  if (isTransient(response.status)) {
    return `GitHub no está respondiendo ahora mismo (${response.status}). Lo reintenté varias veces. Tu app está a salvo: espera un momento y vuelve a pulsar Publish. ${detail}`.trim();
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
