import { relative, resolve } from "node:path";

import type { CodexUiEvent, ProtocolNotification } from "./types";

type Item = {
  type?: string;
  command?: string;
  cwd?: string;
  changes?: Array<{ path?: string }>;
};

function safeRelativePath(workspace: string, value?: string) {
  if (!value) return undefined;
  const candidate = value.startsWith("/") ? value : resolve(workspace, value);
  const path = relative(workspace, candidate);
  return path && !path.startsWith("..") ? path : undefined;
}

export function mapCodexEvent(notification: ProtocolNotification, workspace: string): CodexUiEvent | null {
  if (notification.method === "turn/plan/updated") return { status: "Planning" };
  if (notification.method !== "item/started") return null;

  const item = notification.params?.item as Item | undefined;
  if (item?.type === "fileChange") {
    const path = safeRelativePath(workspace, item.changes?.[0]?.path);
    return { status: "Editing", detail: path ? `Editing ${path}` : "Editing project files" };
  }
  if (item?.type !== "commandExecution") return null;

  const command = item.command?.trim() ?? "";
  if (/\b(rg|find|ls|sed|cat|head|tail|pwd)\b/.test(command)) return { status: "Reading files", detail: "Reading project" };
  if (/\b(test|lint|typecheck|tsc|build)\b/.test(command)) return { status: "Testing", detail: "Validating application" };
  return { status: "Running commands", detail: "Running project command" };
}
