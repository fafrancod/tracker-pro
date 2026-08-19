# Daily Tracker — Claude / Agent instructions

Project monorepo: `packages/web` (React + Vite + PWA + Capacitor), `packages/api` (Express), `packages/core` (shared), `supabase/schema.sql`.

## Language

- Respond in the **same language the user writes in**.
- Product UI / i18n copy: **castellano** (español de España / neutro formal), **tú** imperatives. Never rioplatense voseo.

## Git policy (mandatory)

**Always work on `main`. Always merge into `main`. Always push `main` to BOTH remotes.**

| Rule | Detail |
|------|--------|
| Branch | Default branch for all work: **`main`**. |
| Dual remote | After every completed feature: push to **`tracker-pro`** and **`origin`**. Same commits on both. |
| Parity | Do **not** leave new features only on one GitHub repo. If a push fails, fix and complete both. |
| Feature branches | Prefer no long-lived branches; if used, FF-merge into `main` before finishing. |
| PRs | Optional; only if the user asks. Default delivery is **direct to main**. |
| Force push | Forbidden on `main` unless the user explicitly orders it. |
| Commits | Conventional commits only. **Never** add `Co-Authored-By` or AI attribution footers. |
| Version | SemVer **MAJOR.MINOR.PATCH** on every ship. See **Versioning** below. |

```text
git checkout main
git merge --ff-only <feature-branch>   # if needed
npm run version:patch   # or version:minor / version:major
git add package.json packages/*/package.json
git commit -m "chore(release): vX.Y.Z"
git push tracker-pro main
git push origin main
```

Remotes:

- `tracker-pro` → https://github.com/fafrancod/tracker-pro (**primary deploy**)
- `origin` → https://github.com/fafrancod/dailytracker

When the user says “publica”, “deja todo en main”, or finishes a feature session: **both remotes**, not only `tracker-pro`.

## Architecture

- Business logic lives in **`packages/core`** — do not import web/api into core.
- Shared types and hooks must stay DOM-free (no `window`/`localStorage` types without `globalThis` guards) so mobile/Capacitor/RN can reuse them.
- Data: **Supabase** Auth + PostgreSQL (`supabase/schema.sql`). Apply schema migrations in the Supabase SQL editor when columns change.
- API owns validation (Zod), plan limits, and recurrence materialization; core mirrors recurrence + schedule helpers (keep dual-port in sync).
- Offline queue + task cache live in core; web hosts banners (offline / PWA install).

## Product conventions (current feature set)

These features are **shipped product** on `main` and must exist on **both** remotes. Do not regress them; extend them deliberately.

### Board

- Views: **`day` | `week` | `month` | `continuous`** (`settings.defaultBoardView`).
- Week/day modes: **`list` | `schedule`** (`settings.defaultScheduleLayout`).
- Hour grid: `settings.dayStartHour` / `dayEndHour` (default 7–22); unscheduled strip = “Sin hora”.
- Filters: multi-toggle kinds (combinable) + project multi-select list; urgency/importance cycle-select.
- Dense full-width week columns; touch-friendly targets and safe-area insets.

### Tasks

- Multi-day: `end_day_id` single row; complete-once for the whole span.
- Multi-day recurrence: **`none` | `monthly` | `yearly`** only.
- Eisenhower: `urgency`, `importance` (nullable).
- Kind: `task` | `reminder` | **`rx_human` | `rx_pet`**; optional `color` hex.
- **Time schedule**: optional `startTime` / `endTime` (`HH:mm` / DB `start_time`/`end_time`).
- **Recetario**: phased doses (`rxPhases`: amount, pills|ml, days, times[]); materializes one task per day×time with `rx` / `rx_meta`. Board filter **category**: all | projects | rx.
- Series: shared `seriesId`; edit scope **instance | series** (`applyTo`) for shared metadata (incl. title, color, times, Eisenhower).
- Interactions: long-press / ⋮ / right-click context menu; double-click → detail sheet; draft+save in detail when dirty.

### History & offline

- Session undo/redo (board Ctrl+Z / Ctrl+Y) + Bitácora `/activity` jump timeline.
- Offline: last board snapshot + queued create/update/delete/move; sync on reconnect.

### Appearance

- 60 skins (20 dark + 20 light + 10 Liquid Glass light + 10 dark), `settings.skinId`; `theme-color` follows skin.

### Android / PWA

- PWA installable (PNG any+maskable icons, install banner).
- Capacitor app: `packages/web/android`, id `com.cerebrostudios.dailytracker`.
- Notifications: local (Capacitor + web) + email (Resend worker). Settings: `notifyLocal`, `notifyEmail`, `notifyMinutesBefore`, `timezone`.
- Guides: `roadmap_android.md`, `docs/ANDROID.md`, `docs/PLAY_STORE.md`.
- Native builds need absolute `VITE_API_BASE_URL` at web build time.

### Eisenhower UI

- Labels show **Urgente e importante** / combinations (not Hacer/Planificar/Delegar/Eliminar).

### Gantt

- `/gantt` (life) and `/gantt/:projectId` (project). Groups: project → subcategory (subproyecto).
- Kinds on the chart: `task` | `reminder` | `event` | `possible_event`. Bars from `day_id`…`end_day_id`.

## Testing

- Strict TDD for **API**: `npm run test --workspace=packages/api`
- Typecheck packages after non-trivial changes (`packages/core` has no DOM lib).

## Versioning (SemVer — mandatory)

**Format:** `MAJOR.MINOR.PATCH` (example: **2.1.3**).

| Position | Example | Meaning |
|----------|---------|---------|
| **MAJOR** | **2**.x.x | Cambio **estructural grande** (breaking, arquitectura, rediseño fuerte de shell/datos). |
| **MINOR** | x.**1**.x | **Feature grande** (nueva capacidad de producto / dominio nuevo). |
| **PATCH** | x.x.**3** | **Mejora pequeña** (fix, polish, copy, hardening menor). |

Rules:

- Keep **the same version** in root + `packages/web` + `packages/api` + `packages/core`.
- Bump on **every deploy to main**: `npm run version:patch|minor|major` or `npm run version:set -- 2.1.3` (`scripts/bump-version.mjs`).
- Frontend shows it via Vite `__APP_VERSION__`; API via `/api/version`.
- **PRs** must include a **Version** block: `**vX.Y.Z** (major|minor|patch) — reason`.
- On session close / “done”, report the published version to the user.

## Deploy notes

- After schema changes, run the SQL migration on Supabase **before** relying on new columns in production.
- Railway serves API + SPA from **tracker-pro** deploy pipeline; keep `main` equal on **origin** too.
- Prod DB should include: multi-day, series, recurrence, Eisenhower, kind, color, **start_time/end_time**.
- After finishing work: **bump version**, push both remotes; if schema or Android shell changed, tell the user what to run (SQL / `npm run build:android`).
