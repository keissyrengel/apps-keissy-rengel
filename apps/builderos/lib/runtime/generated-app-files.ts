/// <reference types="vite/client" />

const GENERATED_APP_PREFIX = "../../generated-app/";

const bundledFiles = import.meta.glob<string>(
  [
    "../../generated-app/**/*",
    "!../../generated-app/{node_modules,.next,.next-dev,.turbo,.cache,coverage,dist,out}/**/*",
    "!../../generated-app/**/*.tsbuildinfo",
    "!../../generated-app/**/*.{log,tmp,temp}",
    "!../../generated-app/**/.DS_Store",
  ],
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
);

export interface BundledGeneratedFile {
  path: string;
  content: string;
}

export function getBundledGeneratedAppFiles(): BundledGeneratedFile[] {
  return Object.entries(bundledFiles)
    .map(([sourcePath, content]) => {
      if (!sourcePath.startsWith(GENERATED_APP_PREFIX)) {
        throw new Error(`Unexpected generated-app source path: ${sourcePath}`);
      }

      return {
        path: sourcePath.slice(GENERATED_APP_PREFIX.length),
        content,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}
