# Roadmap Meteora Pro — Daily Tracker → mymeteora.com

Este repo (`daily-tracker`, **v2.37.9**) pasa a ser el producto **Meteora** en **https://www.mymeteora.com**. Se copia el *comportamiento* de `finanzas-pro` (APK con SPA local, carrusel nativo, landing, portal Atenas). **No** se copia Firebase, paywall ni la bóveda como paso de arranque.

Esto no es un rewrite. Es **marca + superficie pública + portal ops + auth nativo correcto**, sobre el stack que ya corre (Supabase + Express + React). El v2 de este doc cerró OAuth WebView, catch-all y DNS. Este v3 fija los **contratos** de backend, frontend y datos: si se implementa la UI sin ellos, la homepage será lenta, Atenas mentirá y “borrar cuenta” no cumplirá Play/GDPR.

---

## Quick path (producción viva)

Hoy **no hay staging**: `main` = Railway = la app que estás usando. El orden de las Fases 1–7 del contrato **no** es el orden de merge. Entregar en **olas aditivas** (sección siguiente). Un usuario con sesión en `/board` no debe enterarse hasta la ola de marca y, al final, el DNS.

---

## Entrega con producción viva

**Invariante:** el camino caliente no se toca. Board, finanzas, hábitos, recetario, Google **web**, cola offline, claves `daily-tracker:*`, `applicationId`, `service: daily-tracker-api`.

Tú estás autenticado. `/login`, `/welcome`, `/privacy`, `/atenas` **no se ejecutan** en tu sesión. Ahí se construye casi todo. Lo que sí puede romperte el día: un `React.lazy` mal hecho (pantalla en blanco), un skin global que pinte la landing en todo el `<html>`, un cambio de OAuth web, un SQL que lockee tablas, o el DNS el día D.

### Qué no hacer mientras usas la app

| Prohibido | Efecto en tu uso |
|-----------|------------------|
| Renombrar `daily-tracker:*` en localStorage | Pierdes settings, cola offline, cache |
| Cambiar el flujo Google **web** | Te echa al relogin o `redirect_uri_mismatch` |
| Forzar el carrusel si ya hay settings/sesión | Tour nativo no pedido en un dispositivo viejo |
| Pintar `mymeteora.com` antes del DNS | Enlaces/QR/emails caen en finanzas-pro o Squarespace |
| 301 el host `*.up.railway.app` | Rollback imposible; rompes el bookmark actual |
| `CREATE INDEX` pesado en tablas calientes sin `CONCURRENTLY` | Lock en `tasks` / movements mientras las usas |
| Code-split + marca + catch-all + OAuth en el mismo PR | No hay forma de saber qué rompió el board |

SQL: índices y `CREATE OR REPLACE FUNCTION` son aditivos. En Supabase el editor no siempre permite `CONCURRENTLY`; para tablas pequeñas de una app personal, `CREATE INDEX IF NOT EXISTS` en `error_logs(created_at)` es barato. **No** reescribir tablas de finanzas.

### Olas (esto se mergea a `main`)

Cada ola = PATCH autónomo. Tras cada push: abres **/board**, creas/editas una tarea, miras Finanzas. Si eso falla, revert de ese commit, no “seguir un poco más”.

| Ola | Qué entra | Qué notas tú en `/board` | Rollback |
|-----|-----------|--------------------------|----------|
| **0 — Rail** | `public-config` añade `brand`, `publicAppUrl`, `landingEnabled: false` (env `LANDING_ENABLED=false`). Front **ignora** campos extra. Tests. | Nada | Revert; JSON extra no rompe clientes viejos |
| **1 — Datos/API muertos** | Índice `error_logs`; `GET /api/admin/errors`; RPC stats nuevo (`CREATE OR REPLACE`); `DELETE /api/auth/me` **sin botón** en Ajustes. Redacción PII en `errorHandler`. | Nada (no llamas esos endpoints) | Revert API. El RPC nuevo debe devolver las mismas keys (`finance_count`, …) para no romper el admin actual |
| **2 — Rutas nuevas** | `/privacy`, `/atenas` (el `/admin` **sigue**). Catch-all anónimo → `/login` **solo si no hay sesión**. | Nada. Si caduca la sesión, ves el login **viejo** (flag off) | Revert router |
| **3 — Landing apagada** | Layout marketing detrás de `landingEnabled`. Flag `false` en Railway. Code-split **solo** de páginas públicas (Login lazy). Board sigue eager en este paso. | Nada, sigues dentro | Flag o revert. **No** lazy del Board todavía |
| **4 — Atenas** | Tabs Analytics/Estado/Fallos. Sidebar dueño puede apuntar a `/atenas`; `/admin` redirect. | Nada salvo que abras Admin | Revert UI admin |
| **5 — Encender landing** | Railway `LANDING_ENABLED=true` **sin** rebuild si lee env en public-config. Verificas en ventana privada. Sesión tuya intacta. | Nada | `LANDING_ENABLED=false` (segundos) |
| **6 — Marca visible** | “Meteora” en sidebar, PWA, emails, `APP_NAME`. Logo. | Ves el nombre nuevo. Funciones iguales | Revert strings |
| **7 — Lazy del producto** | `React.lazy` de Board/Finanzas/Gantt **aparte**. Un PR, un smoke de board+finanzas. | Riesgo real: blanco o spinner eterno | Revert de **ese** commit en minutos |
| **8 — Welcome nativo** | `/welcome` **solo** si nativo **y** no hay sesión **y** no existe `daily-tracker:settings:v1`. Usuarios viejos nunca lo ven. | Nada en web | Revert |
| **9 — Google APK** | PKCE+Browser **solo** si `isNativePlatform()`. El `signInWithOAuth` web **no se toca**. | Nada en Chrome/PWA | Revert del branch nativo |
| **10 — DNS** | www → este Railway. Apex 301. Host Railway **sigue vivo** (sin 301). `APP_PUBLIC_URL` ya www. | Si entras por Railway, igual. Si alguien usa mymeteora.com, ahora eres tú | CNAME otra vez a finanzas-pro. TTL bajo ese día |

El `chore(release)` MINOR va cuando las olas 5–6 están estables (landing + marca). No al primer índice SQL.

### Flag `landingEnabled`

```text
# Railway (runtime, API)
LANDING_ENABLED=false   # default seguro
APP_PUBLIC_URL=https://<este-servicio>.up.railway.app
```

`GET /api/public-config` lo expone. El front: si `false`, `/login` es el formulario actual. Si `true`, marketing. Encender/apagar **sin** redeploy de Android y sin esperar a DNS.

### Sesiones y PWA

- No invalidar JWT. No rotar anon key. No cambiar Site URL de Supabase hasta la ola 10 (entonces **añadir** www, no quitar el host Railway).
- `start_url: '/'` solo en la ola 6–7, cuando el router ya manda sesión → `/board`. Antes, dejar `/board`.
- Update de PWA: banner que ya existe. Tras un deploy, aceptas “actualizar” cuando termines el rato de trabajo, no a mitad de editar una tarea.

### Cómo verificar sin jugarte el día

1. Tras cada ola: `/board` + una mutación (crear/mover tarea) + Finanzas lista.
2. Landing: **ventana privada** o perfil Chrome aparte. Tu sesión principal no se cierra.
3. Atenas: `/atenas` en otra pestaña. `/admin` viejo debe seguir o redirigir, no 404.
4. DNS: el día D no es el día de features. Solo DNS + env. Board ya lleva días estable.

---


## Defaults de identidad

El pedido es la **página** (`mymeteora.com`), no sustituir el APK de finanzas.

| Capa | Default | Código | Consolas |
|------|---------|--------|----------|
| Nombre visible | **Meteora** | Sí | Play, Resend, OAuth consent |
| Dominio | **https://www.mymeteora.com**. Apex → 301 www | Nunca literal en UI; sale de public-config | DNS, Railway, Supabase, Google, Resend |
| Play `applicationId` | `com.cerebrostudios.dailytracker` | No | Play de *esta* app |
| npm / git | `daily-tracker`, remotes actuales | No | — |
| API `service` | `daily-tracker-api` | No | Healthchecks |
| Storage / canal notif. | `daily-tracker:*`, `daily-tracker-reminders` | **No** | — |
| Post-login | `/board` | No | — |

Hasta Fase 6, `APP_PUBLIC_URL` = host Railway de **este** servicio. Pintar `mymeteora.com` antes del DNS manda tráfico a finanzas-pro (o a Squarespace en el apex).

---

## Contratos de ingeniería

Tres capas. Si un PR de UI viola un contrato, no se mergea.

### Backend (Express + Supabase Admin)

| Tema | Decisión | Por qué |
|------|----------|---------|
| Fuente de marca/URL | `GET /api/public-config` añade `brand`, `publicAppUrl`, `playStoreUrl` (string o `null`). Cero secretos. | El APK y la SPA **ya** leen este endpoint cuando faltan `VITE_*`. Un literal `mymeteora.com` en el cliente no se puede cambiar sin rebuild. |
| Emails | `config.email.appName` / `appUrl` leen `APP_NAME` / `APP_PUBLIC_URL`. Misma URL que public-config. | Links de recordatorio rotos si el front y Resend discrepan. |
| CORS | `ALLOWED_ORIGINS` incluye prod + `https://localhost` + `http://localhost` + `capacitor://localhost`. Bearer, no cookies. | Capacitor 8 + `androidScheme: https` origina `https://localhost`. |
| Host canónico | Tras Fase 6: si `Host` es `mymeteora.com` → **301** a `https://www.mymeteora.com` + path. No 301 el `*.up.railway.app` (rompería el servicio viejo y el rollback). | El apex de finanzas-pro cae a Squarespace. El 301 en app es el seguro, no solo el DNS. |
| `assetlinks` | `GET /.well-known/assetlinks.json` **antes** de `express.static` y del fallback SPA. `Content-Type: application/json`. Cache corta (`max-age=300`). | El catch-all actual (`GET /^(?!\/api).*/` → `index.html`) serviría HTML y Digital Asset Links falla en silencio. |
| Admin listado | `GET /api/admin/errors` paginado **en SQL** (`created_at desc`, `limit`/`cursor`). `requireAdmin` + rate limit. | `error_logs` no tiene RLS de lectura para `authenticated`. Service role. Nunca `select *` a JS. |
| Admin users | El snapshot actual carga **todos** los perfiles a memoria. OK < ~2k usuarios. No reescribir a Redis ahora. Sí: no duplicar el scan en cada tab (un endpoint overview ya existe). | App personal. Over-engineering no. |
| Stats | `admin_user_stats()` hoy cuenta `finance_entries` (legado). Hay que contar **movimientos + notas** (y no vender `finance_entries` como “finanzas”). | Atenas Analytics mentiría el día 1. |
| Errores PII | `errorHandler` persiste `details` (Zod flatten, bodies). En **escritura** redactar keys `amount`, `password`, `token`, `anonKey`. En **lectura** admin no devolver `ip` cruda a UI si no hace falta; nunca montos. | Play + GDPR. El tab Fallos no es un dump de requests. |
| Borrar cuenta | `DELETE /api/auth/me` autenticado, rate limit estricto (p. ej. 3/hora). Confirmar con `email` en el body. `auth.admin.deleteUser(uid)`. | Ver mapa de datos abajo. Cascade de `profiles` no cubre `error_logs`. |
| Auth nativo | No hay endpoint nuevo. El cliente nativo hace PKCE + `exchangeCodeForSession`. | El API no habla con Google; Supabase sí. |
| `service` | Sigue `daily-tracker-api`. | Tests y `/api` health. |

`packages/core` sigue **sin DOM**. Brand display (`APP_BRAND = 'Meteora'`) puede vivir en core. URL pública **no**: es runtime.

### Frontend (React + Vite + Capacitor)

| Tema | Decisión | Por qué |
|------|----------|---------|
| Code split | `App.tsx` hoy importa **todas** las páginas en el entry (cero `React.lazy`). La landing no puede arrastrar Board+Finanzas+Gantt+TipTap. Públicas lazy + chunk `app` separado. | Finanzas-pro ya lo hace (`lazyPages.ts`). Un anónimo en mymeteora.com no debe bajar el recetario. |
| Shell público | Rutas `/login` `/welcome` `/privacy` `/download-android` **fuera** de `AppShell`. No `NotificationBootstrap` con efectos de settings. `AdminHeartbeat` ya no-op sin user. | `index.html` trae `class="dark"`. Settings aplica skin de `localStorage` al `<html>`. La landing tiene que **forzar** tema marketing (claro) y restaurar al entrar al board. |
| i18n | Copy de landing en `i18n.ts` (es/en). **No** un objeto de 200 líneas dentro de `Login.tsx` como finanzas-pro. | Un solo sistema. Ajustes.language vs selector anónimo: anónimo usa `localStorage` `meteora:landing-lang`; no pisa `settings` de un usuario que luego entra. |
| URL pública | `getPublicAppUrl()` = `publicConfig.publicAppUrl` → else `window.location.origin`. Nunca hardcoded. En Capacitor, origin es `https://localhost`: **obligatorio** public-config o `VITE_API_BASE_URL` de prod. | APK sin `VITE_*` hoy llama `'' + /api/public-config` contra localhost y muere. Fallback: si `isNativePlatform()` y no hay base, no usar `''`. |
| Helper nativo | Solo `isNativePlatform()` en `packages/web/src/lib/capacitor.ts`. | No portar `isNativeApp()` de finanzas-pro. |
| PWA | `start_url: '/'`. `name`/`short_name` Meteora. Workbox `navigateFallback` ya es `index.html` (OK). No cachear `/api/*` ni `/.well-known/*`. | Instalar PWA no debe abrir `/board` anónimo. |
| OAuth web | Sigue `signInWithOAuth` + `redirectTo` same-origin + path allowlist (`startsWith('/') && !startsWith('//')`). | Ya correcto en web. |
| OAuth Android | Ver secuencia **Auth nativo**. `detectSessionInUrl` no basta con custom scheme. | Google bloquea WebView. |
| Tour | Carrusel = `localStorage` dispositivo. Tour tablero = `profiles.settings.onboardingTourCompleted`. | Dos estados, dos UX. |

### Datos (Postgres)

| Tema | Decisión | Por qué |
|------|----------|---------|
| Sin tabla nueva de “marca” | Brand no es dato de usuario. | Config/env. |
| Welcome nativo | **No** columna. Flag local. | Un usuario puede tener dos dispositivos. |
| Tour tablero | Ya en JSONB `settings`. | No migrar a columna. |
| `error_logs.uid` | Hoy `uuid` **sin FK**. Borrar `auth.users` deja filas con uid huérfano + `ip` + `user_agent`. | GDPR: al borrar cuenta, **anonimizar** esas filas (`uid/ip/user_agent = null`), no borrar el log de ops. Índice `(created_at desc)`. |
| Cascade real | `profiles.id` → `on delete cascade` a tasks, projects, contacts, notes, finances_*, vault, usage, analytics, notification_deliveries. | `DELETE auth.users` dispara profiles. **No hay** Storage buckets (imágenes van en JSON de tasks). |
| RPC stats | Reescribir joins: `finance_movements` (+ credits/goals/accounts si se quieren “objetos”), `notes`. Dejar de usar `finance_entries` como “finanzas”. | El RPC actual es un dato **falso** para el producto de 2026. |
| Admin SQL | Entregar snippet en `supabase/migrations/`. Aplicar en el SQL editor **antes** de depender de él en prod. | Igual que el resto del repo. |
| Montos | Admin **nunca** `select` de `finance_movements.amount` ni `finance_meta`. Counts sí. | Contrato financiero ya escrito en `roadmap_financiero.md`. |

---

## Auth nativo (secuencia)

Google **no** puede usar el flujo web (`redirectTo = window.location.origin` = `https://localhost`).

**Default: PKCE + `@capacitor/browser` (plugin oficial).** El verifier se guarda en el WebView *antes* de abrir Custom Tabs; no se pierde.

```text
1. WebView: signInWithOAuth({
     provider: 'google',
     options: {
       skipBrowserRedirect: true,
       redirectTo: 'com.cerebrostudios.dailytracker://auth/callback',
     }
   })
   → data.url  (code_verifier ya en localStorage del WebView)

2. Browser.open({ url: data.url })   // Custom Tabs, no WebView

3. App.appUrlOpen(url con ?code=)
   → supabase.auth.exchangeCodeForSession(url)
   → sesión persistida (persistSession: true, localStorage)

4. Navegar a /board. No fiarse de detectSessionInUrl.
```

Supabase Redirect URLs: `com.cerebrostudios.dailytracker://auth/callback`.

Google Cloud: el client **web** de Supabase sigue; el redirect de Google es `https://<ref>.supabase.co/auth/v1/callback` (igual que ahora). No hace falta client Android si usamos este flujo.

Email/password no cambia (mismo WebView, `signInWithPassword`).

**No elegir** `signInWithIdToken` + plugin Google nativo en el primer corte: más SHA, más client Android, más superficie. Queda como mejora de UX (account picker nativo).

---

## Borrar cuenta (mapa)

Play Data safety exige flujo in-app. GDPR exige borrar **datos personales**, no necesariamente logs técnicos.

```text
Cliente (Ajustes)
  → confirma escribiendo su email
  → DELETE /api/auth/me { email }
  → 204
  → signOut + wipe local:
      daily-tracker:settings:v1
      daily-tracker:task-cache:*
      daily-tracker:offline-queue:v1
      daily-tracker:demo-*
      sesión supabase
      notificaciones locales (cancelar canal)

API (service role, mismo uid que el token)
  1. Verificar email === req.user.email (mismatch → 403)
  2. UPDATE error_logs SET uid=null, ip=null, user_agent=null WHERE uid=$uid
  3. auth.admin.deleteUser(uid)
       → profiles ON DELETE CASCADE
       → tasks, projects, notes, contacts, finance_*, vault, usage, analytics, deliveries
  4. 204
```

No hay buckets de Storage. No hay filas “globales” de usuario salvo `error_logs` y `profiles`.

Dueño `fafrancod@gmail.com`: **sí puede** borrar su cuenta (no hay magia). El claim admin en otro user no se hereda.

---

## Rutas

Orden: públicas → auth shell → catch-all.

| Ruta | Auth | Qué |
|------|------|-----|
| `/login` | Pública. Con sesión → `/board` | Landing + auth |
| `/welcome` | Pública. Solo nativo; web → `/login` | Carrusel |
| `/privacy` | Pública | Política |
| `/download-android` | Pública | CTA Play o PWA |
| `/atenas` | Sesión + admin; si no, login/denegado del portal | Ops |
| `/admin`, `/atenea` | Redirect `/atenas` | Compat |
| `/` sesión | → `/board` | Home producto |
| `/dashboard` | Auth | Resumen |
| `*` anónimo | → `/login` | Hoy `*` → `/board` (bug) |
| `*` sesión | → `/board` | 404 suave |

---

## Posicionamiento

- Tagline: Tu tablero de vida: tareas, hábitos, recetario y dinero en un solo lugar.
- Auth: Google + email. Android: Google solo por la secuencia PKCE.
- Landing es/en. Fondo **claro** de marketing, no el skin del board.

---

## Fase 1 — Marca + public-config

**Done when:** UI dice Meteora; `/api/public-config` devuelve `brand` + `publicAppUrl`; `GET /api/version` sigue `service: daily-tracker-api`.

| # | Contrato |
|---|---------|
| 1.1 | `index.html`: title, description, `lang="es"`. `class="dark"` puede quedarse; el PublicShell lo overridea en Fase 2. |
| 1.2 | PWA name/short_name/description; `start_url: '/'`. |
| 1.3 | Login/sidebar/gate/i18n `pwa_install_title`. |
| 1.4 | Capacitor `appName` + `strings.xml`. **No** `applicationId`. |
| 1.5 | API defaults `APP_NAME`; copy de `notificationDispatch`. |
| 1.6 | `public-config`: `brand`, `publicAppUrl` (= `config.email.appUrl` o primer ALLOWED_ORIGINS https). Front: `getPublicAppUrl()`. |
| 1.7 | Logo PNG Meteora (no `$`) + `npm run icons` + `icons:android`. |
| 1.8 | `AGENTS.md` / `CLAUDE.md`: UI Meteora; repo `daily-tracker`. |
| 1.9 | No tocar storage keys, canal notif, `@daily-tracker/*`. |

Tests: public-config shape; version service id.

---

## Fase 2 — Homepage

**Done when:** Lighthouse/red del anónimo **no** descarga el chunk del board. Hero + auth en desktop y 360px. URL copiable = public-config, no un dominio ajeno.

| # | Contrato |
|---|---------|
| 2.1 | `React.lazy` páginas de producto. Login/Privacy/Welcome en chunk público. Patrón: `finanzas-pro/src/routes/lazyPages.ts`. |
| 2.2 | PublicShell: tema claro forzado (`data-landing="1"`), sin FAB, sin scheduler. Al desmontar, devolver control del skin al SettingsProvider. |
| 2.3 | Router: públicas **antes** del `*`. `*` anónimo → `/login`. |
| 2.4 | Copy en `i18n.ts`. Mock propio (tablero/hábitos/finanzas), no el de cuotas Visa. |
| 2.5 | Auth web intacto (Google + email). |
| 2.6 | OG tags. Favicon Meteora. |
| 2.7 | `getPublicAppUrl()` en el bloque “copia el enlace”. |

**No:** `/choose-plan`, checkout.

---

## Fase 3 — Guía visual

Dos estados. No mezclar.

```text
Android fresco → /welcome (4 slides) → auth → /board + GuidedTour
Web           → /login              → /board + GuidedTour
```

| # | Contrato |
|---|---------|
| 3.1 | Flag `localStorage` `meteora_native_welcome_seen_v1`. |
| 3.2 | `/welcome` solo si `isNativePlatform()`. |
| 3.3 | 4 previews CSS + phone frame. Gestos swipe/saltar. Mark seen al paso auth. |
| 3.4 | Replay en Ajustes (carrusel) **además** del tour tablero. |
| 3.5 | Tour existente: solo copy, mismos 10 pasos. |

---

## Fase 4 — Atenas

**Done when:** `/atenas` 4 tabs; Fallos pagina SQL; stats no usan `finance_entries` como “finanzas”; tests API.

| # | Contrato |
|---|---------|
| 4.1 | Portal fuera de `AppShell`. Gate `isAdminUser`. |
| 4.2 | Usuarios = panel actual (snapshot in-memory OK). |
| 4.3 | Analytics = `GET /api/admin/overview`. Distinto de `/analytics` (bienestar). |
| 4.4 | Estado = `/api/version` + supabase admin ping. |
| 4.5 | `GET /api/admin/errors?limit=&cursor=` + índice `error_logs_created_at_idx`. Redacción PII. |
| 4.6 | Migración: reescribir `admin_user_stats` (movements + notes). Snippet SQL al usuario. |
| 4.7 | Sidebar dueño → `/atenas`. |
| 4.8 | Tests 401/403/patch plan/errors paginado/stats keys. |

**No:** Feedback, flags, Play reconcile.

---

## Fase 5 — Android publicable

Capacitor local **ya está**. No regenerar el proyecto Gradle.

**No subir a Play** si Google sigue en WebView.

| # | Contrato |
|---|---------|
| 5.0 | PKCE + Browser (secuencia de arriba). Email sigue. Probar en dispositivo. |
| 5.1 | `applicationId` intacto. |
| 5.2 | App Links host `www.mymeteora.com`. |
| 5.3 | Ruta Express assetlinks + SHA upload **y** Play App Signing. |
| 5.4 | Script SHA. |
| 5.5 | `resolveApiBaseUrl()`: nativo sin `VITE_*` no usa `''`; usa public-config del host de build o env. CORS Capacitor. |
| 5.6 | `exchangeCodeForSession` en `appUrlOpen` **antes** de navegar. |
| 5.7 | `/privacy` pública. Texto: Supabase, tareas, contactos, notas, finanzas cifradas de cuenta. |
| 5.8 | `DELETE /api/auth/me` + wipe local (mapa). |
| 5.9 | `/download-android`: Play si `playStoreUrl`; si no, PWA. |
| 5.10 | CI: `ANDROID_VERSION_NAME` = SemVer; `ANDROID_VERSION_CODE` entero monótono (`2.37.9` → `23709`). Nunca bajar. |
| 5.11 | Docs ANDROID / PLAY_STORE / AUTH_AND_EMAIL (flujo nativo). |

---

## Fase 6 — Dominio

Dos Railway. Este código **no** se despliega en el de finanzas-pro.

| # | Contrato |
|---|---------|
| 6.1 | Custom domain `www` en tracker-pro. |
| 6.2 | DNS: www → tracker-pro. Apex 301 www. Quitar Squarespace. TTL bajo el día D. |
| 6.3 | Env (tabla). Rebuild APK con `VITE_API_BASE_URL=https://www.mymeteora.com`. |
| 6.4 | Supabase Site URL + Redirects (www, apex, localhost, scheme). |
| 6.5 | Google origins `www`. Resend dominio + `EMAIL_FROM`. |
| 6.6 | Middleware 301 apex→www. |
| 6.7 | Rollback = CNAME otra vez a finanzas-pro. El código no tiene el dominio hardcodeado. |

```text
ALLOWED_ORIGINS=https://www.mymeteora.com,https://mymeteora.com,https://localhost,http://localhost,capacitor://localhost
APP_PUBLIC_URL=https://www.mymeteora.com
APP_NAME=Meteora
EMAIL_FROM=Meteora <noreply@mymeteora.com>
```

**Done when:** `https://www.mymeteora.com/api/version` → `daily-tracker-api` + SemVer de este monorepo.

---

## Fase 7 — Cierre

| # | Trabajo |
|---|---------|
| 7.1 | Tests API (version, public-config, admin, delete-me, assetlinks content-type). |
| 7.2 | Typecheck. Bundle: chunk de `/login` sin TipTap/recharts. |
| 7.3 | Playbook: Firestore → Supabase. `STATUS_AND_NEXT_STEPS.md` no es inventario. |
| 7.4 | PATCH por PR; MINOR cuando 1–4 estén en prod (`chore(release): v2.38.0` o el siguiente libre). |
| 7.5 | Push **tracker-pro** y **origin**. |
| 7.6 | SQL de 4.5/4.6 pegado en Supabase. |
| 7.7 | `npm run build:android` prod. |

---

## Tests (mínimo por capa)

| Capa | Qué |
|------|-----|
| API | `public-config` tiene `brand`/`publicAppUrl`; version `daily-tracker-api`; admin 401/403; errors paginado; delete-me 403 si email no coincide; assetlinks JSON (cuando exista la ruta). |
| Datos | Migración RPC: `finance_count` no sale de `finance_entries`. Índice `error_logs`. |
| Web | Rutas: anónimo `/foo` → login. Lazy: Login no importa `BoardPage`. |
| Nativo | Manual dispositivo: email; Google Custom Tabs; deep link; welcome once. |

UI de landing/Atenas: verificar en navegador (desktop + 360px) cuando se implemente, no con un screenshot.

---

## Mapa de archivos

| Origen / idea | Destino | Notas |
|---------------|---------|-------|
| `Login.tsx` finanzas-pro | `packages/web/src/pages/Login.tsx` + `i18n.ts` | Layout. Auth local. |
| `NativeWelcome` | `pages/NativeWelcome.tsx` | Sin plan/bóveda. |
| Phone frame / previews | `components/Onboarding/` | Previews **de este** board. |
| `Atenea.tsx` | `pages/Atenea.tsx` | Portal. |
| `Privacy.tsx` | `pages/Privacy.tsx` | Stack Supabase. |
| `lazyPages.ts` | `packages/web/src/routes/lazyPages.ts` | **Nuevo, no opcional.** |
| public-config | `routes/publicConfig.ts` | brand + url. |
| SHA script | `packages/web/scripts/android-sha.mjs` | |
| logo PNG | `packages/web/public/` | No `$`. |
| SQL | `supabase/migrations/` | errors idx + RPC stats + anonimizar logs |

Se conserva: GuidedTour, `isNativePlatform`, CI android, Capacitor local.

---

## Work units

1. `docs: Meteora Pro engineering contracts` (este archivo)
2. `feat(brand): Meteora + public-config brand/url` (Fase 1)
3. `feat(web): lazy public homepage` (Fase 2)
4. `feat(android): native welcome carousel` (Fase 3)
5. `feat(admin): Atenas + error logs + honest stats` (Fase 4)
6. `feat(auth): Capacitor Google PKCE via Browser` (5.0)
7. `feat(account): self-delete + privacy + app links` (resto 5)
8. `chore(ops): mymeteora.com cutover notes` (6)
9. `chore(release): v2.38.0`

Partir si un unit > ~400 líneas.

---

## Operación que git no hace

| Consola | Qué |
|---------|-----|
| Railway tracker-pro | Domain www, env |
| DNS | Quitar Squarespace; CNAME www; apex 301 |
| Railway finanzas-pro | **No** este repo. Congelar tras el corte |
| Supabase | Site URL, redirects, SMTP, **SQL de 4.5/4.6** |
| Google Cloud | Origin www |
| Resend | Dominio + from |
| Play | Listing, Data safety, SHA signing → assetlinks |
| GitHub Actions | `VITE_API_BASE_URL` / Supabase |

---

## Checklist

### Contratos
- [ ] public-config: `brand` + `publicAppUrl` del host **real**
- [ ] Chunk de `/login` sin TipTap/recharts
- [ ] `*` anónimo no cae en `/board`
- [ ] Landing no hereda `dark-github` de un settings viejo

### Auth / Android
- [ ] Web Google + email
- [ ] APK: email; Google en Custom Tabs; `exchangeCodeForSession`
- [ ] assetlinks es JSON
- [ ] `versionCode` monótono = SemVer compacto

### Datos
- [ ] RPC stats sin `finance_entries` como finanzas
- [ ] `DELETE /api/auth/me` anonimiza `error_logs` y cascadea profiles
- [ ] Admin Fallos sin montos ni passwords

### Dominio
- [ ] `www.mymeteora.com/api/version` = este repo
- [ ] Apex no es Squarespace

---

## Relación con otros docs

| Doc | Rol |
|-----|-----|
| **Este** | Marca, landing, welcome, Atenas, auth nativo, cutover, contratos de datos |
| `roadmap_android.md` | UX táctil/offline. Store/marca → aquí |
| `roadmap_financiero.md` | Libro/bóveda. Admin no ve montos (reafirmado) |
| `docs/AUTH_AND_EMAIL.md` | Ampliar con PKCE nativo en 5.0 |
| `APP_FAMILY_PLAYBOOK.md` | Corregir Firestore → Supabase en Fase 7 |

---

## Fuera de alcance

- Paywall / Play Billing
- Feature flags, tickets
- FCM, iOS
- Rename npm/repos
- Pisar `com.mymeteora.app`
- Post-login = `/dashboard`
- Tour tablero → finanzas/hábitos
- Migrar keys `daily-tracker:*`
- Google Identity nativo (`signInWithIdToken`) — mejora posterior a 5.0

---

## Next step

Fase 1 (marca + public-config). DNS y el `applicationId` de finanzas no la bloquean.

Override Play (este AAB pisa `com.mymeteora.app`): dímelo antes de Fase 5.
