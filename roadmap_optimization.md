# Roadmap de optimización — tiempos de carga y mutaciones

**Fecha:** 2026-07-25  
**Contexto:** Al guardar o editar tareas, eventos, hábitos, recetarios, etc. la UI se siente lenta.  
**Objetivo:** Reducir latencia percibida (objetivo p95 create/edit **&lt; 400 ms** en red típica) y eliminar bloqueos de UI innecesarios.

---

## 1. Diagnóstico (causas verificadas en código)

### 1.1 API — create con N+1 de `COUNT` por día (crítico)

**Dónde:** `packages/api/src/routes/tasks.ts` (bucle `orderByDay` antes del `insert`).

```text
for each unique dayId in occurrenceRanges:
  SELECT count(*) FROM tasks WHERE user_id = ? AND day_id = ?
```

- Las consultas van **en serie** (`await` dentro del `for`).
- Con **hábitos diarios** o repetición `daily`, el horizonte es **90 ocurrencias** (`recurrenceHorizon` en `packages/api/src/lib/recurrence.ts` / core).
- Peor caso realista: **~90 round-trips** a Postgres solo para calcular `order`, **antes** del insert.

**Impacto estimado:** cientos de ms a varios segundos según latencia Supabase (p. ej. 30–80 ms × 90 ≈ 3–7 s).

**Síntoma:** “Guardar hábito / tarea diaria se cuelga mucho”.

---

### 1.2 API — materialización masiva + payload enorme (alto)

**Dónde:** mismo handler POST; respuesta:

```json
{ "...first", "instances": [ /* hasta 90 filas completas */ ] }
```

- Un solo `INSERT` con muchas filas está bien; el coste crece con el tamaño del body de respuesta y el parseo en el cliente.
- Hábitos fuerzan `daily` si `none` → 90 filas por defecto.
- Recetarios multi-fase × horarios × días pueden generar decenas/cientos de filas.

**Impacto:** red + JSON + rehidratación en store.

---

### 1.3 API — trabajo secuencial en el camino caliente (medio)

En cada create (y en parte en rematerialize-rx):

| Paso | Función | Notas |
|------|---------|--------|
| 1 | `readProfilePlan(uid)` | 1 query profiles |
| 2 | `readUsage(uid, month)` | 1 query usage_counters (si plan free) |
| 3 | N × `count` por día | **N+1** (ver 1.1) |
| 4 | `insert(rows)` | 1 query batch |
| 5 | `bumpUsage(...)` | 1–3 queries (eventos + select + upsert) |

Nada de 1–2–5 es terrible por sí solo; el **N+1** domina. Aun así, plan+usage podrían ir en paralelo.

**Update (PATCH):**

1. `select *` de la fila existente  
2. `update` instancia y/o **toda la serie** (`applyTo=series`)  
3. Sin caché de perfil

Editar “toda la serie” de un hábito diario = update de **hasta 90 filas** en un solo `UPDATE … WHERE series_id = ?` (aceptable en SQL, pero pesado si hay índices/triggers/realtime).

---

### 1.4 Cliente — la UI espera al servidor aunque haya optimistic UI (alto percibido)

**Dónde:**

- `taskHistory.create` / `update` → `await createTask` / `await updateTask`
- `useTasks.addTask` / `editTask` → `await taskHistory.*`
- `AddTaskForm` / `TaskDetailSheet` → `await onAdd` / `await editTask` con `submitting` / `saving`

Flujo real:

1. Se pinta optimistic en el store (rápido).  
2. El formulario **sigue abierto y deshabilitado** hasta que responde la API.  
3. Luego se quita optimistic y se reinsertan instancias reales.  
4. Realtime dispara **refetch** (ver 1.5).

**Impacto percibido:** el usuario mide “desde Guardar hasta que cierra el sheet”, no el optimistic del board.

---

### 1.5 Realtime — tormenta de refetch al mutar (crítico en vista semana)

**Dónde:**

- `subscribeTasks` en `packages/core/src/services/taskService.ts`
- Cada `useTasks(weekId, dayId)` abre un canal; en **semana lista** hay **hasta 7 columnas** = 7 suscripciones.
- Filtro Realtime: `user_id=eq.${uid}` (cualquier cambio del usuario).
- `onChange` → **siempre** `fetchTasksCoveringDay(uid, dayId)` (SELECT completo del día).

Al crear **1 tarea** (o 90 de un hábito):

1. Postgres emite INSERT(s).  
2. **Cada** DayColumn activa recibe el evento.  
3. Cada una hace un **fetch completo** del día.  
4. `mergeDayTaskLists` en cada una.

Con 7 columnas: **7 SELECTs** por cada ráfaga de realtime (y con 90 inserts puede haber muchas notificaciones).

**Impacto:** picos de red y re-renders justo cuando el usuario espera “listo”.

---

### 1.6 Auth token en cada request (bajo–medio)

**Dónde:** `packages/core/src/lib/api.ts` → `getAccessToken()` → `supabase.auth.getSession()` en **cada** `api.post/patch`.

En entornos lentos o con storage ocupado suma 10–50 ms por mutación (no es el cuello principal, pero es gratis de optimizar).

---

### 1.7 Cargas de rango en Board / Resumen (contexto de “carga”, no solo save)

- `DashboardPage`: `fetchTasksInRange` de toda la semana al montar.  
- `ContinuousMonthsView` / `MonthView`: rangos grandes.  
- `EisenhowerPage` / `NotificationsPage` / `CirclePage`: rangos adicionales.

No explican por sí solos la lentitud de **Guardar**, pero compiten por red y por el store y empeoran la sensación general.

---

### 1.8 Qué NO parece ser el problema principal

- Índices básicos de `tasks (user_id, day_id)` (existen en schema; conviene verificar en prod).  
- Zod parse del body (barato).  
- Materialización en CPU pura (rápida frente a I/O).  
- Falta de optimistic en updates de toggle (sí hay optimistic en `taskHistory.update`).

---

## 2. Métricas a instrumentar (antes de optimizar a ciegas)

Añadir logging temporal o OpenTelemetry en:

| Métrica | Dónde |
|---------|--------|
| `api.tasks.create.ms` total y por fase | plan, usage, orderCounts, insert, bump, serialize |
| `api.tasks.create.rows` | número de filas insertadas |
| `api.tasks.create.order_queries` | cuántos COUNT |
| `client.mutation.wait_ms` | desde click Guardar hasta `finally` del form |
| `client.realtime.refetch_count` | refetches en ventana de 2 s tras mutación |
| `client.api.auth_ms` | tiempo de `getSession` |

**Éxito:**

- Create single-day (sin serie): p95 API &lt; 200 ms, UI cierra sheet &lt; 150 ms (optimistic close).  
- Create hábito daily 90d: p95 API &lt; 500 ms (sin N counts).  
- Edit instance: p95 API &lt; 150 ms.  
- Tras mutación: ≤ 1 refetch de rango (ideal 0 si se confía en optimistic + response).

---

## 3. Plan por fases

### Fase 0 — Quick wins (1–2 días) · impacto alto / esfuerzo bajo

| # | Acción | Archivos | Detalle |
|---|--------|----------|---------|
| 0.1 | **Eliminar N+1 de order** | `api/routes/tasks.ts` | Una sola query: `select day_id, count(*) group by day_id` para los dayIds del rango, o calcular `order` en cliente/local sin COUNT (p. ej. max order en store + timestamp). Mínimo viable: `Promise.all` de counts (paralelo) como parche intermedio. |
| 0.2 | **Cerrar form sin esperar red** | `AddTaskForm`, `TaskDetailSheet`, `BoardPage` | `onAdd` fire-and-forget con toast de error si falla; optimistic ya en store. Mantener `await` solo si se necesita el id real en la misma acción. |
| 0.3 | **Debounce / coalescing de refetch realtime** | `taskService.subscribeTasks` | Tras `onChange`, debounce 150–300 ms y coalescer; idealmente un solo canal por `uid` + un scheduler de refetch por día tocado. |
| 0.4 | **Cache de access token** | `core/lib/api.ts` | Cachear JWT hasta `expires_at - 60s`; refrescar solo al expirar. |

**Criterio de salida Fase 0:** create hábito daily deja de ser “varios segundos” en condiciones normales; Guardar cierra el sheet al instante.

---

### Fase 1 — API create/update eficiente (3–5 días)

| # | Acción | Detalle |
|---|--------|---------|
| 1.1 | **Batch order** | `SELECT day_id, coalesce(max("order"), -1) FROM tasks WHERE user_id=$1 AND day_id = ANY($2) GROUP BY day_id` |
| 1.2 | **Paralelizar plan + usage** | `Promise.all([readProfilePlan, readUsage])` |
| 1.3 | **bumpUsage en background** | Responder 201 tras insert; encolar bump (no bloquear respuesta). Idempotencia con `eventId` ya existe. |
| 1.4 | **Respuesta compacta** | Por defecto devolver `{ id, instances: [{id, weekId, dayId}] }` o solo primera + `createdCount`. Flag `?full=1` si hace falta. |
| 1.5 | **Hábitos: no materializar 90 filas síncronas** | Ver Fase 2 (modelo lazy). Mientras tanto: horizonte daily 30 días o materializar “ventana visible + 14 días”. |
| 1.6 | **Update series** | Si solo cambian metadata, un único `UPDATE`; evitar `select *` completo si solo se necesita `series_id`/`kind`/`day_id`. |

**Índices a verificar en Supabase:**

```sql
-- Ya deberían existir; confirmar EXPLAIN
create index if not exists tasks_user_day_idx on public.tasks (user_id, day_id);
create index if not exists tasks_user_series_idx on public.tasks (user_id, series_id) where series_id is not null;
create index if not exists tasks_user_end_day_idx on public.tasks (user_id, end_day_id);
```

---

### Fase 2 — Modelo de series / hábitos lazy (1–2 semanas) · impacto estructural

Hoy: **materializar N filas físicas** por ocurrencia.

Propuesta:

1. **Serie canónica** (1 fila o tabla `task_series`) con reglas de recurrencia.  
2. **Instancias** solo cuando el usuario las toca o cuando entran en la ventana visible (lazy materialize on read).  
3. Completado de hábito = upsert de instancia del día, no pre-crear 90 filas.

**Beneficios:** create ~1 fila; edit de plantilla ~1 update; board fetch sigue acotado por rango.

**Migración:** habits nuevos en modelo lazy; series viejas se siguen leyendo materializadas.

---

### Fase 3 — Realtime y store (1 semana)

| # | Acción | Detalle |
|---|--------|---------|
| 3.1 | **Un canal por usuario** | No uno por DayColumn. |
| 3.2 | **Aplicar delta del evento Realtime** | Usar el payload de `postgres_changes` (new/old record) en lugar de re-SELECT. |
| 3.3 | **Ignorar eco de mutaciones propias** | Marcar `clientMutationId` / ventana de 1–2 s tras create local. |
| 3.4 | **Suscripción a nivel Board** | `BoardPage` suscribe rango de la vista; columnas leen solo store. |

---

### Fase 4 — UX de carga y percepción (2–4 días)

| # | Acción |
|---|--------|
| 4.1 | Toast “Guardado” inmediato; toast de error si falla en background |
| 4.2 | Skeleton en celdas del board en primer fetch de rango, no en mutaciones |
| 4.3 | Prefetch de semana actual al login (idle) para Resumen y Board |
| 4.4 | Evitar re-mount de `AddTaskForm` / sheet que re-disparen efectos pesados |

---

### Fase 5 — Observabilidad y regresión (continuo)

- Test de rendimiento en CI (mock Supabase midiendo nº de queries en create daily).  
- Test: “create daily no hace más de 3 round-trips a DB”.  
- Dashboard interno o logs Railway: p95 create/update.

---

## 4. Priorización recomendada (orden de implementación)

```text
0.1 Order sin N+1          ████████████  impacto máx.
0.2 Form no bloquea red    ██████████    percepción máx.
0.3 Debounce realtime      █████████
1.3 bumpUsage async        ████
1.4 Response compacta      ████
1.5 Horizonte / lazy habits██████
3.x Realtime unificado     ████████
2.x Modelo lazy series     ████████████  medio plazo
```

---

## 5. Pseudocódigo de fixes prioritarios

### 5.1 Order en una query (API)

```ts
const dayIds = [...new Set(occurrenceRanges.map(r => r.dayId))];
const { data: counts } = await admin
  .from('tasks')
  .select('day_id')
  .eq('user_id', uid)
  .in('day_id', dayIds);
// o RPC: counts_by_day(uid, dayIds[])
const orderByDay = new Map<string, number>();
for (const id of dayIds) orderByDay.set(id, 0);
for (const row of counts ?? []) {
  orderByDay.set(row.day_id, (orderByDay.get(row.day_id) ?? 0) + 1);
}
```

Mejor: función SQL `max_order_by_days(p_user, p_days text[])`.

### 5.2 Cierre optimista del formulario (web)

```ts
onAdd={async payload => {
  setFabOpen(false); // o onCancel inmediato
  void addTask(payload)
    .then(() => showToast(ok))
    .catch(err => showToast(error, 'error'));
}}
```

### 5.3 Debounce refetch (core)

```ts
let t: ReturnType<typeof setTimeout> | null = null;
const scheduleLoad = () => {
  if (t) clearTimeout(t);
  t = setTimeout(() => { t = null; load(); }, 200);
};
// onChange: scheduleLoad
```

---

## 6. Riesgos y trade-offs

| Cambio | Riesgo | Mitigación |
|--------|--------|------------|
| No await en form | Usuario navega antes de ver error | Toast + reabrir draft en error; offline queue ya existe |
| bumpUsage async | Contador de plan retrasado ms | Aceptable; free tier no es rígido en el ms |
| Lazy habits | Complejidad de “días sin fila” | Generar virtuales en `collectTasksCovering` |
| Menos realtime refetch | UI desfasada multi-dispositivo | Delta del evento + refetch periódico 30–60 s |

---

## 7. Checklist de verificación post-cambio

- [ ] Create tarea single-day: form cierra &lt; 100 ms; board muestra fila al instante  
- [ ] Create hábito: API &lt; 500 ms; no 90 COUNT en logs  
- [ ] Edit título instancia: toggle/save fluido  
- [ ] Edit serie (applyTo=series): coherente en todos los días sin freeze de UI  
- [ ] Vista semana: un solo create no dispara 7+ SELECT pesados  
- [ ] Offline: cola sigue funcionando  
- [ ] Tests API: `tasks-create-span` + nuevo test de “query budget”  

---

## 8. Resumen ejecutivo

La lentitud al **guardar/editar** no es un misterio de React: es sobre todo:

1. **N+1 de COUNTs por día** en materialización (peor con daily/hábitos/rx).  
2. **UI que espera la red** a pesar del optimistic.  
3. **Realtime que re-descarga** el día en cada columna al mutar.

Atacar **0.1 + 0.2 + 0.3** debería notarse de inmediato. El modelo lazy de series (Fase 2) es la mejora estructural para hábitos y recurrencias a medio plazo.

---

## 9. Referencias de código

| Área | Ruta |
|------|------|
| Create + counts + insert | `packages/api/src/routes/tasks.ts` |
| Horizontes recurrencia | `packages/api/src/lib/recurrence.ts`, `packages/core/src/lib/recurrence.ts` |
| Usage | `packages/api/src/lib/usage.ts` |
| Cliente HTTP | `packages/core/src/lib/api.ts` |
| create/update cliente | `packages/core/src/services/taskService.ts` |
| Historial + optimistic | `packages/core/src/history/taskHistory.ts` |
| Hook board | `packages/core/src/hooks/useTasks.ts` |
| Realtime | `packages/core/src/lib/realtime.ts` |
| Form create | `packages/web/src/components/Board/AddTaskForm.tsx` |
| Detalle edit | `packages/web/src/components/Board/TaskDetailSheet.tsx` |
