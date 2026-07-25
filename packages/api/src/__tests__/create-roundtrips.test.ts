/**
 * Fase 5 / roadmap: create daily (y hábitos) no reintroducen N+1 de COUNTs.
 * Contamos round-trips a tablas vía getSupabaseAdmin().from(...).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { logger } from '../logger.js';
import {
  percentile,
  _resetRequestMetrics,
  _getCreateSnapshot,
  recordTaskCreate,
} from '../lib/requestMetrics.js';

const app = buildApp();

/** Contadores de round-trips por tabla (cada await terminal del chain). */
const trips: Record<string, number> = {};
/** SELECT de order counters en tasks (loadOrderCounters). */
let tasksOrderSelects = 0;
/** INSERT en tasks. */
let tasksInserts = 0;

function chainEqMaybeSingle(result: { data: unknown; error: null }) {
  const terminal = {
    maybeSingle: vi.fn(async () => {
      return result;
    }),
    single: vi.fn(async () => result),
  };
  const chain: Record<string, unknown> = {
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    ...terminal,
  };
  chain.eq = vi.fn(() => chain);
  return chain;
}

function markTrip(table: string) {
  trips[table] = (trips[table] ?? 0) + 1;
}

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn(() => {
          markTrip('profiles');
          return chainEqMaybeSingle({
            data: { plan: 'pro', id: 'test-uid' },
            error: null,
          });
        }),
      };
    }
    if (table === 'usage_counters') {
      return {
        select: vi.fn(() => {
          markTrip('usage_counters');
          return chainEqMaybeSingle({
            data: { tasks_created: 0, projects_created: 0 },
            error: null,
          });
        }),
        upsert: vi.fn(async () => {
          markTrip('usage_counters');
          return { data: null, error: null };
        }),
      };
    }
    if (table === 'usage_events') {
      return {
        select: vi.fn(() => chainEqMaybeSingle({ data: null, error: null })),
        insert: vi.fn(async () => ({ data: null, error: null })),
      };
    }
    if (table === 'tasks') {
      const selectFn = vi.fn((_cols?: string, _opts?: { count?: string; head?: boolean }) => {
        // loadOrderCounters: select('day_id').eq().in() then await
        const headResult = {
          data: [] as { day_id: string }[],
          error: null,
          count: 0,
        };
        const c: Record<string, unknown> = {
          eq: vi.fn(function eq() {
            return c;
          }),
          in: vi.fn(function inn() {
            tasksOrderSelects += 1;
            markTrip('tasks');
            return c;
          }),
          then: (resolve: (v: unknown) => void) => resolve(headResult),
        };
        return c;
      });

      return {
        select: selectFn,
        insert: vi.fn(async (rows: unknown) => {
          tasksInserts += 1;
          markTrip('tasks');
          void rows;
          return { data: null, error: null };
        }),
      };
    }
    return chainEqMaybeSingle({ data: null, error: null });
  });
}

beforeEach(() => {
  for (const k of Object.keys(trips)) delete trips[k];
  tasksOrderSelects = 0;
  tasksInserts = 0;
  _resetRequestMetrics();
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'valid-token') {
          return {
            data: {
              user: {
                id: 'test-uid',
                email: 'test@example.com',
                app_metadata: {},
              },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: new Error('invalid token') };
      }),
    },
    from: buildFromMock(),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
});

describe('POST /api/tasks — round-trips DB (Fase 5)', () => {
  it('hábito daily: ≤3 round-trips en path crítico (order≤1 + insert≤1 + plan/usage paralelos)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Meditar',
        kind: 'habit_good',
        recurrenceFrequency: 'daily',
      });

    expect(res.status).toBe(201);
    expect(res.body.createdCount).toBe(1);
    // Order: 1 query batch (no N COUNTs) — techo del roadmap “≤3 round-trips”
    expect(tasksOrderSelects).toBeLessThanOrEqual(1);
    expect(tasksInserts).toBe(1);
    // Tabla tasks en path de respuesta: order SELECT + INSERT ≤ 2 (≤3 con margen)
    expect(trips.tasks ?? 0).toBeLessThanOrEqual(3);
    expect(tasksOrderSelects + tasksInserts).toBeLessThanOrEqual(3);
    // plan + usage se leen en paralelo (1 cada uno) antes del insert
    expect(trips.profiles ?? 0).toBe(1);
    // usage_counters: 1 select pre-respuesta; el upsert de bumpUsage es post-201
    expect(trips.usage_counters ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('tarea daily materializada: order en 1 query (no 28 COUNTs)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Daily note',
        kind: 'task',
        recurrenceFrequency: 'daily',
        recurrenceInterval: 1,
      });

    expect(res.status).toBe(201);
    // Horizonte 28 → muchas filas, pero order counters = 1 SELECT
    expect(res.body.createdCount).toBeGreaterThan(1);
    expect(tasksOrderSelects).toBeLessThanOrEqual(1);
    expect(tasksInserts).toBe(1);
    expect(trips.tasks ?? 0).toBeLessThanOrEqual(3);
  });

  it('single-day none: orderQueries 1 o 0 + insert, total tasks ≤ 2', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'One shot',
        kind: 'task',
        recurrenceFrequency: 'none',
      });

    expect(res.status).toBe(201);
    expect(res.body.createdCount).toBe(1);
    expect(tasksOrderSelects).toBeLessThanOrEqual(1);
    expect(tasksInserts).toBe(1);
    expect(trips.tasks ?? 0).toBeLessThanOrEqual(2);
  });

  it('logger.info recibe métrica api.tasks.create con kind y p95', async () => {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Metric task',
        kind: 'habit_quit',
      });

    const infoMock = vi.mocked(logger.info);
    const metricCall = infoMock.mock.calls.find(
      c => c[1] === 'api.tasks.create' || (c[0] as { metric?: string })?.metric === 'api.tasks.create'
    );
    expect(metricCall).toBeTruthy();
    const payload = metricCall![0] as Record<string, unknown>;
    expect(payload.metric).toBe('api.tasks.create');
    expect(payload.kind).toBe('habit_quit');
    expect(typeof payload.p95_ms).toBe('number');
    expect(payload.rows).toBe(1);
    expect(payload.kind_totals).toMatchObject({ habit_quit: expect.any(Number) });
  });
});

describe('requestMetrics unit', () => {
  it('percentile p95 y contadores por kind', () => {
    _resetRequestMetrics();
    for (let i = 1; i <= 20; i++) {
      recordTaskCreate({ ms: i * 10, rows: 1, kind: 'task', orderQueries: 1 });
    }
    recordTaskCreate({ ms: 5, rows: 1, kind: 'habit_good', orderQueries: 1 });
    const snap = _getCreateSnapshot();
    expect(snap.count).toBe(21);
    expect(snap.p95_ms).toBeGreaterThan(0);
    expect(snap.byKind.task).toBe(20);
    expect(snap.byKind.habit_good).toBe(1);
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });
});
