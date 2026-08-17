"use client";

import { FormEvent, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  Code2,
  ExternalLink,
  Globe,
  LoaderCircle,
  Lock,
  Monitor,
  Plus,
  RotateCw,
  Sparkles,
} from "lucide-react";

import {
  BrandLogo,
  BuilderButton,
  BuildProgress,
  ChatMessage,
  StatusIndicator,
  WorkspacePanel,
} from "@/components/builder/brand-ui";
import { BrandPanel } from "@/components/builder/brand-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  Attachment,
  Brand,
  BuilderStatus,
  BuildStreamEvent,
  GeneratedApp,
  GenerateResult,
  PublishResult,
} from "@/lib/builder/types";

type Message = { id: number; role: "user" | "builder" | "error"; text: string };

const BUILD_STEPS = ["Planning", "Writing code", "Rendering preview", "Preview ready"] as const;
const ACCESS_HEADER = "x-builderos-key";
const ACCESS_STORAGE_KEY = "builderos.access-code";

/**
 * The access code is remembered for the browser session. It is read through
 * `useSyncExternalStore` rather than an effect so the server render (empty)
 * and the first client render stay consistent.
 */
const subscribeToSessionStorage = () => () => {};
const readStoredAccessCode = () => window.sessionStorage.getItem(ACCESS_STORAGE_KEY) ?? "";
const noStoredAccessCode = () => "";

interface WorkspaceProps {
  requiresAccessCode: boolean;
  publicBaseUrl: string;
}

export function Workspace({ requiresAccessCode, publicBaseUrl }: WorkspaceProps) {
  const [prompt, setPrompt] = useState("");
  const storedAccessCode = useSyncExternalStore(
    subscribeToSessionStorage,
    readStoredAccessCode,
    noStoredAccessCode,
  );
  const [typedAccessCode, setTypedAccessCode] = useState<string | null>(null);
  const accessCode = typedAccessCode ?? storedAccessCode;
  const [brand, setBrand] = useState<Brand>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<BuilderStatus | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [app, setApp] = useState<GeneratedApp | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const buildId = useRef(0);
  const lastPrompt = useRef("");

  const isBuilding = status !== null && status !== "Preview ready" && status !== "Published";
  const hasPreview = app !== null;
  const needsAccessCode = requiresAccessCode && accessCode.trim().length === 0;

  function updateAccessCode(value: string) {
    setTypedAccessCode(value);
    window.sessionStorage.setItem(ACCESS_STORAGE_KEY, value);
  }

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requiresAccessCode && accessCode.trim()) {
      headers[ACCESS_HEADER] = accessCode.trim();
    }
    return headers;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || isBuilding || needsAccessCode) return;

    const id = ++buildId.current;
    lastPrompt.current = value;
    setMessages((current) => [...current, { id, role: "user", text: value }]);
    setPrompt("");
    setBuildError(null);
    setPublishedUrl(null);
    setStatus("Planning");
    setStatusDetail(null);

    try {
      const response = await fetch("/api/build", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: value,
          previousHtml: app?.html,
          brand,
          attachments,
        }),
      });

      if (!response.body) throw new Error("BuilderOS did not return an event stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: GenerateResult | null = null;

      while (true) {
        const { done, value: chunk } = await reader.read();
        buffer += decoder.decode(chunk, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const streamEvent = JSON.parse(line) as BuildStreamEvent;
          if (streamEvent.type === "status") {
            setStatus(streamEvent.status);
            setStatusDetail(streamEvent.detail ?? null);
          } else {
            result = streamEvent.result;
          }
        }
        if (done) break;
      }

      if (id !== buildId.current) return;
      if (!result) throw new Error("The build finished without a result.");
      if (!result.success || !result.app) {
        throw new Error(result.error || "The app could not be generated.");
      }

      setApp(result.app);
      setPreviewVersion((version) => version + 1);
      setStatus("Preview ready");
      setStatusDetail(null);
      setMessages((current) => [
        ...current,
        { id: id + 0.5, role: "builder", text: result.message ?? "Your app is ready." },
      ]);
      window.setTimeout(() => setStatus(null), 700);
    } catch (error) {
      if (id !== buildId.current) return;
      const message = error instanceof Error ? error.message : "The app could not be generated.";
      setBuildError(message);
      setStatus(null);
      setStatusDetail(null);
      setMessages((current) => [
        ...current,
        { id: id + 0.5, role: "error", text: "Build failed. Check the error in Preview." },
      ]);
    }
  }

  async function handlePublish() {
    if (!app || publishing) return;
    setPublishing(true);
    setBuildError(null);
    setStatus("Publishing");
    setStatusDetail(app.name);

    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ slug: app.slug, html: app.html, prompt: lastPrompt.current }),
      });
      const result = (await response.json()) as PublishResult;
      if (!result.success || !result.url) {
        throw new Error(result.error || "Publish failed.");
      }
      setPublishedUrl(result.url);
      setStatus("Published");
      setStatusDetail(null);
      setMessages((current) => [
        ...current,
        { id: Date.now(), role: "builder", text: `Published to ${result.url}` },
      ]);
      window.setTimeout(() => setStatus(null), 900);
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "Publish failed.");
      setStatus(null);
      setStatusDetail(null);
    } finally {
      setPublishing(false);
    }
  }

  function resetWorkspace() {
    buildId.current += 1;
    setPrompt("");
    setMessages([]);
    setBrand({});
    setAttachments([]);
    setApp(null);
    setPublishedUrl(null);
    setBuildError(null);
    setStatus(null);
    setStatusDetail(null);
  }

  const activeStep = status ? BUILD_STEPS.indexOf(status as (typeof BUILD_STEPS)[number]) : -1;
  const workspaceState = buildError
    ? "error"
    : isBuilding
      ? "working"
      : hasPreview
        ? "ready"
        : "idle";

  return (
    <main className="flex h-dvh min-h-[620px] flex-col overflow-hidden bg-night text-ink">
      <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-brand-border-subtle bg-night px-4 sm:px-6">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-border to-transparent" />
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[15px] font-bold tracking-[-0.035em]">BuilderOS</span>
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-muted sm:inline">
              by Konvertis
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:flex">
            <StatusIndicator state={workspaceState} />
            {publishedUrl ? "Published" : hasPreview ? "Draft" : "Ready"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Start a new project"
            onClick={resetWorkspace}
            className="border border-transparent hover:border-brand-border"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[44%_56%] md:grid-cols-[35%_65%] md:grid-rows-1">
        <section className="flex min-h-0 flex-col border-b border-brand-border-subtle bg-surface md:border-r md:border-b-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-7 sm:py-8">
            {messages.length === 0 && !status ? (
              <div className="my-auto max-w-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-px w-8 bg-acid" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-acid">New project</p>
                </div>
                <h1 className="font-display text-2xl font-bold leading-[1.08] tracking-[-0.05em] text-ink sm:text-[30px]">
                  Build what comes next.
                </h1>
                <p className="mt-4 max-w-xs text-sm leading-6 text-copy">
                  Describe your idea. BuilderOS writes a complete app, shows it in the preview, and
                  publishes it to {publicBaseUrl.replace(/^https?:\/\//, "")}.
                </p>
                <div className="mt-7 flex gap-5 border-t border-brand-border-subtle pt-4 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <span>
                    <b className="mr-1 text-electric">01</b> Describe
                  </span>
                  <span>
                    <b className="mr-1 text-electric">02</b> Preview
                  </span>
                  <span>
                    <b className="mr-1 text-acid">03</b> Publish
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-5" aria-live="polite">
                {messages.map((message) => (
                  <ChatMessage key={message.id} role={message.role} text={message.text} />
                ))}
                {status && (
                  <div className="flex gap-3">
                    <div
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border bg-night/50 ${
                        status === "Preview ready" || status === "Published"
                          ? "border-acid/30 text-acid"
                          : "border-electric/30 text-electric"
                      }`}
                    >
                      {status === "Preview ready" || status === "Published" ? (
                        <Check className="size-3.5" />
                      ) : (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p
                        className={`text-sm font-bold ${
                          status === "Preview ready" || status === "Published" ? "text-acid" : "text-ink"
                        }`}
                      >
                        {statusDetail ?? status}
                      </p>
                      <BuildProgress
                        steps={BUILD_STEPS}
                        activeStep={activeStep}
                        ready={status === "Preview ready" || status === "Published"}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {app && (
            <WorkspacePanel className="mx-3 shrink-0 overflow-hidden bg-night/45 sm:mx-4">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-ink">{app.name}</p>
                  <p className="truncate font-mono text-[9px] text-muted">/{app.slug}/</p>
                </div>
                <BuilderButton type="button" onClick={handlePublish} disabled={publishing || isBuilding}>
                  {publishing ? "Publishing" : publishedUrl ? "Republish" : "Publish"}
                  {publishing ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Globe className="size-3.5" />
                  )}
                </BuilderButton>
              </div>
              {publishedUrl && (
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 border-t border-brand-border-subtle px-3 py-2 font-mono text-[9px] text-acid hover:underline"
                >
                  <ExternalLink className="size-3" />
                  {publishedUrl}
                </a>
              )}
            </WorkspacePanel>
          )}

          <div className="shrink-0 p-3 sm:p-4">
            <BrandPanel
              brand={brand}
              onBrandChange={setBrand}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              disabled={isBuilding}
            />
            {requiresAccessCode && (
              <label className="mb-2 flex items-center gap-2 rounded-lg border border-brand-border bg-night/50 px-3 py-2">
                <Lock className="size-3.5 shrink-0 text-muted" />
                <span className="sr-only">Access code</span>
                <input
                  type="password"
                  value={accessCode}
                  onChange={(event) => updateAccessCode(event.target.value)}
                  placeholder="Access code"
                  autoComplete="off"
                  className="w-full bg-transparent font-mono text-[11px] text-ink outline-none placeholder:text-muted"
                />
              </label>
            )}
            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-brand-border bg-night/65 p-3 shadow-[0_16px_40px_rgb(9_0_20/0.24)] transition focus-within:border-acid/45"
            >
              <Textarea
                value={prompt}
                disabled={isBuilding}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={app ? "Describe a change…" : "What do you want to build?"}
                aria-label="Describe what you want to build"
                className="min-h-16"
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="hidden text-[10px] text-muted sm:inline">
                  Enter to build · Shift + Enter for a new line
                </span>
                <span className="sm:hidden" />
                <BuilderButton type="submit" disabled={!prompt.trim() || isBuilding || needsAccessCode}>
                  {isBuilding ? status : app ? "Update" : "Build"}
                  {isBuilding ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="size-3.5" strokeWidth={2.4} />
                  )}
                </BuilderButton>
              </div>
            </form>
          </div>
        </section>

        <section
          className="konvertis-grid relative flex min-h-0 flex-col bg-night"
          aria-label="Application preview"
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-brand-border-subtle bg-surface/35 px-4 sm:px-5">
            <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-copy">
              <Monitor className="size-3.5 text-electric" />
              Preview
              <span className="hidden rounded-full border border-brand-border bg-surface-secondary/55 px-2 py-1 font-mono text-[8px] font-normal normal-case tracking-normal text-muted sm:inline">
                {app ? `${(app.html.length / 1024).toFixed(0)} KB · single file` : "waiting for build"}
              </span>
            </div>
            <button
              onClick={() => setPreviewVersion((version) => version + 1)}
              disabled={!hasPreview}
              className="grid size-7 place-items-center rounded-md border border-brand-border bg-surface text-muted transition hover:border-electric/50 hover:text-electric focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric disabled:opacity-30"
              aria-label="Reload preview"
            >
              <RotateCw className="size-3" />
            </button>
          </div>
          <div className="preview-ambient relative grid min-h-0 flex-1 place-items-center p-3 sm:p-6 lg:p-8">
            <WorkspacePanel className="relative z-10 grid size-full max-h-[780px] max-w-5xl place-items-center overflow-hidden border-brand-border bg-night shadow-[0_28px_90px_rgb(0_0_0/0.4)]">
              {app && (
                <iframe
                  key={previewVersion}
                  srcDoc={app.html}
                  title="Generated application"
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                  className="size-full border-0 bg-white"
                />
              )}
              {isBuilding && (
                <div className="absolute inset-0 grid place-items-center bg-night/95 backdrop-blur-sm">
                  <div className="flex flex-col items-center px-6 text-center">
                    <div className="relative mb-5 grid size-12 place-items-center rounded-xl border border-brand-border bg-surface-secondary text-acid shadow-[0_0_28px_rgb(224_255_5/0.08)]">
                      <Sparkles className="size-4" />
                      <span className="absolute -bottom-1 h-px w-5 bg-acid shadow-[0_0_8px_var(--primary)]" />
                    </div>
                    <p className="text-sm font-bold text-ink">{status}</p>
                    <p className="mt-2 text-xs text-muted">{statusDetail ?? "Writing a complete app"}</p>
                  </div>
                </div>
              )}
              {buildError && (
                <div className="absolute inset-0 overflow-auto bg-night p-6 text-left text-ink">
                  <div className="mx-auto max-w-2xl">
                    <div className="flex items-center gap-2 text-sm font-bold text-neon">
                      <AlertCircle className="size-4" />
                      Something went wrong
                    </div>
                    <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-neon/20 bg-surface p-4 font-mono text-[11px] leading-5 text-copy">
                      {buildError}
                    </pre>
                  </div>
                </div>
              )}
              {!hasPreview && !isBuilding && !buildError && (
                <div className="flex flex-col items-center px-6 text-center">
                  <div className="relative mb-5 grid size-11 place-items-center rounded-xl border border-brand-border bg-surface-secondary text-acid">
                    <Code2 className="size-4" />
                    <span className="absolute -right-1 -top-1 size-2 rounded-full border-2 border-night bg-electric" />
                  </div>
                  <p className="font-display text-sm font-bold tracking-[-0.02em] text-ink">
                    Your app will appear here
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-muted">
                    generated · previewed · published
                  </p>
                </div>
              )}
            </WorkspacePanel>
          </div>
        </section>
      </div>
    </main>
  );
}
