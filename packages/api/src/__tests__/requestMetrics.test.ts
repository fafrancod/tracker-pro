import { describe, it, expect, beforeEach } from 'vitest';
import {
  percentile,
  recordTaskCreate,
  recordTaskUpdate,
  _resetRequestMetrics,
  _getCreateSnapshot,
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
