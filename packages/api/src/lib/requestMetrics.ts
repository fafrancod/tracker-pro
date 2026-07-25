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

/** Solo tests. */
export function _resetRequestMetrics(): void {
  createBucket.samples = [];
  createBucket.byKind = {};
  updateBucket.samples = [];
  updateBucket.byKind = {};
}

export function _getCreateSnapshot() {
  return snapshot(createBucket);
}
