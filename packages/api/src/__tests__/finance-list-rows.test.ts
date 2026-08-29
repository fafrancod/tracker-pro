import { describe, it, expect } from 'vitest';
import {
  collapseFinanceListRows,
  type FinanceCredit,
  type FinanceMovement,
  type FinanceRule,
} from '@daily-tracker/core';

function mov(
  partial: Partial<FinanceMovement> & Pick<FinanceMovement, 'id' | 'dayId' | 'title'>
): FinanceMovement {
  return {
    purchaseDayId: partial.dayId,
    flow: 'income',
    status: 'confirmed',
    currency: 'CLP',
    amount: 1_000_000,
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
    originalAmount: 1_000_000,
    originalCurrency: 'CLP',
    exchangeRate: 1,
    fxPending: false,
    reportingCurrency: 'CLP',
    ruleId: null,
    sourceTaskId: null,
    virtual: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

const globantRule: FinanceRule = {
  id: 'rule-globant',
  flow: 'income',
  currency: 'CLP',
  frequency: 'monthly',
  recurrenceDay: 25,
  startDayId: '2026-01-25',
  title: 'Ingreso Globant',
  amount: 2_500_000,
  notes: '',
  certainty: 'fixed',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('collapseFinanceListRows', () => {
  it('deja una sola fila para una serie mensual', () => {
    const rows = collapseFinanceListRows(
      [
        mov({
          id: 'm1',
          dayId: '2026-06-25',
          title: 'Ingreso Globant',
          ruleId: 'rule-globant',
        }),
        mov({
          id: 'm2',
          dayId: '2026-07-25',
          title: 'Ingreso Globant',
          ruleId: 'rule-globant',
        }),
        mov({
          id: 'm3',
          dayId: '2026-08-25',
          title: 'Ingreso Globant',
          ruleId: 'rule-globant',
        }),
        mov({ id: 'cafe', dayId: '2026-08-17', title: 'Café' }),
      ],
      [globantRule]
    );
    expect(rows).toHaveLength(2);
    const series = rows.find(r => r.kind === 'series');
    const one = rows.find(r => r.kind === 'one_off');
    expect(series?.kind === 'series' && series.instanceCount).toBe(3);
    expect(series?.kind === 'series' && series.rule.frequency).toBe('monthly');
    expect(one?.kind === 'one_off' && one.movement.title).toBe('Café');
  });

  it('ignora virtuales expandidos para no duplicar la serie', () => {
    const rows = collapseFinanceListRows(
      [
        mov({
          id: 'm1',
          dayId: '2026-08-25',
          title: 'Ingreso Globant',
          ruleId: 'rule-globant',
        }),
        mov({
          id: 'fvr:rule-globant:2026-09-25',
          dayId: '2026-09-25',
          title: 'Ingreso Globant',
          ruleId: 'rule-globant',
          virtual: true,
        }),
      ],
      [globantRule]
    );
    expect(rows.filter(r => r.kind === 'series')).toHaveLength(1);
  });

  it('agrupa instancias del tablero sin ruleId con la regla del mismo título', () => {
    const rows = collapseFinanceListRows(
      [
        mov({
          id: 'm1',
          dayId: '2026-06-25',
          title: 'Ingreso Globant',
          ruleId: 'rule-globant',
        }),
        mov({
          id: 'm2',
          dayId: '2026-07-25',
          title: 'Ingreso Globant',
        }),
        mov({
          id: 'm3',
          dayId: '2026-08-25',
          title: 'Ingreso Globant',
        }),
      ],
      [globantRule]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('series');
    expect(rows[0]?.kind === 'series' && rows[0].instanceCount).toBe(3);
  });

  it('colapsa una cadencia mensual aunque no haya regla persistida', () => {
    const rows = collapseFinanceListRows(
      [
        mov({ id: 'a', dayId: '2026-06-25', title: 'Sueldo' }),
        mov({ id: 'b', dayId: '2026-07-25', title: 'Sueldo' }),
        mov({ id: 'c', dayId: '2026-08-25', title: 'Sueldo' }),
      ],
      []
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind === 'series' && rows[0].rule.frequency).toBe('monthly');
    expect(rows[0]?.kind === 'series' && rows[0].rule.recurrenceDay).toBe(25);
  });

  it('no fusiona puntuales del mismo título sin cadencia', () => {
    const rows = collapseFinanceListRows(
      [
        mov({ id: 'c1', dayId: '2026-08-17', title: 'Café', amount: 3500 }),
        mov({ id: 'c2', dayId: '2026-08-19', title: 'Café', amount: 3500 }),
      ],
      []
    );
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.kind === 'one_off')).toBe(true);
  });

  it('colapsa las cuotas de una compra con tarjeta en una sola fila', () => {
    const rows = collapseFinanceListRows(
      [
        mov({
          id: 'g1',
          dayId: '2026-09-23',
          title: 'Guitarra · Cuota 1 de 6',
          flow: 'expense',
          status: 'confirmed',
          amount: 40000,
          installmentGroupId: 'group-guitar',
          installmentIndex: 1,
          installmentTotal: 6,
          purchaseDayId: '2026-08-23',
        }),
        mov({
          id: 'g2',
          dayId: '2026-10-23',
          title: 'Guitarra · Cuota 2 de 6',
          flow: 'expense',
          status: 'confirmed',
          amount: 40000,
          installmentGroupId: 'group-guitar',
          installmentIndex: 2,
          installmentTotal: 6,
          purchaseDayId: '2026-08-23',
        }),
        mov({
          id: 'g3',
          dayId: '2026-11-23',
          title: 'Guitarra · Cuota 3 de 6',
          flow: 'expense',
          status: 'planned',
          amount: 40000,
          installmentGroupId: 'group-guitar',
          installmentIndex: 3,
          installmentTotal: 6,
          purchaseDayId: '2026-08-23',
        }),
        mov({
          id: 'g4',
          dayId: '2026-12-23',
          title: 'Guitarra · Cuota 4 de 6',
          flow: 'expense',
          status: 'planned',
          amount: 40000,
          installmentGroupId: 'group-guitar',
          installmentIndex: 4,
          installmentTotal: 6,
          purchaseDayId: '2026-08-23',
        }),
        mov({
          id: 'g5',
          dayId: '2027-01-23',
          title: 'Guitarra · Cuota 5 de 6',
          flow: 'expense',
          status: 'planned',
          amount: 40000,
          installmentGroupId: 'group-guitar',
          installmentIndex: 5,
          installmentTotal: 6,
          purchaseDayId: '2026-08-23',
        }),
        mov({
          id: 'g6',
          dayId: '2027-02-23',
          title: 'Guitarra · Cuota 6 de 6',
          flow: 'expense',
          status: 'planned',
          amount: 40000,
          installmentGroupId: 'group-guitar',
          installmentIndex: 6,
          installmentTotal: 6,
          purchaseDayId: '2026-08-23',
        }),
        mov({ id: 'cafe', dayId: '2026-08-17', title: 'Café', amount: 3500 }),
      ],
      [],
      [],
      [],
      '2026-08-29'
    );
    expect(rows).toHaveLength(2);
    const purchase = rows.find(row => row.kind === 'installment');
    expect(purchase?.kind === 'installment' && purchase.title).toBe('Guitarra');
    expect(purchase?.kind === 'installment' && purchase.paidCount).toBe(0);
    expect(purchase?.kind === 'installment' && purchase.remainingCount).toBe(6);
    expect(purchase?.kind === 'installment' && purchase.totalCount).toBe(6);
    expect(purchase?.kind === 'installment' && purchase.endsOn).toBe('2027-02-23');
    expect(purchase?.kind === 'installment' && purchase.totalAmount).toBe(240000);
  });

  it('cuenta cuotas pagadas por vencimiento (compra + N meses), no por confirmed', () => {
    const guitar = (index: number, dayId: string) =>
      mov({
        id: `g${index}`,
        dayId,
        title: `Guitarra · Cuota ${index} de 6`,
        flow: 'expense',
        status: 'confirmed',
        amount: 40000,
        installmentGroupId: 'group-guitar',
        installmentIndex: index,
        installmentTotal: 6,
        purchaseDayId: '2026-08-23',
      });
    const instances = [
      guitar(1, '2026-09-23'),
      guitar(2, '2026-10-23'),
      guitar(3, '2026-11-23'),
      guitar(4, '2026-12-23'),
      guitar(5, '2027-01-23'),
      guitar(6, '2027-02-23'),
    ];
    const august = collapseFinanceListRows(instances, [], [], [], '2026-08-29');
    expect(august[0]?.kind === 'installment' && august[0].paidCount).toBe(0);
    const october = collapseFinanceListRows(instances, [], [], [], '2026-10-23');
    expect(october[0]?.kind === 'installment' && october[0].paidCount).toBe(2);
    expect(october[0]?.kind === 'installment' && october[0].remainingCount).toBe(4);
  });

  it('marca como serie un ingreso del tablero aunque solo haya una fila en el mayor', () => {
    const rows = collapseFinanceListRows(
      [
        mov({
          id: 'globant-1',
          dayId: '2026-08-25',
          title: 'Ingreso Globant',
          sourceTaskId: 'task-g1',
        }),
      ],
      [],
      [
        {
          seriesId: 'series-globant',
          title: 'Ingreso Globant',
          flow: 'income',
          frequency: 'monthly',
          recurrenceDay: 25,
          startDayId: '2026-01-25',
          amount: 1_000_000,
          currency: 'CLP',
          notes: '',
          certainty: 'fixed',
          sourceTaskIds: ['task-g1', 'task-g2'],
        },
      ]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('series');
    expect(rows[0]?.kind === 'series' && rows[0].rule.frequency).toBe('monthly');
    expect(rows[0]?.kind === 'series' && rows[0].rule.recurrenceDay).toBe(25);
  });

  it('une un movimiento a la regla del mismo importe si el título de la regla viene vacío', () => {
    const rows = collapseFinanceListRows(
      [mov({ id: 'g1', dayId: '2026-08-25', title: 'Ingreso Globant', amount: 2_500_000 })],
      [{ ...globantRule, title: '' }]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('series');
    expect(rows[0]?.kind === 'series' && rows[0].rule.id).toBe('rule-globant');
  });

  it('deja una sola fila para un crédito de consumo', () => {
    const consumo: FinanceCredit = {
      id: 'cr-consumo',
      currency: 'CLP',
      kind: 'consumer',
      dueDay: 5,
      startDayId: '2026-08-29',
      termMonths: 12,
      name: 'Crédito consumo',
      principal: 2_000_000,
      monthlyInstallment: 180_000,
      notes: '',
      archived: false,
      createdAt: '',
      updatedAt: '',
    };
    const rows = collapseFinanceListRows(
      [
        mov({
          id: 'p1',
          dayId: '2026-09-05',
          title: 'Crédito consumo',
          flow: 'expense',
          amount: 180_000,
          creditId: 'cr-consumo',
          tag: 'credit_payment',
        }),
      ],
      [],
      [],
      [consumo]
    );
    expect(rows.filter(row => row.kind === 'credit')).toHaveLength(1);
    const row = rows.find(r => r.kind === 'credit');
    expect(row?.kind === 'credit' && row.totalCount).toBe(12);
    expect(row?.kind === 'credit' && row.remainingCount).toBe(11);
    expect(row?.kind === 'credit' && row.endsOn).toBe('2027-08-05');
  });
});
