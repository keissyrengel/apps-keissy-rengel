import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getGeneratedAppRoot } from "../project-paths";
import type { FileChange, GeneratedFile, ProjectState } from "./types";

const PROJECT_ROOT = getGeneratedAppRoot();
const STATE_FILE = path.join(PROJECT_ROOT, ".builder-state.json");

function resolveProjectPath(relativePath: string) {
  const resolved = path.resolve(PROJECT_ROOT, relativePath);
  if (!resolved.startsWith(`${PROJECT_ROOT}${path.sep}`)) {
    throw new Error(`Unsafe generated path: ${relativePath}`);
  }
  return resolved;
}

export async function readProjectState(): Promise<ProjectState | null> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as ProjectState;
  } catch {
    return null;
  }
}

export async function projectFileExists(relativePath: string) {
  try {
    await access(resolveProjectPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function readProjectFile(relativePath: string) {
  return readFile(resolveProjectPath(relativePath), "utf8");
}

export async function writeProjectFiles(files: GeneratedFile[]): Promise<FileChange[]> {
  const changes: FileChange[] = [];
  for (const file of files) {
    const target = resolveProjectPath(file.path);
    await mkdir(path.dirname(target), { recursive: true });
    const exists = await projectFileExists(file.path);
    const previous = exists ? await readProjectFile(file.path) : null;
    if (previous === file.content) continue;
    await writeFile(target, file.content, "utf8");
    changes.push({ path: file.path, action: previous === null ? "created" : "modified" });
  }
  return changes;
}

export async function saveProjectState(state: ProjectState) {
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function getProjectRoot() {
  return PROJECT_ROOT;
}
