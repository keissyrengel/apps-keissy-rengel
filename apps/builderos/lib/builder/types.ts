export type BuilderStatus =
  | "Planning"
  | "Writing code"
  | "Rendering preview"
  | "Preview ready"
  | "Publishing"
  | "Published";

export interface GeneratedApp {
  /** Human readable name, taken from the document <title>. */
  name: string;
  /** URL-safe folder name used when publishing to GitHub Pages. */
  slug: string;
  /** Complete, self-contained HTML document. */
  html: string;
}

export interface GenerateResult {
  success: boolean;
  error?: string;
  message?: string;
  app?: GeneratedApp;
}

export interface PublishResult {
  success: boolean;
  error?: string;
  url?: string;
  commitUrl?: string;
}

export type BuildStreamEvent =
  | { type: "status"; status: BuilderStatus; detail?: string }
  | { type: "result"; result: GenerateResult };
