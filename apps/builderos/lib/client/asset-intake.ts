"use client";

import type { Attachment } from "@/lib/builder/types";

/**
 * Everything here runs in the browser, before anything is sent to the Worker.
 * Downscaling locally is what keeps the whole feature cheap: a 4 MB phone
 * screenshot becomes ~150 KB, which keeps requests small and, for images the
 * model actually looks at, keeps the vision bill down. It also means the logo
 * embedded in every published app stays small enough to load instantly.
 */

const LOGO_MAX_EDGE = 320;
const REFERENCE_MAX_EDGE = 1024;
const PDF_MAX_PAGES = 4;
const TEXT_MAX_CHARS = 20_000;
const PDFJS_VERSION = "6.2.108";

export const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".tsv", ".json"];

export function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/") || file.type === "application/json") return true;
  const name = file.name.toLowerCase();
  return TEXT_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/** SVG keeps its vector form; raster logos are downscaled and re-encoded. */
export async function readLogo(file: File): Promise<string> {
  if (file.type === "image/svg+xml") return readAsDataUrl(file);
  return downscaleToDataUrl(file, LOGO_MAX_EDGE);
}

export async function readAttachment(file: File): Promise<Attachment[]> {
  if (isTextFile(file)) {
    const content = (await file.text()).slice(0, TEXT_MAX_CHARS);
    return content.trim() ? [{ kind: "text", name: file.name, content }] : [];
  }

  if (isPdfFile(file)) {
    const pages = await rasterisePdf(file);
    return pages.map((dataUrl, index) => ({
      kind: "image",
      name: `${file.name} (p. ${index + 1})`,
      dataUrl,
    }));
  }

  if (file.type.startsWith("image/")) {
    const dataUrl =
      file.type === "image/svg+xml"
        ? await readAsDataUrl(file)
        : await downscaleToDataUrl(file, REFERENCE_MAX_EDGE);
    return [{ kind: "image", name: file.name, dataUrl }];
  }

  throw new Error(`No sé leer "${file.name}". Sube imágenes, PDF, o texto (.txt, .md, .csv).`);
}

async function downscaleToDataUrl(file: File, maxEdge: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no pudo procesar la imagen.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // WebP keeps transparency and is markedly smaller than PNG for photographs.
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`No se pudo leer "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

/**
 * The slice of pdf.js this file uses. Typed by hand so the library stays a
 * runtime-only CDN dependency: nothing to install, nothing in the bundle
 * unless someone actually drops a PDF in.
 */
interface PdfViewport {
  width: number;
  height: number;
}

interface PdfPage {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }): { promise: Promise<void> };
}

interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: { data: ArrayBuffer }): {
    promise: Promise<{ numPages: number; getPage(page: number): Promise<PdfPage> }>;
  };
}

/**
 * Brand books are usually designed pages rather than flowing text, so the
 * pages are rendered as images and handed to the model's vision instead of
 * running text extraction that would return little or nothing.
 */
async function rasterisePdf(file: File): Promise<string[]> {
  let pdfjs: PdfJs;
  try {
    pdfjs = (await import(
      /* @vite-ignore */ `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`
    )) as PdfJs;
  } catch {
    throw new Error(
      "No se pudo cargar el lector de PDF. Prueba a exportar las páginas como imagen y súbelas así.",
    );
  }

  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

  const document_ = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(document_.numPages, PDF_MAX_PAGES);
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document_.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, REFERENCE_MAX_EDGE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no pudo procesar el PDF.");

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push(canvas.toDataURL("image/webp", 0.8));
  }

  return pages;
}
