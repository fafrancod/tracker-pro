# Agent instructions — daily-tracker

This file applies to **all coding agents** working in this repository (Claude Code, Grok, Cursor, Codex, etc.).

## Primary rule: main only

**Always merge and push to `main`.**

| Rule | Detail |
|------|--------|
| Branch | Do all implementation on `main` (or merge into `main` before finishing). |
| Ship | When work is done, **push `main`** to remotes. Do not leave completed features unpushed. |
| Remotes | Push both when present: `tracker-pro` (primary) and `origin`. |
| PRs | Optional; only if the user asks. Default delivery is **direct to main**. |
| Force push | Forbidden on `main` unless the user explicitly requests it. |
| Commits | Conventional commits. No AI co-author trailers. |

```text
# Typical finish sequence
git checkout main
git merge --ff-only <feature-branch>   # if you used a temp branch
git push tracker-pro main
git push origin main
```

## Stack (quick map)

```
packages/web     → React 18 + Vite + Tailwind UI
packages/api     → Express + Zod + Supabase Admin
packages/core    → types, hooks, services, recurrence (shared)
supabase/        → schema.sql (source of truth for DB DDL)
```

## Do

- Keep `packages/core` free of web/DOM imports.
- Mirror recurrence logic in **core and api** when changing materialization.
- Ship Supabase SQL snippets to the user when the schema changes.
- Match user language; product strings in castellano (tú, not voseo).
- Run API tests after API changes: `npm run test --workspace=packages/api`.

## Don’t

- Don’t invent Firebase (project is Supabase).
- Don’t leave multi-day recurrence as daily/weekly (rejected by API).
- Don’t skip pushing `main` after the user asks to publish or after “deja todo en main”.
- Don’t commit `.atl/`, `terminals/`, secrets, or local-only junk.

## Session close

Before saying done on a feature the user expects live:

1. Confirm `main` has the commits.
2. Push `main` to remotes.
3. Mention any pending Supabase SQL if schema changed.
