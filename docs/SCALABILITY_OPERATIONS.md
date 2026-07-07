# Scalability Operations

Checklist operativo para Daily Tracker. El producto enforces plan limits,
guarda errores en `errorLogs`, espera App Check en produccion y procesa
jobs pesados de forma asincrona.

## App Check

- Crear un Firebase App Check reCAPTCHA v3 provider para la app web.
- Setear `VITE_FIREBASE_APPCHECK_SITE_KEY` en el build del frontend.
- Setear `ENFORCE_APP_CHECK=true` en produccion **solo despues** de validar el site key en el frontend.
- Dejar `ENFORCE_APP_CHECK` sin setear o en `false` para desarrollo y rollback de emergencia.

## Cost Alerts

Configurar alertas de proveedor antes de abrir adquisicion pagada:

- Firebase / Google Cloud Billing: monthly budget, forecast alert al 50/80/100%.
- Resend (cuando se use): monthly send budget y monitoreo de reputacion de dominio.
- Hosting (Railway/Vercel/Cloud Run): CPU, memoria, restarts, egress.

Variables sugeridas en `.env.example` de api:

- `FIREBASE_MONTHLY_BUDGET_USD`
- `RESEND_MONTHLY_BUDGET_USD`
- `ALERT_EMAIL`

Estas vars documentan el presupuesto operativo; las alertas concretas deben
crearse en la consola de cada proveedor.

## Job Operations

Operaciones costosas devuelven `202 Accepted` y crean `users/{uid}/jobs/{jobId}`:

- `tasks.auto-roll` — mueve tareas incompletas al lunes siguiente (job semanal).
- `analytics.rebuild-week` — recalcula `users/{uid}/analytics/{weekId}` desde tasks.
- `reports.weekly-email` — manda resumen semanal por Resend (futuro).
- `aggregates.rebuild-user` — recalcula todos los analytics del usuario.

Los jobs se persisten en `jobQueue/{jobId}` y los procesa el worker en
`packages/api/src/worker.ts` (cuando exista). El worker reintenta con backoff
exponencial, recupera `running` jobs estancados despues de `JOB_RUNNING_TIMEOUT_MS`,
y borra payloads grandes en Storage despues de exito o fallo final.

Para deploys de un solo proceso, el web service arranca un worker embebido.
Para worker dedicado, setear `RUN_EMBEDDED_WORKER=false` en el web service y
correr:

```bash
npm run worker --workspace=packages/api
```

Knobs utiles:

- `JOB_MAX_ATTEMPTS`
- `JOB_RETRY_BASE_DELAY_MS`
- `JOB_RETRY_MAX_DELAY_MS`
- `JOB_RUNNING_TIMEOUT_MS`
- `JOB_SCAN_LIMIT`

## Plan Limits And Usage

- Limites por plan viven en `packages/core/src/lib/planLimits.ts` (a crear).
- Uso se escribe desde backend en `users/{uid}/usage/{period}` y se audita en `users/{uid}/usageEvents/{eventId}`.
- Creacion de tasks y projects pasa por backend para que el limite no pueda saltarse.
- Free (definitivo TBD): max 3 proyectos, semana actual, sin analytics, sin export.
- Pro: ilimitado.

Endpoints admin (cuando existan):

- `GET /api/admin/usage/summary?period=YYYY-MM`
- `POST /api/admin/aggregates/enqueue-maintenance`

## Webhook Idempotency

Cuando se integren pagos, los webhooks se deduplican en
`webhookEvents/{provider}_{eventId}`. Un retry del provider debe devolver
`{ received: true, processed: false }` y no re-aplicar cambios de subscription.

## Roadmap Coverage

| Prioridad | Control | Estado | Gap |
| --- | --- | --- | --- |
| 1 | Plan limits | Pendiente | Crear `planLimits.ts` y guardar `usage/{period}`. |
| 2 | Counters mensuales | Pendiente | Endpoint admin de summary. |
| 3 | Jobs queue | Pendiente | `worker.ts` con retries y stale recovery. |
| 4 | Aggregates semanales | Pendiente | Mantener `users/{uid}/analytics/{weekId}` por backend. |
| 5 | Reducir listeners realtime | Parcial | Hoy `useTasks` escucha cada `day/{dayId}`. OK para beta, optimizar despues. |
| 6 | Rate limit distribuido | Pendiente | In-memory hoy. Mover a Redis o Firestore counters. |
| 7 | App Check obligatorio | Parcial | Hooks listos, falta enforce. |
| 8 | Cost observability | Pendiente | Configurar provider alerts. |
| 9 | Webhooks idempotentes | Pendiente | Cuando se integren pagos. |
| 10 | Backups y restore | Pendiente | Definir frecuencia, retencion y runbook. |

## Scale Phases

| Phase | Status | Notas |
| --- | --- | --- |
| Now (beta) | Parcial | Backend monolitico, plan limits en construccion. Bloqueante para produccion: distributed rate limit + App Check enforcement. |
| 1k-10k usuarios | Pendiente | Worker dedicado, dashboards de costos y latencia. |
| 10k-100k usuarios | Pendiente | Migrar queue a Cloud Tasks/PubSub, code-split bundle. |
| 100k+ usuarios | Pendiente | Separar dominios (analytics, billing, notifications). |
| 1M+ usuarios | Pendiente | Event-driven, CQRS, warehouse analytics. |
