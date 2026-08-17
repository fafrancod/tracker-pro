# Roadmap financiero — Daily Tracker

**Fecha:** 2026-08-17 (rev. inversiones + cifrado)  
**Producto:** Daily Tracker (Supabase + Express + React). Referencia de dominio: **Meteora / finanzas-pro** (`D:\DesarrollosFF\finanzas-pro`).  
**Versión al escribir:** v2.21.2.

**Respuesta corta:** no se *fusionan* las dos apps. Daily Tracker ya tiene calendario de vida; Meteora ya tiene el motor de dinero. El destino es **dos calendarios que comparten el día** (actividad ↔ dinero) y un **libro de movimientos** de verdad (cuentas, divisas, objetivos, créditos, tarjetas, cuotas, **inversiones**, salud financiera), con **bóveda client-side** para montos y textos. Se recicla la *lógica de dominio* de Meteora, no Firebase ni el paywall familiar.

---

## Quick path (leer en 2 minutos)

1. Hoy hay **dos mitades rotas**: lista `/finances` (`finance_entries`) y chips `finance_income` / `finance_expense` en el tablero (`tasks.finance_meta`). **No se sincronizan.**
2. La tesis de producto: **Calendario de vida** (tareas, eventos, hábitos) y **Calendario de dinero** (movimientos). Un evento/hábito/tarea **puede conllevar un gasto o ingreso**. Completar en uno confirma o actualiza el otro.
3. De Meteora se trae el *modelo mental* (cuentas, TC, cuotas, objetivos, inversiones, motor de salud, bóveda). Se **reescribe** sobre Supabase + `packages/core` (sin DOM) + API Zod. No se copia Firestore.
4. Orden: **libro → bóveda (antes de que crezca el PII) → puente vida↔dinero → cuentas/TC → divisas → objetivos → créditos/cuotas → inversiones → recomendaciones.**
5. Cada fase es un **MINOR**. Un **MAJOR** solo si el shell deja de ser “el tablero es el centro” y pasa a ser “dos calendarios al mismo nivel”.

---

## 1. Tesis de producto

Daily Tracker planifica **qué haces**. Meteora planifica **qué pasa con tu dinero**. La vida real no separa ambas cosas: la cena con alguien del Círculo, el gym, el viaje, la receta de la mascota, son *hechos* que casi siempre mueven caja.

```text
        día civil (timezone de Preferencias)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 Calendario de vida      Calendario de dinero
 tareas · eventos        ingresos · gastos
 hábitos · recetario     cuotas · cobros
                         compras / ventas
                         de inversiones
        │                       │
        └───────────┬───────────┘
                    ▼
           vínculo explícito
     (un hecho ↔ 0..n movimientos)
                    │
                    ▼
         bóveda en el dispositivo
     (montos y textos cifrados en reposo)
```

Regla de oro: **el tablero no es el libro mayor**. Un movimiento de dinero vive en el ledger. El calendario de vida *apunta* a él cuando el hecho tiene coste o cobro. Así un hábito “Gym 35.000 CLP” no ensucia `tasks` con contabilidad, y un pago de tarjeta no se disfraza de tarea.

---

## 2. Inventario honesto

### 2.1 Lo que Daily Tracker ya tiene

| Pieza | Dónde | Qué hace | Hueco |
|-------|--------|----------|--------|
| Lista de finanzas | `/finances`, `finance_entries` | Ingreso/gasto · recurrente / esperado / puntual · multi-moneda como *campo* · resumen del mes | No es calendario. Sin cuentas. Sin estado pagado/pendiente. Sin vínculo a tareas |
| Chip en el tablero | `kind` `finance_income` \| `finance_expense` + `finance_meta` `{amount, currency, certainty}` | Pinta un movimiento *como si fuera tarea* | No escribe en `finance_entries`. Sin cuenta. Completar no “paga” nada |
| Divisas | `packages/core/src/lib/currencies.ts` | Catálogo LATAM + EU + USD | Sin tipo de cambio, sin moneda de reporte, sin `originalAmount` |
| Recurrencia de vida | hábitos lazy, series, `end_day_id` | Calendario fuerte | Las `finance_entries` recurrentes **no** se materializan en días |
| Notificaciones | worker + email + local | “X min antes”, “mañana vas a…”, “¿ya lo hiciste?” | No hay “vence la tarjeta”, “cuota 3/12” |
| Objetivos de vida | Memento / metas | Vida, no dinero | No hay “faltan 1,2 M para el auto” |

Hoy un usuario puede cargar el arriendo en `/finances` **y** un gasto “Arriendo” en el tablero: **dos verdades**. Eso es lo primero que hay que matar.

### 2.2 Lo que Meteora ya resolvió (y queremos reciclar)

Código de referencia: `finanzas-pro/src/`.

| Dominio | Piezas | Reciclar | No traer tal cual |
|---------|--------|----------|-------------------|
| Cuentas / medios de pago | `Account`: cash, credit, debit, crypto; `creditLimit`, `billingDate`, `billedTotal`; `PaymentMethodsBreakdown` | Modelo + UX de cupo / facturación / pago de tarjeta | Firestore, scope familiar |
| Movimiento rico | `Transaction`: cuenta, splits, cuotas, divisa original + tipo de cambio, `isPaid`, `cardPayment` | Campos y reglas | Scope familiar |
| Multi-divisa | `exchangeRates.ts`, `originalAmount` / `exchangeRate` / `rateStatus` | Motor de conversión + flag de tipo stale | Cache keys y API acopladas a Firebase |
| Objetivos | `useGoals`, `Goals.tsx`, `goalAnalyzer.ts` | Meta, avance, “cuánto falta”, viabilidad | Analizador de vacaciones / auto como *primer* corte (fase posterior) |
| Salud + recomendaciones | `financialEngine/` (`rules`, `patterns`, `recommendations`, `projections`) | Snapshot, score 0–100, recs por déficit / DTI / hormiga / objetivo | Textos con emojis de Meteora; reescribir a castellano de Daily Tracker |
| Créditos | `Credits.tsx` + categorías `isCredit` | Amortizado vs resta, simulación de prepago | Crédito *como flag de categoría* — aquí será entidad propia |
| Cuotas | `installmentPlan.ts`, `installment` `{current,total,groupId}` | Agrupar 3/12, progreso, no contar 12 veces el ticket | Heurísticas sucias de descripción; preferir `group_id` explícito |
| Inversiones | `Transaction.investment`, `useInvestmentPortfolio`, `investmentsApi` (search/quote/chart), `Investments.tsx` | Lots abiertos/vendidos, coste invertido manual, cotización, P/L por divisa | Yahoo como *único* proveedor; crypto-exchange en v1 |
| Bóveda | `clientSideEncryption.ts`, vault IndexedDB, `fase3-cifrado.md`, migración histórica | AES-GCM + DEK no exportable + salt en servidor | Google KMS / `ENCRYPTION_LOCAL_MASTER_KEY` en el API (eso **no** es privacidad) |
| Presupuestos | `Budgets.tsx`, `MonthlyBudget` | Opcional, fase tardía | No bloquear el puente actividad↔dinero |
| Scanner de tickets, extractos, familia, paywall | varias páginas | Fuera de este roadmap | — |

### 2.3 Lo que *no* se copia de Meteora

- **Firebase / Firestore.** Daily Tracker es Supabase. Punto.
- **Envelope KMS en el servidor** (`server/kmsEnvelope.ts`). Si el API puede desempaquetar la DEK, un dump de Railway = todos los montos. Eso es cifrado *de disco*, no de datos personales.
- **Scope familiar / groupId.** Un usuario = un libro.
- **Atenea admin / Lemon-MP / paywall.** Producto distinto.
- **Importación de cartola con IA.** Tentador; no es el puente de calendarios.

---

## 3. Decisiones de arquitectura (antes de picar)

Estas hay que *confirmar* en la primera fase. El resto del roadmap asume este corte.

| Tema | Decisión | Por qué |
|------|----------|---------|
| Fuente de verdad del dinero | Tabla(s) de **movimientos**, no `tasks` | Completar un hábito no puede ser un INSERT contable implícito y opaco |
| Fuente de verdad de la vida | `tasks` como ahora | No convertir el ledger en tablero |
| Vínculo | `tasks.finance_movement_id` (nullable) **y** `finance_movements.source_task_id` (nullable) | Se navega en ambos sentidos; uno puede existir sin el otro |
| Recurrente de dinero | Plantilla (`finance_entries` evoluciona a *regla*) + instancias en el calendario de dinero (lazy, como hábitos) | Mismo truco que ya funciona en hábitos: no materializar 90 filas al crear |
| Cuentas | Tabla `finance_accounts`; todo movimiento *puede* tener `account_id` | Sin cuenta no hay TC ni “de qué bolsillo salió” |
| Moneda de reporte | `settings.reportingCurrency` (default: locale / `preferredCurrency` si existe) | Ver el mes en una sola cifra sin prohibir CLP+EUR+USD |
| Completar en vida | Si hay vínculo y el movimiento está `planned` → pasa a `confirmed` (o pide el monto real) | Los dos calendarios *conversan* |
| Completar / pagar en dinero | No marca automáticamente la tarea (el gym no se “hizo” porque pagaste) | Evita magia; el hecho vital y el pago no son el mismo acto |
| Motor de salud | Portar `financialEngine` a `packages/core` (DOM-free), **correr en el cliente** tras descifrar | El API no ve montos; no puede puntuar en el servidor |
| Créditos | Entidad `finance_credits`, no un flag en categoría | En Daily Tracker las categorías de proyecto no son el lugar |
| Cifrado | **Bóveda en el dispositivo** (DEK + frase). Servidor guarda salt + DEK envuelta + ciphertext | “Cifrar en el API con service role” es teatro: Railway seguiría leyendo todo |
| Inversiones | `flow = investment` en el mismo ledger (compra/venta), no una tabla paralela opaca | El calendario de dinero debe mostrar el día que compraste / vendiste |
| Cotizaciones | API de quotes **sin PII**: el cliente manda tickers *después* de descifrar | El ticker no vive en claro en Supabase; el proveedor no recibe uid |

### 3.1 Modelo mental de un movimiento

```text
finance_movements
  id, user_id
  day_id                  -- ancla civil (mismo reloj que el tablero)  [claro]
  flow                    -- income | expense | investment            [claro]
  status                  -- planned | confirmed | skipped            [claro]
  currency                -- código ISO (agrupa el mes)               [claro]
  account_id, credit_id, source_task_id                               [claro]
  installment_group_id, installment_index, installment_total          [claro]
  payload_enc             -- AES-GCM: title, notes, amounts, fx, ticker, qty…
  enc_kid, enc_v          -- versión de llave / formato
```

En **claro** solo lo imprescindible para listar el día, filtrar y no romper índices.  
En **payload_enc**: título, notas, montos, tipos de cambio, institución, límite de cupo, principal de crédito, ticker, cantidad, coste invertido, nombre del objetivo.

`planned` = “va a pasar” (se ve en el calendario, no suma como gastado).  
`confirmed` = “pasó” (entra en salud, objetivos, cupo, P/L).  
`skipped` = “no ocurrió”.

### 3.1.1 Bóveda (cifrado de datos personales financieros)

Esto no es “HTTPS + RLS”. RLS evita que *otro usuario* lea tus filas. Un backup de Supabase, un service role filtrado o un admin curioso **siguen viendo montos** si están en texto.

Contrato (reciclado de Meteora `client-side-encryption.md` + `fase3-cifrado.md`, sin KMS):

```text
1. El cliente genera una DEK (AES-256-GCM), extractable: false.
2. La envuelve con una frase del usuario (PBKDF2 / Argon2id + salt).
3. Supabase guarda: salt, params KDF, wrapped_dek. Nunca la frase. Nunca la DEK en claro.
4. Cada escritura cifra el payload (AAD = user_id + table + id).
5. Cada lectura: API devuelve blobs; core descifra en el dispositivo.
6. Sin bóveda desbloqueada no hay cache offline en claro (lección de Meteora).
```

| Qué | Dónde |
|-----|--------|
| Desbloqueo | Al entrar a `/finances` o al primer “conlleva dinero”. Frase o desbloqueo biométrico del handle ya guardado |
| Recuperación | Frase de recuperación de 12 palabras que el usuario anota **una vez**. Sin eso, datos irrecuperables. Hay que decírselo en grande |
| Worker / email | Avisos **sin montos** (“mañana vence la Visa”). El detalle en local notification si el vault está desbloqueado |
| Panel admin | Sigue viendo MB y recuento de filas. **No** ve 28.000 CLP |
| Salud / resúmenes | Se calculan en `packages/core` **después** de descifrar. El API no expone `/api/finances/health` con números |

**Anti-patrón:** `ENCRYPTION_LOCAL_MASTER_KEY` en Railway (Meteora `kmsEnvelope.ts`). Eso cifra el disco del server; el proceso de la API sigue en claro. No cumple “datos personales financieros”.

### 3.1.2 Inversiones (mismo libro)

No es una app de broker. Es: **registras lots**, el calendario enseña el día del movimiento, y una ficha valora la posición.

```text
flow = investment
payload (cifrado):
  side            -- buy | sell
  ticker          -- "AAPL", "CASH.CL"… nullable si es un fondo sin símbolo
  asset_name
  quantity
  invested_amount, invested_currency   -- coste que el usuario declara (Meteora: no inventar precio×qty)
  purchase_price                       -- opcional, informativo
  status          -- open | sold
  sale_amount, sale_date, sale_fx      -- si cerró
```

- Compra: sale dinero de una cuenta (débito / brokerage). El calendario de dinero muestra el outflow ese `day_id`.
- Venta: entra a una cuenta. El lot pasa a `sold`.
- Posiciones: portar `useInvestmentPortfolio` a core (agrupa lots abiertos, pide quotes, P/L por divisa).
- Sin ticker válido: “no cotiza” (Meteora `untracked`) — se lista, no se valora en vivo.
- Quotes/chart: `GET /api/investments/quote|search|chart` en el API de Daily Tracker (adaptador; Yahoo es el primero, sustituible). El request **no** lleva movimientos ni uid al proveedor.

Cuenta tipo `brokerage` (Fase 4 de cuentas). Crypto-exchange queda para pulido; un ETF o acción no necesita `type=crypto`.

### 3.2 Cómo conversan los dos calendarios

| Acción del usuario | Efecto en vida | Efecto en dinero |
|--------------------|----------------|------------------|
| Crea evento “Cena con Ana” y marca **conlleva gasto** 28.000 CLP · débito | Tarea `event` en ese `day_id` | Movimiento `planned` ese día, `source_task_id` = evento |
| Completa el evento | `completed = true` | Si el movimiento sigue `planned` → `confirmed` (o sheet: “¿fue ese monto?”) |
| Cambia el día del evento | `day_id` / `end_day_id` | El movimiento *planned* se mueve con él. El `confirmed` no se mueve solo (ya pasó) |
| Borra el evento | Soft o hard según serie | `planned` se borra. `confirmed` se *desvincula*, no se borra (el dinero sí salió) |
| Crea solo un gasto en el calendario de dinero | Nada | Movimiento huérfano de tarea. Válido (el café no necesita tarea) |
| Hábito “Gym” con coste mensual | Serie de hábito | Regla recurrente de dinero *o* un movimiento por aparición; ver Fase 4 |
| Paga cuota 4/12 de la tarjeta | Opcional: recordatorio | Movimiento `confirmed` en la TC; baja el cupo usado |
| Compra 2 ETF el martes | Nada, o tarea “Rebalancear” vinculada | Movimiento `investment` / buy, cuenta brokerage |
| Completa “Revisar cartera” | `completed` | No compra solo. La inversión se confirma en el calendario de dinero |

---

## 4. UX: dos calendarios, un reloj

No son dos productos. Son **dos lentes** sobre el mismo `day_id` y el mismo `settings.timezone`.

### 4.1 Calendario de vida (ya existe)

`/board` — day / week / month / continuous · lista / horario.  
Filtro de categoría `finances` **deja de ser un kind de tarea** a medio plazo (los chips `finance_*` se migran a movimientos). Mientras tanto, conviven con un banner de deprecación.

### 4.2 Calendario de dinero (nuevo)

Misma gramática visual que el board (mismas horas de settings, mismo “hoy”, mismo snap al día):

- **Día / semana / mes** (continuous es opcional; el dinero se lee mejor en mes).
- Celdas = movimientos del día, no tareas.
- Franja “Sin cuenta” análoga a “Sin hora”.
- Color por flujo (ingreso / gasto) y estado (planned atenuado, confirmed sólido).
- Click → ficha del movimiento (cuenta, cuota, vínculo a la tarea).
- Desde una celda: “Crear movimiento” o “Vincular a un hecho de ese día”.

**Dónde vive en el nav**

| Opción | Qué implica | Recomendación |
|--------|-------------|---------------|
| A. `/finances` pasa de lista a **hub** (calendario + cuentas + salud) | Menos items de menú | **Elegir esta** en v1 del calendario |
| B. `/board?lens=money` | Un solo route, más riesgo de ensuciar el board | No. El board ya está cargado |
| C. Nav nuevo “Dinero” + `/finances` queda como lista | Duplica | No |

Subsecciones del hub `/finances` (tabs, no 8 rutas al inicio):

1. **Calendario**
2. **Cuentas y tarjetas**
3. **Inversiones**
4. **Objetivos**
5. **Créditos**
6. **Salud** (score + recomendaciones)
7. **Bóveda** (estado, bloquear, recuperar — vive también en Config)

### 4.3 Superficie de vínculo en el calendario de vida

En **Nueva entrada** (tarea, recordatorio, evento, posible, hábito — no recetario en v1):

- Interruptor **“Conlleva dinero”**.
- Flujo, monto, moneda, cuenta, certeza (fijo / potencial).
- No se elige `kind = finance_*`. El kind sigue siendo evento/hábito/tarea.

En la **tarjeta** del tablero: pastilla discreta `− 28.000` / `+ 500` que abre el movimiento, no otro formulario paralelo.

---

## 5. Fases

Cada fase tiene: resultado visible, tablas/API, criterio de hecho, SemVer. No se empieza la siguiente si la anterior no cierra el puente que declara.

```text
Fase 0  Contrato y migración de las dos mitades actuales
   ↓
Fase 1  Libro de movimientos + calendario de dinero
   ↓
Fase 2  Bóveda: cifrado de datos personales financieros
   ↓
Fase 3  Puente vida ↔ dinero
   ↓
Fase 4  Cuentas y tarjetas de crédito
   ↓
Fase 5  Divisas de verdad (tipo de cambio + moneda de reporte)
   ↓
Fase 6  Objetivos: meta, avance, “cuánto falta”
   ↓
Fase 7  Créditos pendientes + pago en cuotas
   ↓
Fase 8  Inversiones (posiciones, cotización, P/L)
   ↓
Fase 9  Salud financiera y recomendaciones
   ↓
Fase 10 Pulido: avisos, presupuestos, recetario con coste
```

La bóveda va **antes** del puente y del resto de PII (cuentas, créditos, objetivos, cartera). Cifrar al final obliga a una migración histórica dolorosa (Meteora ya la pagó). El calendario de Fase 1 puede nacer en claro *unas semanas*; Fase 2 lo envuelve antes de abrir el grifo.

### Fase 0 — Contrato (sin UI nueva)

**Objetivo:** dejar por escrito el modelo y un plan de datos para no tener tres verdades.

- [ ] RFC corto en este mismo archivo queda como fuente (esta sección).
- [ ] Inventario en prod: cuántas `finance_entries` y cuántos `tasks` `finance_*` hay.
- [ ] Script / SQL de **lectura** (no destructivo) que liste huérfanos.
- [ ] Decidir el nombre final de tablas (propuesta abajo).
- [ ] Dual-port: tipos en `packages/core` primero; API Zod espejo.

**Propuesta de DDL (nuevas; las viejas no se dropean en esta fase):**

```text
finance_accounts
finance_movements          -- ledger (instancias); payload listo para cifrar
finance_rules              -- evolución de finance_entries (plantillas)
finance_goals
finance_credits
finance_vault              -- salt KDF, wrapped_dek, enc_v, unlocked_at (cliente)
```

`finance_entries` se marca *legacy* y se migra a `finance_rules` + primera tanda de `finance_movements` en Fase 1.

Checklist extra de contrato:

- [ ] Lista blanca de campos **en claro** vs **cifrados** (anexo §3.1.1). No improvisar por columna.
- [ ] Copy de recuperación: “si olvidas la frase y no guardaste las 12 palabras, no hay soporte que te devuelva los montos”.
- [ ] Inversiones: `flow=investment` entra en el mismo movimiento, no en una tabla sombra.

**Hecho cuando:** el equipo (tú) firma las decisiones de la §3. No hay UI.

**SemVer:** no aplica (doc + SQL de inspección).

---

### Fase 1 — Libro + calendario de dinero

**Objetivo:** `/finances` deja de ser solo una lista mensual. Hay un calendario de movimientos con `planned` / `confirmed`.

**Reciclar de Meteora:** layout de transacción compacta, distinción pagado vs no (`isPaid` → `status`).

**Construir:**

| Capa | Trabajo |
|------|---------|
| SQL | `finance_movements` con `payload` jsonb (claro, temporal) **y** columnas `payload_enc` / `enc_v` vacías. Índices `(user_id, day_id)`, `(user_id, status, flow)` |
| API | CRUD movimientos; listado por rango de días (mismo patrón que `fetchTasksInRange`). El API **no** calcula totales de monto: devuelve filas |
| Core | Tipos, `useFinanceMovements`, presencia por día (sin virtual todavía). Resumen de mes en el cliente |
| Web | Tab **Calendario** en `/finances`: semana + mes. Lista actual queda como “reglas / recurrentes” |
| Migración | Cada `finance_entry` specific/expected → 1 movimiento. Recurrentes → regla + instancias del mes visible (lazy) |
| Tablero | Los `kind` `finance_*` existentes se pueden *seguir viendo*; alta nueva se desaconseja en copy |

**No entra:** bóveda activa (eso es Fase 2), cuentas, vínculo a tareas, FX, objetivos, inversiones.

**Hecho cuando:**

- [ ] Creas un gasto puntual en el calendario de dinero y aparece en el día correcto según timezone.
- [ ] Un recurrente “arriendo día 5” aparece el día 5 de este mes sin materializar 24 meses.
- [ ] El resumen del mes usa **solo** movimientos `confirmed` (los `planned` van a un KPI aparte “previsto”).
- [ ] Tests API: create/list range/update status. `npm run test --workspace=packages/api`.

**SemVer:** MINOR.

---

### Fase 2 — Bóveda (cifrado de datos personales financieros)

**Objetivo:** un dump de Supabase o del service role **no** revela montos, títulos, notas, tickers ni nombres de cuentas. El usuario desbloquea en el dispositivo.

**Reciclar de Meteora:** `clientSideEncryption.ts` (AES-GCM, AAD), vault IndexedDB con `CryptoKey` no exportable, “sin llave no hay cache offline”, migración histórica de filas en claro, Settings → Bóveda. **No** reciclar `kmsEnvelope.ts`.

**Construir:**

| Capa | Trabajo |
|------|---------|
| SQL | `finance_vault (user_id, kdf_salt, kdf_params, wrapped_dek, recovery_wrapped_dek, enc_v, created_at)` |
| Core | `packages/core/src/lib/financeVault.ts`: derivar, envolver, cifrar/descifrar payload. Sin `window` (WebCrypto vía `globalThis.crypto`) |
| Web | Desbloqueo (frase), creación de bóveda, 12 palabras de recuperación, bloquear, timeout de inactividad. Gate en `/finances` |
| API | CRUD **ciego**: persiste `payload_enc`. Rechaza escritura en claro cuando `finance_vault` existe. No hay endpoint que descifre |
| Migración | Job **en el cliente** (como Meteora `historicalMigration`): lee `payload` claro, cifra, borra el claro. Banner hasta 100 % |
| Offline | Cola y snapshot de finanzas solo cifrados. Logout purga el handle |
| Android | Mismo IndexedDB del WebView en v1; Keystore nativo es pulido (Fase 10) |

**Hecho cuando:**

- [ ] Creas un gasto, en SQL Editor ves `payload_enc` y **no** ves `28000`.
- [ ] Frase incorrecta → filas ilegibles, no crash silencioso (error tipado).
- [ ] Sin desbloquear, `/finances` no pinta montos ni escribe cache.
- [ ] `finance_entries` legacy migradas o archivadas. Tests de cifrar → persistir → leer → descifrar en core (si no hay runner de core, un spec en API con WebCrypto de Node).
- [ ] Admin / Atenas sigue viendo MB, no el arriendo.

**SemVer:** MINOR. Aviso claro al usuario la primera vez (no es un toggle escondido).

---

### Fase 3 — Puente vida ↔ dinero

**Objetivo:** la tesis del usuario. Un hecho de vida puede conllevar un movimiento; los calendarios se hablan.

**Construir:**

| Capa | Trabajo |
|------|---------|
| SQL | `tasks.finance_movement_id`, `finance_movements.source_task_id` (+ índice) |
| API | Create/update de tarea acepta `finance: { amount, currency, certainty, accountId? }` y **crea o actualiza** el movimiento. Borrar tarea planned-only borra el movimiento |
| Core | `buildFinanceMeta` deja de ser el final: el meta en la tarea es *caché de UI*; el ledger manda |
| Web | Interruptor en Nueva entrada / ficha. Pastilla en `TaskCard`. Desde el movimiento: link “Ver en calendario” |
| Completar | Completar tarea con movimiento `planned` → `confirmed` (con override de monto) |
| Series | Evento/hábito en serie: el plan de dinero es una **regla** (Fase 1) o un movimiento por instancia. Decisión: **por instancia** si el coste es diario (café); **regla mensual** si es cuota. El formulario pregunta |

**Casos borde (obligatorios en tests):**

| Caso | Resultado |
|------|-----------|
| Completar sin tocar el monto | `confirmed` con el planned |
| Completar y cambiar monto | `confirmed` con monto nuevo; no reescribe el título del hecho |
| Mover el evento de día (planned) | El movimiento planned cambia de `day_id` |
| Mover el evento (confirmed) | El movimiento **no** se mueve; se desvincula o se pregunta |
| Borrar evento planned | Se borra el movimiento |
| Borrar evento confirmed | Movimiento queda, `source_task_id` null |
| Recetario | Fuera (Fase 10). El interruptor no aparece en rx |

**Hecho cuando:** creas “Cena” el jueves con 28.000, lo ves en ambos calendarios, lo marcas hecho, y en dinero pasa a confirmado. Si lo cancelas antes, desaparece del dinero.

**SemVer:** MINOR (feature visible grande, no rompe el board).

---

### Fase 4 — Cuentas y tarjetas de crédito

**Objetivo:** “de qué bolsillo salió” y una ficha de tarjeta que se entienda.

**Reciclar de Meteora:** `Account` (`cash` \| `debit` \| `credit` \| `brokerage` \| `other`; crypto-exchange se deja para pulido), `creditLimit`, `billingDate`, pantalla de medios de pago (cupo usado / disponible, fecha de facturación, registrar pago). Nombre e institución van **cifrados** (Fase 2).

**Construir:**

```text
finance_accounts
  id, user_id, name, type, institution
  currency                  -- moneda nativa de la cuenta
  credit_limit              -- solo type=credit
  billing_day               -- 1–28 (día civil de corte)
  color, archived, order
```

- Todo movimiento *puede* llevar `account_id`.
- Hub tab **Cuentas y tarjetas**:
  - lista de cuentas con saldo *aproximado* = ingresos confirmed − gastos confirmed (sin saldo inicial en v1; campo `opening_balance` en v1.1).
  - tarjeta: cupo, usado en el ciclo (gastos confirmed desde `billing_day`), disponible, % uso.
  - acción **Registrar pago de tarjeta** → movimiento de *pago* (ver nota).
- En el puente (Fase 3) el formulario pide cuenta. El tipo `brokerage` queda listo para Fase 8.

**Pago de tarjeta (importante):** no es un gasto más. En Meteora vive como `cardPayment`. Aquí:

- Opción A (simple, v1): movimiento `expense` en la cuenta *débito/efectivo* de origen, etiquetado `card_payment`, que **no** vuelve a sumar al “gastado del mes” de la TC (la TC ya gastó en cada compra).
- Opción B (doble asiento): transferencia interno cuenta↔cuenta.

**Elegir A** hasta que haya transferencias entre cuentas (fase posterior). El motor de salud ignora `card_payment` al calcular gasto del mes para no contar dos veces.

**Hecho cuando:**

- [ ] Dos cuentas (Banco Estado débito + Visa) y un gasto en cada una se separan en el calendario (filtro por cuenta).
- [ ] La ficha de la Visa muestra cupo 1.000.000, usado 240.000, disponible 760.000.
- [ ] Registrar pago 240.000 desde el débito no infla el gasto del mes.

**SemVer:** MINOR.

---

### Fase 5 — Divisas de verdad

**Objetivo:** registrar en la moneda del ticket y ver el mes en la moneda de reporte.

**Reciclar de Meteora:** `exchangeRates.ts` (fetch + cache + `stale`), campos `originalAmount` / `originalCurrency` / `exchangeRate` / `rateStatus`.

**Construir:**

- `settings.reportingCurrency`.
- Al guardar un movimiento en moneda ≠ reporte: persistir original + rate + `fx_as_of`.
- Si el rate falla: guardar igual y marcar `fx_pending` (el `rateStatus.pending` de Meteora).
- Resumen del mes y objetivos convierten a reporte.
- El calendario muestra el monto *escrito* (28.000 CLP) y, en secundario, el equivalente (27 EUR).
- Reintento de `fx_pending` **en el cliente** al desbloquear (el worker del API no ve montos). No un poll agresivo.

**No entra:** histórico de cotizaciones para gráficos fancy (Meteora `CurrencyRates` puede esperar).

**Hecho cuando:** un gasto en USD y otro en CLP suman bien en EUR (o la moneda de reporte) y, si Frankfurter/la API cae, el movimiento no se pierde.

**SemVer:** MINOR. SQL de columnas FX.

---

### Fase 6 — Objetivos financieros

**Objetivo:** un objetivo claro y **qué tanto falta**.

**Reciclar de Meteora:** `Goal` (`name`, `targetAmount`, `currentAmount`, `monthlyTargetAmount`, `deadline`, `icon`) y la parte *corta* de `goalAnalyzer` (viabilidad, meses restantes, ahorro mensual requerido). Nombre y montos **cifrados**. El pack “vacaciones / auto” espera; “invertir excedente” se engancha en Fase 8.

**Construir:**

```text
finance_goals
  id, user_id, name, icon
  target_amount, currency
  current_amount            -- manual + aportes
  monthly_target
  deadline                  -- day_id nullable
  linked_account_id         -- opcional: “esta cuenta es el sobre”
```

Tab **Objetivos**:

- Lista: barra de avance, falta X, a este ritmo llegas en Y meses (o no).
- Aportar: crea un movimiento `expense` etiquetado `goal_contribution` (sale de una cuenta, entra al objetivo). O, si `linked_account_id`, el saldo de esa cuenta *es* el avance (más simple; **preferir esto** si el usuario usa “sobre” / cuenta ahorro).
- El calendario de dinero puede filtrar “aportes a objetivos”.

**Hecho cuando:** objetivo “Fondo emergencia 3.000.000 CLP”, actual 750.000, se lee “faltan 2.250.000 · 15 meses a 150.000/mes”. Un aporte de 50.000 mueve la barra y el calendario.

**SemVer:** MINOR.

---

### Fase 7 — Créditos pendientes y cuotas

**Objetivo:** declarar deudas, ver cuánto queda, pagar en cuotas (crédito *y* compras en 3/6/12 de tarjeta).

**Reciclar de Meteora:** `Credits.tsx` (amortizado / resta / historial), simulación de prepago (plazo vs cuota), `installmentPlan.ts` (grupo, `current/total`, no contar 12 tickets como 12 compras).

**Dos conceptos que Meteora mezcla y aquí se separan:**

| Concepto | Qué es | Tabla / campos |
|----------|--------|----------------|
| **Crédito** | Deuda con institución, cuota fija, plazo, tasa opcional | `finance_credits` |
| **Compra en cuotas** | Un ticket partido en N movimientos sobre una TC | `installment_group_id` en movimientos |

```text
finance_credits
  id, user_id, name, institution
  principal, currency
  installment_amount
  term_months, start_day_id
  due_day                     -- día civil de cobro
  rate_annual                 -- nullable (si no la sabe, no la inventamos)
  account_id                  -- de dónde sale la cuota (débito)
```

Al crear un crédito: se genera una **regla** mensual (Fase 1) que materializa la cuota `planned` cada `due_day`. Pagar confirma. El tab Créditos muestra: pagado / resta / cuotas hechas / simular extra.

Comprar “Notebook 12 cuotas” en la Visa: un grupo de 12 movimientos planned (o lazy: seed + virtual como hábitos). El calendario de dinero muestra `4/12`. Completar/pagar avanza el índice.

**Hecho cuando:**

- [ ] Crédito auto: 36 cuotas, ves “van 10, restan 26, falta $X”.
- [ ] Simulas +50.000 extra y ves si acorta plazo o cuota (números en tests, no solo UI).
- [ ] Compra 6 cuotas en la TC aparece como un plan, no como 6 gastos independientes en el resumen de “nº de compras”.

**SemVer:** MINOR.

---

### Fase 8 — Inversiones

**Objetivo:** registrar compras y ventas, ver posiciones valuadas y el P/L. El día de la operación vive en el **calendario de dinero**.

**Reciclar de Meteora:** `Transaction.investment` (ticker, quantity, `investedAmount` declarado a mano, status open/sold), `useInvestmentPortfolio` (lots, untracked, totales por divisa), `investmentsApi` (search / quote / chart), UI de `Investments.tsx` + `InvestmentFormModal`. Coste **no** se inventa como precio×cantidad si el usuario puso un total (lección de Meteora).

**Construir:**

| Capa | Trabajo |
|------|---------|
| Core | `flow: 'investment'`, tipos de lot, `buildHoldings(lots, quotes)` en `packages/core` |
| API | `GET /api/investments/search\|quote\|chart` — proxy al proveedor. Cache corta. Rate-limit. **Sin** uid hacia Yahoo. Tests con fixture, no red en CI |
| Web | Tab **Inversiones**: invertido / valor / P/L, lista de posiciones, lots sin ticker, gráfico de un símbolo, alta compra/venta |
| Calendario | Un buy/sell es un movimiento más (icono distinto). Filtro `flow=investment` |
| Cuentas | La compra descuenta la cuenta origen (débito o `brokerage`) |
| Bóveda | Ticker, cantidad y coste van en `payload_enc`. El cliente descifra y recién ahí pide quotes |
| Objetivos | Acción “destinar excedente” puede abrir una compra planned (no automática) |

**No entra en esta fase:** trading, órdenes, crypto on-chain, importar de broker, rebalance automático.

**Hecho cuando:**

- [ ] Compras 2 lotes del mismo ticker; la ficha muestra cantidad sumada y coste declarado sumado.
- [ ] Vendes uno; el P/L de esa venta es un inflow `confirmed` y el lot queda `sold`.
- [ ] Sin red de quotes, las posiciones se listan y el valor actual queda “sin cotización”, no se inventa.
- [ ] En SQL no aparece `AAPL` ni `1500.00` en claro.
- [ ] El martes de la compra se ve en el calendario de dinero.

**SemVer:** MINOR.

---

### Fase 9 — Salud financiera y recomendaciones

**Objetivo:** un número que se entiende y 3–5 recomendaciones accionables. No un dashboard vanidoso.

**Reciclar de Meteora (portar a `packages/core/src/lib/financialEngine/`):**

| Módulo | Qué aporta | Ajuste |
|--------|------------|--------|
| `rules.ts` | Score 0–100: ahorro, DTI, gasto no esencial | Umbrales iguales al inicio (20 % ahorro, DTI 30 %) |
| `types.ts` | `FinancialSnapshot`, `Recommendation`, `Pattern` | Castellano en la UI, ids estables en el motor |
| `patterns.ts` | Hormiga, picos, categorías | Necesita categorías de dinero (ver nota) |
| `recommendations.ts` | Déficit, DTI, hormiga, objetivos | Reescribir copy; sin voseo; tú |
| `projections.ts` | 6–12 meses | Útil junto a objetivos |

**Snapshot (inputs que ya existirán tras Fases 1–8):**

- ingresos / gastos `confirmed` del mes (y media de 3 meses)
- `savingsRate`, `balance`
- `debtToIncomeRatio` = suma de cuotas de `finance_credits` / ingreso
- `unnecessaryExpenseRatio` solo si hay categoría `necessary` (si no, el bloque vale 0 y no se finge)
- `investedValue` / `unrealizedPnl` (Fase 8): el score no trata una compra de ETF como “gasto hormiga”

El motor corre **solo en el cliente**, sobre el ledger ya descifrado. No hay `/api/finances/health` con cifras.

**Nota de categorías:** Daily Tracker tiene proyectos para *tareas*, no para dinero. No reutilizar `projects` como categorías de gasto. Tabla chica `finance_categories` (ingreso/gasto, color, `is_necessary`) o un enum corto v1 (`housing`, `food`, `transport`, `health`, `leisure`, `debt`, `invest`, `other`). **Enum v1**, categorías libres en Fase 10 si hace falta.

Tab **Salud**:

- Semáforo + score.
- 3 recomendaciones ordenadas por `impactScore`.
- Cada rec puede deep-link: “abrir créditos”, “crear objetivo fondo”, “ver gastos leisure del mes”.

**Hecho cuando:** con un mes en déficit y DTI > 30 % aparecen las dos recs fuertes; con ahorro > 20 % y sin deudas, el tono es de “destina excedente al objetivo”. Tests de `evaluateFinancialHealth` y `generateRecommendations` en API o, si se añade runner, en core.

**SemVer:** MINOR.

---

### Fase 10 — Pulido (no bloquear el resto)

Orden sugerido, cada una un PATCH o MINOR chico:

1. **Avisos:** worker **sin montos** — “mañana vence la Visa”, “cuota 5/12 del auto”. Detalle en local si la bóveda está abierta.
2. **Presupuestos mensuales** (Meteora `Budgets`) por categoría de dinero.
3. **Recetario con coste:** una caja de pastillas es un gasto; el puente se abre a `rx_*`.
4. **Saldo inicial** de cuenta y transferencias A→B.
5. **Analizador rico de objetivos** (vacaciones / auto) si el simple de Fase 6 se queda corto.
6. Deprecar de verdad `kind` `finance_*` en el tablero (migración + quitar del picker).
7. **Keystore / Keychain** nativo para el handle de la DEK (hoy IndexedDB del WebView).
8. Crypto-exchange como tipo de cuenta, si hace falta.

---

## 6. Qué pasa con lo que ya está en producción

| Artefacto | Destino |
|-----------|---------|
| `finance_entries` | Migrar a `finance_rules` + movimientos. Mantener tabla hasta Fase 2 (bóveda) + 1 mes. SQL `INSERT…SELECT`, no drop |
| `tasks.finance_meta` + `kind` finance_* | Fase 3: al editar, se crea movimiento (ya cifrado) y se guarda el vínculo. Backfill opcional |
| `SUPPORTED_CURRENCIES` | Se queda; Fase 5 lo usa |
| Resumen `/finances` actual | Se convierte en KPIs del calendario de dinero |
| Filtro board `category=finances` | Tras deprecar kinds, el filtro muestra **tareas con vínculo** (hechos que conllevan dinero), no chips sueltos |

Nada de esto se hace con force-push ni a medias en un solo remote.

---

## 7. Stack y reglas de implementación (innegociable)

Daily Tracker, no Meteora:

| Regla | Detalle |
|-------|---------|
| Persistencia | Supabase PostgreSQL. `supabase/schema.sql` + `supabase/migrations/YYYYMMDD_*.sql`. El usuario pega el SQL |
| Escrituras | API Express + Zod. El cliente no hace INSERT directo al ledger |
| Dominio | `packages/core` sin DOM. Motor de salud, FX, cuotas, holdings, vault, resumen: **core en el cliente** |
| Dual-port | Recurrencia de dinero y validación de cuotas espejo en API (como hábitos / rx). El API **no** ve montos tras Fase 2 |
| Tests | TDD en API. Casos borde del puente (Fase 3) y round-trip de bóveda (Fase 2) son obligatorios |
| UI | Castellano (tú). Skins / CSS variables existentes. Mismo `day_id` y timezone que el board |
| Offline | Cola de movimientos cifrada. Sin DEK no se escribe snapshot en claro |
| SemVer | MINOR por fase visible. PATCH para pulido. MAJOR solo si el nav deja el board como “uno de dos calendarios iguales” |
| Remotes | `main` → `tracker-pro` **y** `origin` |
| Android | El hub `/finances` es web/PWA. Rebuild nativo solo si cambia el shell (`npm run build:android`) |

---

## 8. Plan de pruebas (transversal)

Cada fase cierra con esto, no con “se veía bien”:

- [ ] Rango de fechas en timezone `America/Santiago` vs `Europe/Madrid` (el día no se corre).
- [ ] Recurrente de dinero no explota el plan free (límites: contar *reglas*, no 28 instancias).
- [ ] Completar / descompletar no duplica movimientos.
- [ ] Borrar serie de hábito con coste: ¿qué pasa con las cuotas already `confirmed`? (no borrarlas).
- [ ] Multi-moneda: 0, 1 y 3 divisas en el mismo mes.
- [ ] Tarjeta: compra + pago no cuenta doble.
- [ ] Cuotas: resumen “nº de compras” = 1, no 12.
- [ ] Mobile 360 y desktop: ambos calendarios, ficha, interruptor “conlleva dinero”.
- [ ] SQL Editor: un movimiento confirmado no muestra monto ni ticker en claro.
- [ ] Frase de bóveda incorrecta no filtra datos ajenos ni deja basura en cache.
- [ ] Compra + venta del mismo ticker: holdings y calendario cuadran; quotes no reciben uid.

---

## 9. Fuera de alcance (hasta que este roadmap cierre Fase 9)

- Importar cartola / OCR de tickets (Meteora `StatementImporter`, `ReceiptScanner`).
- Broker API, órdenes, day-trading, crypto on-chain.
- Envelope KMS en Railway (el API no debe poder descifrar).
- Modo familiar / varios usuarios sobre el mismo libro.
- Presupuestos avanzados por proyecto de *tareas* (el dinero no hereda Eisenhower).
- Contabilidad de doble asiento completa (solo el truco del pago de tarjeta).

Si algo de esta lista se pide antes, se documenta como *desvío* y se acepta el coste de retrasar el puente o la bóveda.

---

## 10. SemVer y entrega por fase

| Fase | Bump | Motivo |
|------|------|--------|
| 0 | — | Contrato |
| 1 | MINOR | Calendario de dinero |
| 2 | MINOR | Bóveda (cifrado personal) |
| 3 | MINOR | Puente vida ↔ dinero |
| 4 | MINOR | Cuentas / TC |
| 5 | MINOR | FX |
| 6 | MINOR | Objetivos |
| 7 | MINOR | Créditos y cuotas |
| 8 | MINOR | Inversiones |
| 9 | MINOR | Salud + recs |
| 10.* | PATCH o MINOR chico | Pulido |
| ¿Nav “dos hogares”? | MAJOR | Solo si el board deja de ser el centro |

Cada ship: `npm run version:minor` (o patch), `chore(release): vX.Y.Z`, push a **ambos** remotes, SQL al usuario.

---

## 11. Primera conversación al implementar

Antes de la Fase 1, confirmar solo esto (el resto ya está decidido en §3):

1. **Hub en `/finances`** (opción A) vs ruta nueva — el roadmap asume A.
2. **Saldo de cuenta:** ¿arrancamos en 0 + movimientos, o pedimos saldo inicial desde el día 1?
3. **Objetivo:** ¿el avance es saldo de una cuenta-sobre, o aportes manuales?
4. **Frase de bóveda:** ¿obligatoria al primer movimiento, o se puede posponer hasta Fase 2 con un periodo en claro? El roadmap asume periodo corto en claro (Fase 1) y corte duro en Fase 2.

Si no hay respuesta, el default es: **A · saldo 0 + opening_balance opcional · cuenta-sobre si está linkeada · bóveda obligatoria desde Fase 2.**

---

## Next step

Fase 0: SQL de inspección de `finance_entries` vs `tasks.kind in ('finance_income','finance_expense')` en el proyecto Supabase, y arrancar el DDL de `finance_movements` (columnas `payload` + `payload_enc`) + tab Calendario (Fase 1). La bóveda es lo siguiente, **antes** de cuentas e inversiones.

Referencias de código:

- Daily Tracker: `packages/web/src/pages/FinancesPage.tsx`, `packages/api/src/routes/finances.ts`, `packages/core/src/lib/financeSummary.ts`, `tasks.finance_meta`.
- Meteora: `src/types.ts` (`Account`, `Transaction.investment`), `src/lib/financialEngine/`, `src/lib/installmentPlan.ts`, `src/lib/exchangeRates.ts`, `src/lib/clientSideEncryption.ts`, `src/lib/investmentsApi.ts`, `src/hooks/useInvestmentPortfolio.ts`, `src/pages/Credits.tsx`, `src/pages/Goals.tsx`, `src/pages/Investments.tsx`, `src/pages/PaymentMethodsBreakdown.tsx`, `docs/client-side-encryption.md`.
