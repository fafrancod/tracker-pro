import type {
  FinanceCategorySplit,
  FinanceCredit,
  FinanceMovement,
} from './types';
import { normalizeCategorySplits } from './categorySplits';

const ZERO_DECIMAL_CURRENCIES = new Set(['CLP', 'JPY', 'KRW', 'VND']);

/**
 * Divide a purchase in the smallest unit of its currency. The first installments
 * receive any remainder so every generated row adds up exactly to the purchase.
 */
export function installmentAmountAt(
  totalAmount: number,
  installmentIndex: number,
  installmentTotal: number,
  currency: string
): number {
  const total = Math.max(1, Math.floor(installmentTotal || 1));
  const index = Math.min(total, Math.max(1, Math.floor(installmentIndex || 1)));
  const precision = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
  const factor = 10 ** precision;
  const totalMinor = Math.round(Math.max(0, Number(totalAmount) || 0) * factor);
  const base = Math.floor(totalMinor / total);
  const remainder = totalMinor % total;
  return (base + (index <= remainder ? 1 : 0)) / factor;
}

/** Keep a category allocation proportional when its purchase is materialized in installments. */
export function scaleCategorySplitsForInstallment(
  splits: FinanceCategorySplit[] | undefined,
  purchaseAmount: number,
  installmentAmount: number
): FinanceCategorySplit[] {
  const normalized = normalizeCategorySplits(splits);
  const total = Number(purchaseAmount) || 0;
  if (normalized.length === 0 || total <= 0) return normalized;
  const ratio = installmentAmount / total;
  return normalized.map(split => ({ ...split, amount: split.amount * ratio }));
}

export function installmentTitle(
  title: string,
  installmentIndex: number,
  installmentTotal: number
): string {
  if (installmentTotal <= 1) return title;
  return `${title} · Cuota ${installmentIndex} de ${installmentTotal}`;
}

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

export interface FinanceInstallmentPurchaseSummary {
  groupId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  totalInstallments: number;
  paidInstallments: number;
}

/**
 * A materialized installment row can be confirmed before its due month. Payment
 * progress therefore only counts confirmed rows due on or before the supplied day.
 */
export function summarizeInstallmentPurchases(
  movements: FinanceMovement[],
  throughDayId: string
): Map<string, FinanceInstallmentPurchaseSummary> {
  const accumulators = new Map<
    string,
    Omit<FinanceInstallmentPurchaseSummary, 'remainingAmount'>
  >();
  for (const movement of movements) {
    const groupId = installmentGroupKey(movement);
    if (!groupId || movement.status === 'skipped') continue;
    const current = accumulators.get(groupId) ?? {
      groupId,
      totalAmount: 0,
      paidAmount: 0,
      totalInstallments: 0,
      paidInstallments: 0,
    };
    const amount = Number(movement.amount) || 0;
    current.totalAmount += amount;
    current.totalInstallments = Math.max(
      current.totalInstallments,
      movement.installmentTotal ?? 0
    );
    if (movement.status === 'confirmed' && movement.dayId <= throughDayId) {
      current.paidAmount += amount;
      current.paidInstallments += 1;
    }
    accumulators.set(groupId, current);
  }
  return new Map(
    [...accumulators.entries()].map(([groupId, current]) => [
      groupId,
      {
        ...current,
        remainingAmount: Math.max(0, current.totalAmount - current.paidAmount),
      },
    ])
  );
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
