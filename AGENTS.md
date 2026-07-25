# Agent instructions — daily-tracker

This file applies to **all coding agents** working in this repository (Claude Code, Grok, Cursor, Codex, etc.).

## Primary rule: main only + both remotes

**Always implement on `main`. Always push completed work to BOTH remotes.**

| Rule | Detail |
|------|--------|
| Branch | Do all implementation on `main` (or merge into `main` before finishing). |
| Ship | When work is done, **push `main` to every configured remote**. Do not leave features only on one GitHub repo. |
| Remotes (mandatory pair) | **`tracker-pro`** (primary deploy) **and** **`origin`**. Both must receive the same `main` tip after a feature is finished. |
| Parity | **Never** ship a feature to only one remote. If one push fails, retry/fix and push the other; report if one remote is still behind. |
| PRs | Optional; only if the user asks. Default delivery is **direct to main**. |
| Force push | Forbidden on `main` unless the user explicitly requests it. |
| Commits | Conventional commits. No AI co-author trailers. |

```text
# Typical finish sequence (always both remotes)
git checkout main
git merge --ff-only <feature-branch>   # if you used a temp branch
git push tracker-pro main
git push origin main
git status -sb   # confirm main is not ahead of remotes
```

Remotes:

- `tracker-pro` → https://github.com/fafrancod/tracker-pro (primary deploy / Railway)
- `origin` → https://github.com/fafrancod/dailytracker

## Product feature set (must stay on both remotes)

Agents must treat the following as **in-tree product**, not optional experiments. New work builds on them; do not regress or leave them unpushed.

### Board & calendar

- Views: **day | week | month | continuous** (`BoardViewMode`; default `settings.defaultBoardView`).
- Week/day layout: **list | schedule** (`ScheduleLayout`; default `settings.defaultScheduleLayout`).
- Schedule grid hours: `settings.dayStartHour` / `dayEndHour` (default 7–22).
- Multi-day spans: `end_day_id`; complete-once for the whole span.
- Continuous month bars + week mid-span presence.
- Board filters: project, urgency, importance (with cycle-select ←/→).
- Dense week columns (full width grid).
- Context menu: right-click **and** long-press / ⋮ on mobile; double-click → detail sheet.

### Tasks

- Fields: title, notes, tags, priority, project, `kind` (**task|reminder|rx_human|rx_pet**), `color`, Eisenhower `urgency`/`importance`, multi-day range.
- **Schedules**: optional `startTime` / `endTime` (`HH:mm`).
- **Recetario** (`rx_human` / `rx_pet`): phased plan (`rxPhases`: amount, unit pills|ml, days, times[]); API materializes one task per day×time with `rx_meta` JSON. Board filter **category**: all | projects | rx.
- Recurrence: materialize on create; multi-day allows **`none` | `monthly` | `yearly`** only; also daily/weekly for single-day.
- Series edit: draft + **Guardar solo este** / **Guardar en toda la serie** (`applyTo: instance|series`).
- Session **undo/redo** (Ctrl+Z/Y on board) + Bitácora (`/activity`) timeline jump.

### Eisenhower

- Matrix page `/eisenhower`; quadrant labels = urgency×importance (not do/schedule/delegate/eliminate).
- Series share Eisenhower classification when assigned from the matrix.

### Appearance & settings

- **40 skins** (20 dark + 20 light) via CSS variables; `settings.skinId`.
- Language es/en; week start; auto-roll setting; default board view / schedule layout / day hours.

### Notifications

- **Device (Android + browser):** Capacitor `@capacitor/local-notifications` + Web Notification API; scheduled from tasks/doses with `startTime`.
- **Email (web + Android):** API worker + Resend (`RESEND_API_KEY`, `EMAIL_FROM`); prefs `notifyEmail`, `notifyMinutesBefore`, `timezone`.
- Settings UI: local/email toggles, lead time, tasks vs rx, test email.
- Schema: `notification_deliveries` dedupe table; settings keys on `profiles.settings`.

### Android / PWA / offline

- PWA: PNG icons (any + maskable), install banner, safe-area, touch DnD.
- Offline: task cache + mutation queue (create/update/delete/move) + banner sync.
- Capacitor Android shell: `packages/web/android`, appId `com.cerebrostudios.dailytracker`.
- Docs: `roadmap_android.md`, `docs/ANDROID.md`, `docs/PLAY_STORE.md`.
- CI: `.github/workflows/android.yml` (debug APK; signed AAB when secrets exist).

### Data / stack

- Supabase Auth + PostgreSQL (`supabase/schema.sql` is DDL source of truth).
- Schema includes: multi-day, series, recurrence, urgency/importance, kind, color, **start_time/end_time**, **notification_deliveries**.
- After schema changes: give the user the SQL for Supabase **and** push code to both remotes.

## Stack (quick map)

```
packages/web     → React 18 + Vite + Tailwind UI + PWA + Capacitor android/
packages/api     → Express + Zod + Supabase Admin
packages/core    → types, hooks, services, recurrence, offline, history (DOM-free)
supabase/        → schema.sql (source of truth for DB DDL)
```

## Do

- Keep `packages/core` free of web/DOM imports (use `globalThis` typing when needed).
- Mirror recurrence / series / schedule validation in **core and api**.
- Push **tracker-pro** and **origin** after every completed feature.
- Ship Supabase SQL snippets when the schema changes.
- Match user language; product strings in castellano (tú, not voseo).
- Run API tests after API changes: `npm run test --workspace=packages/api`.

## Don’t

- Don’t invent Firebase (project is Supabase).
- Don’t leave multi-day recurrence as daily/weekly (rejected by API).
- Don’t push only one remote “for speed”.
- Don’t leave finished features only on a local branch.
- Don’t commit `.atl/`, `terminals/`, keystores, secrets, or local-only junk.

## Session close

Before saying done on a feature the user expects live:

1. Confirm `main` has the commits.
2. **`git push tracker-pro main` and `git push origin main`.**
3. Confirm neither remote is behind `main`.
4. Mention any pending Supabase SQL if schema changed.
5. Mention Android rebuild (`npm run build:android`) if native shell assets need sync.
