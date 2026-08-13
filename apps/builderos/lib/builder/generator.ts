import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createInitialProject, modifyProject } from "./templates";
import { getProjectRoot, readProjectState, saveProjectState, writeProjectFiles } from "./project-manager";
import type { GenerateResult } from "./types";

const execFileAsync = promisify(execFile);

export async function generateApp(prompt: string): Promise<GenerateResult> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) return { success: false, changes: [], error: "The prompt cannot be empty." };

  try {
    const current = await readProjectState();
    const plan = current ? modifyProject(current, cleanPrompt) : createInitialProject(cleanPrompt);
    const changes = await writeProjectFiles(plan.files);
    await saveProjectState(plan.state);

    try {
      await execFileAsync("npm", ["run", "build"], {
        cwd: getProjectRoot(),
        env: { ...process.env, NODE_ENV: "production" },
        timeout: 120_000,
        maxBuffer: 1024 * 1024 * 4,
      });
    } catch (buildError) {
      const error = buildError as Error & { stderr?: string; stdout?: string };
      return {
        success: false,
        changes,
        state: plan.state,
        error: (error.stderr || error.stdout || error.message).slice(-4000),
      };
    }

    return { success: true, changes, state: plan.state };
  } catch (error) {
    return {
      success: false,
      changes: [],
      error: error instanceof Error ? error.message : "Unknown generation error.",
    };
  }
}
