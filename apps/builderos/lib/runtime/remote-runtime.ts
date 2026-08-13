import { getSandbox, type Sandbox } from "@cloudflare/sandbox";

import type { BuilderRuntime, RuntimeEventListener } from "./types";

const SANDBOX_ID = "builderos-test";

type RemoteBindings = {
  Sandbox: DurableObjectNamespace<Sandbox>;
};

let remoteBindings: RemoteBindings | undefined;

export function configureRemoteRuntime(bindings: RemoteBindings) {
  remoteBindings = bindings;
}

/** Runs the minimal remote connectivity check through the Sandbox RPC binding. */
export class RemoteRuntime implements BuilderRuntime {
  readonly name = "remote" as const;

  async build(_prompt: string, onEvent: RuntimeEventListener) {
    onEvent({ status: "Planning", detail: "Connecting to remote sandbox" });
    if (!remoteBindings?.Sandbox) throw new Error("Cloudflare Sandbox binding is not configured.");

    const sandbox = getSandbox(remoteBindings.Sandbox, SANDBOX_ID, {
      transport: "rpc",
      enableDefaultSession: false,
    });

    onEvent({ status: "Running commands", detail: "Checking remote Node runtime" });
    const command = await sandbox.exec("node --version");
    if (!command.success) {
      throw new Error(command.stderr.trim() || `Remote command failed with exit code ${command.exitCode}.`);
    }

    const nodeVersion = command.stdout.trim();
    const message = `Remote sandbox ready. Node ${nodeVersion}`;
    onEvent({ status: "Preview ready", detail: message });
    return {
      success: true,
      changes: [],
      message,
    };
  }
}
