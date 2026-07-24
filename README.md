# Daily Tracker

Planificador semanal de tareas. Monorepo npm workspaces: `packages/core`, `packages/web`, `packages/api`.

**Stack:** React + Vite + Express + **Supabase** (Auth + PostgreSQL)

## Setup Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta el SQL de `supabase/schema.sql` en el SQL Editor.
3. En Authentication → Providers, activa Email y Google (opcional).
4. Copia URL y keys a los `.env` de web y api.

## Desarrollo local

```bash
npm install
npm run dev:web   # http://localhost:3005
npm run dev:api   # http://localhost:4000
```

Variables: ver `packages/web/.env.example` y `packages/api/.env.example`.

## Despliegue en Railway

**Un solo servicio** sirve la API y la SPA (Express monta `packages/web/dist`).

**Node 22** obligatorio. Build: `npm run build:prod` (web + api). Start: `npm run start:api`.

Variables del servicio:

| Variable | Cuándo | Notas |
| --- | --- | --- |
| `NIXPACKS_NODE_VERSION` | siempre | `22` |
| `NPM_CONFIG_PRODUCTION` | build | `false` |
| `VITE_SUPABASE_URL` | **build** | Project URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | **build** | anon key |
| `VITE_API_BASE_URL` | build (opcional) | vacío = same-origin (recomendado) |
| `SUPABASE_URL` | runtime | misma Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | **solo servidor** |
| `ALLOWED_ORIGINS` | runtime | `https://tu-app.up.railway.app` |
| `NODE_ENV` | runtime | `production` |

Tras el deploy: abre `https://tu-app.up.railway.app/` → UI. Health: `/api/version`.

Documentación técnica: [`docs/README.md`](docs/README.md).