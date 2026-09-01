# Daily Tracker

Producto visible: **Meteora**. Repo: `daily-tracker`. Planificador semanal de tareas. Monorepo npm workspaces: `packages/core`, `packages/web`, `packages/api`.

**Stack:** React + Vite + Express + **Supabase** (Auth + PostgreSQL)

## Setup Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta el SQL de `supabase/schema.sql` en el SQL Editor.
3. En Authentication → Providers, activa Email y Google (opcional).
4. Copia URL y keys a los `.env` de web y api.

**Google + Resend (checklist operativo):** [`docs/AUTH_AND_EMAIL.md`](docs/AUTH_AND_EMAIL.md).

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
| `RESEND_API_KEY` | runtime (email) | Notificaciones por correo |
| `EMAIL_FROM` | runtime (email) | Remitente con dominio verificado en Resend |
| `APP_PUBLIC_URL` | runtime | URL pública de la app (emails + `public-config.publicAppUrl`) |
| `APP_NAME` | runtime | Nombre visible (emails + `public-config.brand`). Default `Meteora` |
| `LANDING_ENABLED` | runtime | Default `false`. Encender landing sin rebuild del APK |
| `PLAY_STORE_URL` | runtime (opcional) | URL de Play; si falta, `public-config.playStoreUrl` es `null` |

Tras el deploy: abre `https://tu-app.up.railway.app/` → UI. Health: `/api/version`.

Auth Google y correo: [`docs/AUTH_AND_EMAIL.md`](docs/AUTH_AND_EMAIL.md).

## Instalar en Android (PWA)

1. Despliega con **HTTPS** (Railway u otro host).
2. En el teléfono, abre la URL con **Chrome**.
3. Si aparece el banner **Instalar Meteora**, pulsa **Instalar**.  
   Si no: menú ⋮ → **Instalar app** / **Añadir a la pantalla de inicio**.
4. El icono abre el board en modo pantalla completa (`standalone`).

Iconos PNG (192/512 + maskable): regenerar con  
`node packages/web/scripts/generate-pwa-icons.mjs` (requiere `sharp` en web).

**Offline (S3):** sin red se muestra el último board en caché; crear/completar/editar/borrar/mover se encolan y se sincronizan al reconectar (banner arriba + “Sincronizar”).

## Android (Capacitor)

Shell nativo en `packages/web/android` (`com.cerebrostudios.dailytracker`).

```bash
# Build SPA + sync WebView assets
# Importante: define VITE_API_BASE_URL=https://tu-api-prod (absolute HTTPS)
npm run build:android
npm run android:open   # Android Studio → Run
```

Guía completa (OAuth, AAB, live reload): [`docs/ANDROID.md`](docs/ANDROID.md).  
Play Store (checklist + secrets CI): [`docs/PLAY_STORE.md`](docs/PLAY_STORE.md).  
Roadmap: [`roadmap_android.md`](roadmap_android.md).

Documentación técnica: [`docs/README.md`](docs/README.md).