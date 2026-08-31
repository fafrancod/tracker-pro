import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  dedupeFinanceCalendarMovements,
  expandFinanceRules,
  financeRuleAppliesOnDay,
  financeRuleOccurrenceDayId,
  inclusiveDaySpan,
  retargetMonthlyRuleOccurrences,
  shiftDayIdToMonthDay,
  type FinanceMovement,
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
let lastRuleUpdate: Record<string, unknown> | null = null;

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
          c.then = (
            resolve: (v: unknown) => void,
            reject?: (e: unknown) => void
          ) =>
            Promise.resolve({ data: movementRows, error: null }).then(
              resolve,
              reject
            );
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
          c.maybeSingle = vi.fn(async () => ({
            data: ruleRows[0] ?? null,
            error: null,
          }));
          return c;
        }),
        insert: vi.fn(async (row: Record<string, unknown>) => {
          lastRuleInsert = row;
          ruleRows = [...ruleRows, row];
          return { data: null, error: null };
        }),
        update: vi.fn((row: Record<string, unknown>) => {
          lastRuleUpdate = row;
          const c: Record<string, unknown> = {};
          c.eq = vi.fn(() => c);
          c.then = (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null });
          return c;
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
  lastRuleUpdate = null;
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

  it('calcula el N.º día hábil con feriados del país seleccionado', () => {
    const localPayroll: FinanceRule = {
      ...rule,
      recurrenceDay: 1,
      monthlySchedule: 'business_day',
      businessDayOrdinal: 14,
      businessDayCountry: 'CL',
    };
    // El 18/09 es feriado en Chile: el 14.º día hábil de septiembre de 2026
    // llega al lunes 21, no al viernes feriado.
    expect(financeRuleOccurrenceDayId(localPayroll, 2026, 8)).toBe('2026-09-21');
    expect(financeRuleAppliesOnDay(localPayroll, '2026-09-21')).toBe(true);
    expect(financeRuleAppliesOnDay(localPayroll, '2026-09-18')).toBe(false);
  });

  it('mantiene el día 30 tras una primera ocurrencia ajustada al 28 de febrero', () => {
    const arriendo: FinanceRule = {
      ...rule,
      recurrenceDay: 30,
      startDayId: '2026-02-28',
    };
    const extra = expandFinanceRules(
      [arriendo],
      [],
      '2026-02-01',
      '2026-04-30'
    );
    expect(extra.map(movement => movement.dayId)).toEqual([
      '2026-02-28',
      '2026-03-30',
      '2026-04-30',
    ]);
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

  it('no duplica Arriendo si la fila física no trae ruleId', () => {
    const extra = expandFinanceRules(
      [{ ...rule, title: 'Arriendo depto' }],
      [
        {
          id: 'm-arriendo',
          dayId: '2026-08-05',
          flow: 'expense',
          status: 'planned',
          currency: 'CLP',
          title: 'Arriendo depto',
          amount: 500000,
          notes: '',
          certainty: 'fixed',
          ruleId: null,
          sourceTaskId: 'task-arriendo',
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
  });

  it('no emite dos virtuales si hay dos reglas con el mismo título', () => {
    const extra = expandFinanceRules(
      [
        { ...rule, id: 'rule-a', title: 'Arriendo depto' },
        { ...rule, id: 'rule-b', title: 'Arriendo depto' },
      ],
      [],
      '2026-08-01',
      '2026-08-31'
    );
    const onFifth = extra.filter(m => m.dayId === '2026-08-05');
    expect(onFifth).toHaveLength(1);
  });

  it('un arriendo en el mes cubre el vencimiento, aunque el día no coincida', () => {
    const extra = expandFinanceRules(
      [{ ...rule, title: 'Arriendo depto', recurrenceDay: 5 }],
      [
        {
          id: 'm-arriendo',
          dayId: '2026-09-01',
          flow: 'expense',
          status: 'confirmed',
          currency: 'CLP',
          title: 'Arriendo dpto',
          amount: 500000,
          notes: '',
          certainty: 'fixed',
          ruleId: null,
          sourceTaskId: 'task-arriendo',
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
      '2026-09-01',
      '2026-09-30'
    );
    expect(extra.filter(m => m.title.toLowerCase().includes('arriendo'))).toHaveLength(
      0
    );
  });

  it('deja una sola pastilla si hay real y virtual el mismo mes', () => {
    const real: FinanceMovement = {
      id: 'm-real',
      dayId: '2026-09-01',
      flow: 'expense',
      status: 'confirmed',
      currency: 'CLP',
      title: 'Arriendo dpto',
      amount: 500000,
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
      originalAmount: 500000,
      originalCurrency: 'CLP',
      exchangeRate: 1,
      fxPending: false,
      reportingCurrency: 'CLP',
      ruleId: null,
      sourceTaskId: null,
      virtual: false,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
    const virtual: FinanceMovement = {
      ...real,
      id: 'fvr:rule-1:2026-09-05',
      dayId: '2026-09-05',
      title: 'Arriendo depto',
      status: 'planned',
      virtual: true,
      ruleId: 'rule-1',
    };
    const out = dedupeFinanceCalendarMovements(
      [virtual, real],
      [{ ...rule, id: 'rule-1', title: 'Arriendo depto' }]
    );
    const sept = out.filter(m => m.dayId.startsWith('2026-09') && m.status !== 'skipped');
    expect(sept).toHaveLength(1);
    expect(sept[0]?.id).toBe('m-real');
  });

  it('serie mensual que nació el 31 y pasa al 30 sigue aplicando en ese mes', () => {
    const globant: FinanceRule = {
      ...rule,
      id: 'rule-globant',
      flow: 'income',
      title: 'Ingreso Globant',
      amount: 2_500_000,
      recurrenceDay: 30,
      startDayId: '2026-08-31',
    };
    expect(shiftDayIdToMonthDay('2026-08-31', 30)).toBe('2026-08-30');
    expect(financeRuleAppliesOnDay(globant, '2026-08-30')).toBe(true);
    expect(financeRuleAppliesOnDay(globant, '2026-08-31')).toBe(false);
    const extra = expandFinanceRules([globant], [], '2026-08-01', '2026-08-31');
    expect(extra.map(m => m.dayId)).toEqual(['2026-08-30']);
  });

  it('mueve la fila física del 31 al 30 al cambiar el día de la regla', () => {
    const globant: FinanceRule = {
      ...rule,
      id: 'rule-globant',
      flow: 'income',
      title: 'Ingreso Globant',
      amount: 2_500_000,
      recurrenceDay: 30,
      startDayId: '2026-08-31',
    };
    const seed: FinanceMovement = {
      id: 'm-globant',
      dayId: '2026-08-31',
      flow: 'income',
      status: 'confirmed',
      currency: 'CLP',
      title: 'Ingreso Globant',
      amount: 2_500_000,
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
      originalAmount: 2_500_000,
      originalCurrency: 'CLP',
      exchangeRate: 1,
      fxPending: false,
      reportingCurrency: 'CLP',
      ruleId: 'rule-globant',
      sourceTaskId: null,
      virtual: false,
      createdAt: globant.createdAt,
      updatedAt: globant.updatedAt,
    };
    const aligned = retargetMonthlyRuleOccurrences([seed], [globant]);
    expect(aligned[0]?.dayId).toBe('2026-08-30');
    const extra = expandFinanceRules([globant], aligned, '2026-08-01', '2026-08-31');
    expect(extra).toHaveLength(0);
    const shown = dedupeFinanceCalendarMovements([...aligned, ...extra], [globant]);
    expect(shown.map(m => m.dayId)).toEqual(['2026-08-30']);
    expect(shown[0]?.status).toBe('confirmed');
  });

  it('sin ruleId, 31 de julio y 1 de agosto se pintan el 30 (día de la regla)', () => {
    const globant: FinanceRule = {
      ...rule,
      id: 'rule-globant',
      flow: 'income',
      title: 'Ingreso Globant',
      amount: 2_500_000,
      recurrenceDay: 30,
      startDayId: '2026-01-31',
    };
    const july: FinanceMovement = {
      id: 'm-jul',
      dayId: '2026-07-31',
      flow: 'income',
      status: 'confirmed',
      currency: 'CLP',
      title: 'Ingreso Globant',
      amount: 2_500_000,
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
      originalAmount: 2_500_000,
      originalCurrency: 'CLP',
      exchangeRate: 1,
      fxPending: false,
      reportingCurrency: 'CLP',
      ruleId: null,
      sourceTaskId: 't-jul',
      virtual: false,
      createdAt: globant.createdAt,
      updatedAt: globant.updatedAt,
    };
    const aug1: FinanceMovement = {
      ...july,
      id: 'm-aug',
      dayId: '2026-08-01',
      sourceTaskId: 't-aug',
    };
    const aligned = retargetMonthlyRuleOccurrences([july, aug1], [globant]);
    expect(aligned.map(m => m.dayId)).toEqual(['2026-07-30', '2026-08-30']);
    const extra = expandFinanceRules(
      [globant],
      aligned,
      '2026-07-27',
      '2026-08-31'
    );
    const shown = dedupeFinanceCalendarMovements([...aligned, ...extra], [globant]);
    const days = shown.map(m => m.dayId).sort();
    expect(days).toEqual(['2026-07-30', '2026-08-30']);
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
      '2026-09-30',
      '2026-10-31',
      '2026-11-30',
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
    expect(res.body.instances.map((row: { purchaseDayId: string }) => row.purchaseDayId)).toEqual([
      '2026-08-31',
      '2026-08-31',
      '2026-08-31',
    ]);
    const splitTotal = (res.body.instances[1].categorySplits as Array<{ amount: number }>)
      .reduce((sum, split) => sum + split.amount, 0);
    expect(splitTotal).toBeCloseTo(33, 8);
  });

  it('reemplaza toda una compra existente al editarla y cambiar sus cuotas', async () => {
    movementRows = [
      {
        id: 'movement-old-001',
        user_id: 'test-uid',
        day_id: '2026-08-05',
        flow: 'expense',
        status: 'confirmed',
        currency: 'CLP',
        payload: { title: 'Notebook · Cuota 1 de 2', amount: 50, notes: '' },
        installment_group_id: 'group-old-001',
        installment_index: 1,
        installment_total: 2,
        rule_id: null,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ];
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        replaceMovementId: 'movement-old-001',
        dayId: '2026-08-05',
        flow: 'expense',
        title: 'Notebook mejorado',
        amount: 120,
        currency: 'CLP',
        installmentTotal: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.instances).toHaveLength(3);
    expect(res.body.instances.map((row: { amount: number }) => row.amount)).toEqual([
      40,
      40,
      40,
    ]);
  });

  it('concreta una ocurrencia de regla existente sin crear otra regla', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-09-05',
        flow: 'income',
        status: 'confirmed',
        title: 'Salario',
        amount: 1_200_000,
        currency: 'CLP',
        ruleId: 'rule-salary-01',
      });
    expect(res.status).toBe(201);
    expect(lastMovementInsert?.rule_id).toBe('rule-salary-01');
    expect(lastMovementInsert?.day_id).toBe('2026-09-05');
    expect(lastMovementInsert?.status).toBe('confirmed');
    expect(lastRuleInsert).toBeNull();
  });

  it('rechaza una fecha inexistente aunque tenga formato YYYY-MM-DD', async () => {
    const res = await request(app)
      .post('/api/finances/movements')
      .set('Authorization', 'Bearer valid-token')
      .send({
        dayId: '2026-02-30',
        flow: 'expense',
        title: 'Arriendo',
        amount: 500000,
      });
    expect(res.status).toBe(400);
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

  it('PATCH conserva la fecha de compra al corregir la fecha de una cuota', async () => {
    movementRows = [
      {
        id: 'fm_installment',
        user_id: 'test-uid',
        day_id: '2026-08-23',
        flow: 'expense',
        status: 'confirmed',
        currency: 'CLP',
        payload: { title: 'Guitarra · Cuota 1 de 6', amount: 4000, notes: '' },
        installment_group_id: 'group-guitar',
        installment_index: 1,
        installment_total: 6,
        rule_id: null,
        created_at: '2026-08-17T10:00:00.000Z',
        updated_at: '2026-08-17T10:00:00.000Z',
      },
    ];
    const res = await request(app)
      .patch('/api/finances/movements/fm_installment')
      .set('Authorization', 'Bearer valid-token')
      .send({ dayId: '2026-09-23', purchaseDayId: '2026-08-23' });
    expect(res.status).toBe(200);
    expect(res.body.dayId).toBe('2026-09-23');
    expect(res.body.purchaseDayId).toBe('2026-08-23');
  });
});

describe('PATCH /api/finances/rules/:ruleId', () => {
  it('cambia frecuencia y día sin exigir payloadEnc', async () => {
    ruleRows = [
      {
        id: 'rule-globant',
        user_id: 'test-uid',
        flow: 'income',
        currency: 'CLP',
        frequency: 'monthly',
        recurrence_day: 25,
        start_day_id: '2026-01-25',
        payload: { title: 'Ingreso Globant', amount: 2500000 },
        active: true,
      },
    ];
    const res = await request(app)
      .patch('/api/finances/rules/rule-globant')
      .set('Authorization', 'Bearer valid-token')
      .send({ frequency: 'weekly', recurrenceDay: 1 });
    expect(res.status).toBe(200);
    expect(res.body.frequency).toBe('weekly');
    expect(res.body.recurrenceDay).toBe(1);
    expect(lastRuleUpdate?.frequency).toBe('weekly');
    expect(lastRuleUpdate?.recurrence_day).toBe(1);
  });

  it('al pasar de día 31 a 30 adelanta start_day_id para no perder el mes', async () => {
    ruleRows = [
      {
        id: 'rule-globant',
        user_id: 'test-uid',
        flow: 'income',
        currency: 'CLP',
        frequency: 'monthly',
        recurrence_day: 31,
        start_day_id: '2026-08-31',
        payload: { title: 'Ingreso Globant', amount: 2500000 },
        active: true,
      },
    ];
    const res = await request(app)
      .patch('/api/finances/rules/rule-globant')
      .set('Authorization', 'Bearer valid-token')
      .send({ recurrenceDay: 30 });
    expect(res.status).toBe(200);
    expect(res.body.recurrenceDay).toBe(30);
    expect(lastRuleUpdate?.recurrence_day).toBe(30);
    expect(lastRuleUpdate?.start_day_id).toBe('2026-08-30');
  });

  it('acepta el inicio más temprano de la serie al realinear una recurrencia', async () => {
    ruleRows = [
      {
        id: 'rule-globant',
        user_id: 'test-uid',
        flow: 'income',
        currency: 'CLP',
        frequency: 'monthly',
        recurrence_day: 1,
        start_day_id: '2026-09-01',
        payload: { title: 'Ingreso Globant', amount: 2500000 },
        active: true,
      },
    ];
    const res = await request(app)
      .patch('/api/finances/rules/rule-globant')
      .set('Authorization', 'Bearer valid-token')
      .send({ recurrenceDay: 29, startDayId: '2026-07-29' });

    expect(res.status).toBe(200);
    expect(res.body.recurrenceDay).toBe(29);
    expect(lastRuleUpdate?.recurrence_day).toBe(29);
    expect(lastRuleUpdate?.start_day_id).toBe('2026-07-29');
  });

  it('guarda país y ordinal para una recurrencia por día hábil', async () => {
    ruleRows = [
      {
        id: 'rule-payroll', user_id: 'test-uid', flow: 'income', currency: 'CLP',
        frequency: 'monthly', recurrence_day: 1, start_day_id: '2026-09-01',
        payload: { title: 'Sueldo', amount: 2500000 }, active: true,
      },
    ];
    const res = await request(app)
      .patch('/api/finances/rules/rule-payroll')
      .set('Authorization', 'Bearer valid-token')
      .send({ monthlySchedule: 'business_day', businessDayOrdinal: 14, businessDayCountry: 'CL' });

    expect(res.status).toBe(200);
    expect(lastRuleUpdate?.recurrence_kind).toBe('business_day');
    expect(lastRuleUpdate?.business_day_ordinal).toBe(14);
    expect(lastRuleUpdate?.business_day_country).toBe('CL');
  });
});
