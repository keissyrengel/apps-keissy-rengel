import type { BuilderRuntime, BuilderRuntimeName, RuntimeOptions } from "./types";

export function resolveRuntimeName(options: RuntimeOptions = {}): BuilderRuntimeName {
  if (options.runtime) return options.runtime;
  if (process.env.BUILDER_RUNTIME === "local" || process.env.BUILDER_RUNTIME === "remote") {
    return process.env.BUILDER_RUNTIME;
  }
  const environment = options.environment ?? process.env.NODE_ENV;
  return environment === "development" ? "local" : "remote";
}

export async function createRuntime(options: RuntimeOptions = {}): Promise<BuilderRuntime> {
  const runtime = resolveRuntimeName(options);
  if (runtime === "remote") {
    const { RemoteRuntime } = await import("./remote-runtime");
    return new RemoteRuntime();
  }

  const { LocalRuntime } = await import("./local-runtime");
  return new LocalRuntime(options.localEngine ?? "codex");
}
