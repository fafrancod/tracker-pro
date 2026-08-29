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
  cumulative: number;
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

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

export function creditDueDateOnMonth(
  year: number,
  monthIndex0: number,
  dueDay: number
): string {
  const dim = daysInMonth(year, monthIndex0);
  const day = Math.min(Math.max(1, dueDay), dim);
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Primera cuota en o después de startDayId, en el día de vencimiento. */
export function firstCreditDueDayId(credit: FinanceCredit): string {
  const [ys, ms] = credit.startDayId.split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m) return credit.startDayId;
  const inStartMonth = creditDueDateOnMonth(y, m - 1, credit.dueDay);
  if (inStartMonth >= credit.startDayId) return inStartMonth;
  const nextMonthIndex = m; // 0-based next (m is 1-based)
  const year = nextMonthIndex >= 12 ? y + 1 : y;
  const monthIndex0 = nextMonthIndex % 12;
  return creditDueDateOnMonth(year, monthIndex0, credit.dueDay);
}

export function creditInstallmentDayId(
  credit: FinanceCredit,
  index0: number
): string {
  const first = firstCreditDueDayId(credit);
  const [ys, ms] = first.split('-').map(Number);
  const monthIndex = (ms - 1) + Math.max(0, Math.floor(index0) || 0);
  const year = ys + Math.floor(monthIndex / 12);
  const monthIndex0 = ((monthIndex % 12) + 12) % 12;
  return creditDueDateOnMonth(year, monthIndex0, credit.dueDay);
}

export function virtualCreditMovement(
  credit: FinanceCredit,
  dayId: string
): FinanceMovement {
  return {
    id: `fcr:${credit.id}:${dayId}`,
    dayId,
    purchaseDayId: dayId,
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

export function expandFinanceCredits(
  credits: FinanceCredit[],
  movements: FinanceMovement[],
  fromDayId: string,
  toDayId: string
): FinanceMovement[] {
  const paid = new Map<string, Set<string>>();
  for (const mov of movements) {
    if (!mov.creditId || mov.status === 'skipped' || mov.flow !== 'expense') {
      continue;
    }
    const set = paid.get(mov.creditId) ?? new Set<string>();
    set.add(monthIdFromDayId(mov.dayId));
    paid.set(mov.creditId, set);
  }
  const extra: FinanceMovement[] = [];
  for (const credit of credits) {
    if (credit.archived) continue;
    const seen = paid.get(credit.id) ?? new Set<string>();
    for (let i = 0; i < credit.termMonths; i += 1) {
      const dayId = creditInstallmentDayId(credit, i);
      if (dayId < fromDayId || dayId > toDayId) continue;
      if (seen.has(monthIdFromDayId(dayId))) continue;
      extra.push(virtualCreditMovement(credit, dayId));
    }
  }
  return extra;
}

/** Cuotas de crédito aún no registradas, dentro de la ventana de meses. */
export function synthesizeCreditSchedule(
  credits: FinanceCredit[],
  movements: FinanceMovement[],
  monthIds: Iterable<string>
): FinanceMovement[] {
  const window = monthIds instanceof Set ? monthIds : new Set(monthIds);
  const sorted = [...window].sort();
  if (sorted.length === 0) return [];
  const from = `${sorted[0]}-01`;
  const [ys, ms] = sorted[sorted.length - 1]!.split('-').map(Number);
  const to = creditDueDateOnMonth(ys, (ms || 1) - 1, 31);
  return expandFinanceCredits(credits, movements, from, to).filter(mov =>
    window.has(monthIdFromDayId(mov.dayId))
  );
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
      cumulative: 0,
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
  let run = 0;
  for (const monthId of monthIds) {
    const bucket = byMonth.get(monthId)!;
    run += bucket.income - bucket.expense;
    bucket.cumulative = run;
  }
  return monthIds.map(id => byMonth.get(id)!);
}
