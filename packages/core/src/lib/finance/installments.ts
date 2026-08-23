import type { FinanceCredit, FinanceMovement } from './types';

export function addMonthsToDayId(dayId: string, months: number): string {
  const [y, m, d] = dayId.split('-').map(Number);
  if (!y || !m || !d) return dayId;
  const base = Date.UTC(y, m - 1 + months, 1);
  const year = new Date(base).getUTCFullYear();
  const month = new Date(base).getUTCMonth();
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function installmentGroupKey(mov: FinanceMovement): string | null {
  if (mov.installmentGroupId && (mov.installmentTotal ?? 0) > 1) {
    return mov.installmentGroupId;
  }
  return null;
}

/** 6 cuotas del mismo grupo cuentan como 1 compra. */
export function countPurchases(movements: FinanceMovement[]): number {
  const seen = new Set<string>();
  let count = 0;
  for (const mov of movements) {
    if (mov.flow !== 'expense') continue;
    if (mov.status === 'skipped') continue;
    const key = installmentGroupKey(mov);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    count += 1;
  }
  return count;
}

export interface FinanceCreditProgress {
  creditId: string;
  paidCount: number;
  remainingCount: number;
  remainingPrincipal: number;
  actualPaid: number;
  expectedTotal: number;
  paidPercentage: number;
}

export function summarizeCreditProgress(
  credit: FinanceCredit,
  movements: FinanceMovement[]
): FinanceCreditProgress {
  let paidCount = 0;
  let actualPaid = 0;
  for (const mov of movements) {
    if (mov.status !== 'confirmed') continue;
    if (mov.creditId !== credit.id) continue;
    paidCount += 1;
    actualPaid += Number(mov.amount) || 0;
  }
  const expectedTotal =
    credit.principal > 0
      ? credit.principal
      : credit.termMonths * credit.monthlyInstallment;
  const remainingCount = Math.max(0, credit.termMonths - paidCount);
  const remainingPrincipal = Math.max(0, expectedTotal - actualPaid);
  const paidPercentage =
    expectedTotal > 0 ? Math.min(100, (actualPaid / expectedTotal) * 100) : 0;
  return {
    creditId: credit.id,
    paidCount,
    remainingCount,
    remainingPrincipal,
    actualPaid,
    expectedTotal,
    paidPercentage,
  };
}

export function simulateExtraPayment(opts: {
  monthlyInstallment: number;
  remainingCount: number;
  extraAmount: number;
  mode: 'term' | 'installment';
}): {
  savedMonths: number;
  newInstallment: number;
  remainingCount: number;
} {
  const cuota = opts.monthlyInstallment;
  const remaining = opts.remainingCount;
  const extra = opts.extraAmount;
  if (!(cuota > 0) || remaining <= 0 || !(extra > 0)) {
    return { savedMonths: 0, newInstallment: cuota, remainingCount: remaining };
  }
  if (opts.mode === 'term') {
    const saved = Math.min(remaining, Math.floor(extra / cuota));
    return {
      savedMonths: saved,
      newInstallment: cuota,
      remainingCount: remaining - saved,
    };
  }
  const leftover = Math.max(0, remaining * cuota - extra);
  const next = leftover / remaining;
  return {
    savedMonths: 0,
    newInstallment: next,
    remainingCount: remaining,
  };
}
