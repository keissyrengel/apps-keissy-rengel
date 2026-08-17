"use client";

import { useState } from "react";
import {
  ChevronDown,
  CloudDownload,
  ExternalLink,
  FileClock,
  Globe,
  LoaderCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { WorkspacePanel } from "@/components/builder/brand-ui";
import type { Draft } from "@/lib/client/drafts";
import type { PublishedApp } from "@/lib/builder/types";

interface HistoryPanelProps {
  drafts: Draft[];
  onOpenDraft: (draft: Draft) => void;
  onDeleteDraft: (id: string) => void;
  onOpenPublished: (slug: string) => Promise<void>;
  loadPublished: () => Promise<PublishedApp[]>;
  busy: boolean;
  /** True while the access code is required but not yet entered. */
  locked: boolean;
}

export function HistoryPanel({
  drafts,
  onOpenDraft,
  onDeleteDraft,
  onOpenPublished,
  loadPublished,
  busy,
  locked,
}: HistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [published, setPublished] = useState<PublishedApp[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setPublished(await loadPublished());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el repositorio.");
    } finally {
      setLoading(false);
    }
  }

  // The published list costs a GitHub round trip, so it is fetched the first
  // time the panel is opened rather than on every page load — and never while
  // the workspace is still locked, which would only produce a 401.
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !locked && published === null && !loading) void refresh();
  }

  async function openPublished(slug: string) {
    setOpening(slug);
    setError(null);
    try {
      await onOpenPublished(slug);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir la app.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <WorkspacePanel className="mb-2 overflow-hidden bg-night/45">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-acid"
      >
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-copy">
          <FileClock className="size-3.5 text-electric" />
          Mis apps
          {drafts.length > 0 && (
            <span className="rounded-full bg-surface-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted">
              {drafts.length} sin publicar
            </span>
          )}
        </span>
        <ChevronDown className={`size-3.5 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="max-h-72 space-y-4 overflow-y-auto border-t border-brand-border-subtle px-3 py-3">
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                <Globe className="size-3" />
                Publicadas
              </h3>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading || locked}
                aria-label="Actualizar lista"
                className="text-muted transition hover:text-electric disabled:opacity-40"
              >
                <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {locked ? (
              <p className="text-[10px] leading-4 text-muted">
                Escribe tu código de acceso abajo para ver las apps que ya publicaste.
              </p>
            ) : loading && published === null ? (
              <p className="text-[10px] text-muted">Leyendo tu repositorio…</p>
            ) : published && published.length > 0 ? (
              <ul className="space-y-1">
                {published.map((app) => (
                  <li
                    key={app.slug}
                    className="flex items-center justify-between gap-2 rounded-md border border-brand-border-subtle bg-night/40 px-2 py-1.5"
                  >
                    <button
                      type="button"
                      disabled={busy || opening !== null}
                      onClick={() => void openPublished(app.slug)}
                      className="min-w-0 flex-1 text-left disabled:opacity-40"
                    >
                      <span className="block truncate text-[11px] text-ink">{prettify(app.slug)}</span>
                      <span className="block truncate font-mono text-[9px] text-muted">
                        /{app.slug}/
                      </span>
                    </button>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {opening === app.slug ? (
                        <LoaderCircle className="size-3.5 animate-spin text-electric" />
                      ) : (
                        <CloudDownload className="size-3.5 text-muted" aria-hidden />
                      )}
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir ${app.slug} en una pestaña nueva`}
                        className="text-muted transition hover:text-acid"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-muted">
                {published ? "Aún no has publicado ninguna app." : "Abre el panel para cargarlas."}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
              <FileClock className="size-3" />
              Borradores en este navegador
            </h3>
            {drafts.length === 0 ? (
              <p className="text-[10px] text-muted">
                Lo que generes se guarda aquí hasta que lo publiques.
              </p>
            ) : (
              <ul className="space-y-1">
                {drafts.map((draft) => (
                  <li
                    key={draft.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-brand-border-subtle bg-night/40 px-2 py-1.5"
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        onOpenDraft(draft);
                        setOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left disabled:opacity-40"
                    >
                      <span className="block truncate text-[11px] text-ink">{draft.name}</span>
                      <span className="block truncate font-mono text-[9px] text-muted">
                        {formatWhen(draft.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar ${draft.name}`}
                      onClick={() => onDeleteDraft(draft.id)}
                      className="shrink-0 text-muted transition hover:text-neon"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && <p className="text-[10px] leading-4 text-neon">{error}</p>}
        </div>
      )}
    </WorkspacePanel>
  );
}

function prettify(slug: string): string {
  const words = slug.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatWhen(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(timestamp).toLocaleDateString();
}
