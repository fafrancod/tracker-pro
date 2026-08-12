/**
 * Adjuntos de imagen y PDF en create/update de tareas (data URLs).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z';

const TINY_PDF = 'data:application/pdf;name=nota.pdf;base64,JVBERi0xLjQK';

let lastInsertRows: Record<string, unknown>[] | null = null;
let lastUpdatePayload: Record<string, unknown> | null = null;

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
  lastInsertRows = null;
  lastUpdatePayload = null;
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
      if (table === 'tasks') {
        const makeSelect = () => {
          const c: Record<string, unknown> = {
            eq: vi.fn(() => c),
            in: vi.fn(() => c),
            select: vi.fn(() => c),
            order: vi.fn(() => c),
            limit: vi.fn(() => c),
            maybeSingle: vi.fn(async () => ({
              data: {
                id: 'task-1',
                user_id: 'test-uid',
                week_id: '2026-W11',
                day_id: '2026-03-10',
                end_day_id: '2026-03-10',
                title: 'Con foto',
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
                urgency: null,
                importance: null,
                kind: 'task',
                color: null,
                start_time: null,
                end_time: null,
                rx_meta: null,
                involved_contact_ids: [],
                location: null,
                departure_time: null,
                steps: [],
                images: [TINY_JPEG],
                finance_meta: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            })),
            single: vi.fn(async () => ({
              data: null,
              error: null,
            })),
            then: undefined as unknown,
          };
          // Order counters path: await select...eq returns { data, error }
          (c as { then?: unknown }).then = (
            resolve: (v: { data: unknown[]; error: null }) => void
          ) => {
            resolve({ data: [], error: null });
          };
          return c;
        };
        return {
          select: vi.fn(() => makeSelect()),
          insert: vi.fn(async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
            lastInsertRows = Array.isArray(rows) ? rows : [rows];
            return { data: null, error: null };
          }),
          update: vi.fn((payload: Record<string, unknown>) => {
            lastUpdatePayload = payload;
            const c: Record<string, unknown> = {
              eq: vi.fn(() => c),
              select: vi.fn(() => c),
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: 'task-1',
                  user_id: 'test-uid',
                  week_id: '2026-W11',
                  day_id: '2026-03-10',
                  end_day_id: '2026-03-10',
                  title: 'Con foto',
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
                  urgency: null,
                  importance: null,
                  kind: 'task',
                  color: null,
                  start_time: null,
                  end_time: null,
                  rx_meta: null,
                  involved_contact_ids: [],
                  location: null,
                  departure_time: null,
                  steps: [],
                  images: payload.images ?? [],
                  finance_meta: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              })),
            };
            return c;
          }),
        };
      }
      return chainEqMaybeSingle({ data: null, error: null });
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
});

describe('task images', () => {
  it('create guarda images en la fila', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Tarea con foto',
        kind: 'task',
        images: [TINY_JPEG],
      });

    expect(res.status).toBe(201);
    expect(lastInsertRows).toBeTruthy();
    expect(lastInsertRows![0].images).toEqual([TINY_JPEG]);
    expect(res.body.images).toEqual([TINY_JPEG]);
  });

  it('create descarta data URLs inválidas', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Sin basura',
        kind: 'task',
        images: ['http://evil.example/x.png', 'not-an-image', TINY_JPEG],
      });

    expect(res.status).toBe(201);
    expect(lastInsertRows![0].images).toEqual([TINY_JPEG]);
  });

  it('update patch images en instancia', async () => {
    const res = await request(app)
      .patch('/api/tasks/2026-W11/2026-03-10/task-1')
      .set('Authorization', 'Bearer valid-token')
      .send({
        images: [TINY_JPEG, TINY_JPEG],
      });

    // Duplicados se colapsan a 1
    expect(res.status).toBe(200);
    expect(lastUpdatePayload?.images).toEqual([TINY_JPEG]);
  });

  it('create guarda un PDF con nombre en el data URL', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Tarea con PDF',
        kind: 'task',
        images: [TINY_PDF],
      });

    expect(res.status).toBe(201);
    expect(lastInsertRows![0].images).toEqual([TINY_PDF]);
    expect(res.body.images).toEqual([TINY_PDF]);
  });

  it('create acepta objeto { name, dataUrl } y lo normaliza', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'PDF objeto',
        kind: 'task',
        images: [
          {
            name: 'factura.pdf',
            dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
          },
        ],
      });

    expect(res.status).toBe(201);
    const stored = lastInsertRows![0].images as string[];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toContain('application/pdf');
    expect(stored[0]).toContain('name=factura.pdf');
    expect(stored[0]).toContain('JVBERi0xLjQK');
  });

  it('create mezcla imagen y PDF y descarta basura', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({
        weekId: '2026-W11',
        dayId: '2026-03-10',
        title: 'Mixto',
        kind: 'task',
        images: [TINY_JPEG, 'http://evil.example/x.pdf', TINY_PDF],
      });

    expect(res.status).toBe(201);
    expect(lastInsertRows![0].images).toEqual([TINY_JPEG, TINY_PDF]);
  });
});
