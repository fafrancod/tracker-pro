import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  expandFinanceRules,
  financeRuleAppliesOnDay,
  inclusiveDaySpan,
  type FinanceRule,
} from '@daily-tracker/core';
import { buildApp } from '../app.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

const app = buildApp();

let movementRows: Record<string, unknown>[] = [];
let ruleRows: Record<string, unknown>[] = [];
let lastMovementInsert: Record<string, unknown> | null = null;
let lastMovementInsertRows: Record<string, unknown>[] = [];
let lastRuleInsert: Record<string, unknown> | null = null;

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
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    is: vi.fn(() => chain),
    ...terminal,
  };
  chain.eq = vi.fn(() => chain);
  return chain;
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
        insert: vi.fn(async (row: Record<string, unknown> | Record<string, unknown>[]) => {
          const list = Array.isArray(row) ? row : [row];
          lastMovementInsert = list[0] ?? null;
          lastMovementInsertRows = list;
          movementRows = [...movementRows, ...list];
          return { data: null, error: null };
        }),
        update: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.not = vi.fn(() => c);
          c.then = (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null });
          return c;
        }),
        delete: vi.fn(() => {
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
        update: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.not = vi.fn(() => c);
          c.then = (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null });
          return c;
        }),
      };
    }
    if (table === 'finance_rules') {
      return {
        select: vi.fn(() => {
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.lte = vi.fn(() => c);
          c.order = vi.fn(async () => ({ data: ruleRows, error: null }));
          return c;
        }),
        insert: vi.fn(async (row: Record<string, unknown>) => {
          lastRuleInsert = row;
          ruleRows = [...ruleRows, row];
          return { data: null, error: null };
        }),
      };
    }
    return chainEqMaybeSingle({ data: null, error: null });
  });
}

beforeEach(() => {
  movementRows = [];
  ruleRows = [];
  lastMovementInsert = null;
  lastMovementInsertRows = [];
  lastRuleInsert = null;
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

describe('finance rule expansion', () => {
  const rule: FinanceRule = {
    id: 'rule-1',
    flow: 'expense',
    currency: 'CLP',
    frequency: 'monthly',
    recurrenceDay: 5,
    startDayId: '2026-08-01',
    title: 'Arriendo',
    amount: 500000,
    notes: '',
    certainty: 'fixed',
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  it('aparece el día 5 y no el 4', () => {
    expect(financeRuleAppliesOnDay(rule, '2026-08-05')).toBe(true);
    expect(financeRuleAppliesOnDay(rule, '2026-08-04')).toBe(false);
  });

  it('no duplica si ya hay fila física ese día', () => {
    const extra = expandFinanceRules(
      [rule],
      [
        {
          id: 'm1',
          dayId: '2026-08-05',
          flow: 'expense',
          status: 'confirmed',
          currency: 'CLP',
          title: 'Arriendo',
          amount: 500000,
          notes: '',
          certainty: 'fixed',
          ruleId: 'rule-1',
          sourceTaskId: null,
          accountId: null,
          cardAccountId: null,
          goalId: null,
          creditId: null,
          installmentGroupId: null,
          installmentIndex: null,
          installmentTotal: null,
          tag: null,
          originalAmount: null,
          originalCurrency: null,
          exchangeRate: null,
          fxPending: false,
          reportingCurrency: null,
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
        },
      ],
      '2026-08-01',
      '2026-08-31'
    );
    expect(extra.some(m => m.dayId === '2026-08-05')).toBe(false);
    expect(extra.length).toBe(0);
  });

  it('span inclusivo de 93 días es el tope', () => {
    expect(inclusiveDaySpan('2026-08-01', '2026-10-31')).toBeGreaterThan(90);
    expect(inclusiveDaySpan('2026-08-01', '2026-08-31')).toBe(31);
    expect(inclusiveDaySpan('2026-08-10', '2026-08-01')).toBe(-1);
  });
});

describe('POST /api/finances/movements', () => {
  it('crea un gasto puntual confirmed por defecto', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-08-17',
        flow: 'expense',
        title: 'Café',
        amount: 2800,
        currency: 'CLP',
      });
    expect(res.status).toBe(201);
    expect(lastMovementInsert?.day_id).toBe('2026-08-17');
    expect(lastMovementInsert?.flow).toBe('expense');
    expect(lastMovementInsert?.status).toBe('confirmed');
    expect(lastMovementInsert?.payload).toEqual({});
    expect(lastMovementInsert?.payload_enc).toBeTruthy();
    expect(res.body.title).toBe('Café');
    expect(res.body.amount).toBe(2800);
    expect(lastRuleInsert).toBeNull();
  });

  it('recurrente mensual crea regla + seed', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-08-05',
        flow: 'expense',
        title: 'Arriendo',
        amount: 500000,
        currency: 'CLP',
        recurrence: { frequency: 'monthly', recurrenceDay: 5 },
      });
    expect(res.status).toBe(201);
    expect(lastRuleInsert?.frequency).toBe('monthly');
    expect(lastRuleInsert?.recurrence_day).toBe(5);
    expect(lastMovementInsert?.rule_id).toBe(lastRuleInsert?.id);
    expect(res.body.ruleId).toBeTruthy();
  });

  it('materializa una compra con tarjeta en cuotas, divide el total y rotula cada mes', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-08-31',
        flow: 'expense',
        title: 'Notebook',
        amount: 100,
        currency: 'CLP',
        installmentTotal: 3,
        categorySplits: [
          { id: 'food', categoryId: 'food', groupKey: 'food', amount: 40 },
          { id: 'home', categoryId: 'housing', groupKey: 'housing', amount: 60 },
        ],
      });

    expect(res.status).toBe(201);
    expect(lastMovementInsertRows).toHaveLength(3);
    expect(lastMovementInsertRows.map(row => row.day_id)).toEqual([
      '2026-08-31',
      '2026-09-30',
      '2026-10-31',
    ]);
    expect(res.body.instances.map((row: { amount: number }) => row.amount)).toEqual([
      34,
      33,
      33,
    ]);
    expect(res.body.instances.map((row: { title: string }) => row.title)).toEqual([
      'Notebook · Cuota 1 de 3',
      'Notebook · Cuota 2 de 3',
      'Notebook · Cuota 3 de 3',
    ]);
    const splitTotal = (res.body.instances[1].categorySplits as Array<{ amount: number }>)
      .reduce((sum, split) => sum + split.amount, 0);
    expect(splitTotal).toBeCloseTo(33, 8);
  });

  it('dayId inválido → 400', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '17-08-2026',
        flow: 'expense',
        title: 'X',
        amount: 1,
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/finances/movements', () => {
  it('exige from y to', async () => {
    const res = await request(app)
      .get('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(400);
  });

  it('rechaza un rango de más de 93 días', async () => {
    const res = await request(app)
      .get('/api/finances/movements?from=2026-01-01&to=2026-06-01')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(400);
  });

  it('devuelve movimientos del rango', async () => {
    movementRows = [
      {
        id: 'm1',
        user_id: 'test-uid',
        day_id: '2026-08-17',
        flow: 'expense',
        status: 'confirmed',
        currency: 'CLP',
        payload: { title: 'Café', amount: 2800, notes: '', certainty: 'fixed' },
        rule_id: null,
        source_task_id: null,
        created_at: '2026-08-17T10:00:00.000Z',
        updated_at: '2026-08-17T10:00:00.000Z',
      },
    ];
    const res = await request(app)
      .get('/api/finances/movements?from=2026-08-01&to=2026-08-31')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.movements).toHaveLength(1);
    expect(res.body.movements[0].title).toBe('Café');
    expect(Array.isArray(res.body.rules)).toBe(true);
  });
});

describe('bridge vida ↔ dinero', () => {
  it('POST acepta sourceTaskId', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-08-17',
        flow: 'expense',
        title: 'Arriendo',
        amount: 500000,
        currency: 'CLP',
        sourceTaskId: 'task_owner_1',
      });
    expect(res.status).toBe(201);
    expect(lastMovementInsert?.source_task_id).toBe('task_owner_1');
    expect(res.body.sourceTaskId).toBe('task_owner_1');
  });

  it('GET /movements/:id devuelve status sin exigir payload claro', async () => {
    movementRows = [
      {
        id: 'fm_sealed',
        user_id: 'test-uid',
        day_id: '2026-08-17',
        flow: 'expense',
        status: 'planned',
        currency: 'EUR',
        payload: {},
        payload_enc: 'sealed-blob-not-empty-enough',
        source_task_id: 'task_1',
        rule_id: null,
        created_at: '2026-08-17T10:00:00.000Z',
        updated_at: '2026-08-17T10:00:00.000Z',
      },
    ];
    const res = await request(app)
      .get('/api/finances/movements/fm_sealed')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('fm_sealed');
    expect(res.body.status).toBe('planned');
    expect(res.body.sourceTaskId).toBe('task_1');
    expect(res.body.sealed).toBe(true);
    expect(res.body.title).toBe('');
    expect(res.body.amount).toBe(0);
  });

  it('PATCH sourceTaskId no exige payloadEnc', async () => {
    movementRows = [
      {
        id: 'fm_link',
        user_id: 'test-uid',
        day_id: '2026-08-17',
        flow: 'expense',
        status: 'planned',
        currency: 'EUR',
        payload: { title: 'Café', amount: 3, notes: '', certainty: 'fixed' },
        source_task_id: null,
        rule_id: null,
        created_at: '2026-08-17T10:00:00.000Z',
        updated_at: '2026-08-17T10:00:00.000Z',
      },
    ];
    const res = await request(app)
      .patch('/api/finances/movements/fm_link')
      .set('Authorization', 'Bearer valid-token')
      .send({ sourceTaskId: 'task_after_create' });
    expect(res.status).toBe(200);
    expect(res.body.sourceTaskId).toBe('task_after_create');
    expect(res.body.status).toBe('planned');
  });

  it('PATCH status confirmed no exige montos', async () => {
    movementRows = [
      {
        id: 'fm_confirm',
        user_id: 'test-uid',
        day_id: '2026-08-17',
        flow: 'expense',
        status: 'planned',
        currency: 'EUR',
        payload: { title: 'Café', amount: 3, notes: '', certainty: 'fixed' },
        source_task_id: 'task_1',
        rule_id: null,
        created_at: '2026-08-17T10:00:00.000Z',
        updated_at: '2026-08-17T10:00:00.000Z',
      },
    ];
    const res = await request(app)
      .patch('/api/finances/movements/fm_confirm')
      .set('Authorization', 'Bearer valid-token')
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
    expect(res.body.sourceTaskId).toBe('task_1');
  });
});
