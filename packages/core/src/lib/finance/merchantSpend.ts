import type { FinanceCategory, FinanceMerchant, FinanceMovement } from './types';
import { reportingAmountOf } from './fx';
import { inferFinanceCategory } from './payload';
import { getCategoryAllocations } from './categorySplits';
import { addMonthsToDayId } from './installments';

export interface MerchantCategorySlice {
  categoryId: string | null;
  groupKey: FinanceCategory;
  amount: number;
}

export interface MerchantSpendSummary {
  merchantId: string;
  total: number;
  count: number;
  byCategory: MerchantCategorySlice[];
}

/** Primer día del mes, N meses antes de todayDayId (N=2 → ventana de 3 meses). */
export function merchantSpendFromDayId(todayDayId: string, monthsBack = 2): string {
  const firstOfMonth = `${todayDayId.slice(0, 7)}-01`;
  return addMonthsToDayId(firstOfMonth, -monthsBack);
}

function countsTowardMerchantSpend(mov: FinanceMovement): boolean {
  if (mov.status !== 'confirmed') return false;
  if (mov.flow !== 'expense') return false;
  if (mov.tag === 'card_payment' || mov.tag === 'goal_contribution') return false;
  return Boolean(mov.merchantId);
}

export function summarizeMerchantSpend(
  movements: FinanceMovement[],
  opts: {
    fromDayId: string;
    toDayId: string;
    reportingCurrency: string;
  }
): Record<string, MerchantSpendSummary> {
  const out: Record<string, MerchantSpendSummary> = {};
  for (const mov of movements) {
    if (!countsTowardMerchantSpend(mov)) continue;
    if (mov.dayId < opts.fromDayId || mov.dayId > opts.toDayId) continue;
    const merchantId = mov.merchantId;
    if (!merchantId) continue;
    const amount = reportingAmountOf(mov, opts.reportingCurrency);
    if (amount == null || amount <= 0) continue;
    const bucket = out[merchantId] ?? {
      merchantId,
      total: 0,
      count: 0,
      byCategory: [],
    };
    bucket.total += amount;
    bucket.count += 1;
    const allocations = getCategoryAllocations(mov);
    if (allocations.length > 0) {
      const scale = mov.amount > 0 ? amount / mov.amount : 1;
      for (const alloc of allocations) {
        const sliceAmount = alloc.amount * scale;
        const groupKey = alloc.groupKey ?? inferFinanceCategory(mov);
        const existing = bucket.byCategory.find(
          s => s.categoryId === alloc.categoryId && s.groupKey === groupKey
        );
        if (existing) existing.amount += sliceAmount;
        else {
          bucket.byCategory.push({
            categoryId: alloc.categoryId,
            groupKey,
            amount: sliceAmount,
          });
        }
      }
    } else {
      const groupKey = inferFinanceCategory(mov);
      const existing = bucket.byCategory.find(
        s => !s.categoryId && s.groupKey === groupKey
      );
      if (existing) existing.amount += amount;
      else {
        bucket.byCategory.push({
          categoryId: mov.categoryId ?? null,
          groupKey,
          amount,
        });
      }
    }
    out[merchantId] = bucket;
  }
  for (const bucket of Object.values(out)) {
    bucket.byCategory.sort((a, b) => b.amount - a.amount);
  }
  return out;
}

export function rankMerchantsBySpend(
  merchants: FinanceMerchant[],
  spend: Record<string, MerchantSpendSummary>
): Array<FinanceMerchant & { spend: MerchantSpendSummary }> {
  return merchants
    .map(merchant => ({
      ...merchant,
      spend: spend[merchant.id] ?? {
        merchantId: merchant.id,
        total: 0,
        count: 0,
        byCategory: [],
      },
    }))
    .sort((a, b) => b.spend.total - a.spend.total || a.name.localeCompare(b.name));
}
