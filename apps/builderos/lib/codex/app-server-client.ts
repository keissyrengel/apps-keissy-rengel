import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

import type { NotificationListener, ProtocolMessage, ProtocolNotification, ProtocolResponse } from "./types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

const REQUEST_TIMEOUT_MS = 30_000;

export class AppServerClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private listeners = new Set<NotificationListener>();
  private starting: Promise<void> | null = null;
  private stopping = false;
  private recentStderr = "";
  private processGeneration = 0;

  constructor(private readonly cwd: string) {}

  get healthy() {
    return Boolean(this.child && !this.child.killed && this.child.exitCode === null);
  }

  get generation() {
    return this.processGeneration;
  }

  async start() {
    if (this.healthy) return;
    if (this.starting) return this.starting;
    this.starting = this.startProcess().finally(() => { this.starting = null; });
    return this.starting;
  }

  private async startProcess() {
    this.stopping = false;
    this.recentStderr = "";
    const child = spawn("codex", ["app-server", "--listen", "stdio://"], {
      cwd: this.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.processGeneration += 1;
    this.lines = createInterface({ input: child.stdout });
    this.lines.on("line", (line) => this.handleLine(line));
    child.stderr.on("data", (chunk: Buffer) => {
      this.recentStderr = (this.recentStderr + chunk.toString("utf8")).slice(-4_000);
    });
    child.once("error", (error) => this.handleExit(error));
    child.once("exit", (code, signal) => {
      const detail = this.recentStderr.trim();
      this.handleExit(new Error(detail || `Codex App Server exited (${code ?? signal ?? "unknown"}).`));
    });

    await this.request("initialize", {
      clientInfo: { name: "BuilderOS", title: "BuilderOS", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    this.notify("initialized");
  }

  onNotification(listener: NotificationListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async request<T>(method: string, params?: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
    if (!this.healthy && method !== "initialize") await this.start();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      try {
        this.write({ id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error("Unable to write to Codex App Server."));
      }
    });
  }

  notify(method: string, params?: unknown) {
    this.write({ method, ...(params === undefined ? {} : { params }) });
  }

  async stop() {
    this.stopping = true;
    this.lines?.close();
    this.lines = null;
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); resolve(); }, 2_000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
  }

  private write(message: object) {
    if (!this.child?.stdin.writable) throw new Error("Codex App Server is unavailable.");
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string) {
    let message: ProtocolMessage;
    try {
      message = JSON.parse(line) as ProtocolMessage;
    } catch {
      return;
    }
    if ("id" in message && !("method" in message)) {
      const response = message as ProtocolResponse;
      const pending = this.pending.get(Number(response.id));
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(Number(response.id));
      if (response.error) pending.reject(new Error(response.error.message));
      else pending.resolve(response.result);
      return;
    }
    if ("id" in message && "method" in message) {
      this.declineServerRequest(message.id, message.method);
      return;
    }
    if ("method" in message) {
      for (const listener of this.listeners) listener(message as ProtocolNotification);
    }
  }

  private declineServerRequest(id: number | string, method: string) {
    const result = method.includes("permissions")
      ? { permissions: {}, scope: "turn" }
      : { decision: "decline" };
    this.write({ id, result });
  }

  private handleExit(error: Error) {
    this.lines?.close();
    this.lines = null;
    this.child = null;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(this.stopping ? new Error("Codex App Server stopped.") : error);
    }
    this.pending.clear();
  }
}
