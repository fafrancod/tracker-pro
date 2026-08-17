import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  buildLotSale,
  groupOpenLots,
  type FinanceMovement,
} from '@daily-tracker/core';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import {
  INVESTMENT_QUOTE_FIXTURES,
  lookupInvestmentQuotes,
  searchInvestmentFixtures,
} from '../routes/financeInvestments.js';

const app = buildApp();

let movementRows: Record<string, unknown>[] = [];
let lastMovementInsert: Record<string, unknown> | null = null;

function baseLot(partial: Partial<FinanceMovement>): FinanceMovement {
  return {
    id: 'lot-1',
    dayId: '2026-08-11',
    flow: 'investment',
    status: 'confirmed',
    currency: 'USD',
    title: 'Apple',
    amount: 1000,
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
    originalAmount: 1000,
    originalCurrency: 'USD',
    exchangeRate: null,
    fxPending: false,
    reportingCurrency: 'USD',
    investmentSide: 'buy',
    ticker: 'AAPL',
    assetName: 'Apple Inc',
    quantity: 5,
    investedAmount: 1000,
    investmentStatus: 'open',
    closesLotId: null,
    ruleId: null,
    sourceTaskId: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'finance_movements') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.gte = vi.fn(() => c);
          c.lte = vi.fn(() => c);
          c.is = vi.fn(() => c);
          c.order = vi.fn(async () => ({ data: movementRows, error: null }));
          c.maybeSingle = vi.fn(async () => ({
            data: movementRows[0] ?? null,
            error: null,
          }));
          return c;
        }),
        insert: vi.fn(async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(rows) ? rows : [rows];
          lastMovementInsert = list[0] ?? null;
          movementRows = [...movementRows, ...list];
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
  movementRows = [];
  lastMovementInsert = null;
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

describe('groupOpenLots', () => {
  it('2 lots del mismo ticker se agrupan', () => {
    const holdings = groupOpenLots([
      baseLot({ id: 'a', quantity: 2, investedAmount: 400, amount: 400 }),
      baseLot({ id: 'b', quantity: 3, investedAmount: 600, amount: 600 }),
    ]);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].ticker).toBe('AAPL');
    expect(holdings[0].quantity).toBe(5);
    expect(holdings[0].investedAmount).toBe(1000);
    expect(holdings[0].lots).toHaveLength(2);
  });

  it('una venta cierra el lot y no queda en el holding', () => {
    const open = baseLot({ id: 'buy-1' });
    const { closePatch, sale } = buildLotSale({
      lot: open,
      dayId: '2026-08-18',
      proceeds: 1300,
    });
    expect(closePatch.investmentStatus).toBe('sold');
    expect(sale.flow).toBe('investment');
    expect(sale.investmentSide).toBe('sell');
    expect(sale.closesLotId).toBe('buy-1');
    expect(sale.amount).toBe(1300);

    const closed: FinanceMovement = {
      ...open,
      investmentStatus: 'sold',
    };
    const saleRow: FinanceMovement = {
      ...open,
      id: 'sell-1',
      dayId: '2026-08-18',
      investmentSide: 'sell',
      investmentStatus: 'sold',
      amount: 1300,
      investedAmount: 1300,
      closesLotId: 'buy-1',
    };
    expect(groupOpenLots([closed, saleRow])).toEqual([]);
  });
});

describe('quotes y search (fixtures, sin red)', () => {
  it('lookup sin fetchImpl usa fixtures de CI', async () => {
    const quotes = await lookupInvestmentQuotes(['AAPL', 'NOPE']);
    expect(quotes).toEqual([INVESTMENT_QUOTE_FIXTURES.AAPL]);
  });

  it('fetch que falla → lista vacía (sin cotización)', async () => {
    const fake = vi.fn(async () => {
      throw new Error('offline');
    });
    const quotes = await lookupInvestmentQuotes(
      ['AAPL'],
      fake as unknown as typeof fetch
    );
    expect(quotes).toEqual([]);
    expect(fake).toHaveBeenCalled();
  });

  it('GET /api/finances/investments/quote usa fixture', async () => {
    const res = await request(app)
      .get('/api/finances/investments/quote?symbols=AAPL')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.quotes[0].symbol).toBe('AAPL');
    expect(res.body.quotes[0].price).toBe(190.5);
  });

  it('GET /api/finances/investments/search?q=app → Apple', async () => {
    expect(searchInvestmentFixtures('app')[0].symbol).toBe('AAPL');
    const res = await request(app)
      .get('/api/finances/investments/search?q=app')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.results[0].symbol).toBe('AAPL');
  });
});

describe('POST /api/finances/movements investment', () => {
  it('cifra ticker y notional; SQL sin AAPL', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-08-11',
        flow: 'investment',
        status: 'confirmed',
        currency: 'USD',
        title: 'Apple',
        amount: 1900,
        ticker: 'AAPL',
        assetName: 'Apple Inc',
        quantity: 10,
        investedAmount: 1900,
        investmentSide: 'buy',
        investmentStatus: 'open',
      });
    expect(res.status).toBe(201);
    expect(res.body.ticker).toBe('AAPL');
    expect(res.body.flow).toBe('investment');
    expect(lastMovementInsert?.payload).toEqual({});
    expect(lastMovementInsert?.flow).toBe('investment');
    const enc = String(lastMovementInsert?.payload_enc ?? '');
    expect(enc).toBeTruthy();
    expect(enc).not.toContain('AAPL');
    expect(enc).not.toContain('1900');
    expect(JSON.stringify(lastMovementInsert)).not.toContain('AAPL');
  });
});
