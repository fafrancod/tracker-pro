# App Family Playbook (Daily Tracker)

Este doc describe **como Daily Tracker aplica el playbook de la familia
finanzas-pro / Meteora** y donde se aparta. El playbook canonico vive en
`D:\DesarrollosFF\finanzas-pro\docs\APP_FAMILY_PLAYBOOK.md`.

## Que Hereda Sin Cambios

- Apps personales con datos sensibles, mobile-first, Admin minimo desde beta.
- Arquitectura React PWA + Backend API + Firestore + Jobs + Auth.
- Versionado por PR, exposicion via `/api/version`.
- Admin con `Analytics`, `Estado`, `Fallos`.
- Estructura `users/{uid}/...` para datos del usuario.
- Reglas Firestore con bloqueo por defecto.
- Estructura de docs: `TECH_STACK_AND_SCALE`, `DESIGN_DECISIONS`, `STATUS_AND_NEXT_STEPS`, `APP_FAMILY_PLAYBOOK`, `SCALABILITY_OPERATIONS`.

## Donde Se Aparta

| Dimension | Familia (Meteora) | Daily Tracker |
| --- | --- | --- |
| Entidad principal | Transaccion | Tarea (Task). |
| Periodo principal | Mes (`YYYY-MM`) | Semana ISO (`YYYY-Www`) y dia (`YYYY-MM-DD`). |
| AI | Scanner de recibos, cartolas, recomendaciones | No aplica hoy. Posible futuro: parser de notas, recomendador de orden. |
| Pagos | Lemon Squeezy + MercadoPago | TBD (likely Stripe para mercado global; LS si mantenemos LATAM-friendly). |
| Modos especiales | Travel mode | "Focus mode" futuro: dia actual a pantalla completa. |
| Email | Resend con reportes mensuales | Resend con resumen semanal opcional. |
| Importadores | Cartolas, recibos | Importadores: Todoist, Things, CSV. |
| Recurrencias | Cuotas / fechas | Recurrencia de tareas (daily, weekly, custom). |

## Modulos Base — Estado En Daily Tracker

| Modulo | Estado | Notas |
| --- | --- | --- |
| AuthContext | Listo | Google + Email/Password. |
| SettingsContext | Listo | Persiste en Firestore + cache local. |
| ToastContext | Listo | Variantes success/error/info. |
| AdminContext | Pendiente | Necesita rol custom `admin: true`. |
| AnalyticsReporter | Pendiente | Heartbeat de presencia + seccion activa. |
| appVersion | Listo | Inyectado por Vite + accesible desde `/api/version`. |
| errorLogs | Listo (backend) | Falta hook frontend para enviar errores. |
| api/authFetch | Listo | Token Firebase + header App Check. |
| offline cache | Pendiente | Considerar para mobile en futuro. |
| backend jobs | Pendiente | Auto-roll semanal, rebuild de analytics. |

## Estructura

```text
daily-tracker/
  packages/
    core/      -> types, theme, firebase, store, services, hooks
    web/       -> React + Vite + shadcn/ui
    api/       -> Express + Node 20 + Firebase Admin SDK
  firebase/
    firestore.rules
    firestore.indexes.json
    functions/    -> Cloud Functions (futuro)
  docs/
    TECH_STACK_AND_SCALE.md
    DESIGN_DECISIONS.md
    STATUS_AND_NEXT_STEPS.md
    APP_FAMILY_PLAYBOOK.md  (este doc)
    SCALABILITY_OPERATIONS.md
```

## Contrato De Version

Igual que finanzas-pro:

- Cada ship a `main` aumenta la versión SemVer (MAJOR.MINOR.PATCH) en **root + packages/** (mismo número en todos).
  - MAJOR = cambio estructural grande; MINOR = feature grande; PATCH = mejora/fix pequeño.
  - Helper: `npm run version:patch|minor|major` (`scripts/bump-version.mjs`).
  - Los PR deben documentar `vX.Y.Z` y el nivel de bump en la descripción.
- Semver. Para beta: `x.y.z-beta.n`.
- Version backend expuesta por `/api/version`.
- Version frontend inyectada por Vite (`__APP_VERSION__`).
- Guardar version en `errorLogs/{logId}.version` y en presence.

Ejemplo:

```json
{
  "version": "1.0.1-beta.1",
  "channel": "beta",
  "buildId": "2026-05-28T12:34:56Z"
}
```

## Contrato De Admin

Cuando se construya admin, debe tener:

- **Analytics**: usuarios activos ahora, registrados por tier, tiempo por seccion, uso de features con limite (tasks creadas/mes, projects activos).
- **Estado**: online/offline, version y canal, build id, estado Firebase, estado de proveedores externos.
- **Fallos**: usuario, severidad, operacion, mensaje, stack, metadata, version, user agent.

## Contrato De Datos

Datos user-scoped:

```text
users/{uid}/profile/data
users/{uid}/projects/{projectId}
users/{uid}/weeks/{weekId}/days/{dayId}/tasks/{taskId}
users/{uid}/analytics/{weekId}
users/{uid}/usage/{period}            [backend-only]
users/{uid}/usageEvents/{eventId}     [backend-only]
users/{uid}/jobs/{jobId}
```

Datos globales:

```text
errorLogs/{logId}                     [backend-only]
sitePresence/{uid}
siteSectionUsage/{period}/sections/{sectionId}
jobQueue/{jobId}                      [backend-only]
webhookEvents/{provider_eventId}      [backend-only]
```

Reglas:

- Bloqueo por defecto.
- Owner puede leer sus datos.
- Admin puede leer datos globales (cuando exista).
- Escrituras sensibles por backend.
- El cliente nunca escribe counters de uso ni agregados.

## Patron De Feature Nueva

1. Definir entidad y owner.
2. Definir si la escritura es sensible (regla: si toca plan/usage, lo es).
3. Si es sensible, crear endpoint backend con zod + admin SDK.
4. Definir Firestore rules.
5. Definir indices necesarios.
6. Crear UI mobile-first.
7. Crear estados loading/error/empty.
8. Loggear errores relevantes.
9. Agregar metrica de uso si aplica.
10. Actualizar Admin si la feature necesita observabilidad.
11. Subir version del paquete tocado.
12. Correr `npm run type-check` y `npm run build`.

## Patron De UI Nueva

- Pantalla util, no landing.
- Header con titulo y accion primaria si aplica.
- FAB para accion principal en mobile.
- Hamburger mobile, sidebar desktop.
- Cards solo para items repetidos o paneles.
- Iconos lucide.
- Inputs tactiles (min 32px de alto en mobile).
- Texto conciso.
- Dark mode probado (la app arranca en dark).

## Patron De Escala Nueva

Antes de lanzar una feature costosa:

- Medir uso esperado.
- Agregar limite por plan.
- Hacer el endpoint idempotente.
- Usar job si tarda mas de unos segundos.
- Guardar estado observable en `users/{uid}/jobs/{jobId}`.
- Preparar rollback.

## Checklist Para Clonar Daily Tracker A Otra App

- Cambiar nombre, logo, manifest, package names (`@daily-tracker/*`).
- Definir entidad principal y reemplazar `Task` en types/core.
- Definir periodo principal (semana? mes? rango libre?).
- Ajustar sidebar y nombrar el segundo item con la entidad principal.
- Reusar AuthContext / Layout / FAB / Toast / Settings sin cambios.
- Reusar `authFetch` y App Check.
- Reusar error logging.
- Crear reglas Firestore desde bloqueo por defecto.
- Crear docs equivalentes desde estos archivos.
