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

/**
 * Compra con tarjeta en el mes 1 → la cuota N vence el mismo día, N meses después.
 * Cuota 1 = fecha de compra + 1 mes.
 */
export function installmentDueDayId(
  purchaseDayId: string,
  installmentIndex: number
): string {
  const index = Math.max(1, Math.floor(installmentIndex) || 1);
  return addMonthsToDayId(purchaseDayId, index);
}

export function resolveInstallmentPurchaseDayId(
  instances: Array<
    Pick<FinanceMovement, 'purchaseDayId' | 'dayId' | 'installmentIndex'>
  >
): string | null {
  const fromPayload = instances.find(item => item.purchaseDayId)?.purchaseDayId;
  if (fromPayload) return fromPayload;
  const first = instances.find(item => (item.installmentIndex ?? 0) === 1);
  if (first) return addMonthsToDayId(first.dayId, -1);
  const earliest = [...instances].sort((a, b) => a.dayId.localeCompare(b.dayId))[0];
  return earliest ? addMonthsToDayId(earliest.dayId, -1) : null;
}

/** Cuántas cuotas ya vencieron (fecha de cuota <= hoy), da igual el estado confirmed. */
export function countElapsedInstallments(
  purchaseDayId: string,
  totalInstallments: number,
  throughDayId: string
): number {
  const total = Math.max(0, Math.floor(totalInstallments) || 0);
  let paid = 0;
  for (let i = 1; i <= total; i += 1) {
    if (installmentDueDayId(purchaseDayId, i) <= throughDayId) paid += 1;
  }
  return paid;
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
 * Pagado = cuotas cuya fecha de vencimiento (compra + N meses) ya llegó.
 * Confirmar la compra no adelanta el conteo: la cuota 1 vence al mes siguiente.
 */
export function summarizeInstallmentPurchases(
  movements: FinanceMovement[],
  throughDayId: string
): Map<string, FinanceInstallmentPurchaseSummary> {
  const groups = new Map<string, FinanceMovement[]>();
  for (const movement of movements) {
    const groupId = installmentGroupKey(movement);
    if (!groupId || movement.status === 'skipped') continue;
    const list = groups.get(groupId) ?? [];
    list.push(movement);
    groups.set(groupId, list);
  }
  const out = new Map<string, FinanceInstallmentPurchaseSummary>();
  for (const [groupId, rows] of groups) {
    const purchaseDayId = resolveInstallmentPurchaseDayId(rows);
    const totalInstallments = Math.max(
      ...rows.map(row => row.installmentTotal ?? 0),
      rows.length
    );
    const totalAmount = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    let paidAmount = 0;
    let paidInstallments = 0;
    if (purchaseDayId) {
      paidInstallments = countElapsedInstallments(
        purchaseDayId,
        totalInstallments,
        throughDayId
      );
      for (const row of rows) {
        const index = row.installmentIndex ?? 0;
        if (index < 1) continue;
        if (installmentDueDayId(purchaseDayId, index) <= throughDayId) {
          paidAmount += Number(row.amount) || 0;
        }
      }
    }
    out.set(groupId, {
      groupId,
      totalAmount,
      paidAmount,
      remainingAmount: Math.max(0, totalAmount - paidAmount),
      totalInstallments,
      paidInstallments,
    });
  }
  return out;
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
