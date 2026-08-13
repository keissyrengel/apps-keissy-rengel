import { getSandbox, type Process as SandboxProcess, type Sandbox } from "@cloudflare/sandbox";

import { getBundledGeneratedAppFiles } from "./generated-app-files";
import type { BuilderRuntime, RuntimeEventListener } from "./types";

const SANDBOX_ID = "builderos-test";
const REMOTE_PROJECT_ROOT = "/workspace/generated-app";
const PREVIEW_PROCESS_ID = "generated-app-dev";
const INSTALL_PROCESS_ID = "generated-app-install";
const BUILD_PROCESS_ID = "generated-app-build";
const PREVIEW_PORT = 3001;
const PREVIEW_COMMAND = "npm run dev -- --hostname 0.0.0.0 --port 3001";
const COMMAND_TIMEOUT = 300_000;
const LOG_LIMIT = 12_000;

type RemoteBindings = {
  Sandbox: DurableObjectNamespace<Sandbox>;
};

let remoteBindings: RemoteBindings | undefined;

export function configureRemoteRuntime(bindings: RemoteBindings) {
  remoteBindings = bindings;
}

function parentDirectory(path: string) {
  const separator = path.lastIndexOf("/");
  return separator === -1 ? "" : path.slice(0, separator);
}

function commandError(command: string, result: { stderr: string; exitCode: number }) {
  return result.stderr.trim() || `${command} failed with exit code ${result.exitCode}.`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function fullError(error: unknown) {
  if (!(error instanceof Error)) return { value: String(error) };
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause instanceof Error
      ? { name: error.cause.name, message: error.cause.message, stack: error.cause.stack }
      : error.cause === undefined
        ? undefined
        : String(error.cause),
  };
}

function elapsedSince(startedAt: number) {
  return Date.now() - startedAt;
}

function relevantOutput(output: string) {
  const trimmed = output.trim();
  return trimmed.length > LOG_LIMIT ? `[last ${LOG_LIMIT} chars]\n${trimmed.slice(-LOG_LIMIT)}` : trimmed;
}

function diagnostic(
  level: "info" | "error",
  step: string,
  data: Record<string, unknown>,
) {
  const entry = JSON.stringify({ scope: "builderos.remote-runtime", step, ...data });
  if (level === "error") console.error(entry);
  else console.info(entry);
}

async function runInstall(sandbox: Sandbox) {
  const step = "npm install";
  const existing = await sandbox.getProcess(INSTALL_PROCESS_ID);
  if (existing) {
    const status = await existing.getStatus();
    const logs = await existing.getLogs().catch(() => ({ stdout: "", stderr: "" }));
    if (status === "starting" || status === "running") {
      diagnostic("error", step, {
        event: "existing-process-still-alive",
        command: step,
        processId: INSTALL_PROCESS_ID,
        status,
        stdout: relevantOutput(logs.stdout),
        stderr: relevantOutput(logs.stderr),
      });
      throw new Error("Remote dependency installation is still running.");
    }
    await sandbox.cleanupCompletedProcesses();
  }

  const startedAt = Date.now();
  diagnostic("info", step, {
    event: "started",
    command: step,
    processId: INSTALL_PROCESS_ID,
    timeoutMs: COMMAND_TIMEOUT,
  });

  const process = await sandbox.startProcess(step, {
    cwd: REMOTE_PROJECT_ROOT,
    processId: INSTALL_PROCESS_ID,
    autoCleanup: false,
  });

  try {
    const result = await process.waitForExit(COMMAND_TIMEOUT);
    const logs = await process.getLogs().catch(() => ({ stdout: "", stderr: "" }));
    diagnostic(result.exitCode === 0 ? "info" : "error", step, {
      event: "completed",
      command: step,
      processId: INSTALL_PROCESS_ID,
      durationMs: elapsedSince(startedAt),
      exitCode: result.exitCode,
      stdout: relevantOutput(logs.stdout),
      stderr: relevantOutput(logs.stderr),
    });
    await sandbox.cleanupCompletedProcesses();
    if (result.exitCode !== 0) throw new Error("Remote dependency installation failed.");
  } catch (error) {
    const status = await process.getStatus().catch(() => "error" as const);
    const logs = await process.getLogs().catch(() => ({ stdout: "", stderr: "" }));
    const processAlive = status === "starting" || status === "running";
    diagnostic("error", step, {
      event: elapsedSince(startedAt) >= COMMAND_TIMEOUT ? "timeout" : "failed",
      command: step,
      processId: INSTALL_PROCESS_ID,
      timeoutMs: COMMAND_TIMEOUT,
      durationMs: elapsedSince(startedAt),
      status,
      processAlive,
      error: errorMessage(error),
      stdout: relevantOutput(logs.stdout),
      stderr: relevantOutput(logs.stderr),
    });
    if (!processAlive) await sandbox.cleanupCompletedProcesses().catch(() => undefined);
    throw new Error(
      processAlive
        ? "Remote dependency installation timed out and is still running."
        : "Remote dependency installation failed.",
    );
  }
}

async function runBuild(sandbox: Sandbox) {
  const command = "npm run build";
  const existing = await sandbox.getProcess(BUILD_PROCESS_ID);
  if (existing) {
    const status = await existing.getStatus();
    const logs = await existing.getLogs().catch(() => ({ stdout: "", stderr: "" }));
    if (status === "starting" || status === "running") {
      diagnostic("error", command, {
        event: "existing-process-still-alive",
        command,
        processId: BUILD_PROCESS_ID,
        status,
        stdout: relevantOutput(logs.stdout),
        stderr: relevantOutput(logs.stderr),
      });
      throw new Error("Remote generated-app build is still running.");
    }
    await sandbox.cleanupCompletedProcesses();
  }

  const startedAt = Date.now();
  diagnostic("info", command, {
    event: "started",
    command,
    processId: BUILD_PROCESS_ID,
    timeoutMs: COMMAND_TIMEOUT,
  });
  const process = await sandbox.startProcess(command, {
    cwd: REMOTE_PROJECT_ROOT,
    processId: BUILD_PROCESS_ID,
    autoCleanup: false,
  });
  try {
    const result = await process.waitForExit(COMMAND_TIMEOUT);
    const logs = await process.getLogs().catch(() => ({ stdout: "", stderr: "" }));
    diagnostic(result.exitCode === 0 ? "info" : "error", command, {
      event: "completed",
      command,
      processId: BUILD_PROCESS_ID,
      durationMs: elapsedSince(startedAt),
      exitCode: result.exitCode,
      stdout: relevantOutput(logs.stdout),
      stderr: relevantOutput(logs.stderr),
    });
    await sandbox.cleanupCompletedProcesses();
    if (result.exitCode !== 0) throw new Error("Remote generated-app build failed.");
  } catch (error) {
    const status = await process.getStatus().catch(() => "error" as const);
    const logs = await process.getLogs().catch(() => ({ stdout: "", stderr: "" }));
    diagnostic("error", command, {
      event: elapsedSince(startedAt) >= COMMAND_TIMEOUT ? "timeout" : "failed",
      command,
      processId: BUILD_PROCESS_ID,
      timeoutMs: COMMAND_TIMEOUT,
      durationMs: elapsedSince(startedAt),
      status,
      processAlive: status === "starting" || status === "running",
      error: errorMessage(error),
      stdout: relevantOutput(logs.stdout),
      stderr: relevantOutput(logs.stderr),
    });
    if (status !== "starting" && status !== "running") {
      await sandbox.cleanupCompletedProcesses().catch(() => undefined);
    }
    throw new Error("Remote generated-app build failed.");
  }
}

async function stopPreviewProcess(process: SandboxProcess) {
  try {
    await process.kill();
  } catch {
    // A process that exited between the health check and kill is already stopped.
  }
}

/** Synchronizes the bundled generated app and validates it in Cloudflare Sandbox. */
export class RemoteRuntime implements BuilderRuntime {
  readonly name = "remote" as const;

  async build(_prompt: string, onEvent: RuntimeEventListener) {
    onEvent({ status: "Planning", detail: "Preparing workspace" });
    if (!remoteBindings?.Sandbox) throw new Error("Cloudflare Sandbox binding is not configured.");

    const sandbox = getSandbox(remoteBindings.Sandbox, SANDBOX_ID, {
      transport: "rpc",
      enableDefaultSession: false,
    });

    const files = getBundledGeneratedAppFiles();
    if (files.length === 0) throw new Error("No generated-app files were bundled for remote sync.");

    onEvent({ status: "Creating files", detail: "Syncing files" });
    const syncStartedAt = Date.now();
    diagnostic("info", "Syncing files", { event: "started", fileCount: files.length });
    try {
      const reset = await sandbox.exec(`rm -rf ${REMOTE_PROJECT_ROOT}`);
      if (!reset.success) throw new Error(commandError("Workspace reset", reset));
      await sandbox.mkdir(REMOTE_PROJECT_ROOT, { recursive: true });

      const directories = new Set(
        files
          .map((file) => parentDirectory(file.path))
          .filter(Boolean),
      );
      await Promise.all(
        [...directories].map((directory) =>
          sandbox.mkdir(`${REMOTE_PROJECT_ROOT}/${directory}`, { recursive: true }),
        ),
      );
      await Promise.all(
        files.map((file) =>
          sandbox.writeFile(`${REMOTE_PROJECT_ROOT}/${file.path}`, file.content),
        ),
      );
      diagnostic("info", "Syncing files", {
        event: "completed",
        durationMs: elapsedSince(syncStartedAt),
        fileCount: files.length,
        directoryCount: directories.size,
        resetStdout: relevantOutput(reset.stdout),
        resetStderr: relevantOutput(reset.stderr),
      });
    } catch (error) {
      diagnostic("error", "Syncing files", {
        event: "failed",
        durationMs: elapsedSince(syncStartedAt),
        error: errorMessage(error),
      });
      throw new Error("Remote workspace synchronization failed.");
    }

    onEvent({ status: "Running commands", detail: "Installing dependencies" });
    await runInstall(sandbox);

    onEvent({ status: "Building", detail: "Building generated app" });
    await runBuild(sandbox);

    onEvent({ status: "Running commands", detail: "Starting preview" });
    let previewProcess = await sandbox.getProcess(PREVIEW_PROCESS_ID);
    if (previewProcess) {
      let status;
      try {
        status = await previewProcess.getStatus();
      } catch {
        status = "error" as const;
      }

      if (status === "starting" || status === "running") {
        onEvent({ status: "Running commands", detail: "Waiting for app" });
        const reuseWaitStartedAt = Date.now();
        diagnostic("info", "waitForPort", {
          event: "started",
          processId: PREVIEW_PROCESS_ID,
          port: PREVIEW_PORT,
          timeoutMs: 5_000,
          reusedProcess: true,
        });
        try {
          await previewProcess.waitForPort(PREVIEW_PORT, { timeout: 5_000 });
          diagnostic("info", "waitForPort", {
            event: "completed",
            processId: PREVIEW_PROCESS_ID,
            port: PREVIEW_PORT,
            durationMs: elapsedSince(reuseWaitStartedAt),
            reusedProcess: true,
          });
        } catch (error) {
          const logs = await previewProcess.getLogs().catch(() => null);
          diagnostic("error", "waitForPort", {
            event: "failed",
            processId: PREVIEW_PROCESS_ID,
            port: PREVIEW_PORT,
            timeoutMs: 5_000,
            durationMs: elapsedSince(reuseWaitStartedAt),
            reusedProcess: true,
            error: errorMessage(error),
            stdout: relevantOutput(logs?.stdout ?? ""),
            stderr: relevantOutput(logs?.stderr ?? ""),
          });
          await stopPreviewProcess(previewProcess);
          previewProcess = null;
        }
      } else {
        await stopPreviewProcess(previewProcess);
        previewProcess = null;
      }
    }

    if (!previewProcess) {
      const startProcessStartedAt = Date.now();
      diagnostic("info", "startProcess", {
        event: "started",
        command: PREVIEW_COMMAND,
        processId: PREVIEW_PROCESS_ID,
      });
      try {
        previewProcess = await sandbox.startProcess(PREVIEW_COMMAND, {
          cwd: REMOTE_PROJECT_ROOT,
          processId: PREVIEW_PROCESS_ID,
        });
        diagnostic("info", "startProcess", {
          event: "completed",
          command: PREVIEW_COMMAND,
          processId: PREVIEW_PROCESS_ID,
          durationMs: elapsedSince(startProcessStartedAt),
        });
      } catch (error) {
        diagnostic("error", "startProcess", {
          event: "failed",
          command: PREVIEW_COMMAND,
          processId: PREVIEW_PROCESS_ID,
          durationMs: elapsedSince(startProcessStartedAt),
          error: errorMessage(error),
        });
        throw new Error("Remote preview process failed to start.");
      }

      onEvent({ status: "Running commands", detail: "Waiting for app" });
      const waitStartedAt = Date.now();
      diagnostic("info", "waitForPort", {
        event: "started",
        processId: PREVIEW_PROCESS_ID,
        port: PREVIEW_PORT,
        timeoutMs: 60_000,
      });
      try {
        await previewProcess.waitForPort(PREVIEW_PORT, { timeout: 60_000 });
        diagnostic("info", "waitForPort", {
          event: "completed",
          processId: PREVIEW_PROCESS_ID,
          port: PREVIEW_PORT,
          durationMs: elapsedSince(waitStartedAt),
        });
      } catch (error) {
        const logs = await previewProcess.getLogs().catch(() => null);
        diagnostic("error", "waitForPort", {
          event: "failed",
          processId: PREVIEW_PROCESS_ID,
          port: PREVIEW_PORT,
          timeoutMs: 60_000,
          durationMs: elapsedSince(waitStartedAt),
          error: errorMessage(error),
          stdout: relevantOutput(logs?.stdout ?? ""),
          stderr: relevantOutput(logs?.stderr ?? ""),
        });
        await stopPreviewProcess(previewProcess);
        throw new Error(`Remote preview did not become ready on port ${PREVIEW_PORT}.`);
      }
    }

    const tunnelPreflightStartedAt = Date.now();
    const tunnelProcessStatus = await previewProcess.getStatus().catch(() => "error" as const);
    diagnostic(tunnelProcessStatus === "running" ? "info" : "error", "tunnel preflight", {
      event: "process-status",
      processId: PREVIEW_PROCESS_ID,
      status: tunnelProcessStatus,
      durationMs: elapsedSince(tunnelPreflightStartedAt),
    });
    if (tunnelProcessStatus !== "running") {
      const logs = await previewProcess.getLogs().catch(() => null);
      diagnostic("error", "tunnel preflight", {
        event: "server-not-running",
        processId: PREVIEW_PROCESS_ID,
        status: tunnelProcessStatus,
        stdout: relevantOutput(logs?.stdout ?? ""),
        stderr: relevantOutput(logs?.stderr ?? ""),
      });
      throw new Error("Remote preview server is not running.");
    }

    const preflightPortStartedAt = Date.now();
    diagnostic("info", "tunnel preflight", {
      event: "port-check-started",
      processId: PREVIEW_PROCESS_ID,
      port: PREVIEW_PORT,
      timeoutMs: 5_000,
    });
    try {
      await previewProcess.waitForPort(PREVIEW_PORT, { timeout: 5_000 });
      diagnostic("info", "tunnel preflight", {
        event: "port-check-completed",
        processId: PREVIEW_PROCESS_ID,
        port: PREVIEW_PORT,
        durationMs: elapsedSince(preflightPortStartedAt),
      });
    } catch (error) {
      const logs = await previewProcess.getLogs().catch(() => null);
      diagnostic("error", "tunnel preflight", {
        event: "port-check-failed",
        processId: PREVIEW_PROCESS_ID,
        port: PREVIEW_PORT,
        durationMs: elapsedSince(preflightPortStartedAt),
        error: fullError(error),
        stdout: relevantOutput(logs?.stdout ?? ""),
        stderr: relevantOutput(logs?.stderr ?? ""),
      });
      throw new Error(`Remote preview did not respond on port ${PREVIEW_PORT}.`);
    }

    async function getPreviewTunnel(attempt: 1 | 2) {
      const tunnelStartedAt = Date.now();
      diagnostic("info", "tunnel creation", {
        event: "started",
        attempt,
        port: PREVIEW_PORT,
      });
      try {
        const createdTunnel = await sandbox.tunnels.get(PREVIEW_PORT);
        diagnostic("info", "tunnel creation", {
          event: "completed",
          attempt,
          port: PREVIEW_PORT,
          durationMs: elapsedSince(tunnelStartedAt),
          tunnelId: createdTunnel.id,
          previewUrl: createdTunnel.url,
          hostname: createdTunnel.hostname,
        });
        return createdTunnel;
      } catch (error) {
        diagnostic("error", "tunnel creation", {
          event: "failed",
          attempt,
          port: PREVIEW_PORT,
          durationMs: elapsedSince(tunnelStartedAt),
          error: fullError(error),
        });
        throw error;
      }
    }

    let tunnel: Awaited<ReturnType<typeof sandbox.tunnels.get>>;
    try {
      tunnel = await getPreviewTunnel(1);
    } catch {
      const destroyStartedAt = Date.now();
      diagnostic("info", "tunnel cleanup", {
        event: "started",
        port: PREVIEW_PORT,
      });
      try {
        await sandbox.tunnels.destroy(PREVIEW_PORT);
        diagnostic("info", "tunnel cleanup", {
          event: "completed",
          port: PREVIEW_PORT,
          durationMs: elapsedSince(destroyStartedAt),
        });
      } catch (destroyError) {
        diagnostic("error", "tunnel cleanup", {
          event: "failed",
          port: PREVIEW_PORT,
          durationMs: elapsedSince(destroyStartedAt),
          error: fullError(destroyError),
        });
      }

      try {
        tunnel = await getPreviewTunnel(2);
      } catch {
        throw new Error("Remote preview tunnel is unavailable.");
      }
    }

    const previewUrl = tunnel.url;
    const fetchStartedAt = Date.now();
    diagnostic("info", "tunnel HTTP check", {
      event: "started",
      previewUrl,
      hostname: tunnel.hostname,
    });
    try {
      const response = await fetch(previewUrl, { redirect: "follow" });
      const contentType = response.headers.get("content-type");
      diagnostic(response.ok ? "info" : "error", "tunnel HTTP check", {
        event: "completed",
        previewUrl,
        hostname: tunnel.hostname,
        durationMs: elapsedSince(fetchStartedAt),
        status: response.status,
        statusText: response.statusText,
        contentType,
        ok: response.ok,
      });
      if (!response.ok) throw new Error(`Tunnel returned HTTP ${response.status} ${response.statusText}.`);
    } catch (error) {
      diagnostic("error", "tunnel HTTP check", {
        event: "failed",
        previewUrl,
        hostname: tunnel.hostname,
        durationMs: elapsedSince(fetchStartedAt),
        error: fullError(error),
      });
      throw new Error("Remote preview tunnel did not pass its HTTP health check.");
    }

    const message = "Remote generated-app ready.";
    onEvent({ status: "Preview ready", detail: "Preview ready" });
    return {
      success: true,
      changes: [],
      message,
      previewUrl,
    };
  }
}
