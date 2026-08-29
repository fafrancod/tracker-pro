/**
 * Ideas / notas: CRUD + enlaces a proyecto, subproyecto, tarea y evento.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let noteRows: Record<string, unknown>[] = [];
let lastNoteInsert: Record<string, unknown> | null = null;
let lastNoteUpdate: Record<string, unknown> | null = null;
let lastNoteDeleteId: string | null = null;

function chainable(result: { data: unknown; error: null }) {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'notes') {
      return {
        select: vi.fn(() => {
          const c = chainable({ data: noteRows, error: null });
          c.eq = vi.fn(() => {
            const inner = chainable({
              data: noteRows[0] ?? null,
              error: null,
            });
            inner.order = vi.fn(async () => ({ data: noteRows, error: null }));
            inner.maybeSingle = vi.fn(async () => ({
              data: noteRows[0] ?? null,
              error: null,
            }));
            return inner;
          });
          c.order = vi.fn(async () => ({ data: noteRows, error: null }));
          return c;
        }),
        insert: vi.fn(async (row: Record<string, unknown>) => {
          lastNoteInsert = row;
          noteRows = [...noteRows, row];
          return { data: null, error: null };
        }),
        update: vi.fn((patch: Record<string, unknown>) => {
          lastNoteUpdate = patch;
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.then = (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null });
          return c;
        }),
        delete: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn((col: string, val: unknown) => {
            if (col === 'id') lastNoteDeleteId = String(val);
            return c;
          });
          c.then = (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null });
          return c;
        }),
      };
    }
    const c: Record<string, unknown> = {};
    c.eq = vi.fn(() => c);
    c.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    return { select: vi.fn(() => c) };
  });
}

beforeEach(() => {
  noteRows = [];
  lastNoteInsert = null;
  lastNoteUpdate = null;
  lastNoteDeleteId = null;
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

const sampleDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Idea para el lanzamiento' }],
    },
  ],
};

describe('POST /api/notes', () => {
  it('crea una idea con título, contenido y enlaces', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'Lanzamiento',
        content: sampleDoc,
        links: [
          { type: 'project', id: 'proj_1', label: 'Tracker' },
          { type: 'subproject', id: 'cat_1', projectId: 'proj_1', label: 'App' },
          { type: 'task', id: 'task_1', label: 'Landing' },
          { type: 'event', id: 'evt_1', label: 'Kickoff' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Lanzamiento');
    expect(res.body.excerpt).toContain('lanzamiento');
    expect(res.body.links).toHaveLength(4);
    expect(lastNoteInsert?.user_id).toBe('test-uid');
    expect(lastNoteInsert?.title).toBe('Lanzamiento');
  });

  it('rechaza un tipo de enlace desconocido', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', 'Bearer valid-token')
      .send({
        title: 'X',
        links: [{ type: 'habit', id: 'h1' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('exige autenticación', async () => {
    const res = await request(app).post('/api/notes').send({ title: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/notes', () => {
  it('lista las ideas del usuario', async () => {
    noteRows = [
      {
        id: 'n1',
        user_id: 'test-uid',
        title: 'Una',
        content: sampleDoc,
        excerpt: 'Idea para el lanzamiento',
        links: [],
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
      },
    ];
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].title).toBe('Una');
  });
});

describe('PATCH /api/notes/:id', () => {
  it('actualiza título y contenido', async () => {
    noteRows = [
      {
        id: 'n1',
        user_id: 'test-uid',
        title: 'Vieja',
        content: sampleDoc,
        excerpt: 'old',
        links: [],
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ];
    const res = await request(app)
      .patch('/api/notes/n1')
      .set('Authorization', 'Bearer valid-token')
      .send({ title: 'Nueva' });
    expect(res.status).toBe(200);
    expect(lastNoteUpdate?.title).toBe('Nueva');
  });

  it('404 si no existe', async () => {
    noteRows = [];
    const res = await request(app)
      .patch('/api/notes/missing')
      .set('Authorization', 'Bearer valid-token')
      .send({ title: 'Nueva' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/notes/:id', () => {
  it('borra la idea', async () => {
    noteRows = [
      {
        id: 'n1',
        user_id: 'test-uid',
        title: 'Una',
        content: sampleDoc,
        excerpt: 'x',
        links: [],
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ];
    const res = await request(app)
      .delete('/api/notes/n1')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(204);
    expect(lastNoteDeleteId).toBe('n1');
  });
});
