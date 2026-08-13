import { generateApp } from "../builder/generator";
import { getCodexManager } from "../codex/codex-manager";
import type { BuilderRuntime, LocalBuilderEngine, RuntimeEventListener } from "./types";

export class LocalRuntime implements BuilderRuntime {
  readonly name = "local" as const;

  constructor(private readonly engine: LocalBuilderEngine = "codex") {}

  async start() {
    if (this.engine === "codex") await getCodexManager().start();
  }

  async shutdown() {
    if (this.engine === "codex") await getCodexManager().shutdown();
  }

  async build(prompt: string, onEvent: RuntimeEventListener) {
    if (this.engine === "codex") return getCodexManager().build(prompt, onEvent);

    onEvent({ status: "Planning" });
    onEvent({ status: "Creating files" });
    const result = await generateApp(prompt);
    onEvent({ status: "Building" });
    if (result.success) onEvent({ status: "Preview ready" });
    return result;
  }
}
