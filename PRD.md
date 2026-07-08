# PRD — Training App (v1)

## Problem Statement

I design my own training plans on paper. I have nowhere to keep them, mark workouts as done, or see the plan laid out on a calendar. I want a private, always-available web app where I can put my plan, see what's coming up this week, and check off workouts as I complete them — accessible from any device.

Underlying this practical need is a secondary goal that shapes every decision in this PRD: **I am a mid-level frontend developer growing into a fullstack role, and I want this project to teach me production-shape API design + auth, database modeling + migrations, and modern deployment/DevOps.** The app is the vehicle; the learning is the point. Every scope decision favors "small enough to actually ship publicly" over "feature-rich."

## Solution

A publicly-deployed, single-user (per account) training planner:

- Sign in with Google
- Calendar month view — custom grid, not a heavy calendar library
- Add / edit / delete workouts on any day
- Each workout has: a **type** (gym, run, bike, interval, tempo, etc.), a free-text **notes** field (e.g. "10x400 @ 4:00"), a **date**, and a **done** flag with a `completedAt` timestamp
- Mark a workout as done from the calendar
- Color-coded by workout type
- Mobile-responsive
- Deployed to a public URL, using free-tier infrastructure

The app is intentionally minimal. Anything beyond the list above is v2 or later.

## User Stories

1. As a signed-in user, I want to sign in with Google so I don't have to manage another password.
2. As a signed-in user, I want to sign out so I can end my session on shared devices.
3. As a visitor, I want to be redirected to sign-in when I hit a protected page so I understand I need to log in.
4. As a signed-in user, I want to see the current month in a calendar grid so I can view my training at a glance.
5. As a signed-in user, I want to navigate to the previous or next month so I can plan ahead or review past training.
6. As a signed-in user, I want the calendar to open on today's month by default so I don't have to navigate to "now" every time.
7. As a signed-in user, I want today's date visually highlighted on the calendar so I can orient myself quickly.
8. As a signed-in user, I want to click any day cell to add a new workout to that day so I can build my plan.
9. As a signed-in user, I want to add multiple workouts on the same day (e.g. gym in the morning, run in the evening) so I can plan double-sessions.
10. As a signed-in user, I want to pick a workout type from a defined list so I get consistent categorization and color-coding.
11. As a signed-in user, I want to write free-form notes on a workout (e.g. "10x400 @ 4:00" or "5x5 squat @ 100kg") so I capture the details in the format I already use.
12. As a signed-in user, I want to edit an existing workout so I can adjust the plan as it evolves.
13. As a signed-in user, I want to delete a workout so I can remove ones that no longer belong.
14. As a signed-in user, I want to mark a workout as done with a single click so it takes near-zero friction.
15. As a signed-in user, I want to unmark a workout as done (in case I misclick) so mistakes are recoverable.
16. As a signed-in user, I want completed workouts to look visually distinct from pending ones so I can see at a glance what I've actually done.
17. As a signed-in user, I want each workout type to have a consistent color so I can distinguish gym / run / bike / interval / tempo at a glance.
18. As a signed-in user, I want the calendar view to be readable and usable on my phone so I can check my plan on the go.
19. As a signed-in user, I want my data scoped strictly to me so I never see another user's workouts and they never see mine.
20. As a signed-in user, I want my session to persist across browser reloads so I don't have to sign in constantly.
21. As a signed-in user, I want the app to load quickly on cold visits so the daily "check today's workout" habit stays low-friction.
22. As a developer, I want every pull request to spin up its own preview deploy and its own Neon database branch so I can validate changes against real infrastructure before merging.
23. As a developer, I want typecheck, lint, unit tests, and e2e tests to run automatically on every PR so broken changes never reach main.
24. As a developer, I want production errors captured in Sentry so I know when something breaks without a user having to tell me.
25. As a developer, I want a clean local development setup (one command, uses a `.env.local`) so I can hack on the app without ceremony.
26. As a developer, I want DB migrations checked into the repo and run automatically in CI against the PR's Neon branch so schema changes are safe and reviewable.

## Implementation Decisions

### Stack

- **Framework:** Next.js 15 (App Router). Server actions for mutations; route handlers only where server actions don't fit.
- **Styling:** Tailwind CSS. Component primitives from **shadcn/ui** (copied into the repo, owned locally). A distinctive typography choice (a custom Google Font, not Inter) and considered color palette committed on day one to avoid the "generic shadcn look."
- **Calendar UI:** **Custom month grid**, not a library. Built with `date-fns` for date math. A training planner is not a calendar app — no time slots, no drag/drop, no recurring rules in v1. Just a 6×7 grid of days with workout cards. Rationale: distinctive UI, full data-model control, avoids fighting a library's abstractions.
- **Auth:** **Auth.js v5** with the Google OAuth provider and the Drizzle adapter. Session strategy: database sessions (not JWT-only) so we get proper server-side session lookup. No email/password in v1 — Google-only skips verification, reset, and forgot-password flows.
- **ORM / migrations:** **Drizzle** + `drizzle-kit`. Migration SQL files checked in, applied in CI against the PR's Neon branch.
- **Database:** **Neon Postgres** (serverless). One DB branch per PR — this is the killer feature Neon was picked for.
- **Hosting:** **Fly.io** (containers). Verify current free-tier / pricing before committing infra spend; fall back to **Render** if Fly's pricing has drifted.
- **Error tracking:** **Sentry** (free tier), Next.js SDK.
- **CI/CD:** **GitHub Actions**. Pipeline: install → typecheck → lint → unit → e2e → deploy on merge. Preview deploy per PR via Fly + Neon branching.

### Modules

Four deep modules encapsulate the meaningful logic behind stable, testable interfaces:

1. **`calendar-grid`** — pure function module. Given `(year, month)` returns the 6×7 grid of days for month view, including padding days from the previous and next months, week starting on Monday. Zero I/O. Changes rarely. Trivial to test.

2. **`workouts-repo`** — data-access layer over Drizzle. Interface: `create`, `update`, `delete`, `findById`, `listByDateRange(userId, from, to)`. **Every query is scoped to `userId`** — no callable path returns another user's data. Server actions and route handlers go through this module; they never touch Drizzle directly.

3. **`workout-types`** — the single source of truth for workout type metadata. Enum of allowed types (`gym`, `run`, `bike`, `interval`, `tempo`, `long_run`, `strength`, `mobility`, `other` — extensible) with display metadata: label, Tailwind color token, icon. Consumed by API validation, form select, and calendar rendering. New types added here, nowhere else.

4. **`auth`** — thin wrapper around Auth.js v5 configured with the Google provider and Drizzle adapter. Exposes an `auth()` server helper and route protection. Most logic lives inside Auth.js; this module owns the config.

Shallow layers on top:

- **API layer** — server actions and route handlers. Thin controllers over `workouts-repo`; enforce auth via `auth`; validate input against `workout-types` and Zod schemas.
- **UI layer** — `MonthGrid`, `DayCell`, `WorkoutCard`, `WorkoutDialog` (form). Display + interaction; no business logic.
- **Pages / server components** — thin renderers that fetch via server components and mutate via server actions.

### Data model (v1)

Single meaningful table beyond Auth.js's own (`users`, `accounts`, `sessions`, `verification_tokens`):

- **`workouts`**
  - `id` — uuid, PK
  - `user_id` — fk → `users.id`, indexed, cascade on user delete
  - `date` — date (day-precision, no time)
  - `type` — enum matching `workout-types`
  - `notes` — text, nullable
  - `done` — boolean, default false
  - `completed_at` — timestamptz, nullable (set when `done` flips true → false clears it)
  - `created_at` / `updated_at` — timestamptz

Indexes: `(user_id, date)` for the primary list-by-range query.

### Auth boundary

- Every server action and route handler that touches `workouts-repo` MUST resolve `auth()` first and pass the `userId` into repo calls.
- `workouts-repo` MUST NOT expose any method that doesn't take `userId` — enforced by module interface.
- Rationale: this is the single security-critical invariant in the app.

### Rules of engagement (design constraints, not features)

1. No v2 features (Strava, plan templates, structured exercises, stats, AI) touched until v1 has been in production and used by the author for two real weeks.
2. If M0 + M1 (bootstrap + DevOps skeleton) exceeds 25 hours, bail on Fly.io to Render or Vercel. Do not sink weeks into infra.
3. No custom auth from scratch, no rolling a calendar library, no bespoke ORM layer. Use the tools picked here.

## Testing Decisions

**What makes a good test in this project:** tests exercise **external behavior** — the interface a caller sees — not internal implementation. A test on `workouts-repo` calls `listByDateRange` and asserts what comes back; it does not assert which Drizzle query builder methods were called. A test on the calendar grid calls the pure function and asserts the returned grid; it does not test intermediate helpers. This keeps tests robust to refactors.

**Modules under test in v1:**

- **`calendar-grid`** — Vitest unit tests. Covers: month with leading padding days, month with trailing padding days, month starting on Monday (no padding), leap-year February, week-starts-on-Monday ordering. Pure function → fast, deterministic, high value per line.

- **`workouts-repo`** — Vitest integration tests running against a real Neon branch spun up in CI. Covers: create/read/update/delete round-trip, `listByDateRange` returns only the requesting user's workouts (**critical: cross-user data-leak regression test**), `completed_at` is set when `done` flips true and cleared when it flips false. Prior art: none yet — this is greenfield; the pattern established here is the prior art for future data-access modules.

- **`auth`** — one integration test: an unauthenticated request to a protected API route returns 401 / redirects. Not testing Auth.js internals (they have their own tests) — testing that our route guard is wired correctly.

- **Playwright happy-path e2e** — one test covering the golden flow: sign in (mocked Google response in test env) → land on calendar → click a day → fill the workout dialog → save → see the workout appear on the calendar → click "mark done" → reload the page → verify the workout is still there and still marked done.

**Explicitly not tested in v1:**

- Individual UI components (Dialog, WorkoutCard, DayCell) — the e2e covers them via real user flow; unit tests for display components have low value-per-hour.
- `workout-types` — it's a data table; testing it tests nothing beyond that the data was typed correctly.
- Individual route handlers / server actions — thin controllers, covered by e2e.
- Next.js framework internals.

**CI enforcement:** all tests run on every PR. Failing tests block merge. Neon branch created per PR, migrations applied, tests run against it, branch destroyed on merge/close.

## Out of Scope

Explicitly deferred to v2 (only after v1 has been in production and used by the author for two real weeks):

- **Strava integration** — one-way import of completed activities to auto-check-off workouts. Chosen over Garmin because OAuth is simpler and its API surface is more forgiving.
- **Basic statistics** — weekly volume, completed vs planned counts, simple charts. The honest, non-AI version.
- **Plan templates** — reusable multi-week programs stamped onto a date range. Introduces a whole new concept (`Plan` → `PlanDays` → `Workouts`) and 2-3 tables' worth of work.
- **Structured workouts** — exercises with sets/reps/weight for gym, or intervals with pace/distance for running. Currently expressible in the notes field.
- **Email/password auth**, password reset, email verification.

Explicitly rejected (not just deferred):

- **Microfrontends** — solves an organizational problem the author does not have. Learning this pattern belongs in a separate 1-weekend POC repo, not baked into this app.
- **Garmin integration** — if a v2 integration ships, it's Strava.
- **AI form analysis / AI-generated plans** — cliché rabbit hole, unbounded scope, unclear value for the author's actual training workflow.
- **Multi-user features** (sharing plans, coach/athlete relationships, social) — this is a single-user planner.

## Further Notes

**Time budget:** author estimates 4-8 focused hours per week. Milestone plan targets v1 in production in 10-15 weeks:

| Milestone | Deliverable | Est. hours |
|---|---|---|
| M0 | Local stack running (Next + Auth + Neon + Drizzle) | 8-12 |
| M1 | Fly deploy + GitHub Actions CI + Sentry + Neon branch-per-PR + one dummy e2e | 10-15 |
| M2 | `workouts` schema + Drizzle migrations + CRUD via `workouts-repo` + server actions with auth guards | 8-12 |
| M3 | Custom month calendar grid UI, day-cell clickable | 10-15 |
| M4 | Add/edit/delete workout dialog + mark-done toggle | 8-12 |
| M5 | Typography, color palette, mobile-responsive polish, real tests, README with screenshots | 10-15 |
| M6 | Deploy to prod, use for two real weeks, fix real bugs | ongoing |

**Accountability:** author commits to a weekly public log (channel TBD — Twitter/Bluesky thread or blog). The published log is the difference between "shipped" and "abandoned" for solo side projects.

**Risk register:**

- Fly.io free-tier pricing may have drifted — verify at fly.io/docs/about/pricing/ before M1. Fallback to Render.
- Custom calendar grid could balloon past 15h — time-box; if not working at 20h, fall back to `react-big-calendar`.
- Auth.js configuration may frustrate — after 3 sunk weeks, switching to Clerk is a valid rescue, not a failure.
- Feature creep at week 6-8 (Strava temptation) — reread the "rules of engagement" section.

**Prior grill session:** this PRD is the resolved output of an interactive grill-me session covering scope, stack, hosting, DB, ORM, auth, calendar approach, testing/CI/monitoring, feature-shape, and time budget. Each decision was made explicitly with tradeoffs surfaced. When in doubt about *why* a choice was made, the answer is in that session's transcript.
