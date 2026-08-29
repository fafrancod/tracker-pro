/**
 * Tareas de backlog: sin day_id / week_id (no aparecen en el calendario).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let lastTaskInsert: Record<string, unknown>[] = [];

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
        upsert: vi.fn(async () => ({ data: null, error: null })),
      };
    }
    if (table === 'usage_events') {
      return {
        select: vi.fn(() => chainEqMaybeSingle({ data: null, error: null })),
        insert: vi.fn(async () => ({ data: null, error: null })),
      };
    }
    if (table === 'projects') {
      return {
        select: vi.fn(() =>
          chainEqMaybeSingle({
            data: {
              id: 'proj_1',
              categories: [{ id: 'cat_1', name: 'App', order: 0 }],
            },
            error: null,
          })
        ),
      };
    }
    if (table === 'tasks') {
      const selectFn = vi.fn(() => {
        const c: Record<string, unknown> = {
          eq: vi.fn(function eq() {
            return c;
          }),
          in: vi.fn(function inn() {
            return c;
          }),
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: [] as { day_id: string }[], error: null, count: 0 }),
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

describe('POST /api/tasks — sin fecha', () => {
  it('crea una tarea de proyecto sin dayId', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Backlog del proyecto',
        projectId: 'proj_1',
        projectCategoryId: 'cat_1',
        kind: 'task',
      });
    expect(res.status).toBe(201);
    expect(res.body.dayId).toBe('__undated__');
    expect(res.body.weekId).toBe('__inbox__');
    expect(lastTaskInsert).toHaveLength(1);
    expect(lastTaskInsert[0].day_id).toBeNull();
    expect(lastTaskInsert[0].week_id).toBeNull();
    expect(lastTaskInsert[0].end_day_id).toBeNull();
    expect(lastTaskInsert[0].project_id).toBe('proj_1');
    expect(lastTaskInsert[0].project_category_id).toBe('cat_1');
  });

  it('acepta dayId y weekId nulos explícitos', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Sin calendario',
        dayId: null,
        weekId: null,
        kind: 'reminder',
      });
    expect(res.status).toBe(201);
    expect(lastTaskInsert[0].day_id).toBeNull();
    expect(lastTaskInsert[0].kind).toBe('reminder');
  });

  it('rechaza recetario sin fecha', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Amoxi',
        kind: 'rx_human',
        rxPhases: [
          { amount: 1, unit: 'pills', days: 3, times: ['08:00'] },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('rechaza repetición en tarea sin fecha', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Repetir',
        recurrenceFrequency: 'weekly',
      });
    expect(res.status).toBe(400);
  });

  it('sigue exigiendo fecha para hábitos', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Correr',
        kind: 'habit_good',
      });
    expect(res.status).toBe(400);
  });
});
