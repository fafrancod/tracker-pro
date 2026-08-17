import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { summarizeCategoryBudget, type FinanceUserCategory } from '@daily-tracker/core';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let categoryRows: Record<string, unknown>[] = [];
let lastInsert: Record<string, unknown> | null = null;

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'finance_categories') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.is = vi.fn(() => c);
          c.order = vi.fn(async () => ({ data: categoryRows, error: null }));
          c.maybeSingle = vi.fn(async () => ({
            data: categoryRows[0] ?? null,
            error: null,
          }));
          return c;
        }),
        insert: vi.fn(async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(rows) ? rows : [rows];
          lastInsert = list[0] ?? null;
          categoryRows = [...categoryRows, ...list];
          return { data: null, error: null };
        }),
        update: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.then = (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null });
          return c;
        }),
      };
    }
    if (table === 'finance_vault') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
          return c;
        }),
        upsert: vi.fn(async () => ({ data: null, error: null })),
      };
    }
    const c: Record<string, unknown> = {};
    c.eq = vi.fn(() => c);
    c.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    return { select: vi.fn(() => c) };
  });
}

beforeEach(() => {
  categoryRows = [];
  lastInsert = null;
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: { id: 'test-uid', email: 'test@example.com', app_metadata: {} },
        },
        error: null,
      })),
    },
    from: buildFromMock(),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
});

describe('POST /api/finances/categories', () => {
  it('cifra nombre y presupuesto; group_key queda en claro', async () => {
    const res = await request(app)
      .post('/api/finances/categories')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'Cafés',
        groupKey: 'leisure',
        monthlyBudget: 80_000,
        currency: 'CLP',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Cafés');
    expect(res.body.monthlyBudget).toBe(80_000);
    expect(res.body.groupKey).toBe('leisure');
    expect(lastInsert?.group_key).toBe('leisure');
    expect(lastInsert?.payload).toEqual({});
    expect(String(lastInsert?.payload_enc ?? '')).not.toContain('Cafés');
    expect(String(lastInsert?.payload_enc ?? '')).not.toContain('80000');
  });
});

describe('presupuesto de categoría', () => {
  it('suma gastos del mes contra el cupo', () => {
    const cat: FinanceUserCategory = {
      id: 'cat-1',
      groupKey: 'food',
      color: '#f59e0b',
      currency: 'CLP',
      name: 'Comida',
      monthlyBudget: 200_000,
      necessary: true,
      archived: false,
      createdAt: '',
      updatedAt: '',
    };
    const rows = [
      {
        id: 'm1',
        dayId: '2026-08-02',
        flow: 'expense' as const,
        status: 'confirmed' as const,
        currency: 'CLP',
        title: 'Almuerzo',
        amount: 80_000,
        notes: '',
        certainty: 'fixed' as const,
        accountId: null,
        cardAccountId: null,
        goalId: null,
        creditId: null,
        installmentGroupId: null,
        installmentIndex: null,
        installmentTotal: null,
        tag: null,
        originalAmount: 80_000,
        originalCurrency: 'CLP',
        exchangeRate: null,
        fxPending: false,
        reportingCurrency: 'CLP',
        category: 'food' as const,
        categoryId: 'cat-1',
        ruleId: null,
        sourceTaskId: null,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'm2',
        dayId: '2026-08-10',
        flow: 'expense' as const,
        status: 'confirmed' as const,
        currency: 'CLP',
        title: 'Cena',
        amount: 40_000,
        notes: '',
        certainty: 'fixed' as const,
        accountId: null,
        cardAccountId: null,
        goalId: null,
        creditId: null,
        installmentGroupId: null,
        installmentIndex: null,
        installmentTotal: null,
        tag: null,
        originalAmount: 40_000,
        originalCurrency: 'CLP',
        exchangeRate: null,
        fxPending: false,
        reportingCurrency: 'CLP',
        category: 'food' as const,
        categoryId: 'cat-1',
        ruleId: null,
        sourceTaskId: null,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const p = summarizeCategoryBudget(cat, rows, '2026-08');
    expect(p.spent).toBe(120_000);
    expect(p.limit).toBe(200_000);
    expect(p.pct).toBe(60);
  });
});
