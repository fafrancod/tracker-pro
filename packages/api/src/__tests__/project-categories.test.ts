/**
 * Subcategorías de proyecto + enlace en tareas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  appendProjectCategory,
  renameProjectCategory,
} from '@daily-tracker/core';
import request from 'supertest';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let lastProjectInsert: Record<string, unknown> | null = null;
let lastTaskInsert: Record<string, unknown>[] | null = null;

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

beforeEach(() => {
  lastProjectInsert = null;
  lastTaskInsert = null;
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
    from: vi.fn((table: string) => {
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
      if (table === 'projects') {
        return {
          select: vi.fn(() => {
            const c: Record<string, unknown> = {
              eq: vi.fn(() => c),
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: 'proj-1',
                  categories: [
                    { id: 'cat-a', name: 'Backend', order: 0 },
                    { id: 'cat-b', name: 'Frontend', order: 1 },
                  ],
                },
                error: null,
              })),
            };
            // countProjects path may use head count — return chain that is also awaitable
            (c as { then?: unknown }).then = (
              resolve: (v: { data: unknown; error: null; count?: number }) => void
            ) => resolve({ data: null, error: null, count: 0 });
            return c;
          }),
          insert: vi.fn(async (row: Record<string, unknown>) => {
            lastProjectInsert = row;
            return { data: null, error: null };
          }),
          update: vi.fn((_payload: Record<string, unknown>) => {
            const c: Record<string, unknown> = {
              eq: vi.fn(() => c),
            };
            return c;
          }),
        };
      }
      if (table === 'tasks') {
        return {
          select: vi.fn(() => {
            const c: Record<string, unknown> = {
              eq: vi.fn(() => c),
              in: vi.fn(() => c),
              order: vi.fn(() => c),
              limit: vi.fn(() => c),
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            };
            (c as { then?: unknown }).then = (
              resolve: (v: { data: unknown[]; error: null }) => void
            ) => resolve({ data: [], error: null });
            return c;
          }),
          insert: vi.fn(async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
            lastTaskInsert = Array.isArray(rows) ? rows : [rows];
            return { data: null, error: null };
          }),
        };
      }
      return chainEqMaybeSingle({ data: null, error: null });
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
});

describe('renameProjectCategory / appendProjectCategory', () => {
  const cats = [
    { id: 'curso', name: 'Curso', order: 0 },
    { id: 'otro', name: 'Otro', order: 1 },
  ];

  it('renombra sin perder el id', () => {
    const next = renameProjectCategory(cats, 'curso', '  Curso de producción  ');
    expect(next?.find(c => c.id === 'curso')?.name).toBe('Curso de producción');
    expect(next).toHaveLength(2);
  });

  it('rechaza nombre vacío o duplicado', () => {
    expect(renameProjectCategory(cats, 'curso', '   ')).toBeNull();
    expect(renameProjectCategory(cats, 'curso', 'Otro')).toBeNull();
  });

  it('añade un subproyecto nuevo', () => {
    const added = appendProjectCategory(cats, 'Migración');
    expect(added?.categories.map(c => c.name)).toContain('Migración');
    expect(added?.id).toBeTruthy();
  });
});

describe('project categories', () => {
  it('create project con subcategorías', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'Trabajo',
        color: '#58a6ff',
        icon: '💼',
        categories: [
          { id: 'c1', name: 'Backend' },
          { id: 'c2', name: 'Frontend' },
          { id: 'c3', name: '  ' }, // vacío → se descarta
        ],
      });

    expect(res.status).toBe(201);
    expect(lastProjectInsert?.categories).toEqual([
      { id: 'c1', name: 'Backend', order: 0 },
      { id: 'c2', name: 'Frontend', order: 1 },
    ]);
    expect(res.body.categories).toHaveLength(2);
  });

  it('create task con projectCategoryId válida', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'API endpoints',
        kind: 'task',
        projectId: 'proj-1',
        projectCategoryId: 'cat-a',
      });

    expect(res.status).toBe(201);
    expect(lastTaskInsert![0].project_id).toBe('proj-1');
    expect(lastTaskInsert![0].project_category_id).toBe('cat-a');
    expect(res.body.projectCategoryId).toBe('cat-a');
  });

  it('create task descarta categoryId inválida', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Sin cat',
        kind: 'task',
        projectId: 'proj-1',
        projectCategoryId: 'no-existe',
      });

    expect(res.status).toBe(201);
    expect(lastTaskInsert![0].project_category_id).toBeNull();
  });

  it('create event conserva projectId y subcategoría (Gantt)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Ensayo del curso',
        kind: 'event',
        projectId: 'proj-1',
        projectCategoryId: 'cat-a',
      });

    expect(res.status).toBe(201);
    expect(lastTaskInsert![0].project_id).toBe('proj-1');
    expect(lastTaskInsert![0].project_category_id).toBe('cat-a');
  });

  it('hábito no guarda proyecto', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Correr',
        kind: 'habit_good',
        projectId: 'proj-1',
        projectCategoryId: 'cat-a',
      });

    expect(res.status).toBe(201);
    expect(lastTaskInsert![0].project_id).toBeNull();
    expect(lastTaskInsert![0].project_category_id).toBeNull();
  });
});
