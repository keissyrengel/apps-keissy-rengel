import { Workspace } from "@/components/builder/workspace";
import { accessGateEnabled, getConfig } from "@/lib/env";

export default function Home() {
  const config = getConfig();

  return (
    <Workspace
      requiresAccessCode={accessGateEnabled(config)}
      publicBaseUrl={config.publicBaseUrl}
    />
  );
}
