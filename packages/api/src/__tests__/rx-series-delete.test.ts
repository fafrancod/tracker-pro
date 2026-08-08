import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let lastSeriesDeleteEq: Array<{ col: string; val: unknown }> = [];

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {
            eq: vi.fn(() => c),
            maybeSingle: vi.fn(async () => ({
              data: { plan: 'pro', id: 'test-uid' },
              error: null,
            })),
          };
          return c;
        }),
      };
    }
    if (table === 'tasks') {
      return {
        delete: vi.fn(() => {
          lastSeriesDeleteEq = [];
          const c: Record<string, unknown> = {
            eq: vi.fn((col: string, val: unknown) => {
              lastSeriesDeleteEq.push({ col, val });
              return c;
            }),
            then: (resolve: (v: unknown) => void) =>
              resolve({ data: null, error: null }),
          };
          return c;
        }),
      };
    }
    return {
      select: vi.fn(() => {
        const c: Record<string, unknown> = {
          eq: vi.fn(() => c),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        };
        return c;
      }),
    };
  });
}

describe('DELETE /api/tasks/series/:seriesId', () => {
  beforeEach(() => {
    lastSeriesDeleteEq = [];
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

  it('borra todas las filas de la serie del usuario', async () => {
    const res = await request(app)
      .delete('/api/tasks/series/series-rx-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(204);
    expect(lastSeriesDeleteEq).toEqual(
      expect.arrayContaining([
        { col: 'user_id', val: 'test-uid' },
        { col: 'series_id', val: 'series-rx-1' },
      ])
    );
  });

  it('rechaza seriesId vacío', async () => {
    const res = await request(app)
      .delete('/api/tasks/series/%20')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(400);
  });

  it('requiere auth', async () => {
    const res = await request(app).delete('/api/tasks/series/series-rx-1');
    expect(res.status).toBe(401);
  });
});
