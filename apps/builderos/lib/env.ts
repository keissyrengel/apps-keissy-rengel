/**
 * Runtime configuration.
 *
 * With `nodejs_compat` enabled, Cloudflare populates `process.env` from the
 * Worker's `vars` and secrets, so the same accessors work in `vite dev` and in
 * production without threading an `env` object through every call site.
 */

export interface BuilderConfig {
  openaiApiKey: string;
  openaiModel: string;
  openaiBaseUrl: string;
  githubToken: string;
  githubApiUrl: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  publishDirectory: string;
  publicBaseUrl: string;
  accessCode: string;
}

function read(name: string, fallback = ""): string {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function getConfig(): BuilderConfig {
  return {
    openaiApiKey: read("OPENAI_API_KEY"),
    openaiModel: read("OPENAI_MODEL", "gpt-5.6-terra"),
    openaiBaseUrl: read("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    githubToken: read("GITHUB_TOKEN"),
    githubApiUrl: read("GITHUB_API_URL", "https://api.github.com"),
    githubOwner: read("GITHUB_OWNER", "keissyrengel"),
    githubRepo: read("GITHUB_REPO", "apps-keissy-rengel"),
    githubBranch: read("GITHUB_BRANCH", "main"),
    publishDirectory: read("PUBLISH_DIRECTORY", "apps"),
    publicBaseUrl: read("PUBLIC_BASE_URL", "https://apps.keissyrengel.com"),
    accessCode: read("BUILDER_ACCESS_CODE"),
  };
}

export const ACCESS_HEADER = "x-builderos-key";

/**
 * Gates the expensive endpoints behind a shared code so a public URL cannot be
 * used as a free proxy to your OpenAI account. Leaving `BUILDER_ACCESS_CODE`
 * unset disables the gate, which is convenient for local development.
 */
export function isAuthorized(request: Request, config: BuilderConfig): boolean {
  if (!config.accessCode) return true;
  const provided = request.headers.get(ACCESS_HEADER) ?? "";
  return timingSafeEqual(provided, config.accessCode);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export function accessGateEnabled(config: BuilderConfig): boolean {
  return config.accessCode.length > 0;
}
