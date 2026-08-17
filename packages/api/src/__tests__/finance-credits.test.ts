import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  addMonthsToDayId,
  countPurchases,
  simulateExtraPayment,
  summarizeCreditProgress,
} from '@daily-tracker/core';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let creditRows: Record<string, unknown>[] = [];
let lastCreditInsert: Record<string, unknown> | null = null;
let movementInserts: Record<string, unknown>[] = [];

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'finance_credits') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.is = vi.fn(() => c);
          c.order = vi.fn(async () => ({ data: creditRows, error: null }));
          c.maybeSingle = vi.fn(async () => ({
            data: creditRows[0] ?? null,
            error: null,
          }));
          return c;
        }),
        insert: vi.fn(async (row: Record<string, unknown>) => {
          lastCreditInsert = row;
          creditRows = [...creditRows, row];
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
    if (table === 'finance_movements') {
      return {
        insert: vi.fn(async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(rows) ? rows : [rows];
          movementInserts = [...movementInserts, ...list];
          return { data: null, error: null };
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
  creditRows = [];
  lastCreditInsert = null;
  movementInserts = [];
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

describe('POST /api/finances/credits', () => {
  it('cifra principal; due_day queda en claro', async () => {
    const res = await request(app)
      .post('/api/finances/credits')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'Auto',
        principal: 12_000_000,
        monthlyInstallment: 350_000,
        dueDay: 5,
        startDayId: '2026-08-05',
        termMonths: 36,
        kind: 'auto',
        currency: 'CLP',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Auto');
    expect(res.body.dueDay).toBe(5);
    expect(res.body.termMonths).toBe(36);
    expect(lastCreditInsert?.due_day).toBe(5);
    expect(lastCreditInsert?.payload).toEqual({});
    expect(String(lastCreditInsert?.payload_enc ?? '')).not.toContain('12000000');
  });
});

describe('cuotas y simulación', () => {
  it('6 cuotas del mismo grupo = 1 compra', () => {
    const group = 'g1';
    const rows = Array.from({ length: 6 }, (_, i) => ({
      id: `m${i}`,
      dayId: addMonthsToDayId('2026-08-17', i),
      flow: 'expense' as const,
      status: 'planned' as const,
      currency: 'CLP',
      title: 'Notebook',
      amount: 100_000,
      notes: '',
      certainty: 'fixed' as const,
      accountId: null,
      cardAccountId: null,
      goalId: null,
      creditId: null,
      installmentGroupId: group,
      installmentIndex: i + 1,
      installmentTotal: 6,
      tag: null,
      originalAmount: 100_000,
      originalCurrency: 'CLP',
      exchangeRate: null,
      fxPending: false,
      reportingCurrency: 'CLP',
      ruleId: null,
      sourceTaskId: null,
      createdAt: '',
      updatedAt: '',
    }));
    expect(countPurchases(rows)).toBe(1);
    expect(countPurchases([...rows, { ...rows[0], id: 'solo', installmentGroupId: null, installmentTotal: null }])).toBe(2);
  });

  it('36 cuotas: van 10; extra reduce plazo o cuota', () => {
    const credit = {
      id: 'cr1',
      currency: 'CLP',
      kind: 'consumer' as const,
      dueDay: 5,
      startDayId: '2024-08-05',
      termMonths: 36,
      name: 'Consumo',
      principal: 3_600_000,
      monthlyInstallment: 100_000,
      notes: '',
      archived: false,
      createdAt: '',
      updatedAt: '',
    };
    const paid = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      dayId: addMonthsToDayId('2024-08-05', i),
      flow: 'expense' as const,
      status: 'confirmed' as const,
      currency: 'CLP',
      title: 'Cuota',
      amount: 100_000,
      notes: '',
      certainty: 'fixed' as const,
      accountId: null,
      cardAccountId: null,
      goalId: null,
      creditId: 'cr1',
      installmentGroupId: null,
      installmentIndex: null,
      installmentTotal: null,
      tag: 'credit_payment' as const,
      originalAmount: 100_000,
      originalCurrency: 'CLP',
      exchangeRate: null,
      fxPending: false,
      reportingCurrency: 'CLP',
      ruleId: null,
      sourceTaskId: null,
      createdAt: '',
      updatedAt: '',
    }));
    const progress = summarizeCreditProgress(credit, paid);
    expect(progress.paidCount).toBe(10);
    expect(progress.remainingCount).toBe(26);

    const term = simulateExtraPayment({
      monthlyInstallment: 100_000,
      remainingCount: 26,
      extraAmount: 300_000,
      mode: 'term',
    });
    expect(term.savedMonths).toBe(3);
    expect(term.remainingCount).toBe(23);

    const inst = simulateExtraPayment({
      monthlyInstallment: 100_000,
      remainingCount: 26,
      extraAmount: 260_000,
      mode: 'installment',
    });
    expect(inst.newInstallment).toBe(90_000);
    expect(inst.savedMonths).toBe(0);
  });
});

describe('POST /api/finances/movements — cuotas', () => {
  it('materializa 6 filas del mismo grupo', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-08-17',
        flow: 'expense',
        title: 'Notebook',
        amount: 100000,
        currency: 'CLP',
        installmentTotal: 6,
      });
    expect(res.status).toBe(201);
    expect(movementInserts).toHaveLength(6);
    const groups = new Set(movementInserts.map(r => r.installment_group_id));
    expect(groups.size).toBe(1);
    expect(movementInserts[0].day_id).toBe('2026-08-17');
    expect(movementInserts[5].day_id).toBe('2027-01-17');
    expect(res.body.instances).toHaveLength(6);
  });
});
