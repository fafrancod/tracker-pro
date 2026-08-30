import { describe, it, expect } from 'vitest';
import {
  coveringMovementForTask,
  financeTaskToMovement,
  mergeBoardFinanceIntoMovements,
  planBoardFinanceSync,
  type FinanceMovement,
  type LocatedTaskRow,
} from '@daily-tracker/core';

function task(
  partial: Partial<LocatedTaskRow> & Pick<LocatedTaskRow, 'id' | 'title' | 'dayId'>
): LocatedTaskRow {
  return {
    weekId: '2026-W32',
    completed: false,
    completedAt: null,
    projectId: null,
    projectCategoryId: null,
    priority: 'medium',
    notes: '',
    order: 0,
    tags: [],
    movedFrom: null,
    seriesId: null,
    recurrence: { frequency: 'monthly', interval: 1 },
    endDayId: partial.dayId,
    urgency: null,
    importance: null,
    kind: 'finance_income',
    color: '#3fb950',
    startTime: null,
    endTime: null,
    rx: null,
    involvedContactIds: [],
    location: null,
    departureTime: null,
    steps: [],
    images: [],
    finance: { amount: 2_500_000, currency: 'CLP', certainty: 'fixed' },
    financeMovementId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

function mov(partial: Partial<FinanceMovement> & Pick<FinanceMovement, 'id' | 'dayId'>): FinanceMovement {
  return {
    purchaseDayId: partial.dayId,
    flow: 'income',
    status: 'planned',
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
    sourceTaskId: null,
    virtual: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

describe('mergeBoardFinanceIntoMovements', () => {
  it('mete un ingreso completado del tablero como confirmed', () => {
    const globant = task({
      id: 't-globant',
      title: 'Ingreso Globant',
      dayId: '2026-08-25',
      completed: true,
    });
    const out = mergeBoardFinanceIntoMovements([], [globant]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Ingreso Globant');
    expect(out[0].status).toBe('confirmed');
    expect(out[0].flow).toBe('income');
    expect(out[0].amount).toBe(2_500_000);
  });

  it('no duplica si ya hay movimiento del mismo día y título', () => {
    const globant = task({
      id: 't-globant',
      title: 'Ingreso Globant',
      dayId: '2026-08-25',
      completed: true,
    });
    const existing = mov({ id: 'm1', dayId: '2026-08-25', status: 'planned' });
    const out = mergeBoardFinanceIntoMovements([existing], [globant]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('confirmed');
    expect(out[0].id).toBe('m1');
  });

  it('cubre el arriendo del mes aunque el día del tablero no coincida', () => {
    const board = task({
      id: 't-arriendo-sep',
      title: 'Arriendo dpto',
      dayId: '2026-09-01',
      kind: 'finance_expense',
      finance: { amount: 500000, currency: 'CLP', certainty: 'fixed' },
    });
    const existing = mov({
      id: 'm1',
      dayId: '2026-09-05',
      title: 'Arriendo depto',
      flow: 'expense',
      amount: 500000,
    });
    expect(coveringMovementForTask([existing], board)?.id).toBe('m1');
    const merged = mergeBoardFinanceIntoMovements([existing], [board]);
    expect(merged).toHaveLength(1);
  });

  it('no duplica una ocurrencia virtual de la misma regla', () => {
    const globant = task({
      id: 't-globant-aug',
      title: 'Ingreso Globant',
      dayId: '2026-08-25',
      completed: true,
    });
    const virtual = mov({
      id: 'fvr:rule-1:2026-08-25',
      dayId: '2026-08-25',
      virtual: true,
      ruleId: 'rule-1',
      status: 'planned',
    });
    const out = mergeBoardFinanceIntoMovements([virtual], [globant]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('confirmed');
  });
});

describe('planBoardFinanceSync', () => {
  it('crea movimiento si la tarea no tiene fila en el mayor', () => {
    const globant = task({
      id: 't-globant',
      title: 'Ingreso Globant',
      dayId: '2026-08-25',
      completed: true,
    });
    const actions = planBoardFinanceSync([], [globant]);
    expect(actions).toEqual([{ type: 'create', task: globant }]);
  });

  it('confirma el puente previsto cuando la tarea ya está hecha', () => {
    const globant = task({
      id: 't-globant',
      title: 'Ingreso Globant',
      dayId: '2026-08-25',
      completed: true,
      financeMovementId: 'm1',
    });
    const existing = mov({
      id: 'm1',
      dayId: '2026-08-25',
      status: 'planned',
      sourceTaskId: 't-globant',
    });
    const actions = planBoardFinanceSync([existing], [globant]);
    expect(actions).toEqual([{ type: 'confirm', task: globant, movementId: 'm1' }]);
  });
});

describe('financeTaskToMovement', () => {
  it('ignora tareas sin importe o sin fecha', () => {
    expect(
      financeTaskToMovement(
        task({
          id: 'x',
          title: 'X',
          dayId: '__undated__',
        })
      )
    ).toBeNull();
    expect(
      coveringMovementForTask([], task({ id: 'x', title: 'X', dayId: '2026-08-25' }))
    ).toBeUndefined();
  });
});
