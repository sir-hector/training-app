# Training App

A private, calendar-based training planner. Personal side project — see [`PRD.md`](./PRD.md) for the full design record.

> **Status:** v1 — auth + database wired (Google sign-in, Neon Postgres, Drizzle). Calendar features in progress. See open issues on GitHub.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Auth.js v5** with Google OAuth and database sessions
- **Neon Postgres** + **Drizzle ORM** (migrations checked in under `drizzle/`)
- **Sentry** for error tracking
- **Fly.io** for hosting (Docker, standalone Next.js output)
- **GitHub Actions** for CI (typecheck + lint + format) and prod deploys

The full stack decisions and the reasoning behind each choice are in [`PRD.md`](./PRD.md).

## Local development

Requirements: **Node.js 22**, **npm 10**.

```bash
# 1. Install
npm install

# 2. Copy env template and fill it in (see comments inside)
cp .env.example .env.local

# 3. Apply migrations to your Neon branch
npm run db:migrate

# 4. Start the dev server
npm run dev
```

Then open http://localhost:3000.

### One-time setup for local dev

1. **Neon** — create a project (free tier), then create a personal branch (e.g. `dev/<you>`) off `main`. Put its _pooled_ connection string in `DATABASE_URL`.
2. **Google OAuth** — in Google Cloud Console create an OAuth 2.0 Client ID (type: Web application). Add `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI. Copy the client ID/secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
3. **Auth secret** — `npx auth secret` writes a random `AUTH_SECRET` into `.env.local`.

### Database changes

Edit `src/db/schema.ts`, then:

```bash
npm run db:generate   # writes a new SQL migration under drizzle/
npm run db:migrate    # applies pending migrations to DATABASE_URL
npm run db:studio     # browse the DB in Drizzle Studio
```

Commit the generated migration. CI applies it to a throwaway Neon branch for every PR; the deploy workflow applies it to production before the new image goes live.

### Scripts

| Command                | What it does                                 |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Next.js dev server with Turbopack            |
| `npm run build`        | Production build                             |
| `npm run start`        | Serve the production build                   |
| `npm run typecheck`    | `tsc --noEmit` — same check CI runs          |
| `npm run lint`         | ESLint — same lint CI runs                   |
| `npm run format`       | Prettier — fix formatting                    |
| `npm run format:check` | Prettier — verify formatting (used by CI)    |
| `npm run db:generate`  | Drizzle — generate a migration from schema   |
| `npm run db:migrate`   | Drizzle — apply migrations to `DATABASE_URL` |
| `npm run db:studio`    | Drizzle Studio — browse the database         |

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
| `DATABASE_URL`           | Neon → `main` branch → pooled connection string (used to migrate prod)   |
| `NEON_API_KEY`           | Neon → Account settings → API keys (used for per-PR branches)            |

And one **repository variable** (not secret): `NEON_PROJECT_ID` — Neon → project → Settings → General.

### Fly.io runtime secrets

The app reads these at runtime (not build time), so set them once with `flyctl secrets set`:

```bash
flyctl secrets set -a training-app-hector \
  DATABASE_URL=<neon main pooled url> \
  AUTH_SECRET=<openssl rand -base64 32> \
  AUTH_GOOGLE_ID=<google client id> \
  AUTH_GOOGLE_SECRET=<google client secret> \
  AUTH_TRUST_HOST=true
```

The Google OAuth client also needs `https://training-app-hector.fly.dev/api/auth/callback/google` as an authorised redirect URI.

### First-time Fly.io setup

Once, from your local machine after `flyctl auth login`:

```bash
# Reserve the app name in your Fly account (uses the checked-in fly.toml)
flyctl launch --no-deploy --copy-config --name training-app-hector

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
    app/                  # Protected area (requires sign-in)
    api/auth/             # Auth.js route handler
  auth.ts                 # Auth.js config — exposes auth(), signIn, signOut
  proxy.ts                # Route guard for /app/* (optimistic; pages re-check)
  db/                     # Drizzle client + schema
  components/             # UI components (shadcn primitives under ui/)
  lib/                    # Utilities (cn, etc.)
  instrumentation.ts      # Sentry server + edge init
drizzle/                  # SQL migrations (generated, checked in)
drizzle.config.ts         # drizzle-kit config
sentry.client.config.ts   # Sentry browser init
Dockerfile                # Container build (used by Fly.io remote builder)
fly.toml                  # Fly.io app config
.github/workflows/
  ci.yml                  # PR checks
  neon-branch.yml         # Neon DB branch per PR + migrations; deleted on close
  deploy.yml              # Prod deploy on merge to main (migrates first)
```
