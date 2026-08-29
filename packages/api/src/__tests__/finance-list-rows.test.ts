import { describe, it, expect } from 'vitest';
import {
  collapseFinanceListRows,
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
});
