import type { FinanceMovement, FinanceMovementMonthSummary } from './types';
import { reportingAmountOf } from './fx';

export function monthIdFromDayId(dayId: string): string {
  return dayId.slice(0, 7);
}

export function summarizeMovementsByCurrency(
  movements: FinanceMovement[],
  monthId: string,
  reportingCurrency?: string
): Record<string, FinanceMovementMonthSummary> {
  const out: Record<string, FinanceMovementMonthSummary> = {};
  for (const mov of movements) {
    if (!mov.dayId.startsWith(monthId)) continue;
    if (mov.flow === 'investment') continue;
    if (mov.status === 'skipped') continue;
    if (mov.tag === 'card_payment' || mov.tag === 'goal_contribution') continue;
    const converted = reportingCurrency
      ? reportingAmountOf(mov, reportingCurrency)
      : mov.amount;
    if (converted == null) continue;
    const currency = reportingCurrency || mov.currency || 'EUR';
    const bucket = out[currency] ?? {
      monthId,
      currency,
      confirmedIncome: 0,
      confirmedExpense: 0,
      plannedIncome: 0,
      plannedExpense: 0,
      balance: 0,
    };
    const amount = converted;
    if (mov.status === 'confirmed') {
      if (mov.flow === 'income') bucket.confirmedIncome += amount;
      else bucket.confirmedExpense += amount;
    } else {
      if (mov.flow === 'income') bucket.plannedIncome += amount;
      else bucket.plannedExpense += amount;
    }
    bucket.balance = bucket.confirmedIncome - bucket.confirmedExpense;
    out[currency] = bucket;
  }
  return out;
}
