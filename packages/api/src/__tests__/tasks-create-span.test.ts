import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

/** Captura del último insert en `tasks`. */
let lastTaskInsert: Record<string, unknown>[] = [];
/** Contadores de bumpUsage vía upsert en usage_counters. */
let lastUsageUpsert: Record<string, unknown> | null = null;

function chainEqMaybeSingle(result: { data: unknown; error: null }) {
  const terminal = {
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  const chain: Record<string, unknown> = {
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    ...terminal,
  };
  // Allow `.eq().eq().maybeSingle()` depth
  chain.eq = vi.fn(() => chain);
  return chain;
}

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn(() =>
          chainEqMaybeSingle({
            data: { plan: 'pro', id: 'test-uid' },
            error: null,
          })
        ),
        insert: vi.fn(() => chainEqMaybeSingle({ data: null, error: null })),
      };
    }
    if (table === 'usage_counters') {
      return {
        select: vi.fn(() =>
          chainEqMaybeSingle({
            data: { tasks_created: 0, projects_created: 0 },
            error: null,
          })
        ),
        upsert: vi.fn(async (row: Record<string, unknown>) => {
          lastUsageUpsert = row;
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
      const countChain: Record<string, unknown> = {};
      countChain.eq = vi.fn(() => countChain);
      countChain.then = undefined;
      // select with count returns { count }
      const selectFn = vi.fn((_cols?: string, _opts?: { count?: string; head?: boolean }) => {
        // Head count path resolves when awaited via eq chain that finally returns count
        const headResult = { data: null, error: null, count: 0 };
        const c: Record<string, unknown> = {
          eq: vi.fn(function eq() {
            return c;
          }),
          // When the await hits the final chain (after .eq().eq()), vitest/supabase
          // style is that the whole chain is thenable OR returns on maybeSingle.
          // Our route uses: const { count } = await ...eq().eq() — so the chain
          // itself must be thenable.
          then: (resolve: (v: unknown) => void) => resolve(headResult),
        };
        return c;
      });

      return {
        select: selectFn,
        insert: vi.fn(async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          lastTaskInsert = Array.isArray(rows) ? rows : [rows];
          return { data: null, error: null };
        }),
        update: vi.fn(() => {
          const c: Record<string, unknown> = {
            eq: vi.fn(() => c),
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
          };
          return c;
        }),
        delete: vi.fn(() => {
          const c: Record<string, unknown> = {
            eq: vi.fn(() => c),
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
          };
          return c;
        }),
      };
    }
    return chainEqMaybeSingle({ data: null, error: null });
  });
}

beforeEach(() => {
  lastTaskInsert = [];
  lastUsageUpsert = null;
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
  } as ReturnType<typeof getSupabaseAdmin>);
});

const baseBody = {
  weekId: '2026-W11',
  dayId: '2026-03-10',
  title: 'Span task',
};

describe('POST /api/tasks — multi-day span validation', () => {
  it('rechaza endDayId < dayId con 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...baseBody, endDayId: '2026-03-05' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('rechaza multi-day + daily con 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        ...baseBody,
        endDayId: '2026-03-15',
        recurrenceFrequency: 'daily',
        recurrenceInterval: 1,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('rechaza multi-day + weekly con 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        ...baseBody,
        endDayId: '2026-03-15',
        recurrenceFrequency: 'weekly',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });
});

describe('POST /api/tasks — multi-day create', () => {
  it('default endDayId = dayId cuando se omite', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send(baseBody);
    expect(res.status).toBe(201);
    expect(res.body.endDayId).toBe('2026-03-10');
    expect(res.body.dayId).toBe('2026-03-10');
    expect(lastTaskInsert).toHaveLength(1);
    expect(lastTaskInsert[0].end_day_id).toBe('2026-03-10');
    expect(lastTaskInsert[0].day_id).toBe('2026-03-10');
  });

  it('multi-day + none → 1 insert con end_day_id y response endDayId', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...baseBody, endDayId: '2026-03-15', recurrenceFrequency: 'none' });
    expect(res.status).toBe(201);
    expect(lastTaskInsert).toHaveLength(1);
    expect(lastTaskInsert[0].day_id).toBe('2026-03-10');
    expect(lastTaskInsert[0].end_day_id).toBe('2026-03-15');
    expect(lastTaskInsert[0].series_id).toBeNull();
    expect(res.body.endDayId).toBe('2026-03-15');
    expect(res.body.instances).toHaveLength(1);
    expect(res.body.instances[0].endDayId).toBe('2026-03-15');
  });

  it('multi-day + monthly → N inserts mismo series_id y usage += N', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        ...baseBody,
        endDayId: '2026-03-15',
        recurrenceFrequency: 'monthly',
        recurrenceInterval: 1,
      });
    expect(res.status).toBe(201);
    expect(lastTaskInsert).toHaveLength(24);
    const seriesIds = new Set(lastTaskInsert.map(r => r.series_id));
    expect(seriesIds.size).toBe(1);
    expect([...seriesIds][0]).toBeTruthy();
    expect(lastTaskInsert[0].day_id).toBe('2026-03-10');
    expect(lastTaskInsert[0].end_day_id).toBe('2026-03-15');
    expect(lastTaskInsert[1].day_id).toBe('2026-04-10');
    expect(lastTaskInsert[1].end_day_id).toBe('2026-04-15');
    expect(res.body.instances).toHaveLength(24);
    expect(res.body.instances[0].endDayId).toBe('2026-03-15');
    // usage bump by row count
    expect(lastUsageUpsert).toBeTruthy();
    expect(lastUsageUpsert!.tasks_created).toBe(24);
  });
});

describe('POST /api/tasks/:weekId/:dayId/:taskId/move — keep duration', () => {
  it('copia end_day_id desplazado manteniendo duración', async () => {
    // Seed fromTask with multi-day span 10–15 (duration offset 5)
    const fromTask = {
      id: 'task-1',
      user_id: 'test-uid',
      week_id: '2026-W11',
      day_id: '2026-03-10',
      end_day_id: '2026-03-15',
      title: 'Span',
      completed: false,
      completed_at: null,
      project_id: null,
      priority: 'medium',
      notes: '',
      order: 0,
      tags: [],
      moved_from: null,
      series_id: null,
      recurrence_frequency: 'none',
      recurrence_interval: 1,
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
    };

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: { id: 'test-uid', email: 'test@example.com', app_metadata: {} },
          },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table !== 'tasks') return chainEqMaybeSingle({ data: null, error: null });
        return {
          select: vi.fn(() => {
            const c: Record<string, unknown> = {
              eq: vi.fn(() => c),
              maybeSingle: vi.fn(async () => ({ data: fromTask, error: null })),
            };
            return c;
          }),
          insert: vi.fn(async (row: Record<string, unknown>) => {
            lastTaskInsert = [row];
            return { data: null, error: null };
          }),
          delete: vi.fn(() => {
            const c: Record<string, unknown> = {
              eq: vi.fn(() => c),
              then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
            };
            return c;
          }),
        };
      }),
    } as ReturnType<typeof getSupabaseAdmin>);

    const res = await request(app)
      .post('/api/tasks/2026-W11/2026-03-10/task-1/move')
      .set('Authorization', 'Bearer valid-token')
      .send({ toWeekId: '2026-W12', toDayId: '2026-03-17' });

    expect(res.status).toBe(200);
    expect(lastTaskInsert).toHaveLength(1);
    expect(lastTaskInsert[0].day_id).toBe('2026-03-17');
    // duration 5 days → end = 2026-03-22
    expect(lastTaskInsert[0].end_day_id).toBe('2026-03-22');
    expect(lastTaskInsert[0].week_id).toBe('2026-W12');
  });
});
