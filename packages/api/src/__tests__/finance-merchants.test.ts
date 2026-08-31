import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  merchantSpendFromDayId,
  summarizeMerchantSpend,
  type FinanceMovement,
} from '@daily-tracker/core';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let merchantRows: Record<string, unknown>[] = [];
let lastInsert: Record<string, unknown> | null = null;

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'finance_merchants') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.is = vi.fn(() => c);
          c.order = vi.fn(async () => ({ data: merchantRows, error: null }));
          c.maybeSingle = vi.fn(async () => ({
            data: merchantRows[0] ?? null,
            error: null,
          }));
          return c;
        }),
        insert: vi.fn(async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(rows) ? rows : [rows];
          lastInsert = list[0] ?? null;
          merchantRows = [...merchantRows, ...list];
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
  merchantRows = [];
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

describe('POST /api/finances/merchants', () => {
  it('cifra el nombre del comercio', async () => {
    const res = await request(app)
      .post('/api/finances/merchants')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Jumbo', notes: 'Supermercado', color: '#16a34a' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Jumbo');
    expect(res.body.notes).toBe('Supermercado');
    expect(lastInsert?.payload).toEqual({});
    expect(String(lastInsert?.payload_enc ?? '')).not.toContain('Jumbo');
  });

  it('exige nombre', async () => {
    const res = await request(app)
      .post('/api/finances/merchants')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/finances/merchants', () => {
  it('lista los comercios creados sin tumbar el resto de Finanzas', async () => {
    await request(app)
      .post('/api/finances/merchants')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Jumbo' });
    await request(app)
      .post('/api/finances/merchants')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Uber' });
    await request(app)
      .post('/api/finances/merchants')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Netflix' });
    const res = await request(app)
      .get('/api/finances/merchants')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.merchants).toHaveLength(3);
  });
});

function expense(partial: Partial<FinanceMovement> & Pick<FinanceMovement, 'id' | 'dayId'>): FinanceMovement {
  return {
    purchaseDayId: partial.dayId,
    flow: 'expense',
    status: 'confirmed',
    currency: 'CLP',
    title: 'Compra',
    amount: 10_000,
    notes: '',
    certainty: 'fixed',
    accountId: null,
    cardAccountId: null,
    goalId: null,
    creditId: null,
    installmentGroupId: null,
    installmentIndex: null,
    installmentTotal: null,
    tag: null,
    originalAmount: 10_000,
    originalCurrency: 'CLP',
    exchangeRate: 1,
    fxPending: false,
    reportingCurrency: 'CLP',
    category: 'food',
    categoryId: 'cat-food',
    merchantId: 'mer-jumbo',
    ruleId: null,
    sourceTaskId: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('gasto por comercio', () => {
  it('ventana de 3 meses parte el día 1 de hace dos meses', () => {
    expect(merchantSpendFromDayId('2026-08-31', 2)).toBe('2026-06-01');
  });

  it('suma gastos confirmados del comercio y parte por categoría', () => {
    const rows = [
      expense({ id: 'm1', dayId: '2026-08-10', amount: 20_000, originalAmount: 20_000 }),
      expense({
        id: 'm2',
        dayId: '2026-07-02',
        amount: 5_000,
        originalAmount: 5_000,
        category: 'health',
        categoryId: 'cat-health',
      }),
      expense({
        id: 'm3',
        dayId: '2026-05-01',
        amount: 99_000,
        originalAmount: 99_000,
      }),
      expense({
        id: 'm4',
        dayId: '2026-08-11',
        merchantId: 'mer-lider',
        amount: 8_000,
        originalAmount: 8_000,
      }),
      expense({
        id: 'm5',
        dayId: '2026-08-12',
        status: 'planned',
        amount: 7_000,
        originalAmount: 7_000,
      }),
    ];
    const spend = summarizeMerchantSpend(rows, {
      fromDayId: '2026-06-01',
      toDayId: '2026-08-31',
      reportingCurrency: 'CLP',
    });
    expect(spend['mer-jumbo']?.total).toBe(25_000);
    expect(spend['mer-jumbo']?.count).toBe(2);
    expect(spend['mer-jumbo']?.byCategory[0]?.groupKey).toBe('food');
    expect(spend['mer-jumbo']?.byCategory.find(s => s.groupKey === 'health')?.amount).toBe(
      5_000
    );
    expect(spend['mer-lider']?.total).toBe(8_000);
    expect(spend['mer-jumbo']?.byCategory.find(s => s.groupKey === 'food')?.amount).toBe(
      20_000
    );
  });
});
