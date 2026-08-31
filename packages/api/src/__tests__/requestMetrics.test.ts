import { describe, it, expect, beforeEach } from 'vitest';
import {
  percentile,
  recordTaskCreate,
  recordTaskUpdate,
  recordFinanceCalendarLoad,
  _resetRequestMetrics,
  _getCreateSnapshot,
  _getFinanceCalendarSnapshot,
} from '../lib/requestMetrics.js';

beforeEach(() => {
  _resetRequestMetrics();
});

describe('requestMetrics', () => {
  it('percentile vacío y un elemento', () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([42], 95)).toBe(42);
  });

  it('acumula kind_totals en create', () => {
    recordTaskCreate({ ms: 12, rows: 1, kind: 'habit_good', orderQueries: 1 });
    recordTaskCreate({ ms: 20, rows: 28, kind: 'task', orderQueries: 1 });
    recordTaskCreate({ ms: 8, rows: 1, kind: 'habit_good', orderQueries: 1 });
    const snap = _getCreateSnapshot();
    expect(snap.byKind.habit_good).toBe(2);
    expect(snap.byKind.task).toBe(1);
    expect(snap.count).toBe(3);
  });

  it('registra p50/p95 de carga del calendario financiero sin datos sensibles', () => {
    const payload = recordFinanceCalendarLoad({
      completed: true,
      totalMs: 1200,
      readyMs: 1260,
      initialFetchMs: 700,
      unsealMs: 100,
      alignmentMs: 200,
      fxMs: 0,
      bridgeMs: 50,
      calendarFetches: 2,
      ledgerFetches: 2,
      movementCount: 12,
      ruleCount: 4,
      visibleTaskCount: 3,
      financeTaskCount: 8,
      alignmentUpdates: 1,
      fxUpdates: 0,
      bridgePersisted: true,
      rangeDays: 42,
    });
    expect(payload.metric).toBe('api.finances.calendar_load');
    expect(payload.p50_ms).toBe(1200);
    expect(payload.p95_ms).toBe(1200);
    expect(payload.stage_p95_ms).toMatchObject({ initial_fetch: 700 });
    expect(_getFinanceCalendarSnapshot().count).toBe(1);
  });

  it('recordTaskUpdate expone metric name', () => {
    const payload = recordTaskUpdate({
      ms: 15,
      kind: 'event',
      applyTo: 'instance',
      updatedCount: 1,
    });
    expect(payload.metric).toBe('api.tasks.update');
    expect(payload.kind).toBe('event');
    expect(payload.applyTo).toBe('instance');
  });
});
