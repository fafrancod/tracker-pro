/**
 * Métricas ligeras in-process para Railway logs (roadmap Fase 5).
 * Sin dependencias externas: ventana deslizante → p95 en cada log.
 */

const WINDOW = 100;

type SampleBucket = {
  samples: number[];
  byKind: Record<string, number>;
};

const createBucket: SampleBucket = { samples: [], byKind: {} };
const updateBucket: SampleBucket = { samples: [], byKind: {} };
const financeCalendarBucket: SampleBucket = { samples: [], byKind: {} };
const financeInitialFetchBucket: SampleBucket = { samples: [], byKind: {} };
const financeUnsealBucket: SampleBucket = { samples: [], byKind: {} };
const financeAlignmentBucket: SampleBucket = { samples: [], byKind: {} };
const financeFxBucket: SampleBucket = { samples: [], byKind: {} };
const financeBridgeBucket: SampleBucket = { samples: [], byKind: {} };
const financeReadyBucket: SampleBucket = { samples: [], byKind: {} };

function pushSample(bucket: SampleBucket, ms: number, kind: string): void {
  bucket.samples.push(ms);
  if (bucket.samples.length > WINDOW) {
    bucket.samples.splice(0, bucket.samples.length - WINDOW);
  }
  const k = kind || 'unknown';
  bucket.byKind[k] = (bucket.byKind[k] ?? 0) + 1;
}

/** Percentil p (0–100) sobre copia ordenada. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  const w = rank - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

function snapshot(bucket: SampleBucket): {
  count: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
  byKind: Record<string, number>;
} {
  const sorted = [...bucket.samples].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50_ms: Math.round(percentile(sorted, 50)),
    p95_ms: Math.round(percentile(sorted, 95)),
    p99_ms: Math.round(percentile(sorted, 99)),
    max_ms: sorted.length ? sorted[sorted.length - 1] : 0,
    byKind: { ...bucket.byKind },
  };
}

export function nowMs(): number {
  return performance.now();
}

export type TaskCreateMetric = {
  ms: number;
  rows: number;
  kind: string;
  /** Queries de order counters (chunks de loadOrderCounters). */
  orderQueries: number;
  recurrence?: string;
};

export type TaskUpdateMetric = {
  ms: number;
  kind: string;
  applyTo: string;
  updatedCount?: number;
};

/**
 * Registra create y devuelve payload listo para `logger.info`.
 * Railway puede filtrar por `metric: 'api.tasks.create'`.
 */
export function recordTaskCreate(m: TaskCreateMetric): Record<string, unknown> {
  pushSample(createBucket, m.ms, m.kind);
  const roll = snapshot(createBucket);
  return {
    metric: 'api.tasks.create',
    'api.tasks.create.ms': Math.round(m.ms),
    'api.tasks.create.rows': m.rows,
    'api.tasks.create.order_queries': m.orderQueries,
    kind: m.kind,
    recurrence: m.recurrence ?? null,
    rows: m.rows,
    orderQueries: m.orderQueries,
    p50_ms: roll.p50_ms,
    p95_ms: roll.p95_ms,
    p99_ms: roll.p99_ms,
    window_n: roll.count,
    kind_totals: roll.byKind,
  };
}

export function recordTaskUpdate(m: TaskUpdateMetric): Record<string, unknown> {
  pushSample(updateBucket, m.ms, m.kind);
  const roll = snapshot(updateBucket);
  return {
    metric: 'api.tasks.update',
    'api.tasks.update.ms': Math.round(m.ms),
    kind: m.kind,
    applyTo: m.applyTo,
    updatedCount: m.updatedCount ?? 1,
    p50_ms: roll.p50_ms,
    p95_ms: roll.p95_ms,
    p99_ms: roll.p99_ms,
    window_n: roll.count,
    kind_totals: roll.byKind,
  };
}

export type FinanceCalendarLoadMetric = {
  completed: boolean;
  totalMs: number;
  readyMs: number;
  initialFetchMs: number;
  unsealMs: number;
  alignmentMs: number;
  fxMs: number;
  bridgeMs: number;
  calendarFetches: number;
  ledgerFetches: number;
  movementCount: number;
  ruleCount: number;
  visibleTaskCount: number;
  financeTaskCount: number;
  alignmentUpdates: number;
  fxUpdates: number;
  bridgePersisted: boolean;
  rangeDays: number;
};

function stageSnapshot(bucket: SampleBucket) {
  const roll = snapshot(bucket);
  return { p50_ms: roll.p50_ms, p95_ms: roll.p95_ms };
}

/**
 * Registra la carga del calendario financiero en Railway sin títulos, montos,
 * identificadores de usuario ni movimientos. Sirve para decidir el orden real
 * de las optimizaciones P0 con p50/p95 sobre una ventana de 100 cargas.
 */
export function recordFinanceCalendarLoad(
  m: FinanceCalendarLoadMetric
): Record<string, unknown> {
  const outcome = m.completed ? 'completed' : 'failed';
  pushSample(financeCalendarBucket, m.totalMs, outcome);
  pushSample(financeInitialFetchBucket, m.initialFetchMs, outcome);
  pushSample(financeUnsealBucket, m.unsealMs, outcome);
  pushSample(financeAlignmentBucket, m.alignmentMs, outcome);
  pushSample(financeFxBucket, m.fxMs, outcome);
  pushSample(financeBridgeBucket, m.bridgeMs, outcome);
  pushSample(financeReadyBucket, m.readyMs, outcome);
  const total = snapshot(financeCalendarBucket);
  return {
    metric: 'api.finances.calendar_load',
    completed: m.completed,
    total_ms: Math.round(m.totalMs),
    ready_ms: Math.round(m.readyMs),
    initial_fetch_ms: Math.round(m.initialFetchMs),
    unseal_ms: Math.round(m.unsealMs),
    alignment_ms: Math.round(m.alignmentMs),
    fx_ms: Math.round(m.fxMs),
    bridge_ms: Math.round(m.bridgeMs),
    calendar_fetches: m.calendarFetches,
    ledger_fetches: m.ledgerFetches,
    movements: m.movementCount,
    rules: m.ruleCount,
    visible_finance_tasks: m.visibleTaskCount,
    all_finance_tasks: m.financeTaskCount,
    alignment_updates: m.alignmentUpdates,
    fx_updates: m.fxUpdates,
    bridge_persisted: m.bridgePersisted,
    range_days: m.rangeDays,
    p50_ms: total.p50_ms,
    p95_ms: total.p95_ms,
    stage_p50_ms: {
      initial_fetch: stageSnapshot(financeInitialFetchBucket).p50_ms,
      unseal: stageSnapshot(financeUnsealBucket).p50_ms,
      alignment: stageSnapshot(financeAlignmentBucket).p50_ms,
      fx: stageSnapshot(financeFxBucket).p50_ms,
      bridge: stageSnapshot(financeBridgeBucket).p50_ms,
      ready: stageSnapshot(financeReadyBucket).p50_ms,
    },
    stage_p95_ms: {
      initial_fetch: stageSnapshot(financeInitialFetchBucket).p95_ms,
      unseal: stageSnapshot(financeUnsealBucket).p95_ms,
      alignment: stageSnapshot(financeAlignmentBucket).p95_ms,
      fx: stageSnapshot(financeFxBucket).p95_ms,
      bridge: stageSnapshot(financeBridgeBucket).p95_ms,
      ready: stageSnapshot(financeReadyBucket).p95_ms,
    },
    window_n: total.count,
  };
}

/** Solo tests. */
export function _resetRequestMetrics(): void {
  for (const bucket of [
    createBucket,
    updateBucket,
    financeCalendarBucket,
    financeInitialFetchBucket,
    financeUnsealBucket,
    financeAlignmentBucket,
    financeFxBucket,
    financeBridgeBucket,
    financeReadyBucket,
  ]) {
    bucket.samples = [];
    bucket.byKind = {};
  }
}

export function _getCreateSnapshot() {
  return snapshot(createBucket);
}

export function _getFinanceCalendarSnapshot() {
  return snapshot(financeCalendarBucket);
}
