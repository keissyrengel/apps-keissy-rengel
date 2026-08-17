import type { Attachment, Brand } from "../builder/types";

/**
 * Placeholder the model writes instead of the real logo. The logo can be a
 * few hundred kilobytes of base64; sending that to the model would cost a
 * fortune in tokens and invite transcription errors, so the bytes are spliced
 * in after generation and only this short token travels through the prompt.
 */
export const LOGO_PLACEHOLDER = "{{LOGO_SRC}}";

export const MAX_ATTACHMENTS = 6;
export const MAX_TEXT_ATTACHMENT_CHARS = 20_000;
/** Roughly 1.5 MB of base64, comfortably above a downscaled screenshot. */
export const MAX_IMAGE_DATA_URL_CHARS = 2_000_000;
export const MAX_LOGO_DATA_URL_CHARS = 600_000;

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

export function isUsableLogo(dataUrl: string | undefined): dataUrl is string {
  return (
    typeof dataUrl === "string" &&
    dataUrl.length <= MAX_LOGO_DATA_URL_CHARS &&
    IMAGE_DATA_URL.test(dataUrl)
  );
}

/** Drops anything malformed or oversized rather than failing the whole build. */
export function sanitizeBrand(brand: Brand | undefined): Brand {
  if (!brand) return {};
  return {
    name: trim(brand.name, 80),
    logoDataUrl: isUsableLogo(brand.logoDataUrl) ? brand.logoDataUrl : undefined,
    primaryColor: HEX_COLOR.test(brand.primaryColor ?? "") ? brand.primaryColor : undefined,
    accentColor: HEX_COLOR.test(brand.accentColor ?? "") ? brand.accentColor : undefined,
    fontFamily: trim(brand.fontFamily, 60),
  };
}

export function sanitizeAttachments(attachments: Attachment[] | undefined): Attachment[] {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .flatMap((attachment): Attachment[] => {
      const name = trim(attachment?.name, 120) ?? "archivo";

      if (attachment?.kind === "image") {
        if (
          typeof attachment.dataUrl !== "string" ||
          attachment.dataUrl.length > MAX_IMAGE_DATA_URL_CHARS ||
          !IMAGE_DATA_URL.test(attachment.dataUrl)
        ) {
          return [];
        }
        return [{ kind: "image", name, dataUrl: attachment.dataUrl }];
      }

      if (attachment?.kind === "text") {
        const content = typeof attachment.content === "string" ? attachment.content.trim() : "";
        if (!content) return [];
        return [{ kind: "text", name, content: content.slice(0, MAX_TEXT_ATTACHMENT_CHARS) }];
      }

      return [];
    })
    .slice(0, MAX_ATTACHMENTS);
}

/**
 * Turns the brand into instructions the model can act on. Kept as prose rather
 * than a rigid schema because the model designs better when it understands what
 * the colours are *for* than when it is handed a palette with no roles.
 */
export function describeBrand(brand: Brand): string {
  const lines: string[] = [];

  if (brand.name) {
    lines.push(`- The app belongs to "${brand.name}". Use that name in the header and the <title> context, but keep the <title> the name of the app itself.`);
  }
  if (brand.primaryColor) {
    lines.push(`- Primary brand colour: ${brand.primaryColor}. Use it for the main surfaces, headers and primary buttons.`);
  }
  if (brand.accentColor) {
    lines.push(`- Accent colour: ${brand.accentColor}. Use it sparingly, for highlights, active states and key figures.`);
  }
  if (brand.primaryColor || brand.accentColor) {
    lines.push("- Build the rest of the palette around those colours: derive tints and shades from them rather than introducing unrelated hues, and keep text contrast at WCAG AA or better.");
  }
  if (brand.fontFamily) {
    lines.push(`- Typography: ${brand.fontFamily}. Load it from Google Fonts if it is not a system font, and fall back to system sans-serif.`);
  }
  if (brand.logoDataUrl) {
    lines.push(`- A logo is available. Place it in the header with \`<img src="${LOGO_PLACEHOLDER}" alt="${brand.name ?? "Logo"}">\`, sized around 32-40px tall. Write the placeholder exactly as shown — it is replaced with the real image afterwards. Do not invent any other logo, wordmark or icon in its place.`);
  }

  if (lines.length === 0) return "";

  return `\n\nBrand requirements — these override the default styling:\n${lines.join("\n")}`;
}

/** Reference material is described so the model knows how to treat each item. */
export function describeAttachments(attachments: Attachment[]): string {
  const texts = attachments.filter((item) => item.kind === "text");
  const images = attachments.filter((item) => item.kind === "image");
  const sections: string[] = [];

  if (images.length > 0) {
    sections.push(
      `The user attached ${images.length} image(s): ${images.map((item) => item.name).join(", ")}. Treat them as visual reference for layout, style and brand feel — match the look, do not copy any text verbatim unless it is clearly the client's own copy.`,
    );
  }

  if (texts.length > 0) {
    const blocks = texts
      .map((item) => `--- ${item.name} ---\n${item.content}`)
      .join("\n\n");
    sections.push(
      `The user attached reference content. Use these real names, figures and wording instead of inventing placeholder data:\n\n${blocks}`,
    );
  }

  return sections.length > 0 ? `\n\n${sections.join("\n\n")}` : "";
}

function trim(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : undefined;
}
