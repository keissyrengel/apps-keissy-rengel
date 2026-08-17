"use client";

import { ChangeEvent, useRef, useState } from "react";
import { ChevronDown, ImagePlus, LoaderCircle, Palette, Paperclip, X } from "lucide-react";

import { WorkspacePanel } from "@/components/builder/brand-ui";
import { readAttachment, readLogo } from "@/lib/client/asset-intake";
import type { Attachment, Brand } from "@/lib/builder/types";

const FONTS = [
  { label: "Por defecto", value: "" },
  { label: "Inter", value: "Inter" },
  { label: "Poppins", value: "Poppins" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "DM Sans", value: "DM Sans" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "Space Grotesk", value: "Space Grotesk" },
];

const MAX_ATTACHMENTS = 6;

interface BrandPanelProps {
  brand: Brand;
  onBrandChange: (brand: Brand) => void;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  disabled: boolean;
}

export function BrandPanel({
  brand,
  onBrandChange,
  attachments,
  onAttachmentsChange,
  disabled,
}: BrandPanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const configured =
    Boolean(brand.logoDataUrl) ||
    Boolean(brand.primaryColor) ||
    Boolean(brand.name) ||
    attachments.length > 0;

  async function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      onBrandChange({ ...brand, logoDataUrl: await readLogo(file) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el logo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    const collected: Attachment[] = [];
    const failures: string[] = [];

    for (const file of files) {
      try {
        collected.push(...(await readAttachment(file)));
      } catch (cause) {
        failures.push(cause instanceof Error ? cause.message : file.name);
      }
    }

    const merged = [...attachments, ...collected];
    if (merged.length > MAX_ATTACHMENTS) {
      failures.push(`Solo se envían los primeros ${MAX_ATTACHMENTS} adjuntos.`);
    }
    onAttachmentsChange(merged.slice(0, MAX_ATTACHMENTS));
    setError(failures.length > 0 ? failures.join(" ") : null);
    setBusy(false);
  }

  return (
    <WorkspacePanel className="mb-2 overflow-hidden bg-night/45">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-acid"
      >
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-copy">
          <Palette className="size-3.5 text-electric" />
          Marca y referencias
          {configured && (
            <span className="rounded-full bg-acid/15 px-1.5 py-0.5 font-mono text-[9px] text-acid">
              activa
            </span>
          )}
        </span>
        <ChevronDown className={`size-3.5 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-brand-border-subtle px-3 py-3">
          <div>
            <label
              htmlFor="brand-name"
              className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted"
            >
              Nombre del negocio
            </label>
            <input
              id="brand-name"
              type="text"
              value={brand.name ?? ""}
              disabled={disabled}
              onChange={(event) => onBrandChange({ ...brand, name: event.target.value })}
              placeholder="Konvertis Agency"
              className="w-full rounded-lg border border-brand-border bg-night/60 px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-muted focus:border-acid/50"
            />
          </div>

          <div>
            <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
              Logo
            </span>
            <div className="flex items-center gap-2">
              {brand.logoDataUrl ? (
                <span className="flex items-center gap-2 rounded-lg border border-brand-border bg-white/90 px-2 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={brand.logoDataUrl} alt="Logo cargado" className="h-6 w-auto max-w-24 object-contain" />
                  <button
                    type="button"
                    onClick={() => onBrandChange({ ...brand, logoDataUrl: undefined })}
                    aria-label="Quitar logo"
                    className="text-night/60 transition hover:text-night"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => logoInput.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-brand-border px-2.5 py-1.5 text-[11px] text-copy transition hover:border-acid/50 hover:text-ink disabled:opacity-40"
                >
                  <ImagePlus className="size-3.5" />
                  Subir logo
                </button>
              )}
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                onChange={handleLogo}
                className="hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ColorField
              id="brand-primary"
              label="Color principal"
              value={brand.primaryColor}
              disabled={disabled}
              onChange={(primaryColor) => onBrandChange({ ...brand, primaryColor })}
            />
            <ColorField
              id="brand-accent"
              label="Color de acento"
              value={brand.accentColor}
              disabled={disabled}
              onChange={(accentColor) => onBrandChange({ ...brand, accentColor })}
            />
          </div>

          <div>
            <label
              htmlFor="brand-font"
              className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted"
            >
              Tipografía
            </label>
            <select
              id="brand-font"
              value={brand.fontFamily ?? ""}
              disabled={disabled}
              onChange={(event) =>
                onBrandChange({ ...brand, fontFamily: event.target.value || undefined })
              }
              className="w-full rounded-lg border border-brand-border bg-night/60 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-acid/50"
            >
              {FONTS.map((font) => (
                <option key={font.label} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
              Referencias · capturas, PDF, textos
            </span>
            <button
              type="button"
              disabled={disabled || busy || attachments.length >= MAX_ATTACHMENTS}
              onClick={() => fileInput.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-border px-2.5 py-2 text-[11px] text-copy transition hover:border-acid/50 hover:text-ink disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Paperclip className="size-3.5" />
              )}
              {busy ? "Procesando…" : "Añadir archivos"}
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,application/pdf,.txt,.md,.csv,.tsv,.json"
              onChange={handleFiles}
              className="hidden"
            />

            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachments.map((attachment, index) => (
                  <li
                    key={`${attachment.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-brand-border-subtle bg-night/40 px-2 py-1"
                  >
                    <span className="truncate font-mono text-[9px] text-copy/80">
                      {attachment.kind === "image" ? "🖼" : "📄"} {attachment.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Quitar ${attachment.name}`}
                      onClick={() =>
                        onAttachmentsChange(attachments.filter((_, item) => item !== index))
                      }
                      className="shrink-0 text-muted transition hover:text-neon"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[10px] leading-4 text-muted">
            Las imágenes se reducen en tu navegador antes de enviarse, y los PDF se convierten en
            imágenes de página. El logo se incrusta en la app publicada, así que sigue siendo un
            único archivo.
          </p>

          {error && <p className="text-[10px] leading-4 text-neon">{error}</p>}
        </div>
      )}
    </WorkspacePanel>
  );
}

function ColorField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  disabled: boolean;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted"
      >
        {label}
      </label>
      <div className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-night/60 px-2 py-1">
        <input
          id={id}
          type="color"
          value={value ?? "#111111"}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value ?? ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || undefined)}
          placeholder="sin definir"
          aria-label={`${label} en hexadecimal`}
          className="w-full bg-transparent font-mono text-[11px] text-ink outline-none placeholder:text-muted"
        />
        {value && (
          <button
            type="button"
            aria-label={`Quitar ${label}`}
            onClick={() => onChange(undefined)}
            className="shrink-0 text-muted transition hover:text-neon"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}
