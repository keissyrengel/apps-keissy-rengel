import type { BuilderStatus, GenerateResult } from "../builder/types";

export type BuilderRuntimeName = "local" | "remote";
export type LocalBuilderEngine = "local" | "codex";

export interface RuntimeEvent {
  status: BuilderStatus;
  detail?: string;
}

export type RuntimeEventListener = (event: RuntimeEvent) => void;

export interface BuilderRuntime {
  readonly name: BuilderRuntimeName;
  start?(): Promise<void>;
  shutdown?(): Promise<void>;
  build(prompt: string, onEvent: RuntimeEventListener): Promise<GenerateResult>;
}

export interface RuntimeOptions {
  runtime?: BuilderRuntimeName;
  localEngine?: LocalBuilderEngine;
  environment?: "development" | "production" | "test";
}
