# Roadmap de optimización — ruido idle y coste de plataforma

**Fecha:** 2026-08-12  
**Producto de referencia:** **v2.17.1**  
**Alcance de esta auditoría:** ~2 líneas `info` por minuto en el API gateway con la app casi en reposo.  
**Auditor:** código en `main` (API Express + SPA + worker embebido + Railway). No se leyeron logs de producción en vivo.

**Respuesta corta:** no es la webapp preguntando cada 30 s. El cliente **no tiene un poll HTTP** al API de Railway. Esos infos son, con alta probabilidad, **healthchecks del gateway logueados por `pino-http`**, a veces sumados a un **cron de `/api/notifications/dispatch`**. En paralelo, el worker embebido **sí barre Supabase cada 60 s** (eso no es el gateway, pero es coste de datos constante).

---

## Quick path (confirmar en 2 minutos)

1. En Railway → Logs, filtra un minuto de idle y mira `req.url` / `req.method` de cada `info`.
2. Clasifica cada línea:

| `req.url` típico | Qué es | ¿Lo genera el usuario? |
|------------------|--------|------------------------|
| `GET /api/version` | Healthcheck de Railway (`railway.toml` → `healthcheckPath`) | No |
| `POST /api/notifications/dispatch` | Cron externo **o** alguien pegándole al endpoint | No (si hay cron) |
| `GET /api/` o `GET /` | Otro probe / load balancer | No |
| `GET /api/public-config` | Arranque de la SPA (una vez) | Solo al abrir |
| `/api/tasks`, `/api/auth/bootstrap` | Uso real | Sí |

3. Cuenta. **Dos `GET /api/version` por minuto** = intervalo de health ~30 s. **Uno de version + uno de dispatch** = health + cron. **Cero HTTP y aún hay infos** = no es el gateway; mira el worker (abajo).

---

## 1. Diagnóstico (evidencia en código)

### 1.1 Reloj #1 — healthcheck + log de cada request (causa más probable del síntoma)

| Pieza | Hecho |
|-------|--------|
| Probe | `railway.toml`: `healthcheckPath = "/api/version"` |
| Handler | `packages/api/src/routes/version.ts` — JSON estático, sin DB |
| Log | `packages/api/src/app.ts`: `pinoHttp({ logger })` en **todas** las rutas, nivel **info** en producción (`logger.ts`) |
| Filtro | No hay. Un 200 de health cuenta igual que un POST de tarea |

`pino-http` escribe un `info` por request (`request completed`). Railway pega a `/api/version` de forma periódica para no matar el contenedor. Un intervalo típico de gateway de ~30 s produce **exactamente ~2 infos/minuto**. Eso no escala con “cuánto usas la app”.

**Cómo se ve** (campos reales de pino-http):

```text
level=30  req.method=GET  req.url=/api/version  res.statusCode=200  msg=request completed
```

Si ves **user-agent** tipo `RailwayHealthCheck`, `Go-http-client` o vacío, cierra el caso.

### 1.2 Reloj #2 — worker de email cada 60 s (Supabase, no Railway)

| Pieza | Hecho |
|-------|--------|
| Arranque | `server.ts` llama `startNotificationsWorker()` al listen |
| Default | `RUN_EMBEDDED_WORKER` default **true**; `NOTIFICATIONS_INTERVAL_MS` default **60_000** |
| Tick silencioso | Solo `logger.info` si `candidates|sent|failed > 0` |
| Trabajo real | **Cada tick** (aunque no envíe nada): `SELECT` de **todos** los `profiles` con email +, por cada usuario con `notifyEmail`, `SELECT` de `tasks` incompletas de 3–5 días |

Eso **no** genera un `info` HTTP en el gateway (el worker llama a Supabase Admin, no a Express). Sí genera:

- tráfico PostgREST hacia el proyecto Supabase cada minuto
- CPU del contenedor
- si alguien configuró **además** un cron a `POST /api/notifications/dispatch`, **ese sí** es un `info` extra por minuto

El dispatch es un **full scan N+1**:

```text
1 × profiles (todos los que tienen email)
+ N × tasks  (un SELECT por usuario con notifyEmail)
(+ inserts a notification_deliveries si hay ventanas)
```

Con 1 usuario y `notifyEmail` apagado: 1 query/minuto. Con `notifyEmail` on: 2+. Con 50 usuarios con email on: 51 queries/minuto **en idle**.

### 1.3 Reloj #3 — SPA / PWA / Realtime (descartados como origen de esos 2 infos)

Auditoría de timers y red en cliente:

| Origen | Intervalo | ¿Pega al API Railway? |
|--------|-----------|------------------------|
| `pwaUpdate.ts` | 30 min + focus/visibility | No (pide `sw.js` / estáticos) |
| `useNotificationScheduler` | debounce 800 ms | No (Capacitor / Notification API local) |
| `NotificationBootstrap` | una vez al montar | Solo `updateSettings` si timezone UTC |
| `subscribeTable` / `subscribeTasks` | WebSocket Realtime | **Supabase**, no Express |
| `useProjects` | un canal Realtime | Supabase |
| `AppShell` prefetch semana | idle una vez | `ensureTasksRangeLoaded` → **Supabase** directo |
| `SettingsPage` | al abrir Sistema | 1 × `GET /api/version` |
| `supabase.ts` public-config | arranque si faltan VITE_* | 1 × `GET /api/public-config` |
| `DocumentsPage` / `DashboardPage` `fetchAllTasks` | al montar | Supabase (y es pesado: `select *`) |

**Conclusión:** con la pestaña abierta y sin navegar, la SPA no genera 2 HTTP/min al API. Si el usuario **cierra** la pestaña y los infos siguen, es 100 % servidor/gateway.

### 1.4 Otros ruidos de plataforma (secundarios)

| Riesgo | Por qué importa |
|--------|-----------------|
| Dos réplicas / restart loop | Duplica healthchecks |
| Cron **y** worker embebido a la vez | 2 scans/min a Supabase + 1 HTTP/min |
| `GET /api/version` como health | Mezcla “versión de producto” (SPA Settings) con probe; no se puede silenciar por path semántico |
| Adjuntos data-URL en `tasks.images` | No es idle, pero `fetchAllTasks` / Documentos / board descargan megas de JSONB en cada visita |
| Docs viejos (`SCALABILITY_OPERATIONS.md`) | Hablan de Firebase App Check y `jobQueue` que **este repo ya no usa** (Supabase). No seguirlos. |

---

## 2. Qué optimizar (orden de impacto)

```text
A  Silenciar health en logs          ████████████  quita el síntoma
B  /healthz barato + intervalo       ██████████    semántica + menos hits
C  Worker: no full-scan + intervalo  ████████████  coste Supabase real
D  Un solo disparador (embed XOR cron) ████████
E  Payloads gordos (images jsonb)    ██████        no es idle; sí es coste
```

Las fases 0–5 de **latencia al guardar** (N+1 de COUNT, hábitos lazy, Realtime 1 canal) **ya están aplicadas** en v2.7.x. Ver [archivo](#8-archivo--latencia-de-mutaciones-cerrado-v27x).

---

## 3. Plan

### Fase A — Dejar de loguear el probe (1–2 h) · quita el “2 infos/min”

**Objetivo:** healthcheck = 200, **cero** línea info.

| # | Cambio | Dónde |
|---|--------|--------|
| A.1 | `pino-http` `autoLogging.ignore` para `GET /api/version`, futuro `/healthz`, `/favicon.ico` | `packages/api/src/app.ts` |
| A.2 | Nivel `warn` para 2xx de probes; `info` solo mutaciones y 4xx/5xx | mismo |
| A.3 | Verificar en Railway: 5 min idle → 0 infos de `request completed` en esos paths | |

```ts
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: req => {
      const url = req.url ?? '';
      return (
        req.method === 'GET' &&
        (url === '/healthz' || url.startsWith('/api/version') || url === '/favicon.ico')
      );
    },
  },
}));
```

**Trade-off:** dejas de ver el probe en logs. Eso es correcto: un health 200 no es un evento de negocio.

### Fase B — Healthcheck dedicado (medio día)

| # | Cambio | Detalle |
|---|--------|---------|
| B.1 | `GET /healthz` → `{ ok: true }` sin leer `package.json` ni listar flags de email | 1 handler de 3 líneas |
| B.2 | `railway.toml` → `healthcheckPath = "/healthz"` | Settings de Railway igual |
| B.3 | `/api/version` queda para humanos / Settings | 1 hit al abrir Sistema, no 2/min |
| B.4 | Documentar intervalo real en Railway (UI del servicio) | Si está en 10–30 s, subir a **60–120 s** una vez estable |

**Éxito:** probe no aparece en infos; Settings sigue mostrando versión.

### Fase C — Worker de notificaciones barato en idle (1–2 días) · el coste de verdad

Hoy el worker es un **batch scan** cada 60 s aunque no haya nada que enviar.

| # | Cambio | Detalle |
|---|--------|---------|
| C.1 | Query de perfiles: filtrar en SQL `settings->>'notifyEmail' = 'true'` (o columna booleana) | Evita traer a todos |
| C.2 | Una query de tasks para **todos** los uids notifiables (`user_id IN (...)`) | Elimina N+1 |
| C.3 | Intervalo idle **180–300 s**; 60 s solo si hay candidatos en la ventana | `NOTIFICATIONS_INTERVAL_MS` default 180000 |
| C.4 | Log de tick: `debug` si `candidates === 0`; `info` solo si envió/falló | Hoy ya casi; no subir ruido |
| C.5 | Índice | `tasks (user_id, completed, day_id)` si no existe |

**Éxito:** 1 usuario con email off = **0** queries de tasks / 3 min. Con email on = 1 query de tasks / 3 min, no 2/min.

### Fase D — Un disparador, no dos (1 h + consola)

| Situación | Qué hacer |
|-----------|-----------|
| Solo Railway, 1 contenedor | `RUN_EMBEDDED_WORKER=true`, **sin** cron a `/dispatch` |
| Cron de Railway / cron-job.org | `RUN_EMBEDDED_WORKER=false` + `CRON_SECRET` + `POST /dispatch` cada 2–5 min |
| Duda | Logs: si ves `/dispatch` cada minuto **y** el worker está on, apaga uno |

### Fase E — Coste de datos al usar la app (no idle; no confundir)

No explica los 2 infos/min. Sí explica facturas de Postgres / payloads enormes cuando **sí** abres la app.

| Superficie | Problema | Dirección |
|------------|----------|-----------|
| `fetchAllTasks` | `select *` de todas las filas (Documentos, Dashboard recetario, Eisenhower amplio) | Endpoint de adjuntos: `id, day_id, kind, project_id, images` **o** columna `has_attachments` + storage |
| `tasks.images` jsonb data-URL | Hasta ~3.5 MB/fila; cada range load los arrastra | Supabase Storage + URL firmada (siguiente salto de adjuntos) |
| Realtime `select *` en INSERT/UPDATE | Replica el JSONB gordo al canal | Replica columns mínimas si PostgREST lo permite |
| Prefetch semana en `AppShell` | 1 fetch al entrar (OK) | No tocar |

---

## 4. Métricas (para no adivinar la próxima vez)

| Señal | Dónde | Idle sano |
|-------|--------|-----------|
| `http.requests` por path | pino (cuando no ignore) o Railway metrics | Solo `/healthz` |
| `notifications.scan.profiles` / `tasks_queries` | log debug del worker | 0–1 / intervalo |
| `notifications.sent` | info | 0 la mayor parte del día |
| `api.tasks.create` | ya existe (`requestMetrics`) | solo al guardar |

Añadir al tick del worker (debug):

```ts
{ metric: 'notifications.scan', scannedUsers, taskQueries, candidates, ms }
```

---

## 5. Checklist de cierre (esta auditoría)

- [ ] Un minuto de logs idle: anotar `req.url` de cada info
- [ ] Fase A desplegada: health no escribe info
- [ ] Fase B: `/healthz` + `healthcheckPath` actualizado
- [ ] Confirmar en Railway que **no** hay cron a `/dispatch` si el worker embebido está on
- [ ] Fase C: scan filtrado + intervalo ≥ 180 s
- [ ] 10 min idle: 0 infos de negocio; ≤ 1 scan Supabase / 3 min
- [ ] Abrir Settings → Sistema: versión y flags de email siguen bien

---

## 6. Fuera de alcance (a propósito)

- Reescribir hábitos lazy / Realtime 1 canal (ya hecho, v2.7.9–2.7.10).
- Storage de adjuntos (Fase E, otro cambio de producto).
- Firebase App Check / `jobQueue` de `docs/SCALABILITY_OPERATIONS.md` (doc obsoleto).

---

## 7. Referencias de código (idle / gateway)

| Área | Ruta |
|------|------|
| Healthcheck Railway | `railway.toml` |
| Access log | `packages/api/src/app.ts` (`pinoHttp`) |
| Nivel de log | `packages/api/src/logger.ts` |
| `/api/version` | `packages/api/src/routes/version.ts` |
| Worker | `packages/api/src/worker/notificationsWorker.ts` |
| Scan email | `packages/api/src/lib/notificationDispatch.ts` |
| Intervalo / embed | `packages/api/src/config.ts` (`worker.*`) |
| Cron HTTP | `packages/api/src/routes/notifications.ts` `POST /dispatch` |
| PWA poll | `packages/web/src/lib/pwaUpdate.ts` (30 min, no API) |
| Realtime | `packages/core/src/lib/realtime.ts` (Supabase WS) |
| Prefetch board | `packages/web/src/components/Layout/AppShell.tsx` |

---

## 8. Archivo — latencia de mutaciones (cerrado, v2.7.x)

El contenido anterior de este archivo (2026-07-25) cubría lentitud al **guardar**. Estado al día:

| Fase | Tema | Estado |
|------|------|--------|
| 0 | Order sin N+1, form no bloquea, Realtime debounce, JWT cache | Hecho (v2.7.6) |
| 1 | Respuesta create compacta, horizonte corto, steps solo instancia | Hecho (v2.7.7) |
| 2 | Hábitos lazy (`habit-ensure` + virtuales `vh:`) | Hecho (v2.7.9) |
| 3 | 1 canal Realtime / uid + delta + eco 2 s + range cache 45 s | Hecho (v2.7.10) |
| 4 | Toast inmediato, prefetch idle, continuo ±1 mes | Hecho (v2.7.11) |
| 5 | `requestMetrics` p95 create/update + tests de round-trips | Hecho (v2.7.12) |

No reabrir esas fases salvo regresión medida. El trabajo nuevo es **A–E** (ruido idle y scan de notificaciones).

---

## 9. Changelog de este documento

| Fecha | Cambio |
|-------|--------|
| 2026-07-25 | Versión inicial: latencia de mutaciones (fases 0–5) |
| 2026-07-25 | Fases 0–5 aplicadas en producto (v2.7.6–2.7.12) |
| 2026-08-12 | **Reenfoque:** auditoría idle (~2 infos/min en API gateway). Diagnóstico healthcheck+pino / worker 60 s / no-poll del cliente. Plan A–E. Histórico de latencia archivado en §8. |
