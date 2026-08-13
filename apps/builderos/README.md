# BuilderOS

BuilderOS converts a prompt into real code changes inside an independent Next.js application. During local development, the BuilderOS workspace runs on port `3000`, the generated application runs on port `3001`, and Codex App Server performs changes through a persistent local thread.

The project is portable and can live at the repository root or inside a monorepo at `apps/builderos`. Internal project paths are resolved from BuilderOS's own `package.json`, not from the monorepo root or an absolute machine path.

## Installation

Requirements:

- Node.js `>=22.13.0`
- npm
- Codex CLI installed and authenticated locally when using the Codex engine

From the BuilderOS directory:

```bash
npm install
npm --prefix ./generated-app install
```

## Local development

```bash
npm run dev
```

This starts:

- BuilderOS: `http://localhost:3000`
- generated-app: `http://localhost:3001`
- Codex App Server: a child process managed by the BuilderOS backend over stdin/stdout

Useful validation commands:

```bash
npm run lint
npm run typecheck
npm run build
npm run build:generated
```

## Environment variables

Copy `.env.example` to `.env.local` when overrides are needed. Do not commit `.env.local` or secrets.

| Variable | Default | Purpose |
| --- | --- | --- |
| `BUILDER_RUNTIME` | `local` in development, `remote` in production | Selects the local filesystem/Codex runtime or the future Cloudflare runtime. The remote runtime is currently a controlled stub. |
| `BUILDER_ENGINE` | `codex` | Use `codex` for Codex App Server or `local` for the template fallback. |
| `CODEX_MODEL` | Codex configuration | Optional model override. Usually left unset. |

Codex authentication remains in the developer's local Codex configuration and is never exposed to the browser.

## Local architecture

```text
apps/builderos/
├── app/                 BuilderOS application
├── components/          BuilderOS UI
├── lib/
│   ├── builder/         Local fallback generator and project manager
│   ├── codex/           App Server client, thread manager and event mapping
│   └── runtime/         Local/remote runtime boundary and selection
├── build/               Local API middleware and Cloudflare build helpers
└── generated-app/       Independent Next.js application edited by Codex
```

The request flow is:

```text
prompt → BuilderOS backend → Codex App Server → generated-app files
       → Next.js hot reload on :3001 → iframe preview → Changes panel
```

One in-memory Codex thread is associated with `generated-app` for the current BuilderOS process. The App Server process is reused between prompts and is shut down gracefully with the development server.

`BUILDER_RUNTIME=local` preserves this complete local pipeline. `BUILDER_RUNTIME=remote` routes builds to `lib/runtime/remote-runtime.ts`, which currently returns `Remote runtime is not configured yet.` without executing commands. Cloudflare Sandbox/Containers will be connected at that runtime boundary later.

## Monorepo placement

Move this entire directory to `apps/builderos` without separating `generated-app`. Run commands from the BuilderOS workspace or through the monorepo's workspace runner. Keep the root `package.json`, lockfile, `.openai`, `.env.example`, and `generated-app` together.

No root-relative monorepo paths or machine-specific absolute paths are required.

## Deployment architecture

The intended production architecture is:

- BuilderOS will be deployed on Cloudflare.
- Generated projects will execute in isolated Cloudflare Sandbox/Containers rather than inside the BuilderOS web process.
- GitHub will be the source of truth for generated project code and its history.

Cloudflare Sandbox/Containers, GitHub synchronization and deployment orchestration are intentionally not implemented in this phase.
