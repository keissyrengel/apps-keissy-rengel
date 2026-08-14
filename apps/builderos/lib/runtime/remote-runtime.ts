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
const PREVIEW_TUNNEL_NAME = "builderos-preview";
const EXPECTED_PREVIEW_HOSTNAME = "builderos-preview.konvertisagency.com";
const EXPECTED_PREVIEW_URL = `https://${EXPECTED_PREVIEW_HOSTNAME}`;
const COMMAND_TIMEOUT = 300_000;
const LOG_LIMIT = 12_000;
const HTTP_BODY_LOG_LIMIT = 4_000;
const TUNNEL_PROPAGATION_DELAY_MS = 3_000;

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

function responseDiagnosticHeaders(headers: Headers) {
  const relevant: Record<string, string> = {};
  for (const [name, value] of headers.entries()) {
    const normalized = name.toLowerCase();
    if (
      normalized === "server" ||
      normalized === "content-type" ||
      normalized.startsWith("cf-") ||
      normalized.startsWith("x-cloudflare-")
    ) {
      relevant[normalized] = value;
    }
  }
  return relevant;
}

async function diagnoseSandboxHttp(sandbox: Sandbox, host: "127.0.0.1" | "localhost") {
  const command = `curl -sS -i --max-time 10 http://${host}:${PREVIEW_PORT}/`;
  const startedAt = Date.now();
  diagnostic("info", "sandbox HTTP check", { event: "started", host, command });
  try {
    const result = await sandbox.exec(command, { timeout: 15_000 });
    const statusMatch = result.stdout.match(/^HTTP\/\S+\s+(\d{3})/m);
    const httpStatus = statusMatch ? Number(statusMatch[1]) : null;
    const healthy = result.success && httpStatus === 200;
    diagnostic(healthy ? "info" : "error", "sandbox HTTP check", {
      event: "completed",
      host,
      command,
      durationMs: elapsedSince(startedAt),
      exitCode: result.exitCode,
      httpStatus,
      response: result.stdout.slice(0, HTTP_BODY_LOG_LIMIT),
      stderr: relevantOutput(result.stderr),
    });
    return { healthy, httpStatus, response: result.stdout };
  } catch (error) {
    diagnostic("error", "sandbox HTTP check", {
      event: "failed",
      host,
      command,
      durationMs: elapsedSince(startedAt),
      error: fullError(error),
    });
    return { healthy: false, httpStatus: null, response: "" };
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
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

    const previewLogs = await previewProcess.getLogs().catch(() => null);
    const listensOnExpectedAddress = /(?:0\.0\.0\.0|Network:\s+http:\/\/0\.0\.0\.0):3001/i.test(
      `${previewLogs?.stdout ?? ""}\n${previewLogs?.stderr ?? ""}`,
    );
    diagnostic(listensOnExpectedAddress ? "info" : "error", "tunnel preflight", {
      event: "preview-process-logs",
      processId: PREVIEW_PROCESS_ID,
      status: tunnelProcessStatus,
      expectedAddress: "0.0.0.0:3001",
      listensOnExpectedAddress,
      stdout: relevantOutput(previewLogs?.stdout ?? ""),
      stderr: relevantOutput(previewLogs?.stderr ?? ""),
    });

    const loopbackCheck = await diagnoseSandboxHttp(sandbox, "127.0.0.1");
    const localhostCheck = await diagnoseSandboxHttp(sandbox, "localhost");
    if (!loopbackCheck.healthy || !localhostCheck.healthy) {
      throw new Error("Remote preview server failed its internal HTTP checks.");
    }

    const tunnelStartedAt = Date.now();
    diagnostic("info", "named tunnel creation", {
      event: "started",
      port: PREVIEW_PORT,
      tunnelName: PREVIEW_TUNNEL_NAME,
      expectedHostname: EXPECTED_PREVIEW_HOSTNAME,
      accountResolution: "CLOUDFLARE_ACCOUNT_ID",
      zoneResolution: "CLOUDFLARE_ZONE_ID",
    });

    const existingTunnels = await sandbox.tunnels.list().catch((error) => {
      diagnostic("error", "named tunnel migration", {
        event: "list-failed",
        port: PREVIEW_PORT,
        error: fullError(error),
      });
      return [];
    });
    const legacyQuickTunnel = existingTunnels.find(
      (item) => item.port === PREVIEW_PORT && item.name === undefined,
    );
    if (legacyQuickTunnel) {
      const migrationStartedAt = Date.now();
      diagnostic("info", "named tunnel migration", {
        event: "legacy-quick-tunnel-found",
        port: PREVIEW_PORT,
        tunnelId: legacyQuickTunnel.id,
        previewUrl: legacyQuickTunnel.url,
      });
      try {
        await sandbox.tunnels.destroy(legacyQuickTunnel);
        diagnostic("info", "named tunnel migration", {
          event: "legacy-quick-tunnel-destroyed",
          port: PREVIEW_PORT,
          durationMs: elapsedSince(migrationStartedAt),
        });
      } catch (error) {
        diagnostic("error", "named tunnel migration", {
          event: "legacy-quick-tunnel-destroy-failed",
          port: PREVIEW_PORT,
          durationMs: elapsedSince(migrationStartedAt),
          error: fullError(error),
        });
        throw new Error("Remote app is running, but the legacy preview tunnel could not be replaced.");
      }
    }

    let tunnel: Awaited<ReturnType<typeof sandbox.tunnels.get>>;
    try {
      tunnel = await sandbox.tunnels.get(PREVIEW_PORT, { name: PREVIEW_TUNNEL_NAME });
      diagnostic("info", "named tunnel creation", {
        event: "completed",
        port: PREVIEW_PORT,
        tunnelName: PREVIEW_TUNNEL_NAME,
        durationMs: elapsedSince(tunnelStartedAt),
        tunnelId: tunnel.id,
        previewUrl: tunnel.url,
        hostname: tunnel.hostname,
        expectedHostname: EXPECTED_PREVIEW_HOSTNAME,
        hostnameMatches: tunnel.hostname === EXPECTED_PREVIEW_HOSTNAME,
        accountResolved: true,
        zoneResolved: true,
      });
    } catch (error) {
      const errorRecord = error && typeof error === "object" ? error as Record<string, unknown> : null;
      diagnostic("error", "named tunnel creation", {
        event: "failed",
        port: PREVIEW_PORT,
        tunnelName: PREVIEW_TUNNEL_NAME,
        expectedHostname: EXPECTED_PREVIEW_HOSTNAME,
        durationMs: elapsedSince(tunnelStartedAt),
        status: errorRecord?.status,
        code: errorRecord?.code,
        responseBody: typeof errorRecord?.body === "string" ? errorRecord.body.slice(0, HTTP_BODY_LOG_LIMIT) : undefined,
        accountResolution: "CLOUDFLARE_ACCOUNT_ID",
        zoneResolution: "CLOUDFLARE_ZONE_ID",
        error: fullError(error),
      });
      throw new Error("Remote app is running, but Cloudflare named preview tunnel is unavailable.");
    }

    if (tunnel.hostname !== EXPECTED_PREVIEW_HOSTNAME || tunnel.url !== EXPECTED_PREVIEW_URL) {
      diagnostic("error", "named tunnel validation", {
        event: "hostname-mismatch",
        tunnelName: PREVIEW_TUNNEL_NAME,
        expectedHostname: EXPECTED_PREVIEW_HOSTNAME,
        expectedUrl: EXPECTED_PREVIEW_URL,
        actualHostname: tunnel.hostname,
        actualUrl: tunnel.url,
      });
      throw new Error("Remote named preview tunnel returned an unexpected hostname.");
    }

    const previewUrl = tunnel.url;
    diagnostic("info", "named tunnel propagation", {
      event: "waiting",
      previewUrl,
      delayMs: TUNNEL_PROPAGATION_DELAY_MS,
    });
    await wait(TUNNEL_PROPAGATION_DELAY_MS);

    const fetchStartedAt = Date.now();
    diagnostic("info", "named tunnel HTTP check", {
      event: "started",
      previewUrl,
      hostname: tunnel.hostname,
    });
    try {
      const response = await fetch(previewUrl, { redirect: "follow" });
      const body = await response.text();
      diagnostic(response.ok ? "info" : "error", "named tunnel HTTP check", {
        event: "completed",
        previewUrl,
        hostname: tunnel.hostname,
        durationMs: elapsedSince(fetchStartedAt),
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
        headers: responseDiagnosticHeaders(response.headers),
        body: body.slice(0, HTTP_BODY_LOG_LIMIT),
        ok: response.ok,
      });
      if (!response.ok) {
        throw new Error(`Named tunnel returned HTTP ${response.status} ${response.statusText}.`);
      }
    } catch (error) {
      diagnostic("error", "named tunnel HTTP check", {
        event: "failed",
        previewUrl,
        hostname: tunnel.hostname,
        durationMs: elapsedSince(fetchStartedAt),
        error: fullError(error),
      });
      throw new Error("Remote app is running, but Cloudflare named preview tunnel is unavailable.");
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
