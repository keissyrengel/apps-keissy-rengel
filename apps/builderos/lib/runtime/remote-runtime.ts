import { getSandbox, type Process as SandboxProcess, type Sandbox } from "@cloudflare/sandbox";

import { getBundledGeneratedAppFiles } from "./generated-app-files";
import type { BuilderRuntime, RuntimeEventListener } from "./types";

const SANDBOX_ID = "builderos-test";
const REMOTE_PROJECT_ROOT = "/workspace/generated-app";
const PREVIEW_PROCESS_ID = "generated-app-dev";
const PREVIEW_PORT = 3001;
const PREVIEW_COMMAND = "npm run dev -- --hostname 0.0.0.0 --port 3001";

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

    onEvent({ status: "Running commands", detail: "Installing dependencies" });
    const install = await sandbox.exec("npm install", {
      cwd: REMOTE_PROJECT_ROOT,
      timeout: 300_000,
    });
    if (!install.success) {
      throw new Error(commandError("npm install", install));
    }

    onEvent({ status: "Building", detail: "Building generated app" });
    const build = await sandbox.exec("npm run build", {
      cwd: REMOTE_PROJECT_ROOT,
      timeout: 300_000,
    });
    if (!build.success) {
      throw new Error(commandError("npm run build", build));
    }

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
        try {
          await previewProcess.waitForPort(PREVIEW_PORT, { timeout: 5_000 });
        } catch {
          await stopPreviewProcess(previewProcess);
          previewProcess = null;
        }
      } else {
        await stopPreviewProcess(previewProcess);
        previewProcess = null;
      }
    }

    if (!previewProcess) {
      try {
        previewProcess = await sandbox.startProcess(PREVIEW_COMMAND, {
          cwd: REMOTE_PROJECT_ROOT,
          processId: PREVIEW_PROCESS_ID,
        });
      } catch (error) {
        throw new Error(`Remote preview process failed to start: ${errorMessage(error)}`);
      }

      onEvent({ status: "Running commands", detail: "Waiting for app" });
      try {
        await previewProcess.waitForPort(PREVIEW_PORT, { timeout: 60_000 });
      } catch (error) {
        const logs = await previewProcess.getLogs().catch(() => null);
        await stopPreviewProcess(previewProcess);
        const logDetail = logs?.stderr.trim() || logs?.stdout.trim();
        throw new Error(
          `Remote preview did not become ready on port ${PREVIEW_PORT}: ${logDetail || errorMessage(error)}`,
        );
      }
    }

    let previewUrl: string;
    try {
      const tunnel = await sandbox.tunnels.get(PREVIEW_PORT);
      previewUrl = tunnel.url;
    } catch (error) {
      throw new Error(`Remote preview tunnel is unavailable: ${errorMessage(error)}`);
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
