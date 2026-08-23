import { describe, it, expect } from 'vitest';
import {
  classifyExpenseKind,
  isValidPaymentInstitution,
  listMonthIds,
  summarizeMonthlyEvolution,
  type FinanceCredit,
  type FinanceMovement,
} from '@daily-tracker/core';

function mov(partial: Partial<FinanceMovement>): FinanceMovement {
  return {
    id: partial.id ?? 'm1',
    dayId: partial.dayId ?? '2026-08-10',
    flow: partial.flow ?? 'expense',
    status: partial.status ?? 'confirmed',
    currency: partial.currency ?? 'CLP',
    title: partial.title ?? 'Gasto',
    amount: partial.amount ?? 0,
    notes: '',
    certainty: 'fixed',
    accountId: null,
    cardAccountId: null,
    goalId: null,
    creditId: null,
    installmentGroupId: null,
    installmentIndex: null,
    installmentTotal: null,
    tag: partial.tag ?? null,
    originalAmount: partial.amount ?? 0,
    originalCurrency: 'CLP',
    exchangeRate: null,
    fxPending: false,
    reportingCurrency: 'CLP',
    category: partial.category ?? null,
    ruleId: null,
    sourceTaskId: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function credit(partial: Partial<FinanceCredit> = {}): FinanceCredit {
  return {
    id: 'c1',
    currency: 'CLP',
    kind: 'consumer',
    dueDay: 5,
    startDayId: '2026-01-05',
    termMonths: 12,
    name: 'Consumo',
    principal: 2_400_000,
    monthlyInstallment: 200_000,
    notes: '',
    archived: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('medios de pago: banco', () => {
  it('efectivo no exige banco; débito y crédito sí', () => {
    expect(isValidPaymentInstitution('cash', '')).toBe(true);
    expect(isValidPaymentInstitution('cash', 'Banco Estado')).toBe(true);
    expect(isValidPaymentInstitution('debit', '')).toBe(false);
    expect(isValidPaymentInstitution('credit', '  ')).toBe(false);
    expect(isValidPaymentInstitution('debit', 'Santander')).toBe(true);
    expect(isValidPaymentInstitution('credit', 'BCI')).toBe(true);
  });
});

describe('evolución de pagos', () => {
  it('lista 12 meses hacia atrás inclusive', () => {
    expect(listMonthIds('2026-08', 12)[0]).toBe('2025-09');
    expect(listMonthIds('2026-08', 12)[11]).toBe('2026-08');
  });

  it('clasifica unitario, cuota, mensual y crédito', () => {
    expect(classifyExpenseKind(mov({ title: 'Café', amount: 3000 }))).toBe(
      'unit'
    );
    expect(
      classifyExpenseKind(
        mov({
          title: 'TV',
          amount: 50_000,
          installmentTotal: 6,
          installmentGroupId: 'g1',
        })
      )
    ).toBe('installment');
    expect(
      classifyExpenseKind(mov({ title: 'Luz', amount: 40_000, ruleId: 'r1' }))
    ).toBe('recurring');
    expect(
      classifyExpenseKind(
        mov({
          title: 'Hipoteca',
          amount: 500_000,
          creditId: 'c1',
          tag: 'credit_payment',
        })
      )
    ).toBe('credit');
    expect(
      classifyExpenseKind(mov({ tag: 'card_payment', amount: 80_000 }))
    ).toBeNull();
  });

  it('suma ingresos y gastos del mes: cuotas, mensuales, créditos y unitarios', () => {
    const rows = summarizeMonthlyEvolution(
      [
        mov({
          id: 'in',
          flow: 'income',
          title: 'Sueldo',
          amount: 1_000_000,
          dayId: '2026-08-01',
        }),
        mov({
          id: 'u',
          title: 'Café',
          amount: 3_000,
          dayId: '2026-08-02',
        }),
        mov({
          id: 'q',
          title: 'Notebook',
          amount: 80_000,
          dayId: '2026-08-05',
          installmentTotal: 6,
          installmentGroupId: 'g-nb',
          installmentIndex: 2,
        }),
        mov({
          id: 'luz',
          title: 'Electricidad',
          amount: 45_000,
          dayId: '2026-08-12',
          ruleId: 'rule-luz',
        }),
        mov({
          id: 'hip',
          title: 'Hipoteca',
          amount: 400_000,
          dayId: '2026-08-05',
          creditId: 'c-hip',
          tag: 'credit_payment',
        }),
        mov({
          id: 'skip',
          title: 'Anulado',
          amount: 9_999,
          dayId: '2026-08-03',
          status: 'skipped',
        }),
      ],
      { monthIds: ['2026-08'], reportingCurrency: 'CLP' }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].income).toBe(1_000_000);
    expect(rows[0].expenseUnit).toBe(3_000);
    expect(rows[0].expenseInstallment).toBe(80_000);
    expect(rows[0].expenseRecurring).toBe(45_000);
    expect(rows[0].expenseCredit).toBe(400_000);
    expect(rows[0].expense).toBe(528_000);
  });

  it('incluye la cuota hipotecaria o de consumo si no hay movimiento ese mes', () => {
    const rows = summarizeMonthlyEvolution(
      [
        mov({
          id: 'in',
          flow: 'income',
          title: 'Sueldo',
          amount: 2_000_000,
          dayId: '2026-08-01',
        }),
      ],
      {
        monthIds: ['2026-08'],
        reportingCurrency: 'CLP',
        credits: [
          credit({
            id: 'hip',
            kind: 'mortgage',
            name: 'Hipoteca',
            startDayId: '2026-01-05',
            termMonths: 24,
            monthlyInstallment: 550_000,
          }),
        ],
      }
    );
    expect(rows[0].expenseCredit).toBe(550_000);
    expect(rows[0].expense).toBe(550_000);
  });

  it('no duplica el crédito si ya hay pago registrado en el mes', () => {
    const rows = summarizeMonthlyEvolution(
      [
        mov({
          id: 'pago',
          title: 'Cuota hipoteca',
          amount: 550_000,
          dayId: '2026-08-05',
          creditId: 'hip',
          tag: 'credit_payment',
        }),
      ],
      {
        monthIds: ['2026-08'],
        reportingCurrency: 'CLP',
        credits: [
          credit({
            id: 'hip',
            kind: 'mortgage',
            monthlyInstallment: 550_000,
            startDayId: '2026-01-05',
          }),
        ],
      }
    );
    expect(rows[0].expenseCredit).toBe(550_000);
  });
});
