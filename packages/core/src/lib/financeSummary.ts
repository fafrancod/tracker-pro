import type {
  FinanceEntry,
  FinanceMonthSummary,
} from '../types';

/** YYYY-MM */
export function monthIdFromDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/**
 * How many times a weekly recurring entry lands in the given month.
 * recurrenceDay: 0=Sun … 6=Sat (JS Date.getDay).
 */
function weeklyOccurrencesInMonth(
  year: number,
  monthIndex0: number,
  weekday: number
): number {
  const dim = daysInMonth(year, monthIndex0);
  let count = 0;
  for (let day = 1; day <= dim; day++) {
    if (new Date(year, monthIndex0, day).getDay() === weekday) count += 1;
  }
  return count;
}

function entryAppliesToMonth(entry: FinanceEntry, monthId: string): boolean {
  if (!entry.active) return false;
  if (entry.kind === 'recurring') return true;
  if (!entry.entryDate) return false;
  return entry.entryDate.startsWith(monthId);
}

/**
 * Monthly rollup for the finances board.
 * Recurring monthly = amount × 1; weekly = amount × weeks-in-month.
 * Expected + specific only count if their date falls in the month.
 */
export function summarizeFinanceMonth(
  entries: FinanceEntry[],
  monthId: string
): FinanceMonthSummary {
  const [ys, ms] = monthId.split('-');
  const year = Number(ys);
  const monthIndex0 = Number(ms) - 1;
  const currency =
    entries.find(e => e.active)?.currency ??
    entries[0]?.currency ??
    'EUR';

  let incomeRecurring = 0;
  let incomeExpected = 0;
  let incomeSpecific = 0;
  let expenseRecurring = 0;
  let expenseExpected = 0;
  let expenseSpecific = 0;

  for (const e of entries) {
    if (!entryAppliesToMonth(e, monthId)) continue;
    let amount = e.amount;
    if (e.kind === 'recurring') {
      if (e.frequency === 'weekly') {
        const wd = Math.min(6, Math.max(0, e.recurrenceDay ?? 1));
        amount = e.amount * weeklyOccurrencesInMonth(year, monthIndex0, wd);
      }
      // monthly: once per month (day-of-month used for display only)
    }

    if (e.flow === 'income') {
      if (e.kind === 'recurring') incomeRecurring += amount;
      else if (e.kind === 'expected') incomeExpected += amount;
      else incomeSpecific += amount;
    } else {
      if (e.kind === 'recurring') expenseRecurring += amount;
      else if (e.kind === 'expected') expenseExpected += amount;
      else expenseSpecific += amount;
    }
  }

  const totalIncome = incomeRecurring + incomeExpected + incomeSpecific;
  const totalExpense = expenseRecurring + expenseExpected + expenseSpecific;

  return {
    monthId,
    currency,
    incomeRecurring,
    incomeExpected,
    incomeSpecific,
    expenseRecurring,
    expenseExpected,
    expenseSpecific,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}

export function entriesForMonth(
  entries: FinanceEntry[],
  monthId: string
): FinanceEntry[] {
  return entries.filter(e => entryAppliesToMonth(e, monthId));
}
