export type BuilderStatus =
  | "Planning"
  | "Writing code"
  | "Rendering preview"
  | "Preview ready"
  | "Publishing"
  | "Published";

/** Visual identity applied to a generated app. Every field is optional. */
export interface Brand {
  name?: string;
  /** Logo as a `data:` URL so the published app stays a single self-contained file. */
  logoDataUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

/**
 * Extra material the model should look at: reference screenshots, pages of a
 * brand book, or real copy and data so the app is not filled with invented
 * content. PDFs are rasterised in the browser, so they arrive here as images.
 */
export type Attachment =
  | { kind: "image"; name: string; dataUrl: string }
  | { kind: "text"; name: string; content: string };

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
