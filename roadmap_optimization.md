# Roadmap de optimización — tiempos de carga y mutaciones

**Fecha (actualizado):** 2026-07-25  
**Versión de producto de referencia:** **v2.7.5**  
**Archivo:** `roadmap_optimization.md` (repo root)

**Contexto original:** Al guardar o editar tareas, eventos, hábitos, recetarios, etc. la UI se siente lenta.  
**Objetivo:** Reducir latencia percibida (objetivo p95 create/edit **&lt; 400 ms** en red típica) y eliminar bloqueos de UI innecesarios, **teniendo en cuenta las features nuevas** que aumentan volumen de datos y re-renders.

---

## 0. Mapa de producto actual (impacta rendimiento)

El monorepo ya no es un “task tracker mínimo”. Cada dominio nuevo multiplica filas, queries o trabajo en cliente.

### 0.1 Calendario (nav **Calendario**, ruta `/board`)

| Capacidad | Versión aprox. | Impacto en perf |
|-----------|----------------|-----------------|
| Vistas **día \| semana \| mes \| continuo** + lista/horario | base + iteraciones | 7× `useTasks` en semana; mes/continuo = `fetchTasksInRange` amplio |
| Filtros categoría: **Todo / Proyectos / Recetario / Eventos / Posibles / Hábitos** | 2.6.x–2.7.0 | Más re-filtros en cliente; mensajes vacíos por categoría |
| Checkbox de completar en **todas** las vistas (lista, grilla, chips, barras) | 2.7.4 | Más handlers por ítem; toggles optimistas OK si no se espera red en UI |
| Orden lista **por hora** (temprano → tarde) | 2.7.5 | Barato (sort en memoria); `compareByStartTime` en `taskPresence` |
| Doble clic hueco horario → crear con hora | 2.6.6+ | OK |
| Multi-día + cruce medianoche (20:00→03:00) | 2.6.7 | Layout `layoutInGridForDay` un poco más trabajo |
| **Pasos asociados** (`steps` jsonb) en tarea/recordatorio/evento/posible | 2.7.1 | Payload create/update más grande; UI checklist en form/detalle |
| FAB estable entre pestañas | 2.6.6 | N/A perf de red |

### 0.2 Kinds de entrada (filas en `tasks`)

| Kind | Comportamiento al crear | Riesgo |
|------|-------------------------|--------|
| `task` / `reminder` | 1+ filas si hay recurrencia | Medio si daily/weekly |
| `event` / `possible_event` | 1 span o serie; lugar, involucrados, pasos | Medio |
| `rx_human` / `rx_pet` | Materializa **día × hora × fases** | **Alto** (muchas filas) |
| `habit_good` / `habit_quit` | Fuerza **daily** si `none` → hasta **90 filas** | **Crítico** (N+1 order + insert + realtime) |

### 0.3 Otras pantallas que compiten por red/store

| Pantalla | Qué carga | Riesgo |
|----------|-----------|--------|
| **Resumen** (`DashboardPage`) | `fetchTasksInRange` de la **semana ISO de hoy** + `collectTasksCovering` | Medio al montar; arreglado 2.7.3 (antes vacío/sin fetch) |
| **Reflexiones** | Diario local en settings (ánimo+energía por hora, sueño, texto) | Bajo en red API; más estado local |
| **Círculo** | Contactos + a veces `fetchTasksInRange` de compromisos | Medio |
| **Eisenhower / Notificaciones** | Rangos de tareas | Medio–alto |
| **Proyectos** | Lista proyectos | Bajo |

### 0.4 Implicación para este roadmap

Las features nuevas **no cambian la causa raíz** (N+1 de COUNTs + await en form + refetch Realtime), pero **sí amplifican el daño**:

- Guardar un **hábito** o **recetario** es el peor caso.  
- Un toggle de checkbox en **7 columnas** + Realtime multiplica SELECTs.  
- **Pasos** y **involved contacts** engordan el JSON de create/update.  
- **Continuo** y **Resumen** piden rangos grandes al montar.

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
- **Recetarios** multi-fase: un COUNT por cada día distinto del plan (puede ser 14–30+).

**Impacto estimado:** cientos de ms a varios segundos (p. ej. 30–80 ms × 90 ≈ 3–7 s).

**Síntoma:** “Guardar hábito / recetario / tarea diaria se cuelga mucho”.

---

### 1.2 API — materialización masiva + payload enorme (alto)

**Dónde:** mismo handler POST; respuesta:

```json
{ "...first", "instances": [ /* hasta 90 filas completas, con steps[] */ ] }
```

- Hábitos fuerzan `daily` si `none` → 90 filas por defecto.  
- Cada fila puede llevar `steps`, `involved_contact_ids`, `location`, etc.  
- Cliente: `taskHistory.create` reinserta **todas** las instancias en el store.

**Impacto:** red + JSON + rehidratación + picos de Realtime.

---

### 1.3 API — trabajo secuencial en el camino caliente (medio)

| Paso | Función | Notas |
|------|---------|--------|
| 1 | `readProfilePlan(uid)` | 1 query profiles |
| 2 | `readUsage(uid, month)` | 1 query usage_counters (plan free) |
| 3 | N × `count` por día | **N+1** (1.1) |
| 4 | `insert(rows)` | 1 batch |
| 5 | `bumpUsage(...)` | 1–3 queries |

**Update (PATCH):**

1. `select *` de la fila  
2. `update` instancia y/o **toda la serie** (`applyTo=series`) — crítico en hábitos (hasta 90 filas) y en **pasos** propagados a la serie  
3. Sin caché de perfil

---

### 1.4 Cliente — la UI espera al servidor aunque haya optimistic UI (alto percibido)

**Dónde:**

- `taskHistory.create` / `update` → `await createTask` / `await updateTask`  
- `useTasks.addTask` / `editTask` → `await taskHistory.*`  
- `AddTaskForm` / `TaskDetailSheet` → `await onAdd` / `await handleSave` con `submitting` / `saving`  
- Checkbox en calendario: `editTask` / `taskHistory.update` — si se hace `await` en el handler, el check se siente “duro”

Flujo:

1. Optimistic en store (rápido).  
2. Formulario / detalle **sigue bloqueado** hasta la API.  
3. Se reescriben instancias reales.  
4. Realtime dispara **refetch** (1.5).

---

### 1.5 Realtime — tormenta de refetch al mutar (crítico en vista semana)

**Dónde:**

- `subscribeTasks` en `packages/core/src/services/taskService.ts`  
- Semana **lista**: hasta **7** `useTasks` → 7 canales con filtro `user_id=eq.${uid}`  
- `onChange` → **siempre** `fetchTasksCoveringDay`  
- Toggle de checkbox o create de 1 hábito → INSERT(s) → N refetches

Con **hábitos 90 inserts** el fan-out de eventos Realtime puede ser brutal.

---

### 1.6 Auth token en cada request (bajo–medio)

`packages/core/src/lib/api.ts` → `getSession()` en cada mutación.

---

### 1.7 Cargas de rango al montar pantallas (medio, “carga” general)

| Pantalla | Fetch |
|----------|--------|
| Resumen | Semana completa (`DashboardPage`, 2.7.3) |
| Continuo | Varios meses (`ContinuousMonthsView`) |
| Mes | Rango del grid del mes |
| Círculo / Eisenhower / Notificaciones | Rangos propios |

Compiten con mutaciones y saturan el store.

---

### 1.8 Features nuevas — puntos calientes específicos

| Feature | Riesgo | Nota |
|---------|--------|------|
| **Hábitos** `habit_good` / `habit_quit` | Crítico | Create = daily × 90; edit serie = 90 updates |
| **Pasos** `steps` | Medio | JSON en cada fila; edit serie puede copiar checklist a toda la serie |
| **Eventos + Círculo** | Medio | `involved_contact_ids`, tags de handles, lugar |
| **Recetario** | Alto | Materialización densa día×hora |
| **Checkbox global** | Medio percibido | Muchos toggles; debe ser optimistic sin bloquear paint |
| **Orden por hora** | Bajo | Solo sort local |
| **Reflexiones** (ánimo+energía juntos) | Bajo API | Persistencia en settings del usuario; no pasa por tasks |

---

### 1.9 Qué NO es el problema principal

- Sort por hora en lista.  
- Copy/i18n de vacíos por categoría.  
- Skins / layout chrome (FAB).  
- Falta de optimistic en updates (existe; el await del form es el problema).

---

## 2. Métricas a instrumentar

| Métrica | Dónde |
|---------|--------|
| `api.tasks.create.ms` por fase | plan, usage, orderCounts, insert, bump, serialize |
| `api.tasks.create.rows` | filas insertadas (hábitos ~90) |
| `api.tasks.create.order_queries` | nº de COUNT |
| `client.mutation.wait_ms` | click Guardar → `finally` del form |
| `client.checkbox.toggle_ms` | click check → paint optimista |
| `client.realtime.refetch_count` | refetches en 2 s tras mutación |
| `client.api.auth_ms` | `getSession` |

**Éxito:**

- Create single-day: p95 API &lt; 200 ms; sheet cierra &lt; 150 ms.  
- Create hábito daily 90d: p95 API &lt; 500 ms (sin N counts).  
- Edit instance / toggle checkbox: p95 API &lt; 150 ms; UI &lt; 50 ms percibido.  
- Tras mutación: ≤ 1 refetch de rango (ideal 0 con delta Realtime).

---

## 3. Plan por fases (actualizado)

### Fase 0 — Quick wins (1–2 días) · impacto alto / esfuerzo bajo

| # | Acción | Archivos | Detalle |
|---|--------|----------|---------|
| 0.1 | **Eliminar N+1 de order** | `api/routes/tasks.ts` | Una query `GROUP BY day_id` / `max(order)` para los días del rango; o `Promise.all` de counts como parche. **Prioridad #1 por hábitos.** |
| 0.2 | **Cerrar form sin esperar red** | `AddTaskForm`, `TaskDetailSheet`, `BoardPage` | Cerrar sheet + toast; error en background. |
| 0.3 | **Checkbox no bloquea paint** | `ScheduleGrid`, `MonthView`, `TaskCard`, `DayView` | `void taskHistory.update(...)` ya en varios sitios; asegurar que ninguno haga spinner global. |
| 0.4 | **Debounce / coalescing Realtime** | `taskService.subscribeTasks` | 150–300 ms; un solo canal por `uid`. |
| 0.5 | **Cache access token** | `core/lib/api.ts` | Hasta `expires_at - 60s`. |

**Salida Fase 0:** guardar hábito deja de ser “varios segundos”; Guardar cierra al instante; checks en calendario se sienten instantáneos.

---

### Fase 1 — API create/update eficiente (3–5 días)

| # | Acción | Detalle |
|---|--------|---------|
| 1.1 | Batch order SQL | `max(order) GROUP BY day_id` o RPC |
| 1.2 | `Promise.all([plan, usage])` | |
| 1.3 | `bumpUsage` async | Responder 201 tras insert |
| 1.4 | Respuesta compacta | `{ id, createdCount, instances: [{id,weekId,dayId}] }` sin volcar `steps`×90 |
| 1.5 | Hábitos: horizonte corto o lazy | Daily 14–30 días visibles, o no materializar 90 (Fase 2) |
| 1.6 | Update serie: campos mínimos | Evitar `select *` si solo hace falta `series_id`/`kind` |
| 1.7 | Pasos en serie | No propagar `steps` a 90 filas por defecto; solo instancia, o plantilla de serie |

**Índices a verificar en Supabase:**

```sql
create index if not exists tasks_user_day_idx on public.tasks (user_id, day_id);
create index if not exists tasks_user_series_idx on public.tasks (user_id, series_id) where series_id is not null;
create index if not exists tasks_user_end_day_idx on public.tasks (user_id, end_day_id);
create index if not exists tasks_user_kind_day_idx on public.tasks (user_id, kind, day_id);
```

---

### Fase 2 — Modelo lazy de series / hábitos (1–2 semanas)

Hoy: materializar **N filas físicas** por ocurrencia.

Propuesta:

1. Serie canónica (reglas de recurrencia + steps plantilla + color).  
2. Instancias **on demand** (ventana visible + al completar un día).  
3. Completar hábito = upsert del día, no precrear 90 filas.

**Aplica a:** `habit_good`, `habit_quit`, y opcionalmente daily/weekly de tareas.

**Migración:** hábitos nuevos lazy; series viejas materializadas se siguen leyendo.

---

### Fase 3 — Realtime y store (1 semana)

| # | Acción |
|---|--------|
| 3.1 | Un canal por usuario (no por DayColumn) |
| 3.2 | Aplicar delta del evento Realtime (`new`/`old` record) |
| 3.3 | Ignorar eco de mutaciones propias (ventana 1–2 s) |
| 3.4 | Suscripción a nivel Board por rango de vista |
| 3.5 | Continuo/Resumen: no re-fetch completo si el store ya tiene el rango fresco |

---

### Fase 4 — UX y cargas de pantalla (2–4 días)

| # | Acción |
|---|--------|
| 4.1 | Toast “Guardado” inmediato |
| 4.2 | Prefetch semana actual en idle (Resumen + Board) |
| 4.3 | Continuo: ventana de meses más estrecha + infinite scroll (ya hay load chunk; afinar) |
| 4.4 | Form pasos: no re-render masivo del board al tipear un paso (estado local hasta Guardar — ya es draft en detalle) |
| 4.5 | Skeleton solo en primer fetch de rango, no en toggles |

---

### Fase 5 — Observabilidad (continuo)

- Test CI: “create daily no hace más de 3 round-trips a DB”.  
- Log p95 create/update en Railway.  
- Contador de filas por kind (`habit_*`, `rx_*`) en métricas.

---

## 4. Priorización (orden de implementación)

```text
0.1 Order sin N+1              ████████████  hábitos / daily
0.2 Form no bloquea red        ██████████    percepción
0.3 / 0.4 Checkbox + Realtime  █████████     calendario actual
1.4 Response compacta          ████
1.5 / 2.x Lazy hábitos         ████████████  medio plazo
3.x Realtime unificado         ████████
4.x Prefetch / continuo        ████
```

---

## 5. Pseudocódigo de fixes prioritarios

### 5.1 Order en una query (API)

```ts
const dayIds = [...new Set(occurrenceRanges.map(r => r.dayId))];
// Preferir RPC max_order_by_days(uid, dayIds[])
// Parche intermedio: Promise.all counts, no await en serie
const counts = await Promise.all(
  dayIds.map(async dayId => {
    const { count } = await admin.from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid).eq('day_id', dayId);
    return [dayId, count ?? 0] as const;
  })
);
const orderByDay = new Map(counts);
```

### 5.2 Cierre optimista del formulario

```ts
onAdd={async payload => {
  setFabOpen(false);
  void addTask(payload)
    .then(() => showToast(t('task_created_ok'), 'success'))
    .catch(err => showToast(formatError(err), 'error'));
}}
```

### 5.3 Debounce refetch Realtime

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
| Form sin await | Error tras cerrar | Toast + cola offline ya existente |
| Lazy hábitos | Días sin fila física | Generar presencia virtual en `collectTasksCovering` |
| Menos Realtime refetch | Multi-dispositivo desfasado | Delta de evento + poll suave |
| No propagar steps a serie | Serie con checklists distintas | UX: “aplicar pasos a serie” explícito |

---

## 7. Checklist post-cambio

- [ ] Create tarea single-day: form cierra &lt; 100 ms  
- [ ] Create **hábito**: API &lt; 500 ms; logs sin 90 COUNT  
- [ ] Create **recetario** 7d×2 tomas: aceptable y sin N+1  
- [ ] Toggle checkbox en semana/mes/continuo: paint inmediato  
- [ ] Edit pasos en detalle: no congela board  
- [ ] Resumen “Esta semana” sigue mostrando conteos (2.7.3)  
- [ ] Offline queue sigue funcionando  
- [ ] Tests API + test de query budget  

---

## 8. Resumen ejecutivo

La lentitud al **guardar/editar** sigue anclada en:

1. **N+1 de COUNTs por día** al materializar (peor con **hábitos daily** y **recetarios**).  
2. **UI que espera la red** (form/detalle) pese al optimistic.  
3. **Realtime que re-descarga** el día en cada columna al mutar (peor con **checkbox** en 7 columnas y inserts masivos).

Las features de **v2.6–2.7** (hábitos, pasos, eventos, Círculo, resumen con fetch de semana, checks globales, orden por hora) **suben el volumen de trabajo**; el roadmap prioriza Fase 0/1 primero y **lazy de hábitos** como mejora estructural.

---

## 9. Referencias de código (actualizado)

| Área | Ruta |
|------|------|
| Create + counts + insert + habits | `packages/api/src/routes/tasks.ts` |
| Horizontes recurrencia | `packages/api/src/lib/recurrence.ts`, `packages/core/src/lib/recurrence.ts` |
| Hábitos helpers | `packages/core/src/lib/habits.ts` |
| Pasos | `packages/core/src/lib/steps.ts`, `TaskStepsEditor.tsx` |
| Orden lista por hora | `packages/core/src/lib/taskPresence.ts` (`compareByStartTime`) |
| Usage | `packages/api/src/lib/usage.ts` |
| Cliente HTTP | `packages/core/src/lib/api.ts` |
| create/update + subscribe | `packages/core/src/services/taskService.ts` |
| Historial + optimistic | `packages/core/src/history/taskHistory.ts` |
| Hook board | `packages/core/src/hooks/useTasks.ts` |
| Realtime | `packages/core/src/lib/realtime.ts` |
| Form / detalle | `AddTaskForm.tsx`, `TaskDetailSheet.tsx` |
| Checks calendario | `ScheduleGrid.tsx`, `MonthView.tsx`, `TaskCard.tsx`, `BoardLayout.tsx` |
| Resumen semana | `packages/web/src/pages/DashboardPage.tsx` |
| Reflexiones | `packages/web/src/pages/ReflectionsPage.tsx` |
| SQL hábitos / pasos | `supabase/migrations/20260725_habits_kind.sql`, `20260725_task_steps.sql` |

---

## 10. Changelog del propio roadmap

| Fecha | Cambio |
|-------|--------|
| 2026-07-25 | Versión inicial (mutaciones lentas) |
| 2026-07-25 | **Actualización v2.7.5:** mapa de features (hábitos, pasos, checks, orden por hora, resumen, reflexiones, eventos/Círculo); riesgos amplificados; fases 0.3 checkbox, 1.5–1.7 hábitos/pasos; referencias de código al día |
| 2026-07-25 | **Fase 0 aplicada (parcial, v2.7.6):** `loadOrderCounters` (1 query batch por chunks, sin N COUNT secuenciales); plan+usage en `Promise.all`; `bumpUsage` post-respuesta; create form cierra sin await; Realtime debounce 200 ms en `subscribeTasks`; cache JWT en `api.ts` + clear en signOut |
