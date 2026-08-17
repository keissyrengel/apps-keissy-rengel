import type { BuilderConfig } from "../env";
import type { Attachment, Brand, GeneratedApp } from "../builder/types";
import {
  LOGO_PLACEHOLDER,
  describeAttachments,
  describeBrand,
  sanitizeAttachments,
  sanitizeBrand,
} from "./brand-brief.ts";

const SYSTEM_PROMPT = `You are BuilderOS, an expert front-end engineer who ships complete, production-quality web apps in a single file.

Output contract — follow it exactly:
- Return ONE complete HTML5 document and nothing else.
- No markdown code fences, no commentary before or after the document.
- The document must start with <!DOCTYPE html> and end with </html>.

Technical rules:
- Everything is self-contained: all CSS inside one <style> tag, all JavaScript inside one <script> tag.
- No build step, no bundler, no imports of local files.
- You may load libraries from https://cdn.jsdelivr.net or https://cdnjs.cloudflare.com via <script src> or <link rel="stylesheet">. Prefer vanilla JS when a library is not clearly needed.
- Persist user data with localStorage when the app should remember state between visits. Seed it with a few realistic example records on first run so the app never looks empty.
- The app must be fully functional client-side. No backend, no API keys, no server calls.

Design rules:
- Modern, confident visual design. Real spacing, real typography, a coherent colour palette.
- Fully responsive from 360px to desktop.
- Accessible: semantic HTML, labelled form controls, visible focus states, sufficient contrast.
- Include a <title> that is the plain human name of the app — this becomes its published name, so keep it short and free of taglines.
- Write all user-facing copy in the same language as the user's request.`;

const EDIT_PROMPT = `The user wants to change the app below. Apply the requested change and return the COMPLETE updated HTML document, following the same output contract. Preserve everything the user did not ask you to change.`;

export interface GenerateOptions {
  prompt: string;
  previousHtml?: string;
  brand?: Brand;
  attachments?: Attachment[];
  config: BuilderConfig;
  signal?: AbortSignal;
  /** Called as the model streams, with the number of characters produced so far. */
  onProgress?: (characters: number) => void;
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type Message = { role: "system" | "user"; content: string | ContentPart[] };

export async function generateApp({
  prompt,
  previousHtml,
  brand: rawBrand,
  attachments: rawAttachments,
  config,
  signal,
  onProgress,
}: GenerateOptions): Promise<GeneratedApp> {
  if (!config.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it as a Worker secret with `npx wrangler secret put OPENAI_API_KEY`.",
    );
  }

  const brand = sanitizeBrand(rawBrand);
  const attachments = sanitizeAttachments(rawAttachments);

  const messages: Message[] = [
    { role: "system", content: `${SYSTEM_PROMPT}${describeBrand(brand)}` },
  ];

  const instruction = previousHtml
    ? `${EDIT_PROMPT}\n\nRequested change:\n${prompt}\n\nCurrent app:\n${previousHtml}`
    : prompt;

  const text = `${instruction}${describeAttachments(attachments)}`;
  const parts: ContentPart[] = [{ type: "text", text }];
  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: attachment.dataUrl } });
    }
  }

  // A plain string keeps the request identical to the pre-attachment shape for
  // the common case, which matters for providers that only accept parts when
  // an image is actually present.
  messages.push({ role: "user", content: parts.length === 1 ? text : parts });

  const endpoint = `${config.openaiBaseUrl.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(await describeOpenAiError(response));
  }

  const generated = extractHtmlDocument(await readStream(response.body, onProgress));
  const html = applyLogo(generated, brand.logoDataUrl);
  const name = readTitle(html) ?? "Untitled app";

  return { name, slug: slugify(name), html };
}

/**
 * Splices the real logo into the document. When there is no logo the
 * placeholder is stripped along with its `<img>` tag, so a model that used it
 * anyway cannot leave a broken image in the published app.
 */
export function applyLogo(html: string, logoDataUrl: string | undefined): string {
  if (!html.includes(LOGO_PLACEHOLDER)) return html;
  if (logoDataUrl) return html.split(LOGO_PLACEHOLDER).join(logoDataUrl);

  const placeholder = LOGO_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html
    .replace(new RegExp(`<img[^>]*src=["']${placeholder}["'][^>]*>`, "gi"), "")
    .split(LOGO_PLACEHOLDER)
    .join("");
}

async function describeOpenAiError(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "");
  let detail = raw.slice(0, 400);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message) detail = parsed.error.message;
  } catch {
    // Non-JSON error bodies are used verbatim.
  }
  if (response.status === 401) {
    return "OpenAI rejected the API key (401). Check the OPENAI_API_KEY secret.";
  }
  if (response.status === 429) {
    return "OpenAI rate limit or quota reached (429). Check your billing and usage limits.";
  }
  return `OpenAI returned HTTP ${response.status}. ${detail}`.trim();
}

/** Reads an OpenAI SSE stream and concatenates the assistant's text deltas. */
async function readStream(
  body: ReadableStream<Uint8Array>,
  onProgress?: (characters: number) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null } }>;
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          output += delta;
          onProgress?.(output.length);
        }
      } catch {
        // Partial or keep-alive frames are ignored.
      }
    }

    if (done) break;
  }

  if (!output.trim()) throw new Error("OpenAI returned an empty response.");
  return output;
}

/**
 * Models occasionally wrap the document in a markdown fence or add a sentence
 * of preamble despite the output contract, so the document is extracted rather
 * than trusted verbatim.
 */
export function extractHtmlDocument(raw: string): string {
  const fenced = raw.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();

  const start = candidate.search(/<!DOCTYPE html>|<html[\s>]/i);
  if (start === -1) {
    throw new Error("The model did not return a complete HTML document.");
  }

  const end = candidate.toLowerCase().lastIndexOf("</html>");
  if (end === -1) {
    throw new Error("The generated HTML document was truncated before </html>.");
  }

  return candidate.slice(start, end + "</html>".length).trim();
}

export function readTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const title = match[1].replace(/\s+/g, " ").trim();
  return title.length > 0 ? title : null;
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return slug || "app";
}
