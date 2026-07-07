# Status And Next Steps

Estado real del producto Daily Tracker al momento de escribir este doc.
Convertir relative dates a fecha absoluta cuando se actualice.

## Estado Actual Del Producto

Daily Tracker esta en **scaffold + fundamentos**:

- Monorepo npm workspaces: `packages/core`, `packages/web`, `packages/api`.
- Auth con Firebase: Google + Email/Password.
- Layout con sidebar desktop / hamburger drawer mobile / FAB.
- Board semanal con DayColumn, TaskCard, AddTaskForm, ProgressRing.
- Hooks core: `useTasks`, `useProjects`, `useWeek`, `usePlan`, `useAnalytics`.
- Zustand store compartido con immer.
- Contextos: AuthContext, ToastContext, SettingsContext.
- ProtectedRoute y FirebaseConfigGate.
- Backend Express scaffolded en `packages/api`: `/api/version`, `tasks` y `projects` backend-owned.
- Version actual: `1.0.0` (canal `dev`).

## Lo Que Ya Esta Implementado

### Seguridad Y Datos

- Firestore rules con bloqueo por defecto.
- Creacion/edicion/eliminacion de tasks por backend (Admin SDK), consumido por el cliente via `authFetch`.
- Creacion/edicion/eliminacion de projects por backend, consumido por el cliente via `authFetch`.
- App Check wireado end-to-end: cliente inicializa con `VITE_FIREBASE_APPCHECK_SITE_KEY`, backend verifica detras de `ENFORCE_APP_CHECK`.
- Validacion de payloads con zod en backend.
- AuthContext muestra toast si el bootstrap de perfil falla (sin signOut automatico).

### UX

- Sidebar con orden del playbook (entidad principal = Tareas en pos. 2).
- FAB siempre visible en pantallas que admiten accion principal.
- Boton "Anadir tarea" junto al titulo en desktop.
- Login con Google + Email/Password + signup toggle.
- Toasts globales con auto-dismiss.
- TaskCard con checkbox, inline edit, project pill, priority badge, notes expandible, dropdown menu (move/duplicate/delete).

### Observabilidad

- Logs de error en backend → `errorLogs/{logId}`.
- Version expuesta por `/api/version`.
- `appVersion.ts` en frontend con version/channel/buildId.

### DevX

- `npm run dev:web` y `npm run dev:api`.
- Type-check y build pasan.
- Aliases `@core/` y `@/` en Vite y tsc.
- `.env.example` para web y api.

## Lo Que Esta Parcial

| Area | Estado | Siguiente mejora |
| --- | --- | --- |
| Drag & drop entre dias | Dependencies instaladas, no wired | Wirear @dnd-kit en BoardLayout. |
| Analytics panel | Hook listo, UI pendiente | Recharts: bars por dia, donut por proyecto, heatmap. |
| Auto-roll incompletas | Setting expuesto, no job | Worker + Cloud Scheduler para correr Dom 23:59. |
| Proyectos CRUD | Service core listo, UI pendiente | Pagina /projects con modal de crear/editar. |
| Plan limits | Hook usePlan placeholder | Definir limites reales (free vs pro) y guardarlos en backend. |
| App Check | Hooks listos | Activar enforcement en prod. |
| Pagos | No iniciado | Stripe o Lemon Squeezy + webhooks idempotentes. |
| Admin | No iniciado | Pestanas Analytics/Estado/Fallos. |
| PWA | No iniciado | manifest + service worker. |
| Tests | Solo type-check | Vitest para hooks core, supertest para API. |
| Mobile RN | Solo el contrato (core sin DOM) | Bootstrap Expo en `packages/mobile`. |

## Pasos Que Siguen

### Sesion Inmediata (Fundamentos backend + docs)

- [x] `docs/*` creados (este archivo y los cinco hermanos).
- [x] `packages/api` scaffold con Express + Admin SDK.
- [x] `firestore.rules` con bloqueo por defecto.
- [x] `lib/api.ts` con `authFetch` + App Check header.
- [x] `errorLogs` writer en backend.

### Corto Plazo

1. Crear un proyecto Firebase real, completar `.env.local` y validar el flujo entero login → board.
2. ~~Migrar la creacion de tasks/projects al backend~~ — **listo** (services usan `api.post/patch/del` contra `/api/tasks` y `/api/projects`).
3. Implementar pagina Proyectos con CRUD.
4. Implementar Analytics minimo (bar chart de completions por dia).
5. Configurar firestore indexes para queries del board (semana actual).
6. Documentar como crear un usuario admin (claim custom `admin: true`).
7. Crear endpoint `POST /api/auth/bootstrap` para que el perfil se cree backend-owned (hoy es client-create permitido por rules).

### Beta Publica

1. Activar App Check enforcement.
2. Agregar distributed rate limiting (Redis o Firestore counters).
3. Separar worker en servicio dedicado (`npm run worker`).
4. Crear backup automatico y probar restore.
5. Agregar Sentry para errores frontend/backend.
6. GitHub Actions: lint, build, version guard.
7. Politica de releases: internal, beta, stable.

### Camino A 10k Usuarios

1. Reemplazar queue Firestore por Cloud Tasks / PubSub.
2. Dashboards de costos y latencia.
3. Medir top queries de Firestore.
4. Revisar indices y lecturas por pantalla.
5. Cache para data estable (proyectos, profile).
6. Pruebas de carga de endpoints.

### Camino A 100k Usuarios

1. Separar servicios por dominio: AI/recurrencias, reports, billing, analytics.
2. Exportar eventos a warehouse.
3. Backfills versionados.
4. Feature flags.
5. Harden de seguridad: WAF, abuse detection.

### Camino A 1M Usuarios

1. Event bus y arquitectura orientada a eventos.
2. CQRS para reporteria y analytics.
3. Multi-worker autoscaling por dominio.
4. Dead-letter queues y retry policies por job.
5. SLOs por dominio y alertas de error budget.
6. DR plan con restore probado periodicamente.

## Definition Of Done Para Nuevas Features

- Escrituras sensibles pasan por backend.
- Firestore rules no permiten bypass.
- Hay loading/error/empty state.
- El flujo funciona en mobile (320px width).
- El cambio no tapa FAB ni navegacion.
- Admin puede observar errores o estado si aplica.
- La version sube en `package.json` correspondiente.
- `npm run type-check` pasa.
- `npm run build` pasa.

## Riesgos Conocidos

- El frontend escribe el perfil inicial directo a Firestore en el primer login. Las rules lo permiten (create con `plan=free`), pero idealmente debe pasar por `POST /api/auth/bootstrap` para que tambien inicialice usage y defaults atomicamente.
- Rate limit local al proceso no protege bien en horizontal.
- Bundle web es 937 KB (sin gzip pelado): code-splitting pendiente.
- Faltan tests automaticos de flujos criticos.
- Backups/restore aun no estan operativizados.
- App Check no esta enforced; en prod sin enforce, el endpoint es atacable.
