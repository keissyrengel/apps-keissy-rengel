import type { BuilderStatus, GenerateResult } from "../builder/types";

export type JsonRpcId = number | string;

export interface ProtocolRequest {
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface ProtocolResponse {
  id: JsonRpcId;
  result?: unknown;
  error?: { code?: number; message: string; data?: unknown };
}

export interface ProtocolNotification {
  method: string;
  params?: Record<string, unknown>;
}

export type ProtocolMessage = ProtocolRequest | ProtocolResponse | ProtocolNotification;

export interface CodexThreadStartResponse {
  thread: { id: string };
}

export interface CodexTurnStartResponse {
  turn: { id: string; status: string; error?: { message?: string } | null };
}

export interface CodexUiEvent {
  status: BuilderStatus;
  detail?: string;
}

export interface CodexBuildResult extends GenerateResult {
  threadId?: string;
}

export type NotificationListener = (notification: ProtocolNotification) => void;
