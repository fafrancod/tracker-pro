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

function emptyBucket(monthId: string, currency: string): FinanceMonthSummary {
  return {
    monthId,
    currency,
    incomeRecurring: 0,
    incomeExpected: 0,
    incomeSpecific: 0,
    expenseRecurring: 0,
    expenseExpected: 0,
    expenseSpecific: 0,
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
  };
}

/**
 * Monthly rollup for the finances board (single currency dominant).
 * Prefer summarizeFinanceMonthByCurrency when mixed currencies.
 */
export function summarizeFinanceMonth(
  entries: FinanceEntry[],
  monthId: string
): FinanceMonthSummary {
  const by = summarizeFinanceMonthByCurrency(entries, monthId);
  const keys = Object.keys(by);
  if (keys.length === 0) return emptyBucket(monthId, 'EUR');
  // Prefer currency with most activity, else first.
  let best = by[keys[0]];
  for (const k of keys) {
    const s = by[k];
    if (s.totalIncome + s.totalExpense > best.totalIncome + best.totalExpense) {
      best = s;
    }
  }
  return best;
}

/** One summary per currency present in the month. */
export function summarizeFinanceMonthByCurrency(
  entries: FinanceEntry[],
  monthId: string
): Record<string, FinanceMonthSummary> {
  const [ys, ms] = monthId.split('-');
  const year = Number(ys);
  const monthIndex0 = Number(ms) - 1;
  const out: Record<string, FinanceMonthSummary> = {};

  for (const e of entries) {
    if (!entryAppliesToMonth(e, monthId)) continue;
    const currency = (e.currency || 'EUR').toUpperCase();
    if (!out[currency]) out[currency] = emptyBucket(monthId, currency);

    let amount = e.amount;
    if (e.kind === 'recurring') {
      if (e.frequency === 'weekly') {
        const wd = Math.min(6, Math.max(0, e.recurrenceDay ?? 1));
        amount = e.amount * weeklyOccurrencesInMonth(year, monthIndex0, wd);
      }
    }

    const s = out[currency];
    if (e.flow === 'income') {
      if (e.kind === 'recurring') s.incomeRecurring += amount;
      else if (e.kind === 'expected') s.incomeExpected += amount;
      else s.incomeSpecific += amount;
      s.totalIncome += amount;
    } else {
      if (e.kind === 'recurring') s.expenseRecurring += amount;
      else if (e.kind === 'expected') s.expenseExpected += amount;
      else s.expenseSpecific += amount;
      s.totalExpense += amount;
    }
    s.balance = s.totalIncome - s.totalExpense;
  }

  return out;
}

export function entriesForMonth(
  entries: FinanceEntry[],
  monthId: string
): FinanceEntry[] {
  return entries.filter(e => entryAppliesToMonth(e, monthId));
}
