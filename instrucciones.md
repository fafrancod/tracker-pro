# Daily Task Tracker — Claude Code Project Brief

## 🎯 Project Overview

Production-ready **Daily Task Tracker SaaS** for sale and personal use.
Built as a monorepo so the web app and a future React Native mobile app share the same core logic.

**Stack:** React 18 + Vite + TypeScript + Node.js + Firebase + Tailwind CSS + shadcn/ui

---

## 📁 Monorepo Structure

```
daily-tracker/
├── packages/
│   ├── core/          # Shared logic: types, hooks, Firebase services, Zustand store
│   ├── web/           # React + Vite frontend
│   ├── api/           # Node.js + Express + Firebase Admin SDK
│   └── mobile/        # Placeholder — React Native / Expo (future)
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── functions/     # Cloud Functions (TypeScript)
├── package.json       # npm workspaces root
├── tsconfig.base.json
└── .env.example
```

---

## 🏗️ Architecture Rules

- **All business logic lives in `/packages/core`** — never import from `/web` or `/mobile` inside core
- **Custom hooks** (`useTasks`, `useProjects`, `useWeek`, `usePlan`) must be pure React hooks with zero DOM-specific code so React Native can consume them directly
- **Zustand store** defined in `/core/store` — shared across web and mobile
- **TypeScript strict mode** everywhere — no `any`
- **Optimistic UI** — update local Zustand state before Firestore confirms, rollback on error
- **Design tokens** (`theme.ts`) in `/core` — single source of truth for colors and spacing used by both web (Tailwind config) and mobile (StyleSheet)

---

## 🔥 Firebase & Data Model

### Firestore Collections

```
users/{uid}/
  profile                       → { name, email, plan: 'free'|'pro', createdAt, settings }
  projects/{projectId}          → { name, color, icon, createdAt, order }
  weeks/{weekId}/               → weekId format: "2026-W22"
    days/{dayId}/               → dayId format: "2026-05-27"
      tasks/{taskId}            → { title, completed, completedAt, projectId, priority,
                                    notes, order, tags[], movedFrom?, createdAt, updatedAt }
  analytics/{weekId}            → { completionsByDay, completionsByProject, streakCount }
                                   (cached aggregates — written by Cloud Functions)
```

### Security Rules Principle
- Users can **only** read/write their own `users/{uid}/**`
- Analytics subcollection is **write-only** from Cloud Functions (Admin SDK)

### Cloud Functions
| Function | Trigger | Purpose |
|---|---|---|
| `onTaskWrite` | Firestore write | Update `analytics/{weekId}` aggregates |
| `onWeekEnd` | Scheduled (Sun 23:59) | Auto-roll incomplete tasks to next week (if user setting enabled) |
| `createCheckoutSession` | HTTPS callable | Stripe Pro plan checkout |
| `stripeWebhook` | HTTPS | Handle payment events, update `plan` field |

---

## ✅ Features to Build

### Board (Main View)
- Horizontal columns, one per day of the current week (Mon–Sun)
- Each column: day name, date, circular progress ring (% completed), task list
- Week navigator (prev/next) in the header
- "Add Task" button per column (opens inline form)

### Task Card
- [ ] Checkbox to complete
- Inline editable title (click to edit)
- Project pill (color-coded)
- Priority badge: `low` | `medium` | `high`
- Expandable notes field
- `movedFrom` badge if task was moved from another day/week
- Right-click context menu: Move to day / Move to next week / Duplicate / Delete
- Drag handle for DnD

### Drag & Drop
- Library: `@dnd-kit/core`
- Drag tasks between day columns (same week)
- Drag tasks to a "Next Week" drop zone in the header
- On drop: update `dayId` in Firestore + set `movedFrom` field

### Analytics Panel
- Collapsible side panel (right side)
- Bar chart: completions per day this week
- Donut chart: completion % by project
- Heatmap grid: task rows × day columns (green = done, red = missed, gray = not scheduled)
- Weekly streak counter
- Data source: `/analytics/{weekId}` cached document (not live task queries)

### Projects
- CRUD: create / edit / delete projects
- Fields: name, color (picker), icon (emoji)
- Filter board view by project
- Project stats page: total tasks, completed %, all-time history

### Auth
- Google Sign-In + Email/Password
- Protected routes — redirect to `/login` if unauthenticated
- Persistent session (Firebase handles this)
- Loading skeleton while auth state resolves

### Plan Gating
- `usePlan()` hook reads `users/{uid}/profile.plan`
- **Free limits:** max 3 projects, current week only, no analytics panel
- **Pro:** unlimited projects, full week history, analytics, CSV export
- Gate UI components with `<ProGate>` wrapper that shows upgrade modal for free users

---

## 🎨 Design System

| Token | Value |
|---|---|
| Background | `#0d1117` |
| Surface | `#161b22` |
| Border | `#30363d` |
| Text primary | `#e6edf3` |
| Text muted | `#7d8590` |
| Accent green | `#3fb950` |
| Accent teal | `#58a6ff` |
| Accent red | `#f85149` |
| Accent pink | `#f778ba` |

- **Component library:** `shadcn/ui` (dark mode, customized with above tokens)
- **Icons:** `lucide-react`
- **Charts:** `recharts`
- **Drag & Drop:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Dates:** `date-fns`
- **Animations:** `framer-motion` (card transitions, panel open/close)

---

## 📱 Mobile-Ready Constraints

These rules ensure the React Native app can be built without rewriting logic:

1. **Never use `window`, `document`, or any browser API inside `/core`**
2. **Never import Tailwind classes inside `/core`** — only use `theme.ts` tokens
3. All Firebase calls must go through service functions in `/core/services/` — never call Firebase SDK directly from UI components
4. Navigation is **state-driven** (current week, selected day, open panel) stored in Zustand — maps 1:1 to React Navigation state
5. Use `@react-native-firebase` compatible modular Firebase SDK imports

---

## 🛠️ Dev Environment

```bash
# Install all packages
npm install

# Run web app (dev)
npm run dev --workspace=packages/web

# Run API (dev)
npm run dev --workspace=packages/api

# Run Firebase emulators
firebase emulators:start

# Build all
npm run build
```

### Environment Variables (`packages/web/.env.local`)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_STRIPE_PUBLISHABLE_KEY=
```

### Environment Variables (`packages/api/.env`)
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 📋 Build Order for Claude Code

Work in this exact sequence to avoid broken imports:

1. `package.json` (root, workspaces config) + `tsconfig.base.json`
2. `/core` — `types.ts`, `theme.ts`, `firebase.ts` (init)
3. `/core/services/` — `taskService.ts`, `projectService.ts`, `analyticsService.ts`
4. `/core/store/` — Zustand store slices
5. `/core/hooks/` — `useTasks`, `useProjects`, `useWeek`, `usePlan`
6. `firestore.rules` + `firestore.indexes.json`
7. `/web` — Vite config, Tailwind config, `shadcn/ui` setup
8. `/web/src/components/Board/` — `BoardLayout`, `DayColumn`, `TaskCard`
9. `/web/src/components/DragDrop/` — DnD wrappers
10. `/web/src/components/Analytics/` — charts and heatmap
11. `/web/src/pages/` — `Login`, `Board`, `Projects`, `Settings`
12. Auth flow + protected routes
13. Plan gating — `usePlan`, `<ProGate>`, upgrade modal
14. `/api` — Express app, Firebase Admin init, route stubs
15. `/firebase/functions/` — Cloud Functions
16. `/mobile/README.md` — Expo bootstrap guide

---

## ⚠️ Known Constraints & Decisions

- **No Redux** — Zustand only (lighter, works in React Native)
- **No Next.js** — pure Vite SPA (simpler Firebase Hosting deploy, easier RN parity)
- **shadcn/ui** components must be copied into `/web/src/components/ui/` (not imported from npm) — standard shadcn pattern
- Firestore **does not support** `!=` queries on multiple fields — use client-side filtering for complex project filters
- Free plan week history limit is enforced **client-side** via `usePlan` hook — also enforce in Security Rules for production
- Stripe integration is **stubbed** — implement checkout flow after core tracker is working

---

## 🚀 Deployment Target

- **Web:** Firebase Hosting (`firebase deploy --only hosting`)
- **API:** Firebase Cloud Functions or Cloud Run
- **Database:** Firestore (production project)
- **CI/CD:** GitHub Actions (lint + build on PR, deploy on merge to `main`)
