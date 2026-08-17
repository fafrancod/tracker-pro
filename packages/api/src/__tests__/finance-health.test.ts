import { describe, it, expect } from 'vitest';
import {
  buildHealthSnapshot,
  detectAntExpenses,
  evaluateFinancialHealth,
  generateHealthRecommendations,
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
    investmentSide: partial.investmentSide ?? null,
    ticker: partial.ticker ?? null,
    ruleId: null,
    sourceTaskId: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function credit(partial: Partial<FinanceCredit>): FinanceCredit {
  return {
    id: 'c1',
    currency: 'CLP',
    kind: 'consumer',
    dueDay: 5,
    startDayId: '2026-01-05',
    termMonths: 24,
    name: 'Consumo',
    principal: 2_000_000,
    monthlyInstallment: 400_000,
    notes: '',
    archived: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('motor de salud (sin red)', () => {
  it('déficit + DTI > 30 % → dos recs fuertes', () => {
    const snapshot = buildHealthSnapshot({
      monthId: '2026-08',
      reportingCurrency: 'CLP',
      credits: [credit({ monthlyInstallment: 400_000 })],
      movements: [
        mov({ id: 'in', flow: 'income', title: 'Sueldo', amount: 1_000_000 }),
        mov({
          id: 'out',
          flow: 'expense',
          title: 'Arriendo',
          amount: 1_200_000,
          category: 'housing',
        }),
      ],
    });
    expect(snapshot.savingsRate).toBeLessThan(0);
    expect(snapshot.debtToIncomeRatio).toBeGreaterThan(30);

    const recs = generateHealthRecommendations(snapshot);
    const strong = recs.filter(r => r.severity === 'strong');
    expect(strong.map(r => r.id).sort()).toEqual(['rec_deficit', 'rec_high_dti']);

    const score = evaluateFinancialHealth(snapshot);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeLessThan(55);
  });

  it('compra de ETF no es gasto hormiga', () => {
    const etf = mov({
      id: 'etf',
      flow: 'investment',
      title: 'SPY',
      amount: 8,
      currency: 'USD',
      category: 'invest',
      ticker: 'SPY',
      investmentSide: 'buy',
    });
    const coffee = mov({
      id: 'caf1',
      flow: 'expense',
      title: 'Café',
      amount: 8,
      currency: 'USD',
      category: 'leisure',
    });
    const ants = detectAntExpenses(
      [
        etf,
        coffee,
        { ...coffee, id: 'caf2' },
        { ...coffee, id: 'caf3' },
        { ...coffee, id: 'caf4' },
      ],
      '2026-08',
      10
    );
    expect(ants.some(g => g.category === 'invest')).toBe(false);
    expect(ants.some(g => g.title === 'Café')).toBe(true);
  });

  it('score sano cuando hay superávit y sin deuda', () => {
    const snapshot = buildHealthSnapshot({
      monthId: '2026-08',
      reportingCurrency: 'CLP',
      credits: [],
      movements: [
        mov({ id: 'in', flow: 'income', amount: 2_000_000 }),
        mov({
          id: 'food',
          flow: 'expense',
          amount: 400_000,
          category: 'food',
        }),
      ],
    });
    expect(snapshot.savingsRate).toBeGreaterThan(20);
    expect(snapshot.debtToIncomeRatio).toBe(0);
    const recs = generateHealthRecommendations(snapshot);
    expect(recs.filter(r => r.severity === 'strong')).toEqual([]);
    expect(evaluateFinancialHealth(snapshot)).toBeGreaterThanOrEqual(75);
  });
});
