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

Dos servicios desde el mismo repo:

| Servicio | Build | Start |
| --- | --- | --- |
| API | `npm ci && npm run build:api` | `npm run start:api` |
| Web | `npm ci && npm run build:web` | `npx serve packages/web/dist -s -l $PORT` |

En producción:
- `VITE_API_BASE_URL` → URL pública de la API
- `ALLOWED_ORIGINS` → URL pública del frontend
- `SUPABASE_URL` y keys en ambos servicios (anon en web, service role solo en API)

Documentación técnica: [`docs/README.md`](docs/README.md).