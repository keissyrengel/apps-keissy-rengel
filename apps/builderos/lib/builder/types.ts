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

/** How to resolve a publish that would overwrite an existing app. */
export type PublishMode = "update" | "copy";

export interface PublishResult {
  success: boolean;
  error?: string;
  url?: string;
  commitUrl?: string;
  /** The slug actually written — differs from the requested one in "copy" mode. */
  slug?: string;
  /**
   * Set when the target already exists and no mode was given. The UI asks the
   * user whether to update the live app or publish a copy.
   */
  conflict?: boolean;
}

/** An app already published to the repository. */
export interface PublishedApp {
  slug: string;
  url: string;
}

export type BuildStreamEvent =
  | { type: "status"; status: BuilderStatus; detail?: string }
  | { type: "result"; result: GenerateResult };
