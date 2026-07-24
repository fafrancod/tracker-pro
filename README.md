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

**Node 22** obligatorio (`engines`, `.nvmrc`, `nixpacks.toml`). Nixpacks por defecto puede usar Node 18 y romper con `@supabase/*` y con `npm ci` (`EBUSY` en `node_modules/.cache`).

Dos servicios desde el mismo repo:

| Servicio | Build | Start |
| --- | --- | --- |
| API | (ver `railway.toml`) `npm ci --include=dev --cache /tmp/npm-cache … && npm run build:api` | `npm run start:api` |
| Web | mismo patrón con `build:web` | `npx serve packages/web/dist -s -l $PORT` |

En el servicio API (Variables):
- `NIXPACKS_NODE_VERSION=22` (refuerzo por si nixpacks.toml no aplica)
- `NPM_CONFIG_PRODUCTION=false` (si el panel fuerza production)

En producción:
- `VITE_API_BASE_URL` → URL pública de la API (**en el build** de la web)
- `ALLOWED_ORIGINS` → URL pública del frontend
- `SUPABASE_URL` y keys (anon en web, **service role solo en API**)

Documentación técnica: [`docs/README.md`](docs/README.md).