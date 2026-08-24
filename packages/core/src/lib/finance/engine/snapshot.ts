import { reportingAmountOf } from '../fx';
import type {
  FinanceCategory,
  FinanceCredit,
  FinanceMovement,
} from '../types';
import { FINANCE_CATEGORIES } from '../types';
import { inferFinanceCategory } from '../payload';
import { getCategoryAllocations } from '../categorySplits';
import type { HealthSnapshot } from './types';

function emptyByCategory(): Record<FinanceCategory, number> {
  return {
    housing: 0,
    food: 0,
    transport: 0,
    health: 0,
    leisure: 0,
    debt: 0,
    invest: 0,
    other: 0,
  };
}

function cashAmount(
  mov: FinanceMovement,
  reportingCurrency?: string
): number | null {
  if (reportingCurrency) return reportingAmountOf(mov, reportingCurrency);
  const n = Number(mov.amount);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function countsTowardHealthCashflow(mov: FinanceMovement): boolean {
  if (mov.status === 'skipped') return false;
  if (mov.flow === 'investment') return false;
  if (mov.tag === 'card_payment' || mov.tag === 'goal_contribution') return false;
  return true;
}

export function resolveMovementCategory(mov: FinanceMovement): FinanceCategory {
  return inferFinanceCategory({
    flow: mov.flow,
    tag: mov.tag,
    category: mov.category ?? null,
  });
}

export function buildHealthSnapshot(opts: {
  movements: FinanceMovement[];
  credits: FinanceCredit[];
  monthId: string;
  reportingCurrency?: string;
}): HealthSnapshot {
  const currency = opts.reportingCurrency || 'EUR';
  let totalIncome = 0;
  let totalExpense = 0;
  let unnecessaryExpense = 0;
  const byCategory = emptyByCategory();

  for (const mov of opts.movements) {
    if (!mov.dayId.startsWith(opts.monthId)) continue;
    if (!countsTowardHealthCashflow(mov)) continue;
    const amount = cashAmount(mov, opts.reportingCurrency);
    if (amount == null) continue;
    if (mov.flow === 'income') {
      totalIncome += amount;
      continue;
    }
    if (mov.flow !== 'expense') continue;
    totalExpense += amount;
    const allocations = getCategoryAllocations(mov);
    const splitSum = allocations.reduce((s, a) => s + a.amount, 0);
    if (allocations.length > 0 && splitSum > 0) {
      for (const alloc of allocations) {
        const share = amount * (alloc.amount / splitSum);
        const key = alloc.groupKey ?? resolveMovementCategory(mov);
        byCategory[key] += share;
        if (key === 'leisure') unnecessaryExpense += share;
      }
    } else {
      const category = resolveMovementCategory(mov);
      byCategory[category] += amount;
      if (category === 'leisure') unnecessaryExpense += amount;
    }
  }

  const monthlyDebt = opts.credits
    .filter(c => !c.archived)
    .reduce((sum, c) => sum + (Number(c.monthlyInstallment) || 0), 0);

  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
  const debtToIncomeRatio =
    totalIncome > 0
      ? (monthlyDebt / totalIncome) * 100
      : monthlyDebt > 0
        ? 100
        : 0;
  const unnecessaryExpenseRatio =
    totalExpense > 0 ? (unnecessaryExpense / totalExpense) * 100 : 0;

  return {
    monthId: opts.monthId,
    currency,
    totalIncome,
    totalExpense,
    balance,
    savingsRate,
    monthlyDebt,
    debtToIncomeRatio,
    unnecessaryExpense,
    unnecessaryExpenseRatio,
    byCategory,
  };
}

export function isKnownCategory(raw: string): raw is FinanceCategory {
  return (FINANCE_CATEGORIES as readonly string[]).includes(raw);
}
