import type { BuilderConfig } from "../env";

/**
 * The agency credit that every generated app carries.
 *
 * This is applied after generation rather than asked for in the prompt. A model
 * asked to include a footer will sometimes reword it, restyle it, or quietly
 * drop it on the next edit; appending it here means it is byte-identical in
 * every app and survives every iteration.
 */

const MARKER = "data-builderos-credit";
/** Any previous credit is removed before the canonical one is appended. */
const EXISTING_CREDIT = new RegExp(`<footer[^>]*${MARKER}[^>]*>[\\s\\S]*?</footer>`, "gi");

export function applyCredit(html: string, config: BuilderConfig): string {
  const text = config.creditText.trim();
  const linkText = config.creditLinkText.trim();
  const url = config.creditUrl.trim();

  const cleaned = html.replace(EXISTING_CREDIT, "");
  if (!text && !linkText) return cleaned;

  const footer = renderCredit(text, linkText, url);
  const closingBody = cleaned.toLowerCase().lastIndexOf("</body>");
  if (closingBody !== -1) {
    return `${cleaned.slice(0, closingBody)}${footer}\n${cleaned.slice(closingBody)}`;
  }

  const closingHtml = cleaned.toLowerCase().lastIndexOf("</html>");
  if (closingHtml !== -1) {
    return `${cleaned.slice(0, closingHtml)}${footer}\n${cleaned.slice(closingHtml)}`;
  }

  return `${cleaned}\n${footer}`;
}

function renderCredit(text: string, linkText: string, url: string): string {
  // Colours are deliberately relative: a grey border and inherited text colour
  // read correctly whether the generated app is light or dark, without the
  // credit having to know anything about the app's palette.
  const style = [
    "margin-top:48px",
    "padding:20px 16px",
    "border-top:1px solid rgba(128,128,128,0.25)",
    "text-align:center",
    "font:400 13px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif",
    "color:inherit",
    "opacity:0.72",
  ].join(";");

  const linkStyle = [
    "color:inherit",
    "font-weight:600",
    "text-decoration:underline",
    "text-underline-offset:2px",
  ].join(";");

  const label = escapeHtml(linkText);
  const anchor = isSafeUrl(url)
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${label}</a>`
    : label;

  const body = [escapeHtml(text), anchor].filter(Boolean).join(" ");
  return `<footer ${MARKER} style="${style}">${body}</footer>`;
}

/** Only http(s) links are rendered; anything else degrades to plain text. */
function isSafeUrl(url: string): boolean {
  return /^https?:\/\/[^\s"'<>]+$/i.test(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
