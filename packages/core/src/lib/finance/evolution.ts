import type { FinanceCredit, FinanceMovement } from './types';
import { addMonthsToDayId } from './installments';
import { monthIdFromDayId } from './movementSummary';
import { reportingAmountOf } from './fx';

export type ExpenseKind = 'unit' | 'installment' | 'recurring' | 'credit';

export interface MonthlyEvolutionRow {
  monthId: string;
  income: number;
  expense: number;
  expenseUnit: number;
  expenseInstallment: number;
  expenseRecurring: number;
  expenseCredit: number;
}

export function listMonthIds(endMonthId: string, count: number): string[] {
  const safeCount = Math.max(1, Math.min(36, Math.floor(count) || 12));
  const end = `${endMonthId}-01`;
  const ids: string[] = [];
  for (let i = safeCount - 1; i >= 0; i--) {
    ids.push(monthIdFromDayId(addMonthsToDayId(end, -i)));
  }
  return ids;
}

export function classifyExpenseKind(
  mov: FinanceMovement
): ExpenseKind | null {
  if (mov.flow !== 'expense') return null;
  if (mov.status === 'skipped') return null;
  if (mov.tag === 'card_payment' || mov.tag === 'goal_contribution') {
    return null;
  }
  if (mov.creditId || mov.tag === 'credit_payment') return 'credit';
  if ((mov.installmentTotal ?? 0) > 1 || mov.installmentGroupId) {
    return 'installment';
  }
  if (mov.ruleId) return 'recurring';
  return 'unit';
}

function virtualCreditMovement(
  credit: FinanceCredit,
  dayId: string
): FinanceMovement {
  return {
    id: `fcr:${credit.id}:${dayId.slice(0, 7)}`,
    dayId,
    flow: 'expense',
    status: 'planned',
    currency: credit.currency,
    title: credit.name,
    amount: credit.monthlyInstallment,
    notes: credit.notes,
    certainty: 'fixed',
    accountId: null,
    cardAccountId: null,
    goalId: null,
    creditId: credit.id,
    installmentGroupId: null,
    installmentIndex: null,
    installmentTotal: null,
    tag: 'credit_payment',
    originalAmount: credit.monthlyInstallment,
    originalCurrency: credit.currency,
    exchangeRate: null,
    fxPending: false,
    reportingCurrency: null,
    ruleId: null,
    sourceTaskId: null,
    virtual: true,
    createdAt: credit.createdAt,
    updatedAt: credit.updatedAt,
  };
}

/** Cuotas de crédito aún no registradas, dentro de la ventana de meses. */
export function synthesizeCreditSchedule(
  credits: FinanceCredit[],
  movements: FinanceMovement[],
  monthIds: Iterable<string>
): FinanceMovement[] {
  const window = monthIds instanceof Set ? monthIds : new Set(monthIds);
  const paid = new Map<string, Set<string>>();
  for (const mov of movements) {
    if (!mov.creditId) continue;
    if (mov.status === 'skipped') continue;
    if (mov.flow !== 'expense') continue;
    const set = paid.get(mov.creditId) ?? new Set<string>();
    set.add(monthIdFromDayId(mov.dayId));
    paid.set(mov.creditId, set);
  }
  const extra: FinanceMovement[] = [];
  for (const credit of credits) {
    if (credit.archived) continue;
    const seen = paid.get(credit.id) ?? new Set<string>();
    for (let i = 0; i < credit.termMonths; i++) {
      const dayId = addMonthsToDayId(credit.startDayId, i);
      const monthId = monthIdFromDayId(dayId);
      if (!window.has(monthId) || seen.has(monthId)) continue;
      extra.push(virtualCreditMovement(credit, dayId));
    }
  }
  return extra;
}

export function summarizeMonthlyEvolution(
  movements: FinanceMovement[],
  opts: {
    monthIds: string[];
    reportingCurrency?: string;
    credits?: FinanceCredit[];
  }
): MonthlyEvolutionRow[] {
  const monthIds = opts.monthIds;
  const extra =
    opts.credits && opts.credits.length > 0
      ? synthesizeCreditSchedule(opts.credits, movements, monthIds)
      : [];
  const all = extra.length > 0 ? [...movements, ...extra] : movements;
  const byMonth = new Map<string, MonthlyEvolutionRow>();
  for (const monthId of monthIds) {
    byMonth.set(monthId, {
      monthId,
      income: 0,
      expense: 0,
      expenseUnit: 0,
      expenseInstallment: 0,
      expenseRecurring: 0,
      expenseCredit: 0,
    });
  }
  for (const mov of all) {
    if (mov.status === 'skipped') continue;
    if (mov.flow === 'investment') continue;
    const monthId = monthIdFromDayId(mov.dayId);
    const bucket = byMonth.get(monthId);
    if (!bucket) continue;
    const amount = opts.reportingCurrency
      ? reportingAmountOf(mov, opts.reportingCurrency)
      : mov.amount;
    if (amount == null) continue;
    if (mov.flow === 'income') {
      bucket.income += amount;
      continue;
    }
    const kind = classifyExpenseKind(mov);
    if (!kind) continue;
    bucket.expense += amount;
    if (kind === 'installment') bucket.expenseInstallment += amount;
    else if (kind === 'recurring') bucket.expenseRecurring += amount;
    else if (kind === 'credit') bucket.expenseCredit += amount;
    else bucket.expenseUnit += amount;
  }
  return monthIds.map(id => byMonth.get(id)!);
}
