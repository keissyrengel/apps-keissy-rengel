import { dirname, resolve } from "node:path";

/**
 * npm exposes the package.json of the workspace whose script is running.
 * This remains stable whether BuilderOS lives at the repository root or at
 * apps/builderos and avoids coupling project paths to the caller's cwd.
 */
export function getBuilderOsRoot() {
  const packageJson = process.env.npm_package_json;
  return packageJson ? dirname(resolve(packageJson)) : resolve(process.cwd());
}

export function getGeneratedAppRoot() {
  return resolve(getBuilderOsRoot(), "generated-app");
}
