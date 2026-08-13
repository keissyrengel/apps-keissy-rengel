import type { BuilderRuntime } from "./types";

/**
 * Cloudflare Sandbox/Containers will be connected here in a later phase.
 * Until then, the remote runtime is intentionally inert.
 */
export class RemoteRuntime implements BuilderRuntime {
  readonly name = "remote" as const;

  async build() {
    return {
      success: false,
      changes: [],
      error: "Remote runtime is not configured yet.",
    };
  }
}
