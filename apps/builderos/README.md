# BuilderOS

Describe an app in plain language, see it running in the preview, and publish it to
GitHub Pages with one click.

BuilderOS is a single Cloudflare Worker. It calls the OpenAI API to write a complete,
self-contained HTML application, renders it in a sandboxed iframe, and — when you press
Publish — commits it to `apps/<slug>/index.html` in this repository, where GitHub Pages
serves it at `https://apps.keissyrengel.com/apps/<slug>/`.

No containers, no tunnels, no Docker, no database. Local development and production run
exactly the same code path.

## How it works

```text
prompt ──▶ /api/build ──▶ OpenAI ──▶ one self-contained HTML document
                                        │
                                        ├─▶ <iframe srcdoc> preview (sandboxed)
                                        │
        Publish ──▶ /api/publish ──▶ GitHub Contents API ──▶ commit to main
                                        │
                                        └─▶ GitHub Pages serves the live app
```

Follow-up prompts send the current document back to the model, so you can iterate on an
app instead of regenerating it from scratch.

## Requirements

- Node.js `>=22.13.0`
- An OpenAI API key
- A GitHub fine-grained token with **Contents: read and write** on this repository

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in OPENAI_API_KEY and GITHUB_TOKEN
npm run dev                  # open the URL Vite prints
```

Validation:

```bash
npm run check    # lint + typecheck + tests
```

## Configuration

Secrets — set with `npx wrangler secret put <NAME>`, never in `wrangler.jsonc`:

| Secret | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | Generates the apps. |
| `GITHUB_TOKEN` | to publish | Commits the app to the repository. |
| `BUILDER_ACCESS_CODE` | strongly recommended | Shared code required by `/api/build` and `/api/publish`. Without it, anyone who finds the URL can spend your OpenAI credit. |

Non-secret vars live in `wrangler.jsonc`:

| Var | Default | Purpose |
| --- | --- | --- |
| `OPENAI_MODEL` | `gpt-5.6-terra` | Any chat-completions capable model id. |
| `GITHUB_OWNER` | `keissyrengel` | Repository owner. |
| `GITHUB_REPO` | `apps-keissy-rengel` | Repository name. |
| `GITHUB_BRANCH` | `main` | Branch that GitHub Pages serves. |
| `PUBLISH_DIRECTORY` | `apps` | Folder published apps are committed into. |
| `PUBLIC_BASE_URL` | `https://apps.keissyrengel.com` | Used to build the live URL shown after publishing. |

## Deployment

First time only:

```bash
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put BUILDER_ACCESS_CODE
```

Then either deploy by hand:

```bash
npm run deploy
```

…or let CI do it. `.github/workflows/deploy-builderos.yml` deploys on every push to
`main` that touches `apps/builderos/`. It needs two repository secrets:

- `CLOUDFLARE_API_TOKEN` — an *Edit Cloudflare Workers* token
- `CLOUDFLARE_ACCOUNT_ID`

`npm run deploy:dry-run` validates the build and the Worker configuration without
uploading anything.

## Project layout

```text
apps/builderos/
├── app/
│   ├── api/build/       Prompt → OpenAI → HTML document (ndjson status stream)
│   ├── api/publish/     HTML document → GitHub commit → live URL
│   └── page.tsx         Server component; decides whether the access gate is on
├── components/builder/  Workspace UI
├── lib/
│   ├── ai/              OpenAI client, HTML extraction, slugs
│   ├── github/          Contents API publisher
│   ├── builder/types.ts Shared types
│   └── env.ts           Config and the access gate
├── worker/index.ts      Cloudflare Worker entry point
└── tests/               Unit tests plus a server-render smoke test
```

## Security notes

- Generated apps run in an iframe with `sandbox="allow-scripts allow-forms allow-modals allow-popups"`, so they cannot reach BuilderOS's own origin.
- `BUILDER_ACCESS_CODE` is the only thing standing between a public URL and your OpenAI bill. Set it.
- The GitHub token can write to this repository. Use a fine-grained token scoped to this repository only.
