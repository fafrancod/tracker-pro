import type { FinanceMovement } from './types';
import { monthIdFromDayId } from './movementSummary';

export const INSTALLMENT_CHART_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#d97706',
  '#059669',
  '#0891b2',
  '#4f46e5',
  '#dc2626',
  '#0d9488',
  '#ca8a04',
  '#9333ea',
  '#ea580c',
] as const;

export function isInstallmentMovement(mov: FinanceMovement): boolean {
  if (mov.status === 'skipped') return false;
  if (mov.flow !== 'expense') return false;
  if (mov.tag === 'card_payment' || mov.tag === 'goal_contribution') return false;
  return (mov.installmentTotal ?? 0) > 1 || Boolean(mov.installmentGroupId);
}

export function stripInstallmentSuffix(title: string): string {
  return title.replace(/\s*\(\d+\/\d+\)\s*$/u, '').trim();
}

export function installmentProductKey(mov: FinanceMovement): string {
  if (mov.installmentGroupId) return `g:${mov.installmentGroupId}`;
  const base = stripInstallmentSuffix(mov.title);
  return `t:${base || mov.id}`;
}

export function installmentProductLabel(mov: FinanceMovement): string {
  return stripInstallmentSuffix(mov.title) || mov.title || 'Cuota';
}

export function productSegmentKey(productKey: string): string {
  return `prod_${String(productKey).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export interface InstallmentScheduleSegment {
  key: string;
  productKey: string;
  label: string;
  color: string;
  total: number;
}

export interface InstallmentScheduleRow {
  monthId: string;
  monthLabel: string;
  total: number;
  [segmentKey: string]: number | string;
}

export function buildInstallmentSchedule(
  movements: FinanceMovement[],
  monthIds: string[],
  formatMonthLabel: (monthId: string) => string
): { rows: InstallmentScheduleRow[]; segments: InstallmentScheduleSegment[] } {
  const window = new Set(monthIds);
  const installments = movements
    .filter(isInstallmentMovement)
    .filter(mov => window.has(monthIdFromDayId(mov.dayId)))
    .slice()
    .sort((a, b) => a.dayId.localeCompare(b.dayId));

  const totals = new Map<string, { label: string; total: number }>();
  const monthMap = new Map<string, InstallmentScheduleRow>();
  for (const id of monthIds) {
    monthMap.set(id, {
      monthId: id,
      monthLabel: formatMonthLabel(id),
      total: 0,
    });
  }

  for (const mov of installments) {
    const amount = Number(mov.amount) || 0;
    if (!(amount > 0)) continue;
    const productKey = installmentProductKey(mov);
    const segKey = productSegmentKey(productKey);
    const prev = totals.get(productKey) ?? {
      label: installmentProductLabel(mov),
      total: 0,
    };
    prev.total += amount;
    totals.set(productKey, prev);

    const monthId = monthIdFromDayId(mov.dayId);
    const row = monthMap.get(monthId);
    if (!row) continue;
    row.total += amount;
    row[segKey] = (Number(row[segKey]) || 0) + amount;
  }

  const keys = [...totals.keys()].sort((a, b) => a.localeCompare(b));
  const segments: InstallmentScheduleSegment[] = keys.map((productKey, index) => {
    const meta = totals.get(productKey)!;
    return {
      key: productSegmentKey(productKey),
      productKey,
      label: meta.label,
      color: INSTALLMENT_CHART_COLORS[index % INSTALLMENT_CHART_COLORS.length],
      total: meta.total,
    };
  });

  return {
    rows: monthIds.map(id => monthMap.get(id)!),
    segments,
  };
}

export function movementsForAccount(
  movements: FinanceMovement[],
  accountId: string
): FinanceMovement[] {
  return movements.filter(mov => {
    if (mov.status === 'skipped') return false;
    if (mov.accountId === accountId) return true;
    if (mov.cardAccountId === accountId) return true;
    return false;
  });
}
