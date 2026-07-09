# Training App

A private, calendar-based training planner. Personal side project — see [`PRD.md`](./PRD.md) for the full design record.

> **Status:** v1 walking skeleton — deployed, empty, ready for feature work. See open issues on GitHub.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Sentry** for error tracking
- **Fly.io** for hosting (Docker, standalone Next.js output)
- **GitHub Actions** for CI (typecheck + lint + format) and prod deploys

The full stack decisions and the reasoning behind each choice are in [`PRD.md`](./PRD.md).

## Local development

Requirements: **Node.js 22**, **npm 10**.

```bash
# 1. Install
npm install

# 2. Copy env template
cp .env.example .env.local
# (edit .env.local — for the walking skeleton, empty values work; Sentry just no-ops)

# 3. Start the dev server
npm run dev
```

Then open http://localhost:3000.

### Scripts

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Next.js dev server with Turbopack         |
| `npm run build`        | Production build                          |
| `npm run start`        | Serve the production build                |
| `npm run typecheck`    | `tsc --noEmit` — same check CI runs       |
| `npm run lint`         | ESLint — same lint CI runs                |
| `npm run format`       | Prettier — fix formatting                 |
| `npm run format:check` | Prettier — verify formatting (used by CI) |

## Deployment

Prod deploys are triggered by pushes to `main` via [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). The workflow uses `flyctl deploy --remote-only`, so no Docker daemon is needed on GitHub runners.

### GitHub Actions secrets required for deploy

Set these under **Settings → Secrets and variables → Actions** on the repo:

| Secret                   | Where to get it                                                          |
| ------------------------ | ------------------------------------------------------------------------ |
| `FLY_API_TOKEN`          | `flyctl auth token` after `flyctl auth login`                            |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry → Settings → Projects → training-app → Client Keys (DSN)          |
| `SENTRY_AUTH_TOKEN`      | Sentry → Settings → Auth Tokens (scopes: `project:releases`, `org:read`) |
| `SENTRY_ORG`             | Your Sentry org slug                                                     |
| `SENTRY_PROJECT`         | `training-app`                                                           |

### First-time Fly.io setup

Once, from your local machine after `flyctl auth login`:

```bash
# Reserve the app name in your Fly account (uses the checked-in fly.toml)
flyctl launch --no-deploy --copy-config --name training-app

# Optional: set runtime secrets that don't need to be build args
flyctl secrets set NEXT_PUBLIC_APP_ENV=production

# Deploy the first time manually to prove the pipeline works end-to-end
flyctl deploy --remote-only \
  --build-arg NEXT_PUBLIC_SENTRY_DSN=<your-dsn> \
  --build-arg SENTRY_AUTH_TOKEN=<your-token> \
  --build-arg SENTRY_ORG=<your-org-slug> \
  --build-arg SENTRY_PROJECT=training-app
```

After that, `git push origin main` triggers deploys via GitHub Actions.

## Project layout

```
src/
  app/                    # Next.js App Router pages/layouts
  components/             # UI components (shadcn primitives under ui/)
  lib/                    # Utilities (cn, etc.)
  instrumentation.ts      # Sentry server + edge init
sentry.client.config.ts   # Sentry browser init
Dockerfile                # Container build (used by Fly.io remote builder)
fly.toml                  # Fly.io app config
.github/workflows/
  ci.yml                  # PR checks
  deploy.yml              # Prod deploy on merge to main
```
