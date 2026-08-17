import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { habitShouldAppearOnDay } from '@daily-tracker/core';
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
    limit: vi.fn(() => chain),
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
        upsert: vi.fn(async () => ({ data: null, error: null })),
      };
    }
    if (table === 'usage_events') {
      return {
        select: vi.fn(() => chainEqMaybeSingle({ data: null, error: null })),
        insert: vi.fn(async () => ({ data: null, error: null })),
      };
    }
    if (table === 'tasks') {
      const selectFn = vi.fn(() => {
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

describe('habitShouldAppearOnDay — plan', () => {
  it('weekdays lun/mié/vie no aparecen el martes', () => {
    const rec = { frequency: 'weekly' as const, interval: 1, weekdays: [1, 3, 5] };
    // 2026-03-09 = lunes, 10 = martes, 11 = miércoles
    expect(habitShouldAppearOnDay('2026-03-09', '2026-03-09', rec)).toBe(true);
    expect(habitShouldAppearOnDay('2026-03-09', '2026-03-10', rec)).toBe(false);
    expect(habitShouldAppearOnDay('2026-03-09', '2026-03-11', rec)).toBe(true);
  });

  it('weekdays vacío solo muestra el seed (días concretos)', () => {
    const rec = { frequency: 'none' as const, interval: 1, weekdays: [] };
    expect(habitShouldAppearOnDay('2026-03-10', '2026-03-10', rec)).toBe(true);
    expect(habitShouldAppearOnDay('2026-03-10', '2026-03-11', rec)).toBe(false);
  });

  it('sin weekdays, none sigue siendo diario (compat)', () => {
    const rec = { frequency: 'none' as const, interval: 1 };
    expect(habitShouldAppearOnDay('2026-03-10', '2026-03-11', rec)).toBe(true);
  });
});

describe('POST /api/tasks — plan de hábito', () => {
  it('recurrenceWeekdays guarda 1 seed weekly con esos días', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Gym',
        kind: 'habit_good',
        recurrenceWeekdays: [1, 3, 5],
      });

    expect(res.status).toBe(201);
    expect(lastTaskInsert).toHaveLength(1);
    expect(lastTaskInsert[0].recurrence_frequency).toBe('weekly');
    expect(lastTaskInsert[0].recurrence_weekdays).toEqual([1, 3, 5]);
    expect(res.body.recurrence.weekdays).toEqual([1, 3, 5]);
    expect(res.body.createdCount).toBe(1);
  });

  it('specificDayIds materializa una fila por día, misma serie, weekdays []', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Dentista prep',
        kind: 'habit_good',
        specificDayIds: ['2026-03-12', '2026-03-10', '2026-03-12'],
      });

    expect(res.status).toBe(201);
    expect(lastTaskInsert).toHaveLength(2);
    expect(lastTaskInsert.map(r => r.day_id).sort()).toEqual([
      '2026-03-10',
      '2026-03-12',
    ]);
    expect(new Set(lastTaskInsert.map(r => r.series_id)).size).toBe(1);
    expect(lastTaskInsert[0].recurrence_frequency).toBe('none');
    expect(lastTaskInsert[0].recurrence_weekdays).toEqual([]);
    expect(res.body.createdCount).toBe(2);
    expect(res.body.instances).toHaveLength(2);
  });

  it('specificDayIds en una tarea normal → 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'No es hábito',
        kind: 'task',
        specificDayIds: ['2026-03-10', '2026-03-11'],
      });
    expect(res.status).toBe(400);
    expect(lastTaskInsert).toHaveLength(0);
  });

  it('weekdays fuera de 1–7 → 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Gym',
        kind: 'habit_good',
        recurrenceWeekdays: [0, 8],
      });
    expect(res.status).toBe(400);
  });

  it('hábito sin plan extra sigue siendo 1 seed daily', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Meditar',
        kind: 'habit_good',
      });
    expect(res.status).toBe(201);
    expect(lastTaskInsert).toHaveLength(1);
    expect(lastTaskInsert[0].recurrence_frequency).toBe('daily');
    expect(lastTaskInsert[0].recurrence_weekdays).toBeUndefined();
  });
});
