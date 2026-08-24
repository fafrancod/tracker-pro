import { describe, it, expect } from 'vitest';
import {
  buildInstallmentSchedule,
  classifyExpenseKind,
  collectFinanceBanks,
  isValidPaymentInstitution,
  listMonthIds,
  parseFinancePayload,
  summarizeCreditProgress,
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
  it('reutiliza bancos ya guardados en otros medios', () => {
    expect(
      collectFinanceBanks(
        [
          { institution: 'Santander' },
          { institution: 'BCI' },
          { institution: 'Santander' },
          { institution: '' },
        ],
        ['BCI', 'Estado']
      )
    ).toEqual(['BCI', 'Estado', 'Santander']);
  });

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

  it('acumula flujo mes a mes', () => {
    const rows = summarizeMonthlyEvolution(
      [
        mov({
          id: 'in1',
          flow: 'income',
          amount: 100,
          dayId: '2026-07-01',
        }),
        mov({ id: 'e1', amount: 30, dayId: '2026-07-10' }),
        mov({
          id: 'in2',
          flow: 'income',
          amount: 100,
          dayId: '2026-08-01',
        }),
        mov({ id: 'e2', amount: 50, dayId: '2026-08-10' }),
      ],
      { monthIds: ['2026-07', '2026-08'], reportingCurrency: 'CLP' }
    );
    expect(rows[0].cumulative).toBe(70);
    expect(rows[1].cumulative).toBe(120);
  });
});

describe('calendario de cuotas (Meteora)', () => {
  it('apila por compra (groupId) y no cuenta pagos de tarjeta', () => {
    const rows = [
      mov({
        id: 'c1',
        title: 'Notebook (1/3)',
        amount: 80_000,
        dayId: '2026-07-05',
        installmentGroupId: 'g-nb',
        installmentIndex: 1,
        installmentTotal: 3,
      }),
      mov({
        id: 'c2',
        title: 'Notebook (2/3)',
        amount: 80_000,
        dayId: '2026-08-05',
        installmentGroupId: 'g-nb',
        installmentIndex: 2,
        installmentTotal: 3,
      }),
      mov({
        id: 'pay',
        title: 'Pago de Visa',
        amount: 200_000,
        dayId: '2026-08-15',
        tag: 'card_payment',
        cardAccountId: 'visa',
      }),
    ];
    const model = buildInstallmentSchedule(rows, ['2026-07', '2026-08'], id => id);
    expect(model.segments).toHaveLength(1);
    expect(model.segments[0].label).toBe('Notebook');
    expect(model.rows[0].total).toBe(80_000);
    expect(model.rows[1].total).toBe(80_000);
  });
});

describe('crédito: pagado vs resta', () => {
  it('resta el capital con los pagos reales, no solo el conteo de cuotas', () => {
    const progress = summarizeCreditProgress(
      credit({
        principal: 1_200_000,
        monthlyInstallment: 100_000,
        termMonths: 12,
      }),
      [
        mov({
          id: 'p1',
          amount: 100_000,
          creditId: 'c1',
          tag: 'credit_payment',
          dayId: '2026-01-05',
        }),
        mov({
          id: 'p2',
          amount: 150_000,
          creditId: 'c1',
          tag: 'credit_payment',
          dayId: '2026-02-05',
        }),
      ]
    );
    expect(progress.paidCount).toBe(2);
    expect(progress.actualPaid).toBe(250_000);
    expect(progress.remainingPrincipal).toBe(950_000);
    expect(progress.remainingCount).toBe(10);
  });
});

describe('evolución: no duplicar crédito pagado', () => {
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

describe('adjuntos de movimiento', () => {
  it('conserva data URLs de imagen y descarta URLs externas', () => {
    const jpeg =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z';
    const parsed = parseFinancePayload({
      title: 'Ticket',
      amount: 1200,
      images: [jpeg, 'http://evil.example/x.png'],
    });
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images?.[0]).toContain('data:image/jpeg');
  });
});
