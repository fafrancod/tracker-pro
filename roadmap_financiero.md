# Roadmap financiero — Daily Tracker

**Fecha:** 2026-08-17 (rev. cifrado de cuenta)  
**Producto:** Daily Tracker (Supabase + Express + React). Referencia: **Meteora** (`D:\DesarrollosFF\finanzas-pro`).  
**Versión del repo al escribir:** v2.24.0.

**Estado:** Fases 1–5 en `main` (v2.27). Siguiente: Fase 6 objetivos.

**Respuesta corta:** dos calendarios, un libro, cifrado **con la cuenta**. El tablero no es el mayor. Login = ves el dinero. Restablecer la contraseña **no** pierde importes. La bóveda privada (frase + 12 palabras) queda como legado opt-in, no como default.

### Qué cambió en esta revisión

El documento anterior era una tesis de producto sólida con huecos que harían rehacer el modelo a mitad de camino. Esta versión cierra el contrato de ingeniería:

| Antes | Ahora |
|-------|--------|
| Fase 3 mandaba `amount` al create de tareas | Tras la bóveda el cliente cifra y el API de tareas **solo** recibe `financeMovementId` |
| `finance_meta` en la tarea como caché de UI | Tras Fase 2 **es un leak**. La pastilla descifra el movimiento, no guarda el monto en `tasks` |
| Doble FK (`tasks.finance_movement_id` + `source_task_id`) sin dueño | El movimiento es dueño del vínculo. La tarea puede denormalizar el id, actualizado en el mismo flujo |
| Calendario de Fase 1 en claro en producción | Fase 1 puede vivir en dev. **Producción no acumula PII en claro** |
| 7 tabs desde el día 1 | Los tabs aparecen cuando la fase aterriza. Mobile no aguanta un hub vacío |
| Totales “el API no calcula” sin decir cómo | Ventana de días + suma en el cliente. El servidor no hace `SUM(amount)` nunca |
| Fases sin mapa de archivos ni slice de PR | Cada fase declara rutas, archivos y el primer PR autónomo |

---

## Quick path

1. Hoy hay **dos verdades**: `/finances` (`finance_entries`) y chips `finance_*` en el tablero. No se hablan.
2. Destino: **Calendario de vida** + **Calendario de dinero**, mismo `day_id` y timezone. Un hecho puede conllevar un movimiento.
3. Orden: libro (dev) → **bóveda** → puente → cuentas → FX → objetivos → créditos → inversiones → salud.
4. Cada fase visible = **MINOR**. Un PR no debe mezclar bóveda + puente + cuentas.

---

## 1. Tesis

Daily Tracker planifica **qué haces**. El dinero es **qué se mueve**. Un evento, un hábito o una tarea *pueden* costar; completar el hecho no es lo mismo que pagar.

```text
     day_id + settings.timezone
              │
   ┌──────────┴──────────┐
   ▼                     ▼
 vida (/board)        dinero (/finances)
 tarea/evento/hábito   movimiento (ledger)
   │                     │
   └──────────┬──────────┘
              ▼
     vínculo (dueño: movimiento)
              │
              ▼
     cifrado de cuenta (sobre servidor)
     login = acceso; se puede restablecer
```

**Regla de oro:** el mayor es `finance_movements`. El tablero apunta. Un pago de tarjeta no es una tarea. Un hábito “Gym” no guarda el CLP en `tasks`.

---

## 2. Inventario

### 2.1 Daily Tracker hoy

| Pieza | Dónde | Hueco |
|-------|--------|--------|
| Lista mensual | `/finances`, `finance_entries` | No es calendario. Sin cuenta, sin pagado/pendiente, sin vínculo |
| Chip en tablero | `kind` finance_* + `finance_meta` | No escribe en `finance_entries`. Completar no paga |
| Divisas | `core/lib/currencies.ts` | Código ISO, sin FX |
| Recurrencia de vida | hábitos lazy | Las `finance_entries` no se materializan por día |
| Offline | cola de **tareas** | El ledger no está en la cola |
| Notificaciones | worker + email + local | El worker no necesita montos; avisos por día/estado |
| Admin | `/admin` tamaño MB | Debe seguir sin ver montos |

### 2.2 Reciclar de Meteora (código, no stack)

| Dominio | Reciclar | Dejar |
|---------|----------|--------|
| Cuentas / TC | Tipos, cupo, corte, pago de tarjeta | Firestore, familiar |
| Movimiento | Estados, cuotas, FX, `cardPayment` | `scope` familiar |
| FX | `exchangeRates` + `rateStatus` | Keys de Firebase |
| Objetivos | meta / falta / ritmo | Analizador vacaciones/auto al inicio |
| Salud | `financialEngine` en core, **cliente** | Copy con emojis; endpoint server-side |
| Créditos | amortizado vs resta, simulación | Crédito como flag de categoría |
| Cuotas | `groupId` + current/total | Heurística por título |
| Inversiones | lots, `investedAmount` manual, portfolio, quote API | Yahoo acoplado; crypto on-chain |
| Bóveda | AES-GCM, DEK no exportable, sin cache en claro | `kmsEnvelope.ts` / master key en Railway |

### 2.3 No se copia

Firebase, KMS en el API, familia, paywall, OCR/cartola, day-trading.

---

## 3. Contrato de ingeniería

Esto es lo que un BE/FE tiene que respetar. Si una fase lo rompe, la fase está mal cortada.

### 3.1 Quién ve qué

| Actor | Ve montos / títulos / tickers |
|-------|-------------------------------|
| Navegador con sesión | Sí. El API abre el sobre y devuelve el importe |
| API Express (service role + `FINANCE_MASTER_KEY`) | Sí, para servir a **ese** uid. Dump de Postgres sigue siendo blob |
| SQL Editor / backup Supabase | Blobs (`payload_enc`) |
| Worker de notificaciones | Solo metadatos en claro (`day_id`, `status`, `flow`). Copy sin cifras |
| `/admin` | Conteos y bytes, no 28.000 CLP |
| Proveedor de quotes | Tickers que el **cliente** elige mandar. Sin uid |

### 3.2 Campos en claro vs cifrados

En claro (índice, listado por día, RLS, límites de plan = *número de filas*):

`id`, `user_id`, `day_id`, `flow`, `status`, `currency`, `account_id`, `credit_id`, `source_task_id`, `installment_*`, `client_mutation_id`, `enc_v`, `updated_at`, `deleted_at`.

En `payload_enc` (AES-GCM, AAD = `user_id|table|id|enc_v`):

título, notas, montos, FX, certainty, categoría, ticker, qty, coste, nombre de cuenta/institución, límite, principal, nombre de objetivo.

**Prohibido:** volver a escribir `finance_meta.amount` en `tasks`. La pastilla lee el movimiento (ya abierto por el API en modo cuenta).

### 3.3 Dueño del vínculo (evita FK doble huérfana)

```text
finance_movements.source_task_id   → dueño
tasks.finance_movement_id          → denormalizado para pintar la pastilla sin un JOIN extra
```

Reglas:

1. Crear: movimiento primero (o en el mismo handler), luego la tarea con el id. Si la tarea falla, se borra el movimiento `planned` huérfano.
2. Un movimiento tiene 0..1 tarea. Una tarea tiene 0..1 movimiento en v1 (0..n queda fuera).
3. Si los dos ids discrepan, gana `source_task_id`. Job de reparación en cliente al cargar el día.

El create de **tareas no lleva montos**. Lleva `financeMovementId` ya cifrado y persistido.

```text
POST /api/finance/movements   { dayId, flow, status, currency, payloadEnc, sourceTaskId? }
POST /api/tasks               { …, financeMovementId }
```

### 3.4 Cifrado de cuenta (default) — no ZK hardcore

Como Meteora en producción (`server-envelope` / `kmsEnvelope` local):

- El cliente manda título/importe por HTTPS autenticado.
- El API sella `payload_enc` con una DEK por usuario envuelta por `FINANCE_MASTER_KEY`.
- El GET **descifra** para esa sesión. El dump de Supabase no se lee.
- Restablecer la contraseña de Supabase **no** rompe el mayor.
- `POST /api/finances/vault/reset` — olvidé la frase de una bóveda **privada**: pasa a `account` y tira las filas que no se puedan abrir.
- `POST /api/finances/vault/adopt-account` — tengo la frase: re-sella y quita la frase.

La bóveda privada (frase + 12 palabras) es **legado**. No se ofrece en el alta.

Zod sigue validando forma. El API **no** suma ni puntúa salud. Listado: `GET /api/finances/movements?from=&to=` (tope 93 días). Límites de plan: `COUNT(*)`, no pesos.
- Idempotencia: `client_mutation_id` (el `eventId` de tasks ya existe — mismo patrón).

### 3.5 Recurrencia lazy + cifrado

Igual que hábitos: la **regla** guarda el payload cifrado. El cliente, con la bóveda abierta, decide si el día aplica y pinta virtuales.  
`habit-ensure` equivalente: `POST /api/finance/movements/ensure` materializa la fila **con el `payloadEnc` que manda el cliente**, no “copiando el monto desde el server”.

### 3.6 Consistencia y cola

| Problema | Decisión |
|----------|----------|
| Dos requests (movimiento + tarea) | Movimiento primero; compensar `planned` si la tarea 4xx/5xx |
| Offline | Nueva op en `offlineQueue`: `finance.create/update/delete` con **blob ya cifrado**. Sin DEK no se encola |
| Demo | `localStorage` actual de finanzas se cifra o se declara inseguro. No mezclar con prod |
| Concurrencia | `updated_at` + 409 si el PATCH llega con `updatedAt` viejo (como `version` de Meteora, más simple) |
| Decrypt de una fila | No tumba el mes. Badge “no se pudo leer” + log local |

### 3.7 Frontend: no otro board

| Hacer | No hacer |
|-------|----------|
| Reusar `useWeek`, `todayCivilDate`, `day_id`, skins, sheets | Forkear el grid del board en FinancesPage (ya es un archivo-lista) |
| Módulo `packages/web/src/finances/` (calendario, ficha, vault gate) | 7 tabs vacíos el día 1 |
| `packages/core/src/lib/finance/*` (vault, summary, holdings, engine) | Importar `window` en core |
| i18n en `i18n.ts` (tú) | Copy inline como `Investments.tsx` de Meteora |
| Pastilla del TaskCard: si vault locked, muestra “· · ·” y pide desbloqueo | Guardar el monto otra vez en la tarea |

Tabs del hub: se **encienden por fase**. Fase 1 = Calendario. Fase 2 añade Bóveda. Fase 4 añade Cuentas. etc.

### 3.8 Mapa de rutas (objetivo)

```text
GET    /api/finance/movements?from&to
POST   /api/finance/movements
PATCH  /api/finance/movements/:id
DELETE /api/finance/movements/:id
POST   /api/finance/movements/ensure

GET/POST/PATCH/DELETE /api/finance/accounts
GET/POST/PATCH/DELETE /api/finance/rules
GET/POST/PATCH/DELETE /api/finance/goals
GET/POST/PATCH/DELETE /api/finance/credits
GET/PUT  /api/finance/vault          -- metadatos (salt, wrapped_dek), no la DEK

GET /api/investments/search|quote|chart   -- público de mercado, rate-limit, sin uid al proveedor
```

`packages/api/src/routes/finances.ts` se parte; no crecer el archivo único actual.

---

## 4. Modelo

```text
finance_vault        user_id, kdf_salt, kdf_params, wrapped_dek, recovery_wrapped_dek, enc_v
finance_movements    índice en claro + payload_enc
finance_rules        plantillas (ex finance_entries)
finance_accounts     type en claro; name/institution/limits en payload_enc
finance_goals        deadline en claro; name/montos en payload_enc
finance_credits      due_day en claro; principal/cuota en payload_enc
```

Estados del movimiento: `planned` | `confirmed` | `skipped`.  
Flujos: `income` | `expense` | `investment`.  
`card_payment` y `goal_contribution` viven **dentro del payload** (tag), no como `flow` extra.

Inversión (mismo movimiento):

```text
side: buy|sell
ticker?, asset_name, quantity
invested_amount   -- lo declara el usuario; no inventar precio×qty
status: open|sold
```

Una compra = **una fila** (sale de `account_id`). No doble asiento en v1.

---

## 5. Cómo conversan los calendarios

| Acción | Vida | Dinero |
|--------|------|--------|
| Evento + “conlleva gasto” | `event` | `planned` ese `day_id`, `source_task_id` |
| Completar evento | `completed` | `planned` → `confirmed` (sheet si cambia el monto: el cliente re-cifra y PATCH) |
| Mover evento `planned` | nuevo `day_id` | PATCH `day_id` del movimiento |
| Mover evento `confirmed` | se mueve el hecho | el dinero **no** se mueve; se desvincula o se pregunta |
| Borrar evento `planned` | delete | delete movimiento |
| Borrar evento `confirmed` | delete | movimiento queda, `source_task_id` null |
| Gasto suelto en dinero | — | válido |
| Completar “Revisar cartera” | done | **no** compra solo |
| Vault locked al completar | no se confirma dinero | se pide desbloqueo; no se escribe monto en la tarea |

---

## 6. UX

`/finances` es el hub (no `/board?lens=money`). Mismo reloj que el board.

Calendario de dinero: día / semana / **mes** (prioritario). Planned atenuado, confirmed sólido. Sin cuenta = franja tipo “Sin hora”.

Nueva entrada (vida): interruptor “Conlleva dinero”. No cambia el `kind` a `finance_*`.

Pastilla en `TaskCard`: `− 28.000` si vault abierta; si no, punto mudo.

---

## 7. Fases

Cada fase: objetivo, primer PR, archivos, hecho. No se abre la siguiente si el “hecho cuando” no pasa.

```text
0 contrato
1 libro + calendario          (dev / no PII prod)
2 bóveda                      (corte duro)
3 puente vida ↔ dinero
4 cuentas / TC
5 FX
6 objetivos
7 créditos / cuotas
8 inversiones
9 salud
10 pulido
```

### Fase 0 — Contrato

- [ ] Corrida de inspección (abajo) en Supabase.
- [ ] Firma de §3 (sobre todo 3.2 y 3.3).
- [ ] Tipos en `packages/core/src/lib/finance/types.ts` (aún sin tablas).

```sql
-- inspección (solo lectura)
select count(*) filter (where kind in ('finance_income','finance_expense')) as task_chips
from public.tasks;
select count(*) as entries from public.finance_entries;
```

**Hecho:** hay números. No hay UI. SemVer: no.

### Fase 1 — Libro + calendario (sin producción en claro)

**Objetivo:** `/finances` muestra un calendario de movimientos.

**Primer PR:** DDL `finance_movements` + GET/POST rango + tab Calendario (semana/mes). Sin cuentas. Sin tabs de más.

| Capa | Dónde |
|------|--------|
| SQL | `supabase/migrations/…_finance_movements.sql` |
| API | `routes/finance/movements.ts` + tests de rango/timezone |
| Core | `lib/finance/summary.ts` (suma en cliente), `services/financeMovementService.ts` |
| Web | `src/finances/MoneyCalendar.tsx` montado en `FinancesPage` |

**Producción:** feature flag o solo cuentas internas. Si se abre a usuarios, **Fase 2 sale en el mismo release**. No dejar un mes de arriendos en `payload` claro.

**Hecho:**

- [ ] Gasto puntual cae en el `day_id` del timezone de Preferencias.
- [ ] Recurrente “día 5” se ve el 5 sin 24 inserts.
- [ ] KPI “hecho” = confirmed; “previsto” = planned. Todo sumado en cliente.
- [ ] Tests API de create + list range.

**SemVer:** MINOR (si viaja con Fase 2, un solo minor).

### Fase 2 — Bóveda

**Objetivo:** dump de Supabase ≠ dump de tu vida financiera.

**Primer PR:** `finance_vault` + `financeVault.ts` + gate + migración cliente de filas claras.

Reciclar el **sobre de cuenta** de Meteora (`kmsEnvelope` local / `ENCRYPTION_LOCAL_MASTER_KEY`), **no** el ZK duro de `clientSideEncryption`.

**Modelo (igual que Meteora en producción):**

| Esquema | Quién cifra | Cómo entras | Si olvidas |
|---------|-------------|-------------|------------|
| **`account`** (default) | API con DEK envuelta por `FINANCE_MASTER_KEY` | Tu sesión de Supabase | Restableces la **contraseña de la cuenta**. Los importes siguen |
| **`private`** (legado) | Cliente AES-GCM + frase | Frase o 12 palabras | «Restablecer cifrado» borra lo que no se pueda abrir y pasa a `account` |

**No hacer:** pedir frase a un usuario nuevo. No decir «nadie puede recuperar». Eso era demasiado hardcore para este producto.

**Hecho:**

- [x] SQL Editor: hay `payload_enc`, no `28000`.
- [x] Usuario nuevo: `/finances` abre sin frase.
- [x] POST en claro → el servidor sella; GET devuelve el importe a la sesión.
- [x] Bóveda privada antigua: unlock **o** restablecer.
- [x] Admin sigue viendo MB, no importes.

**SemVer:** MINOR. Copy: «el cifrado va con tu cuenta».

### Fase 3 — Puente

**Objetivo:** “Cena” el jueves existe en ambos lados.

**Primer PR:** interruptor en Nueva entrada + pastilla + completar confirma. Un solo movimiento por tarea.

El API de tareas **no** recibe `finance.amount`. El cliente: `POST movements` (cifrado) → `POST tasks` con `financeMovementId`.

**Tests obligatorios:** tabla de §5 + “vault locked al completar”.

**Hecho:** creas, ves, marcas, se confirma; cancelas planned, desaparece del dinero. `tasks.finance_meta.amount` no se escribe.

**SemVer:** MINOR.

### Fase 4 — Cuentas y tarjetas

Tipos en claro: `cash | debit | credit | brokerage | other`.  
Nombre, institución, cupo: cifrados (`payload_enc`).

Pago de tarjeta = movimiento en el débito con `tag=card_payment` + `card_account_id`. No entra en el KPI del mes. Usado de la TC = cargos − pagos.

**Hecho:**

- [x] Dos cuentas, tab Cuentas, filtro en el calendario.
- [x] Ficha Visa: cupo / usado / disponible.
- [x] Pago que no dobla el mes (tests de `summarizeCardUsage` + KPI).

### Fase 5 — FX

`settings.preferredCurrency` es la **moneda de reporte**. Original + `exchangeRate` en el payload cifrado. Reintento de `fxPending` al abrir Finanzas, no en el worker. `GET /api/finances/fx` (Frankfurter, sin uid al proveedor).

**Hecho:**

- [x] USD + CLP cuadran en la moneda de reporte.
- [x] Si cae la API de tipos, el movimiento se guarda (`fxPending`) y no se pierde.

### Fase 6 — Objetivos

Avance = saldo de cuenta-sobre si hay `linked_account_id`; si no, aportes tag `goal_contribution`. Nombre y meta cifrados; `target_day_id` en claro.

**Hecho:**

- [x] “faltan 2,25 M · 15 meses a 150 k”.
- [x] Un aporte mueve barra y calendario (y no dobla el KPI del mes).

### Fase 7 — Créditos y cuotas

Crédito ≠ compra en 12 cuotas (grupo en movimientos).  
`due_day` en claro para que el worker avise sin leer el principal.

**Hecho:** 36 cuotas con “van 10”; simulación extra en tests numéricos; 6 cuotas = 1 compra en el resumen.

### Fase 8 — Inversiones

Mismo ledger. Tab que aparece ahora. Quotes vía API propia, fixtures en CI. Cliente descifra ticker y pide cotización.

**Hecho:** 2 lots se agrupan; una venta cierra lot + inflow; sin red, “sin cotización”; SQL sin `AAPL` ni notional; el martes se ve en el calendario.

### Fase 9 — Salud

`packages/core/src/lib/finance/engine/*`. Corre en el cliente. Compra de ETF **no** es gasto hormiga. Enum de categoría v1 (`housing`, `food`, `transport`, `health`, `leisure`, `debt`, `invest`, `other`).

**Hecho:** déficit + DTI > 30 % → dos recs fuertes. Tests del score sin red.

### Fase 10 — Pulido

Avisos sin montos; presupuestos; recetario con coste; saldo inicial / transferencias; Keystore; deprecar `kind` finance_* ; crypto-exchange si hace falta.

---

## 8. Datos que ya existen

| Artefacto | Destino |
|-----------|---------|
| `finance_entries` | → `finance_rules` + movimientos. Drop solo cuando Fase 2+1 mes esté limpia |
| `tasks` finance_* | Fase 3: backfill a movimiento cifrado + vínculo. Quitar del picker cuando el backfill cierre |
| Cola offline de tasks | Extender; no reutilizar el payload de tarea para meter montos en claro |

---

## 9. Riesgos (los que duelen)

| Riesgo | Mitigación |
|--------|------------|
| XSS usa la sesión autenticada | CSP ya. El sobre de cuenta no sustituye higiene de DOM |
| Usuario pierde frase de bóveda **privada** | Restablecer cifrado → `account`. Se pierden solo filas que no se puedan abrir |
| Falta `FINANCE_MASTER_KEY` en Railway | Obligatorio en prod. 32 bytes base64. Sin eso no se sella el mayor |
| Fase 1 en prod sin Fase 2 | **No.** Mismo release o flag off |
| Calendario lento (descifrar 90 días) | Rango ≤ 93 días; decrypt por fila; virtuales de reglas, no 900 inserts |
| Puente a medias (tarea sin movimiento) | Orden create + compensación; never amount on task |
| Quotes como canal de fuga | Rate-limit, sin uid, tickers sueltos |
| `FinancesPage` god-file | Cortar módulo en el PR de Fase 1, no “después refactorizamos” |

---

## 10. Pruebas transversales

- [ ] `America/Santiago` vs `Europe/Madrid`: el `day_id` no se corre.
- [ ] Plan free: se cuentan reglas, no 28 instancias.
- [ ] Completar / descompletar no duplica movimientos.
- [ ] Confirmed no se borra al borrar el hecho de vida.
- [ ] 0 / 1 / 3 divisas en el mes (suma en cliente).
- [ ] TC: compra + pago no dobla.
- [ ] Cuotas: nº de compras = 1.
- [ ] Vault **privada** locked: pastilla muda, no hay monto en `tasks`.
- [ ] Cifrado de cuenta: pastilla con importe tras login, sin frase.
- [ ] SQL: ni monto ni ticker en claro (sí `payload_enc`).
- [ ] Restablecer cifrado con frase olvidada no tira 500.
- [ ] Mobile 360 + desktop: calendario dinero, ficha, interruptor.
- [ ] Quote API en tests con fixture.

TDD: `npm run test --workspace=packages/api`. Motor/vault: tests en API con WebCrypto de Node hasta que core tenga runner.

---

## 11. Fuera de alcance (hasta cerrar Fase 9)

OCR/cartola, broker API, day-trading, on-chain, KMS en Railway, libro familiar, doble asiento completo, presupuestos por *proyecto de tareas*.

---

## 12. SemVer

| Fase | Bump |
|------|------|
| 0 | — |
| 1+2 | un MINOR si salen juntas (recomendado) |
| 3–9 | MINOR cada una |
| 10 | PATCH / MINOR chico |
| Board deja de ser el centro | MAJOR |

Ship: `version:minor`, `chore(release): vX.Y.Z`, **ambos** remotes, SQL al usuario.

---

## 13. Defaults (si no hay otra orden)

Hub = `/finances`. Saldo de cuenta = 0 (+ `opening_balance` después). Objetivo = cuenta-sobre si está linkeada. **Cifrado de cuenta (sobre servidor) en el mismo release que el primer movimiento de producción. Bóveda privada = legado, no default.**

## Next step

Correr el SQL de inspección de Fase 0. Después un solo slice: DDL de movimientos + calendario (Fase 1) **con el PR de bóveda en cola inmediata** (Fase 2). No abrir cuentas ni inversiones con el mayor en claro.

Referencias:

- Daily Tracker: `FinancesPage.tsx`, `routes/finances.ts`, `lib/financeSummary.ts`, `offlineQueue.ts`, `tasks.finance_meta`.
- Meteora: `types.ts`, `financialEngine/`, `clientSideEncryption.ts`, `investmentsApi.ts`, `useInvestmentPortfolio.ts`, `installmentPlan.ts`, `Credits.tsx`, `Goals.tsx`, `Investments.tsx`, `docs/client-side-encryption.md`.
