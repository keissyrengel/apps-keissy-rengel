"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, Check, ChevronDown, Code2, FileCode2, LoaderCircle, Monitor, Plus, RotateCw, Sparkles } from "lucide-react";

import { BrandLogo, BuilderButton, BuildProgress, ChatMessage, StatusIndicator, WorkspacePanel } from "@/components/builder/brand-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BuilderStatus, BuildStreamEvent, FileChange, GenerateResult } from "@/lib/builder/types";

type Message = { id: number; role: "user" | "builder" | "error"; text: string };
type BuildRecord = { id: number; prompt: string; changes: FileChange[] };

const BUILD_STEPS = ["Planning", "Reading files", "Editing", "Testing", "Preview ready"] as const;

export function Workspace() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<BuilderStatus | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [hasPreview, setHasPreview] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [changesOpen, setChangesOpen] = useState(true);
  const buildId = useRef(0);
  const isBuilding = status !== null && status !== "Preview ready";

  useEffect(() => {
    let cancelled = false;
    async function checkPreview() {
      try {
        await fetch("http://localhost:3001", { mode: "no-cors", cache: "no-store" });
        if (!cancelled) setHasPreview(true);
      } catch {
        if (!cancelled) setHasPreview(false);
      }
    }
    void checkPreview();
    const interval = window.setInterval(checkPreview, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || isBuilding) return;

    const id = ++buildId.current;
    setMessages((current) => [...current, { id, role: "user", text: value }]);
    setPrompt("");
    setBuildError(null);
    setStatus("Planning");
    setStatusDetail(null);

    try {
      const response = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
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
          } else result = streamEvent.result;
        }
        if (done) break;
      }
      if (id !== buildId.current) return;
      if (!result) throw new Error("The build finished without a result.");
      setBuilds((current) => [...current, { id, prompt: value, changes: result.changes }]);
      if (!result.success) throw new Error(result.error || "The generated app failed to build.");

      setHasPreview(true);
      setPreviewLoading(true);
      setPreviewVersion(id);
      setStatus("Preview ready");
      setStatusDetail(null);
      setMessages((current) => [...current, { id: id + 0.5, role: "builder", text: "Your app is ready." }]);
      window.setTimeout(() => setStatus(null), 700);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The generated app failed to build.";
      setBuildError(message);
      setStatus(null);
      setStatusDetail(null);
      setMessages((current) => [...current, { id: id + 0.5, role: "error", text: "Build failed. Check the error in Preview." }]);
    }
  }

  function resetWorkspace() {
    buildId.current += 1;
    setPrompt("");
    setMessages([]);
    setBuilds([]);
    setHasPreview(false);
    setBuildError(null);
    setStatus(null);
    setStatusDetail(null);
  }

  const activeStep = status ? BUILD_STEPS.indexOf(status as (typeof BUILD_STEPS)[number]) : -1;
  const latestBuild = builds.at(-1);
  const workspaceState = buildError ? "error" : isBuilding ? "working" : hasPreview ? "ready" : "idle";

  return (
    <main className="flex h-dvh min-h-[620px] flex-col overflow-hidden bg-night text-ink">
      <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-brand-border-subtle bg-night px-4 sm:px-6">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-border to-transparent" />
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[15px] font-bold tracking-[-0.035em]">BuilderOS</span>
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-muted sm:inline">by Konvertis</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:flex"><StatusIndicator state={workspaceState} />Local workspace</span>
          <Button variant="ghost" size="icon" aria-label="Start a new project" onClick={resetWorkspace} className="border border-transparent hover:border-brand-border"><Plus className="size-4" /></Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[44%_56%] md:grid-cols-[35%_65%] md:grid-rows-1">
        <section className="flex min-h-0 flex-col border-b border-brand-border-subtle bg-surface md:border-r md:border-b-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-7 sm:py-8">
            {messages.length === 0 && !status ? (
              <div className="my-auto max-w-sm">
                <div className="mb-5 flex items-center gap-3"><span className="h-px w-8 bg-acid" /><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-acid">New project</p></div>
                <h1 className="font-display text-2xl font-bold leading-[1.08] tracking-[-0.05em] text-ink sm:text-[30px]">Build what comes next.</h1>
                <p className="mt-4 max-w-xs text-sm leading-6 text-copy">Describe your product. BuilderOS will create and run a real application in the preview.</p>
                <div className="mt-7 flex gap-5 border-t border-brand-border-subtle pt-4 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted"><span><b className="mr-1 text-electric">01</b> Plan</span><span><b className="mr-1 text-electric">02</b> Build</span><span><b className="mr-1 text-acid">03</b> Launch</span></div>
              </div>
            ) : (
              <div className="space-y-5" aria-live="polite">
                {messages.map((message) => <ChatMessage key={message.id} role={message.role} text={message.text} />)}
                {status && (
                  <div className="flex gap-3">
                    <div className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border bg-night/50 ${status === "Preview ready" ? "border-acid/30 text-acid" : "border-electric/30 text-electric"}`}>{status === "Preview ready" ? <Check className="size-3.5" /> : <LoaderCircle className="size-3.5 animate-spin" />}</div>
                    <div className="min-w-0 flex-1 pt-0.5"><p className={`text-sm font-bold ${status === "Preview ready" ? "text-acid" : "text-ink"}`}>{statusDetail ?? status}</p><BuildProgress steps={BUILD_STEPS} activeStep={activeStep} ready={status === "Preview ready"} /></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {latestBuild && (
            <WorkspacePanel className="mx-3 shrink-0 overflow-hidden bg-night/45 sm:mx-4">
              <button onClick={() => setChangesOpen((open) => !open)} className="flex w-full items-center justify-between px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-acid" aria-expanded={changesOpen}>
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-copy"><FileCode2 className="size-3.5 text-electric" />Changes <span className="rounded-full bg-surface-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted">{latestBuild.changes.length}</span></span>
                <ChevronDown className={`size-3.5 text-muted transition ${changesOpen ? "rotate-180" : ""}`} />
              </button>
              {changesOpen && <div className="max-h-32 space-y-3 overflow-y-auto border-t border-brand-border-subtle px-3 py-2">{[...builds].reverse().map((build, index) => <div key={build.id}><p className="mb-1 truncate font-mono text-[9px] text-muted">build_{builds.length - index} · {build.prompt}</p>{build.changes.length ? build.changes.map((change) => <div key={change.path} className="flex items-center justify-between gap-3 font-mono text-[9px]"><span className="truncate text-copy/70">{change.path}</span><span className={change.action === "created" ? "text-acid" : change.action === "deleted" ? "text-neon" : "text-electric"}>{change.action}</span></div>) : <p className="font-mono text-[9px] text-muted">No file changes were needed.</p>}</div>)}</div>}
            </WorkspacePanel>
          )}

          <div className="shrink-0 p-3 sm:p-4">
            <form onSubmit={handleSubmit} className="rounded-xl border border-brand-border bg-night/65 p-3 shadow-[0_16px_40px_rgb(9_0_20/0.24)] transition focus-within:border-acid/45 focus-within:shadow-[0_0_0_1px_rgb(224_255_5/0.05),0_0_24px_rgb(224_255_5/0.05)]">
              <Textarea value={prompt} disabled={isBuilding} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="What do you want to build?" aria-label="Describe what you want to build" className="min-h-16" />
              <div className="mt-1 flex items-center justify-between"><span className="hidden text-[10px] text-muted sm:inline">Enter to build · Shift + Enter for a new line</span><span className="sm:hidden" /><BuilderButton type="submit" disabled={!prompt.trim() || isBuilding}>{isBuilding ? status : "Build"}{isBuilding ? <LoaderCircle className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" strokeWidth={2.4} />}</BuilderButton></div>
            </form>
          </div>
        </section>

        <section className="konvertis-grid relative flex min-h-0 flex-col bg-night" aria-label="Application preview">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-brand-border-subtle bg-surface/35 px-4 sm:px-5">
            <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-copy"><Monitor className="size-3.5 text-electric" />Preview <span className="hidden rounded-full border border-brand-border bg-surface-secondary/55 px-2 py-1 font-mono text-[8px] font-normal normal-case tracking-normal text-muted sm:inline">localhost:3001</span></div>
            <button onClick={() => { setPreviewLoading(true); setPreviewVersion((version) => version + 1); }} disabled={!hasPreview} className="grid size-7 place-items-center rounded-md border border-brand-border bg-surface text-muted transition hover:border-electric/50 hover:text-electric focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric disabled:opacity-30" aria-label="Reload preview"><RotateCw className="size-3" /></button>
          </div>
          <div className="preview-ambient relative grid min-h-0 flex-1 place-items-center p-3 sm:p-6 lg:p-8">
            <WorkspacePanel className="relative z-10 grid size-full max-h-[780px] max-w-5xl place-items-center overflow-hidden border-brand-border bg-night shadow-[0_28px_90px_rgb(0_0_0/0.4),0_0_50px_rgb(0_148_255/0.035)]">
              {hasPreview && <iframe key={previewVersion} src={`http://localhost:3001/?build=${previewVersion}`} title="Generated application" className="size-full border-0 bg-white" onLoad={() => setPreviewLoading(false)} onError={() => setHasPreview(false)} />}
              {(isBuilding || previewLoading) && <div className="absolute inset-0 grid place-items-center bg-night/95 backdrop-blur-sm"><div className="flex flex-col items-center px-6 text-center"><div className="relative mb-5 grid size-12 place-items-center rounded-xl border border-brand-border bg-surface-secondary text-acid shadow-[0_0_28px_rgb(224_255_5/0.08)]"><Sparkles className="size-4" /><span className="absolute -bottom-1 h-px w-5 bg-acid shadow-[0_0_8px_var(--primary)]" /></div><p className="text-sm font-bold text-ink">{status ?? "Loading preview"}</p><p className="mt-2 text-xs text-muted">Writing and validating real files</p></div></div>}
              {buildError && <div className="absolute inset-0 overflow-auto bg-night p-6 text-left text-ink"><div className="mx-auto max-w-2xl"><div className="flex items-center gap-2 text-sm font-bold text-neon"><AlertCircle className="size-4" />Generated app failed to compile</div><pre className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-neon/20 bg-surface p-4 font-mono text-[11px] leading-5 text-copy">{buildError}</pre></div></div>}
              {!hasPreview && !isBuilding && !buildError && <div className="flex flex-col items-center px-6 text-center"><div className="relative mb-5 grid size-11 place-items-center rounded-xl border border-brand-border bg-surface-secondary text-acid"><Code2 className="size-4" /><span className="absolute -right-1 -top-1 size-2 rounded-full border-2 border-night bg-electric" /></div><p className="font-display text-sm font-bold tracking-[-0.02em] text-ink">Your app will appear here</p><p className="mt-2 font-mono text-[10px] text-muted">real files · live on port 3001</p></div>}
            </WorkspacePanel>
          </div>
        </section>
      </div>
    </main>
  );
}
