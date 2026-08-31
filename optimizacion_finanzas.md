# Auditoría de carga de Finanzas

La pantalla **Finanzas / Calendario** tiene varios recorridos duplicados y efectos de escritura dentro de su carga inicial. El principal problema no es un único query lento: es una cascada de lecturas, descifrados, sincronizaciones y recargas que bloquea el primer render útil.

> **Estado:** instrumentación de la etapa 1 implementada. Antes de aplicar los cambios P0, reunir una muestra real de p50/p95 en Railway para confirmar el orden de impacto.

## Instrumentación implementada

Desde **v2.38.5**, cada carga del Calendario envía de forma no bloqueante una muestra técnica agregada al endpoint protegido `POST /api/finances/metrics/calendar-load`. Railway registra la métrica `api.finances.calendar_load` con p50/p95 sobre una ventana en memoria de 100 cargas por instancia.

| Se mide | No se envía |
|---|---|
| Total hasta datos listos y hasta el siguiente frame de pintura | Títulos, importes, notas, IDs de movimientos o identificador de usuario |
| Lectura inicial, descifrado, alineación, FX y puente Board→ledger | Contenido del libro financiero |
| Conteos de filas, reglas, tareas, escrituras y refetches | Datos que permitan reconstruir un movimiento |

**Cómo usarla:** filtrar los logs de Railway por `metric=api.finances.calendar_load`, comparar `p95_ms` y `stage_p95_ms`, y sólo entonces tomar el siguiente P0. La telemetría no bloquea la carga ni persiste en Supabase.

## Recorrido actual

Al abrir o cambiar de mes, `FinancesPage.reload()` dispara en paralelo:

1. Calendario financiero del rango.
2. Cuentas, metas, créditos y categorías.
3. Libro financiero completo.
4. Tareas del rango visible.
5. **Todas** las tareas financieras del usuario.

Después ejecuta posibles escrituras de alineación, conversión FX y sincronización Board→ledger; cada una puede provocar nuevas consultas del calendario.

## Cuellos de botella identificados

| Prioridad | Cuello | Evidencia | Impacto | Optimización propuesta |
|---|---|---|---|---|
| P0 | Libro completo duplicado | El calendario obtiene `/finances/movements?from&to`; en paralelo, el libro pide `/finances/ledger` con hasta 2.000 movimientos y 500 reglas. Ambos traen reglas y ambos descifran. | Payload, CPU y descifrado duplicados antes de pintar el mes. | Crear un endpoint de *bootstrap* de calendario que entregue sólo el rango y los agregados necesarios; reutilizarlo para KPI/Lista. Cargar el libro completo sólo al abrir Lista/Evolución. |
| P0 | Sincronización con escrituras durante `reload` | La carga puede alinear reglas, escribirlas y volver a consultar calendario+ledger. Luego puede sincronizar Board→ledger y consultar el calendario una tercera vez. | Un primer render depende de mutaciones y de hasta dos recargas extra. | Separar **lectura** de **reconciliación**. Pintar el calendario con datos actuales; ejecutar reconciliación en segundo plano, con un único refresco sólo si hubo cambios. Idealmente conciliar al guardar/mover el evento, no al abrir Finanzas. |
| P0 | FX secuencial bloqueante | Cada movimiento pendiente ejecuta `await resolveFinanceFx` y `await updateFinanceMovement` dentro de un `for`. | N movimientos pendientes = N peticiones de cotización + N escrituras en cadena antes de terminar la carga. | Resolver por lotes y con concurrencia limitada; deduplicar por `moneda origen + moneda destino + fecha`. No bloquear la primera pintura: actualizar valores FX en segundo plano. |
| P1 | Todas las tareas financieras sin límite | `fetchFinanceKindTasks(uid)` usa `select('*')` de todas las tareas `finance_income/finance_expense`, ordenadas por fecha. | Crece con todo el historial y descarga campos que el calendario no necesita. | Consultar sólo `id, series_id, day_id, kind, finance_meta, finance_movement_id, updated_at, title`; limitar al horizonte de recurrencias/series activas o crear una vista/endpoint de resúmenes de serie. |
| P1 | Sincronización Board→ledger secuencial | `syncBoardFinanceToLedger` procesa cada acción una a una; una acción de creación puede además actualizar la tarea. | Al acumular tareas sin puente se convierte en N+1 HTTP y DB writes. | Añadir endpoint batch transaccional para acciones de puente, con respuesta de IDs actualizados; ejecutar sólo tras mutaciones del Board o mediante cola. |
| P1 | `select('*')` en endpoints financieros | `/ledger` y `/movements` devuelven filas completas; `/ledger` además tiene límite alto fijo (2.000/500). | Payload y parseo innecesarios, especialmente con imágenes, notas y payloads cifrados. | Definir proyecciones por vista: calendario, KPI, lista y detalle. Paginar Lista/Evolución. Mantener payload completo sólo para editar/abrir detalle. |
| P2 | Algoritmos cliente O(movimientos × reglas) | `expandFinanceRules` recorre reglas por movimiento y días por regla; `retargetMonthlyRuleOccurrences` usa búsquedas lineales de regla por movimiento. | CPU visible con cientos de reglas/movimientos y rangos continuos. | Preindexar reglas por `id` y por identidad `flujo+título+importe`; expandir por mes/ocurrencia, no por cada día del rango. |
| P2 | Bundle de feriados en el chunk inicial | `date-holidays` añadió ~2,70 MiB al JS principal. | Más descarga, parseo y memoria antes de que llegue a Finanzas. | Cargar el motor de feriados sólo para Finanzas/recurrencia laboral o generar el calendario en API. Si se mantiene en cliente, crear un build reducido con países soportados. |
| P2 | Consultas de paneles no visibles | Cuentas, metas, créditos y categorías cargan siempre aunque el usuario está en Calendario. | Trabajo inicial que no afecta la primera vista. | Cargar sólo los datos requeridos por el hub activo; precargar el resto tras `requestIdleCallback` o al cambiar de pestaña. |

## Orden de trabajo recomendado

1. **Instrumentar antes de cambiar:** medir duración cliente de red, descifrado, reconciliación, FX y render; incluir tamaño de filas/reglas/tareas y número de mutaciones.
2. **Eliminar recargas/escrituras del camino crítico:** mover la conciliación a la mutación que originó el cambio y dejar `reload` como lectura.
3. **Crear bootstrap específico de calendario:** una respuesta compacta para rango + KPI + reglas necesarias; cargar Libro/Lista bajo demanda.
4. **Batch de FX y Board→ledger:** deduplicación y concurrencia limitada o endpoint batch.
5. **Reducir historial y columnas:** resúmenes de serie, proyecciones selectivas, paginación.
6. **Optimizar CPU y bundle:** índices de reglas y carga diferida/build reducido de feriados.

## Métricas de aceptación

| Métrica | Objetivo inicial |
|---|---|
| Primer calendario visible, caché fría 4G | p95 < 1,5 s |
| Navegación entre meses con datos ya cargados | p95 < 300 ms |
| Peticiones bloqueantes en apertura de Calendario | ≤ 2 |
| Escrituras durante carga pasiva | 0 |
| FX pendiente | no bloquea el render inicial |
| Payload de calendario mensual | < 250 KB comprimido para un uso normal |

## Alcance intencionalmente fuera de esta auditoría

- No se cambia aún la semántica de recurrencias ni de conciliación.
- No se elimina el cifrado de bóveda; se debe mantener el descifrado local para los datos que realmente se muestran.
- Los objetivos deberán ajustarse después de capturar telemetría real de Railway/Supabase y de un perfil de navegador.

## Archivos revisados

- `packages/web/src/pages/FinancesPage.tsx` — orquestación y recargas del calendario.
- `packages/core/src/services/financeMovementService.ts` — obtención, descifrado y FX.
- `packages/core/src/services/taskService.ts` — consulta global de tareas financieras.
- `packages/core/src/lib/finance/bridge.ts` — sincronización Board→ledger.
- `packages/core/src/lib/finance/expandRules.ts` — expansión y deduplicación de recurrencias.
- `packages/api/src/routes/financeMovements.ts` — endpoints de libro y calendario.
