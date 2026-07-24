# Daily Tracker — Claude / Agent instructions

Project monorepo: `packages/web` (React + Vite), `packages/api` (Express), `packages/core` (shared), `supabase/schema.sql`.

## Language

- Respond in the **same language the user writes in**.
- Product UI / i18n copy: **castellano** (español de España / neutro formal), **tú** imperatives. Never rioplatense voseo.

## Git policy (mandatory)

**Always work on `main`. Always merge into `main` and push `main`.**

- Default branch for all work: **`main`**.
- Do **not** leave finished work only on feature branches unless the user explicitly asks for a PR branch workflow.
- When a change is complete and the user wants it published (or when the session ends with completed work they expect live):
  1. Ensure commits are on `main` (fast-forward merge feature branches into `main` if needed).
  2. **Push `main`** to remotes (`tracker-pro` and `origin` when both exist).
- Prefer **no long-lived feature branches** for this solo product; feature-branch-chain is optional only if the user requests review isolation.
- Never force-push `main` unless the user explicitly orders it.
- Conventional commits only. **Never** add `Co-Authored-By` or AI attribution footers.

Remotes historically used:

- `tracker-pro` → https://github.com/fafrancod/tracker-pro (primary deploy)
- `origin` → https://github.com/fafrancod/dailytracker

## Architecture

- Business logic lives in **`packages/core`** — do not import web/api into core.
- Shared types and hooks must stay DOM-free so a future mobile app can reuse them.
- Data: **Supabase** Auth + PostgreSQL (`supabase/schema.sql`). Apply schema migrations in the Supabase SQL editor when columns change.
- API owns validation (Zod), plan limits, and recurrence materialization; core mirrors recurrence helpers (keep dual-port in sync).

## Product conventions

- Multi-day tasks: `end_day_id` single row; complete-once for the whole span.
- Multi-day recurrence allowed: **`none` | `monthly` | `yearly`** only.
- Eisenhower fields: `urgency`, `importance` (nullable).
- Task kind: `task` | `reminder`; optional `color` hex.
- Board views: week | month | continuous; default from `settings.defaultBoardView`.
- Right-click → context menu (complete / edit / delete); double-click → edit sheet.

## Testing

- Strict TDD for **API**: `npm run test --workspace=packages/api`
- Typecheck packages after non-trivial changes.

## Deploy notes

- After schema changes, run the SQL migration on Supabase **before** relying on new columns in production.
- Railway serves API + SPA; keep `end_day_id`, `kind`, `color`, yearly recurrence constraints applied in prod DB.
