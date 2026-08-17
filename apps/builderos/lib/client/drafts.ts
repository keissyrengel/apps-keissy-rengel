"use client";

import type { GeneratedApp } from "@/lib/builder/types";

/**
 * Recent work, kept in the browser.
 *
 * Published apps live in the repository and are the real archive; this only
 * has to answer "I closed the tab before publishing — where did it go?".
 * That makes localStorage the right size of tool: no binding to configure,
 * no extra round trip, and losing it costs a regeneration rather than an app.
 */

const STORAGE_KEY = "builderos.drafts";
const MAX_DRAFTS = 8;

/** One line of the conversation, as it is replayed when a draft is reopened. */
export interface DraftMessage {
  id: number;
  role: "user" | "builder" | "error";
  text: string;
  /** Names of files attached to that message, shown so the thread reads honestly. */
  files?: string[];
}

export interface Draft extends GeneratedApp {
  id: string;
  prompt: string;
  updatedAt: number;
  /**
   * The full thread, not just the last prompt. Reopening a project without it
   * means re-reading the generated app to remember what you already asked for.
   */
  messages?: DraftMessage[];
}

/**
 * Exposed as an external store so React can read it with
 * `useSyncExternalStore`. Reading storage during render would make the server
 * render (no storage) and the first client render disagree; a cached snapshot
 * plus an explicit subscription keeps hydration clean and the badge honest.
 */
const EMPTY: Draft[] = [];
const listeners = new Set<() => void>();
let snapshot: Draft[] | null = null;

export function subscribeDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDraftsSnapshot(): Draft[] {
  if (snapshot === null) snapshot = readDrafts();
  return snapshot;
}

/** The server has no storage, so it always renders an empty history. */
export function getServerDraftsSnapshot(): Draft[] {
  return EMPTY;
}

function publish(drafts: Draft[]): Draft[] {
  snapshot = drafts;
  for (const listener of listeners) listener();
  return drafts;
}

export function readDrafts(): Draft[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Draft[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((draft) => typeof draft?.id === "string" && typeof draft?.html === "string")
      .sort((left, right) => right.updatedAt - left.updatedAt);
  } catch {
    // Corrupt or unreadable storage should never break the workspace.
    return [];
  }
}

/**
 * Iterations of one app replace each other instead of piling up: a draft is
 * matched by id, so "make it dark" does not create a second entry.
 */
export function saveDraft(draft: Draft): Draft[] {
  const others = getDraftsSnapshot().filter((item) => item.id !== draft.id);
  const next = [draft, ...others].slice(0, MAX_DRAFTS);
  persist(next);
  return publish(next);
}

export function deleteDraft(id: string): Draft[] {
  const next = getDraftsSnapshot().filter((draft) => draft.id !== id);
  persist(next);
  return publish(next);
}

export function newDraftId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generated apps embed their logo, so a handful of drafts can approach the
 * ~5 MB origin quota. When that happens the oldest are dropped until the
 * write succeeds rather than surfacing a storage error to the user.
 */
function persist(drafts: Draft[]): void {
  const candidates = [...drafts];
  while (candidates.length > 0) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
      return;
    } catch {
      candidates.pop();
    }
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is unavailable entirely (private mode); drafts are simply off.
  }
}
