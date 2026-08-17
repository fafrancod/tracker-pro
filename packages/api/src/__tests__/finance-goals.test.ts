import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { summarizeGoalProgress, summarizeMovementsByCurrency } from '@daily-tracker/core';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let goalRows: Record<string, unknown>[] = [];
let lastGoalInsert: Record<string, unknown> | null = null;

function buildFromMock() {
  return vi.fn((table: string) => {
    if (table === 'finance_goals') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.is = vi.fn(() => c);
          c.order = vi.fn(async () => ({ data: goalRows, error: null }));
          c.maybeSingle = vi.fn(async () => ({
            data: goalRows[0] ?? null,
            error: null,
          }));
          return c;
        }),
        insert: vi.fn(async (row: Record<string, unknown>) => {
          lastGoalInsert = row;
          goalRows = [...goalRows, row];
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
  goalRows = [];
  lastGoalInsert = null;
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

const blankFx = {
  originalAmount: 150_000,
  originalCurrency: 'CLP',
  exchangeRate: null as number | null,
  fxPending: false,
  reportingCurrency: 'CLP',
};

describe('POST /api/finances/goals', () => {
  it('cifra nombre y meta; deadline queda en claro', async () => {
    const res = await request(app)
      .post('/api/finances/goals')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'Pie departamento',
        targetAmount: 2_400_000,
        targetDayId: '2027-11-01',
        currency: 'CLP',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Pie departamento');
    expect(res.body.targetAmount).toBe(2_400_000);
    expect(res.body.targetDayId).toBe('2027-11-01');
    expect(lastGoalInsert?.payload).toEqual({});
    expect(lastGoalInsert?.target_day_id).toBe('2027-11-01');
    expect(String(lastGoalInsert?.payload_enc ?? '')).not.toContain('departamento');
    expect(String(lastGoalInsert?.payload_enc ?? '')).not.toContain('2400000');
  });
});

describe('avance de objetivo', () => {
  const goal = {
    id: 'goal_1',
    currency: 'CLP',
    targetDayId: '2027-11-01',
    linkedAccountId: null as string | null,
    name: 'Pie',
    targetAmount: 2_400_000,
    notes: '',
    archived: false,
    createdAt: '',
    updatedAt: '',
  };

  const contribution = {
    id: 'm1',
    dayId: '2026-08-17',
    flow: 'expense' as const,
    status: 'confirmed' as const,
    currency: 'CLP',
    title: 'Aporte pie',
    amount: 150_000,
    notes: '',
    certainty: 'fixed' as const,
    accountId: 'acc_debit',
    cardAccountId: null,
    goalId: 'goal_1',
    creditId: null,
    installmentGroupId: null,
    installmentIndex: null,
    installmentTotal: null,
    tag: 'goal_contribution' as const,
    ruleId: null,
    sourceTaskId: null,
    createdAt: '',
    updatedAt: '',
    ...blankFx,
  };

  it('aporte mueve la barra y no dobla el KPI del mes', () => {
    const progress = summarizeGoalProgress(goal, [contribution], '2026-08-17');
    expect(progress.current).toBe(150_000);
    expect(progress.remaining).toBe(2_250_000);
    expect(progress.monthsLeft).toBe(15);
    expect(progress.monthlyNeed).toBe(150_000);
    const kpi = summarizeMovementsByCurrency([contribution], '2026-08', 'CLP');
    expect(kpi.CLP?.confirmedExpense ?? 0).toBe(0);
  });

  it('cuenta-sobre: saldo de la cuenta es el avance', () => {
    const linked = { ...goal, linkedAccountId: 'acc_sobre' };
    const income = {
      ...contribution,
      id: 'm2',
      flow: 'income' as const,
      tag: null,
      goalId: null,
      accountId: 'acc_sobre',
      amount: 400_000,
    };
    const progress = summarizeGoalProgress(linked, [income], '2026-08-17');
    expect(progress.current).toBe(400_000);
    expect(progress.remaining).toBe(2_000_000);
  });
});
