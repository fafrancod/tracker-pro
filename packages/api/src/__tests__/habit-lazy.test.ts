import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let lastTaskInsert: Record<string, unknown>[] = [];
let lastUsageUpsert: Record<string, unknown> | null = null;
/** Filas de serie devueltas por select en habit-ensure */
let seriesRowsForEnsure: Record<string, unknown>[] = [];
let lastEnsureInsert: Record<string, unknown> | null = null;
let lastEnsureUpdate: Record<string, unknown> | null = null;

function chainEqMaybeSingle(result: { data: unknown; error: null }) {
  const terminal = {
    maybeSingle: vi.fn(async () => result),
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

function buildFromMock(mode: 'create' | 'ensure' = 'create') {
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
      if (mode === 'ensure') {
        const selectFn = vi.fn((_cols?: string, _opts?: { count?: string; head?: boolean }) => {
          const c: Record<string, unknown> = {
            eq: vi.fn(function eq() {
              return c;
            }),
            order: vi.fn(function order() {
              return c;
            }),
            limit: vi.fn(async () => ({
              data: seriesRowsForEnsure,
              error: null,
            })),
            // head count path for order on target day
            then: (resolve: (v: unknown) => void) =>
              resolve({ data: null, error: null, count: 2 }),
          };
          return c;
        });
        return {
          select: selectFn,
          insert: vi.fn(async (row: Record<string, unknown> | Record<string, unknown>[]) => {
            lastEnsureInsert = Array.isArray(row) ? row[0] : row;
            return { data: null, error: null };
          }),
          update: vi.fn((patch: Record<string, unknown>) => {
            lastEnsureUpdate = patch;
            const c: Record<string, unknown> = {
              eq: vi.fn(() => c),
              then: (resolve: (v: unknown) => void) =>
                resolve({ data: null, error: null }),
            };
            return c;
          }),
        };
      }

      // create mode
      const selectFn = vi.fn((_cols?: string, _opts?: { count?: string; head?: boolean }) => {
        const headResult = { data: [] as { day_id: string }[], error: null, count: 0 };
        const c: Record<string, unknown> = {
          eq: vi.fn(function eq() {
            return c;
          }),
          in: vi.fn(function inn() {
            return c;
          }),
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
      };
    }
    return chainEqMaybeSingle({ data: null, error: null });
  });
}

beforeEach(() => {
  lastTaskInsert = [];
  lastUsageUpsert = null;
  seriesRowsForEnsure = [];
  lastEnsureInsert = null;
  lastEnsureUpdate = null;
});

describe('POST /api/tasks — hábitos lazy (Fase 2)', () => {
  beforeEach(() => {
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
      from: buildFromMock('create'),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
  });

  it('habit_good daily crea 1 sola fila seed con series_id', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Meditar',
        kind: 'habit_good',
        recurrenceFrequency: 'daily',
        recurrenceInterval: 1,
      });

    expect(res.status).toBe(201);
    expect(lastTaskInsert).toHaveLength(1);
    expect(lastTaskInsert[0].kind).toBe('habit_good');
    expect(lastTaskInsert[0].day_id).toBe('2026-03-10');
    expect(lastTaskInsert[0].end_day_id).toBe('2026-03-10');
    expect(lastTaskInsert[0].series_id).toBeTruthy();
    expect(lastTaskInsert[0].recurrence_frequency).toBe('daily');
    expect(lastTaskInsert[0].start_time).toBeNull();
    expect(res.body.createdCount).toBe(1);
    expect(res.body.instances).toHaveLength(1);
    expect(res.body.seriesId).toBeTruthy();
    expect(lastUsageUpsert?.tasks_created).toBe(1);
  });

  it('habit_quit sin recurrence → daily + 1 seed', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Dejar de fumar',
        kind: 'habit_quit',
      });

    expect(res.status).toBe(201);
    expect(lastTaskInsert).toHaveLength(1);
    expect(lastTaskInsert[0].kind).toBe('habit_quit');
    expect(lastTaskInsert[0].recurrence_frequency).toBe('daily');
    expect(lastTaskInsert[0].series_id).toBeTruthy();
    expect(res.body.createdCount).toBe(1);
  });

  it('habit weekly también es seed único (no 26 filas)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Gym',
        kind: 'habit_good',
        recurrenceFrequency: 'weekly',
        recurrenceInterval: 1,
      });

    expect(res.status).toBe(201);
    expect(lastTaskInsert).toHaveLength(1);
    expect(lastTaskInsert[0].recurrence_frequency).toBe('weekly');
    expect(res.body.createdCount).toBe(1);
  });
});

describe('POST /api/tasks/habit-ensure', () => {
  beforeEach(() => {
    seriesRowsForEnsure = [
      {
        id: 'seed-1',
        user_id: 'test-uid',
        week_id: '2026-W11',
        day_id: '2026-03-10',
        end_day_id: '2026-03-10',
        title: 'Meditar',
        completed: false,
        completed_at: null,
        project_id: null,
        priority: 'medium',
        notes: '',
        order: 0,
        tags: [],
        moved_from: null,
        series_id: 'series-habit-1',
        recurrence_frequency: 'daily',
        recurrence_interval: 1,
        urgency: null,
        importance: null,
        kind: 'habit_good',
        color: '#3fb950',
        start_time: null,
        end_time: null,
        rx_meta: null,
        involved_contact_ids: [],
        location: null,
        departure_time: null,
        steps: [],
        created_at: '2026-03-10T10:00:00.000Z',
        updated_at: '2026-03-10T10:00:00.000Z',
      },
    ];

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: { id: 'test-uid', email: 'test@example.com', app_metadata: {} },
          },
          error: null,
        })),
      },
      from: buildFromMock('ensure'),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
  });

  it('materializa día nuevo con completed true', async () => {
    const res = await request(app)
      .post('/api/tasks/habit-ensure')
      .set('Authorization', 'Bearer valid-token')
      .send({
        seriesId: 'series-habit-1',
        dayId: '2026-03-12',
        completed: true,
      });

    expect(res.status).toBe(201);
    expect(lastEnsureInsert).toBeTruthy();
    expect(lastEnsureInsert!.day_id).toBe('2026-03-12');
    expect(lastEnsureInsert!.series_id).toBe('series-habit-1');
    expect(lastEnsureInsert!.kind).toBe('habit_good');
    expect(lastEnsureInsert!.completed).toBe(true);
    expect(lastEnsureInsert!.title).toBe('Meditar');
    expect(res.body.dayId).toBe('2026-03-12');
    expect(res.body.completed).toBe(true);
    expect(res.body.seriesId).toBe('series-habit-1');
  });

  it('si ya existe el día, actualiza completed y no inserta', async () => {
    seriesRowsForEnsure = [
      {
        id: 'seed-1',
        user_id: 'test-uid',
        week_id: '2026-W11',
        day_id: '2026-03-10',
        end_day_id: '2026-03-10',
        title: 'Meditar',
        completed: false,
        completed_at: null,
        series_id: 'series-habit-1',
        recurrence_frequency: 'daily',
        recurrence_interval: 1,
        kind: 'habit_good',
        color: '#3fb950',
        notes: '',
        order: 0,
        tags: [],
        priority: 'medium',
        project_id: null,
        urgency: null,
        importance: null,
        start_time: null,
        end_time: null,
        steps: [],
      },
      {
        id: 'inst-12',
        user_id: 'test-uid',
        week_id: '2026-W11',
        day_id: '2026-03-12',
        end_day_id: '2026-03-12',
        title: 'Meditar',
        completed: false,
        completed_at: null,
        series_id: 'series-habit-1',
        recurrence_frequency: 'daily',
        recurrence_interval: 1,
        kind: 'habit_good',
        color: '#3fb950',
        notes: '',
        order: 1,
        tags: [],
        priority: 'medium',
        project_id: null,
        urgency: null,
        importance: null,
        start_time: null,
        end_time: null,
        steps: [],
      },
    ];

    const res = await request(app)
      .post('/api/tasks/habit-ensure')
      .set('Authorization', 'Bearer valid-token')
      .send({
        seriesId: 'series-habit-1',
        dayId: '2026-03-12',
        completed: true,
      });

    expect(res.status).toBe(200);
    expect(lastEnsureInsert).toBeNull();
    expect(lastEnsureUpdate).toBeTruthy();
    expect(lastEnsureUpdate!.completed).toBe(true);
    expect(res.body.id).toBe('inst-12');
    expect(res.body.completed).toBe(true);
  });

  it('404 si la serie no existe', async () => {
    seriesRowsForEnsure = [];
    const res = await request(app)
      .post('/api/tasks/habit-ensure')
      .set('Authorization', 'Bearer valid-token')
      .send({ seriesId: 'missing', dayId: '2026-03-12' });
    expect(res.status).toBe(404);
  });
});
