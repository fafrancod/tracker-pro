import { describe, it, expect } from 'vitest';
import {
  BOARD_CREDIT_WEEK_ID,
  boardCreditColor,
  boardCreditTasksByDay,
  collectTasksCovering,
  expandCreditsForBoard,
  isBoardCreditTaskId,
  isBoardCreditWeekId,
  makeBoardCreditTaskId,
  parseBoardCreditTaskId,
  type FinanceCredit,
  type FinanceMovement,
} from '@daily-tracker/core';

function credit(partial: Partial<FinanceCredit> = {}): FinanceCredit {
  return {
    id: 'c1',
    currency: 'CLP',
    kind: 'consumer',
    dueDay: 5,
    startDayId: '2026-01-05',
    termMonths: 12,
    name: 'Consumo Banco',
    principal: 2_400_000,
    monthlyInstallment: 200_000,
    notes: '',
    archived: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function mov(partial: Partial<FinanceMovement>): FinanceMovement {
  return {
    id: partial.id ?? 'm1',
    dayId: partial.dayId ?? '2026-08-05',
    flow: partial.flow ?? 'expense',
    status: partial.status ?? 'confirmed',
    currency: partial.currency ?? 'CLP',
    title: partial.title ?? 'Pago',
    amount: partial.amount ?? 200_000,
    notes: '',
    certainty: 'fixed',
    accountId: null,
    cardAccountId: null,
    goalId: null,
    creditId: null,
    installmentGroupId: null,
    installmentIndex: null,
    installmentTotal: null,
    tag: partial.tag ?? 'credit_payment',
    originalAmount: partial.amount ?? 200_000,
    originalCurrency: 'CLP',
    exchangeRate: null,
    fxPending: false,
    reportingCurrency: 'CLP',
    category: null,
    ruleId: null,
    sourceTaskId: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('cuotas de crédito en el tablero', () => {
  it('id virtual redondea creditId + día', () => {
    const id = makeBoardCreditTaskId('abc:def', '2026-09-05');
    expect(isBoardCreditTaskId(id)).toBe(true);
    expect(parseBoardCreditTaskId(id)).toEqual({
      creditId: 'abc:def',
      dayId: '2026-09-05',
    });
    expect(isBoardCreditWeekId(BOARD_CREDIT_WEEK_ID)).toBe(true);
    expect(isBoardCreditWeekId('2026-W36')).toBe(false);
  });

  it('consumo: primera cuota el día de vencimiento, no el alta', () => {
    const tasks = expandCreditsForBoard(
      [
        credit({
          startDayId: '2026-08-29',
          dueDay: 5,
          termMonths: 12,
          name: 'Crédito consumo',
        }),
      ],
      [],
      '2026-08-31',
      '2026-09-06'
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.startDayId).toBe('2026-09-05');
    expect(tasks[0]?.kind).toBe('finance_expense');
    expect(tasks[0]?.completed).toBe(false);
    expect(tasks[0]?.title).toMatch(/cuota 1 de 12/i);
    expect(tasks[0]?.finance?.amount).toBe(200_000);
    expect(tasks[0]?.color).toBe(boardCreditColor('consumer'));
  });

  it('hipotecario: una pastilla por mes en el plazo', () => {
    const tasks = expandCreditsForBoard(
      [
        credit({
          id: 'hip-1',
          kind: 'mortgage',
          name: 'Hipoteca depto',
          startDayId: '2026-01-01',
          dueDay: 15,
          termMonths: 6,
          monthlyInstallment: 550_000,
        }),
      ],
      []
    );
    expect(tasks).toHaveLength(6);
    expect(tasks.map(t => t.startDayId)).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
      '2026-06-15',
    ]);
    expect(tasks[0]?.color).toBe(boardCreditColor('mortgage'));
    expect(tasks[5]?.title).toMatch(/cuota 6 de 6/i);
  });

  it('marca completada la cuota si ya hay pago confirmado ese mes', () => {
    const tasks = expandCreditsForBoard(
      [credit({ id: 'c1', startDayId: '2026-01-05', dueDay: 5, termMonths: 3 })],
      [
        mov({
          id: 'paid-aug',
          dayId: '2026-02-03',
          creditId: 'c1',
          status: 'confirmed',
          amount: 199_000,
        }),
      ],
      '2026-02-01',
      '2026-02-28'
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.completed).toBe(true);
    expect(tasks[0]?.financeMovementId).toBe('paid-aug');
    expect(tasks[0]?.finance?.amount).toBe(199_000);
  });

  it('no duplica si el pago ya está vinculado a una tarea del tablero', () => {
    const tasks = expandCreditsForBoard(
      [credit({ termMonths: 2 })],
      [
        mov({
          dayId: '2026-01-05',
          creditId: 'c1',
          sourceTaskId: 'task-real',
        }),
      ],
      '2026-01-01',
      '2026-01-31'
    );
    expect(tasks).toHaveLength(0);
  });

  it('omite créditos archivados', () => {
    const tasks = expandCreditsForBoard(
      [credit({ archived: true, termMonths: 4 })],
      []
    );
    expect(tasks).toHaveLength(0);
  });

  it('collectTasksCovering expone la cuota con weekId real', () => {
    const rows = expandCreditsForBoard(
      [
        credit({
          startDayId: '2026-09-01',
          dueDay: 5,
          termMonths: 1,
          name: 'Consumo',
        }),
      ],
      []
    );
    const byDay = boardCreditTasksByDay(rows);
    const covering = collectTasksCovering(
      { [BOARD_CREDIT_WEEK_ID]: byDay },
      '2026-09-05'
    );
    expect(covering).toHaveLength(1);
    expect(covering[0]?.weekId).toMatch(/^2026-W\d{2}$/);
    expect(covering[0]?.weekId).not.toBe(BOARD_CREDIT_WEEK_ID);
    expect(covering[0]?.kind).toBe('finance_expense');
  });

  it('agrupa por día para el cubo del store', () => {
    const byDay = boardCreditTasksByDay(
      expandCreditsForBoard(
        [credit({ startDayId: '2026-01-05', dueDay: 5, termMonths: 2 })],
        []
      )
    );
    expect(Object.keys(byDay).sort()).toEqual(['2026-01-05', '2026-02-05']);
    expect(byDay['2026-01-05']?.[0]?.kind).toBe('finance_expense');
  });
});
