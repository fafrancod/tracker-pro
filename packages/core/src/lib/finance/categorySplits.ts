import type { FinanceCategory, FinanceCategorySplit, FinanceMovement } from './types';
import { FINANCE_CATEGORIES } from './types';

const EPSILON = 0.0001;

function finitePositiveAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function newCategorySplitId(): string {
  const rnd =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `split_${rnd.replace(/-/g, '').slice(0, 20)}`;
}

export function splitMatchTolerance(total: number): number {
  return total >= 100 ? 1 : 0.01;
}

export function normalizeCategorySplits(
  splits:
    | Array<Partial<FinanceCategorySplit> & { categoryId?: string; amount?: number }>
    | undefined
    | null
): FinanceCategorySplit[] {
  if (!Array.isArray(splits)) return [];
  return splits
    .map((split, index) => {
      const categoryId = String(split?.categoryId ?? '').trim().slice(0, 80);
      const groupRaw = split?.groupKey;
      const groupKey: FinanceCategory | undefined =
        typeof groupRaw === 'string' &&
        (FINANCE_CATEGORIES as readonly string[]).includes(groupRaw)
          ? (groupRaw as FinanceCategory)
          : (FINANCE_CATEGORIES as readonly string[]).includes(categoryId)
            ? (categoryId as FinanceCategory)
            : undefined;
      return {
        id: String(split?.id || `split-${index}`).slice(0, 80),
        categoryId,
        groupKey,
        amount: finitePositiveAmount(split?.amount),
      };
    })
    .filter(split => split.categoryId && split.amount > 0);
}

export function getCategoryAllocations(
  mov: Pick<FinanceMovement, 'amount' | 'categoryId' | 'category' | 'categorySplits'>
): FinanceCategorySplit[] {
  const splits = normalizeCategorySplits(mov.categorySplits);
  if (splits.length > 0) return splits;
  const amount = finitePositiveAmount(mov.amount);
  const categoryId = String(mov.categoryId || mov.category || '').trim();
  if (!categoryId || amount <= 0) return [];
  const groupKey: FinanceCategory | undefined =
    mov.category ??
    ((FINANCE_CATEGORIES as readonly string[]).includes(categoryId)
      ? (categoryId as FinanceCategory)
      : undefined);
  return [
    {
      id: 'primary',
      categoryId,
      groupKey,
      amount,
    },
  ];
}

export function getAmountForCategory(
  mov: Pick<FinanceMovement, 'amount' | 'categoryId' | 'category' | 'categorySplits'>,
  categoryId: string
): number {
  if (!categoryId) return finitePositiveAmount(mov.amount);
  return getCategoryAllocations(mov)
    .filter(split => split.categoryId === categoryId)
    .reduce((sum, split) => sum + split.amount, 0);
}

export function categorySplitsRemaining(
  splits: Array<{ amount?: number | string | null }>,
  total: number
): number {
  const allocated = splits.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0
  );
  return total - allocated;
}

export function categorySplitsMatchTotal(
  splits: FinanceCategorySplit[] | undefined,
  total: number
): boolean {
  const normalized = normalizeCategorySplits(splits);
  if (normalized.length === 0) return false;
  const splitTotal = normalized.reduce((sum, split) => sum + split.amount, 0);
  return Math.abs(splitTotal - total) <= Math.max(splitMatchTolerance(total), EPSILON);
}
