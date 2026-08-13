import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import type { FileChange } from "../builder/types";
import { getGeneratedAppRoot } from "../project-paths";
import { AppServerClient } from "./app-server-client";
import { mapCodexEvent } from "./event-mapper";
import type { CodexBuildResult, CodexThreadStartResponse, CodexTurnStartResponse, CodexUiEvent, ProtocolNotification } from "./types";

const SYSTEM_INSTRUCTIONS = `You are the BuilderOS software engineer.

You are working inside a generated Next.js application. Implement the user's requested change directly in this project.

Rules:
- Inspect the existing application before modifying it.
- Preserve existing functionality unless the user explicitly asks to replace it.
- Make minimal, coherent changes and use the existing design system when possible.
- Never read or modify files outside this workspace.
- Do not expose secrets or environment variables.
- Run appropriate lint and typecheck validation after changes and fix errors caused by your changes.
- Do not merely explain what code should be written: modify the files directly.
- Do not use network access.
- Do not spawn sub-agents.`;

const IGNORED = new Set(["node_modules", ".next", ".next-dev", ".git", ".builder-state.json", "next-env.d.ts"]);
const TURN_TIMEOUT_MS = 600_000;

type Snapshot = Map<string, string>;

export class CodexManager {
  private readonly workspace: string;
  private readonly client: AppServerClient;
  private threadId: string | null = null;
  private threadGeneration = 0;
  private activeTurn: Promise<CodexBuildResult> | null = null;

  constructor(workspace = getGeneratedAppRoot()) {
    this.workspace = workspace;
    this.client = new AppServerClient(workspace);
  }

  async start() {
    await this.assertWorkspace();
    await this.client.start();
  }

  async shutdown() {
    await this.client.stop();
  }

  async build(prompt: string, onEvent: (event: CodexUiEvent) => void): Promise<CodexBuildResult> {
    if (this.activeTurn) throw new Error("A Codex build is already running.");
    const run = this.runBuild(prompt, onEvent);
    this.activeTurn = run;
    try { return await run; } finally { this.activeTurn = null; }
  }

  private async runBuild(prompt: string, onEvent: (event: CodexUiEvent) => void) {
    const value = prompt.trim();
    if (!value) return { success: false, changes: [], error: "Enter a build instruction." };
    await this.start();
    const threadId = await this.ensureThread();
    const before = await this.snapshot();
    onEvent({ status: "Planning" });

    let activeTurnId = "";
    let completionResolve: ((notification: ProtocolNotification) => void) | null = null;
    const completion = new Promise<ProtocolNotification>((resolveCompletion) => { completionResolve = resolveCompletion; });
    const unsubscribe = this.client.onNotification((notification) => {
      const params = notification.params;
      if (params?.threadId !== threadId) return;
      if (activeTurnId && params?.turnId && params.turnId !== activeTurnId) return;
      const event = mapCodexEvent(notification, this.workspace);
      if (event) onEvent(event);
      if (notification.method === "turn/completed") completionResolve?.(notification);
    });

    try {
      const turn = await this.client.request<CodexTurnStartResponse>("turn/start", {
        threadId,
        input: [{ type: "text", text: value, text_elements: [] }],
        cwd: this.workspace,
        approvalPolicy: "never",
        sandboxPolicy: {
          type: "workspaceWrite",
          writableRoots: [this.workspace],
          networkAccess: false,
          excludeTmpdirEnvVar: true,
          excludeSlashTmp: true,
        },
        ...(process.env.CODEX_MODEL ? { model: process.env.CODEX_MODEL } : {}),
      });
      activeTurnId = turn.turn.id;
      const completed = await Promise.race([
        completion,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Codex turn timed out.")), TURN_TIMEOUT_MS)),
      ]);
      const finishedTurn = completed.params?.turn as { status?: string; error?: { message?: string } | null } | undefined;
      const changes = await this.diff(before);
      if (finishedTurn?.status !== "completed") {
        return { success: false, changes, error: finishedTurn?.error?.message || "Codex could not complete the requested change.", threadId };
      }
      onEvent({ status: "Preview ready" });
      return { success: true, changes, threadId };
    } catch (error) {
      const changes = await this.diff(before);
      return { success: false, changes, error: error instanceof Error ? error.message : "Codex build failed.", threadId };
    } finally {
      unsubscribe();
    }
  }

  private async ensureThread() {
    if (this.threadId && this.threadGeneration === this.client.generation) return this.threadId;
    if (this.threadId) {
      try {
        await this.client.request("thread/resume", {
          threadId: this.threadId,
          cwd: this.workspace,
          approvalPolicy: "never",
          sandbox: "workspace-write",
          baseInstructions: SYSTEM_INSTRUCTIONS,
          ...(process.env.CODEX_MODEL ? { model: process.env.CODEX_MODEL } : {}),
        });
        this.threadGeneration = this.client.generation;
        return this.threadId;
      } catch {
        this.threadId = null;
      }
    }
    const response = await this.client.request<CodexThreadStartResponse>("thread/start", {
      cwd: this.workspace,
      approvalPolicy: "never",
      approvalsReviewer: "user",
      sandbox: "workspace-write",
      serviceName: "BuilderOS",
      baseInstructions: SYSTEM_INSTRUCTIONS,
      ephemeral: false,
      ...(process.env.CODEX_MODEL ? { model: process.env.CODEX_MODEL } : {}),
    });
    this.threadId = response.thread.id;
    this.threadGeneration = this.client.generation;
    return this.threadId;
  }

  private async assertWorkspace() {
    const root = await realpath(this.workspace);
    const generated = getGeneratedAppRoot();
    if (root !== generated || !root.endsWith(`${sep}generated-app`)) throw new Error("Refusing to run Codex outside generated-app.");
    const info = await stat(root);
    if (!info.isDirectory()) throw new Error("generated-app is not a directory.");
  }

  private async snapshot(directory = this.workspace, result: Snapshot = new Map()): Promise<Snapshot> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (IGNORED.has(entry.name)) continue;
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) await this.snapshot(absolute, result);
      else if (entry.isFile() && !entry.name.endsWith(".tsbuildinfo")) {
        const path = relative(this.workspace, absolute);
        const content = await readFile(absolute);
        result.set(path, createHash("sha256").update(content).digest("hex"));
      }
    }
    return result;
  }

  private async diff(before: Snapshot): Promise<FileChange[]> {
    const after = await this.snapshot();
    const changes: FileChange[] = [];
    for (const [path, hash] of after) changes.push({ path, action: before.has(path) ? (before.get(path) === hash ? null : "modified") : "created" } as FileChange & { action: FileChange["action"] | null });
    for (const path of before.keys()) if (!after.has(path)) changes.push({ path, action: "deleted" });
    return changes.filter((change) => change.action).sort((a, b) => a.path.localeCompare(b.path));
  }
}

let singleton: CodexManager | null = null;
export function getCodexManager() {
  singleton ??= new CodexManager();
  return singleton;
}
