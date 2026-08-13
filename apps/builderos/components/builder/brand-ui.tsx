import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Check, Code2, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[9px] border border-brand-border bg-surface-secondary", className)} aria-label="Konvertis">
      <span className="absolute left-[8px] h-[18px] w-[3px] rounded-full bg-acid" />
      <span className="absolute left-[14px] top-[7px] h-[3px] w-[11px] origin-left -rotate-45 rounded-full bg-acid" />
      <span className="absolute bottom-[7px] left-[14px] h-[3px] w-[11px] origin-left rotate-45 rounded-full bg-electric" />
    </div>
  );
}

export function StatusIndicator({ state }: { state: "idle" | "working" | "ready" | "error" }) {
  return <span className={cn("size-1.5 rounded-full", state === "ready" && "bg-acid shadow-[0_0_8px_var(--primary)]", state === "working" && "animate-pulse bg-electric shadow-[0_0_8px_var(--blue)]", state === "error" && "bg-neon", state === "idle" && "bg-muted")} />;
}

export function WorkspacePanel({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div className={cn("rounded-xl border border-brand-border-subtle bg-surface/85 shadow-[0_18px_60px_rgb(9_0_20/0.28)]", className)} {...props}>{children}</div>;
}

export function BuilderButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-acid px-4 text-sm font-bold text-night shadow-[0_0_0_1px_rgb(224_255_5/0.08),0_6px_22px_rgb(224_255_5/0.12)] transition hover:bg-acid/90 hover:shadow-[0_0_24px_rgb(224_255_5/0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-40", className)} {...props}>{children}</button>;
}

export function ChatMessage({ role, text }: { role: "user" | "builder" | "error"; text: string }) {
  if (role === "user") return <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-md border border-brand-border bg-surface-secondary px-4 py-3 text-sm leading-6 text-ink shadow-[0_8px_24px_rgb(9_0_20/0.18)]">{text}</div>;
  const isError = role === "error";
  return (
    <div className={cn("flex gap-3 text-sm leading-6", isError ? "text-neon" : "text-copy")}>
      <div className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border bg-night/55", isError ? "border-neon/30 text-neon" : "border-brand-border text-acid")}>
        <Code2 className="size-3.5" />
      </div>
      <p className="pt-0.5">{text}</p>
    </div>
  );
}

export function BuildProgress({ steps, activeStep, ready }: { steps: readonly string[]; activeStep: number; ready: boolean }) {
  return (
    <div className="mt-3 space-y-2">
      {steps.map((step, index) => {
        const complete = index < activeStep || ready;
        const active = index === activeStep && !ready;
        return <div key={step} className={cn("flex items-center gap-2 text-[11px]", complete || active ? "text-copy" : "text-muted/50")}><span className={cn("grid size-4 place-items-center rounded-full border", complete && "border-acid/30 bg-acid/10 text-acid", active && "border-electric/50 bg-electric/10 text-electric", !complete && !active && "border-brand-border-subtle")}>{complete ? <Check className="size-2.5" /> : active ? <LoaderCircle className="size-2.5 animate-spin" /> : <span className="size-1 rounded-full bg-current" />}</span>{step}</div>;
      })}
    </div>
  );
}
