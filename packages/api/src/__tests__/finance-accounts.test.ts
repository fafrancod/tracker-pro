import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { summarizeCardUsage, summarizeMovementsByCurrency } from '@daily-tracker/core';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let accountRows: Record<string, unknown>[] = [];
let lastAccountInsert: Record<string, unknown> | null = null;

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'finance_accounts') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.is = vi.fn(() => c);
          c.order = vi.fn(async () => ({ data: accountRows, error: null }));
          c.maybeSingle = vi.fn(async () => ({
            data: accountRows[0] ?? null,
            error: null,
          }));
          return c;
        }),
        insert: vi.fn(async (row: Record<string, unknown>) => {
          lastAccountInsert = row;
          accountRows = [...accountRows, row];
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
  accountRows = [];
  lastAccountInsert = null;
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

describe('POST /api/finances/accounts', () => {
  it('cifra nombre y cupo; el insert no lleva el nombre en claro', async () => {
    const res = await request(app)
      .post('/api/finances/accounts')
      .set('Authorization', 'Bearer valid-token')
      .send({
        type: 'credit',
        name: 'Visa Santander',
        institution: 'Santander',
        creditLimit: 2_000_000,
        currency: 'CLP',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Visa Santander');
    expect(res.body.creditLimit).toBe(2_000_000);
    expect(res.body.type).toBe('credit');
    expect(lastAccountInsert?.payload).toEqual({});
    expect(String(lastAccountInsert?.payload_enc ?? '')).not.toContain('Visa');
    expect(String(lastAccountInsert?.payload_enc ?? '')).not.toContain('2000000');
  });
});

describe('pago de tarjeta no dobla el mes', () => {
  const visa = {
    id: 'acc_visa',
    type: 'credit' as const,
    currency: 'CLP',
    name: 'Visa',
    institution: 'Banco',
    creditLimit: 1_000_000,
    archived: false,
    createdAt: '',
    updatedAt: '',
  };
  const charge = {
    id: 'm1',
    dayId: '2026-08-10',
    flow: 'expense' as const,
    status: 'confirmed' as const,
    currency: 'CLP',
    title: 'Cena',
    amount: 40_000,
    notes: '',
    certainty: 'fixed' as const,
    accountId: 'acc_visa',
    cardAccountId: null,
    tag: null,
    ruleId: null,
    sourceTaskId: null,
    createdAt: '',
    updatedAt: '',
  };
  const payment = {
    ...charge,
    id: 'm2',
    dayId: '2026-08-17',
    title: 'Pago Visa',
    amount: 40_000,
    accountId: 'acc_debit',
    cardAccountId: 'acc_visa',
    tag: 'card_payment' as const,
  };

  it('KPI del mes ignora el pago de tarjeta', () => {
    const sum = summarizeMovementsByCurrency([charge, payment], '2026-08');
    expect(sum.CLP.confirmedExpense).toBe(40_000);
    expect(sum.CLP.balance).toBe(-40_000);
  });

  it('usado = cargos − pagos; disponible = cupo − usado', () => {
    const usage = summarizeCardUsage(visa, [charge, payment]);
    expect(usage.spent).toBe(40_000);
    expect(usage.paid).toBe(40_000);
    expect(usage.used).toBe(0);
    expect(usage.available).toBe(1_000_000);
  });
});
