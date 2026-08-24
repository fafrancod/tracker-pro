import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/components/ui/decimal-input';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import {
  categorySplitsRemaining,
  newCategorySplitId,
  splitMatchTolerance,
  type FinanceCategory,
  type FinanceUserCategory,
} from '@core/lib/finance';
import { FINANCE_CATEGORIES } from '@core/lib/finance/types';

export interface CategorySplitRow {
  id: string;
  categoryId: string;
  amount: number;
}

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency || 'CLP',
      maximumFractionDigits: currency === 'CLP' || currency === 'JPY' ? 0 : 2,
    }).format(n);
  } catch {
    return `$ ${n.toFixed(0)}`;
  }
}

export function CategorySplitEditor({
  total,
  currency,
  rows,
  userCategories,
  onChange,
}: {
  total: number;
  currency: string;
  rows: CategorySplitRow[];
  userCategories: FinanceUserCategory[];
  onChange: (rows: CategorySplitRow[]) => void;
}) {
  const { t } = useT();
  const leftover = categorySplitsRemaining(rows, total);
  const tol = splitMatchTolerance(total);
  const balanced = Math.abs(leftover) <= tol;

  function updateRow(id: string, patch: Partial<CategorySplitRow>) {
    onChange(rows.map(row => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const fill = leftover > tol ? leftover : 0;
    onChange([
      ...rows,
      { id: newCategorySplitId(), categoryId: '', amount: fill },
    ]);
  }

  function removeRow(id: string) {
    const next = rows.filter(row => row.id !== id);
    onChange(next.length > 0 ? next : rows);
  }

  const options =
    userCategories.length > 0
      ? userCategories.map(cat => ({
          value: cat.id,
          label: cat.name || t(`fin_cat_${cat.groupKey}` as 'fin_cat_other'),
        }))
      : FINANCE_CATEGORIES.filter(c => c !== 'invest').map(cat => ({
          value: cat,
          label: t(`fin_cat_${cat}` as 'fin_cat_other'),
        }));

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {t('fin_split_title')}
        </p>
        <p
          className={cn(
            'text-[11px] font-semibold tabular-nums',
            balanced ? 'text-accent-green' : leftover > 0 ? 'text-amber-600' : 'text-accent-red'
          )}
        >
          {balanced
            ? t('fin_split_ok')
            : leftover > 0
              ? t('fin_split_left').replace('{amount}', money(leftover, currency))
              : t('fin_split_over').replace(
                  '{amount}',
                  money(Math.abs(leftover), currency)
                )}
        </p>
      </div>
      {rows.map(row => (
        <div key={row.id} className="grid grid-cols-[1fr_7rem_auto] items-center gap-1.5">
          <select
            value={row.categoryId}
            onChange={e => {
              const categoryId = e.target.value;
              const fill =
                !row.amount && leftover > tol ? leftover : row.amount;
              updateRow(row.id, { categoryId, amount: fill });
            }}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">{t('fin_split_pick')}</option>
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <DecimalInput
            value={row.amount}
            onChange={v => updateRow(row.id, { amount: v })}
            min={0}
            max={1_000_000_000}
            className="h-9 text-sm"
          />
          <button
            type="button"
            onClick={() => removeRow(row.id)}
            disabled={rows.length <= 2}
            className="rounded-md p-1.5 text-text-muted hover:text-accent-red disabled:opacity-30"
            aria-label={t('action_delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addRow}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        {t('fin_split_add')}
      </Button>
    </div>
  );
}

export function initialSplitRows(
  categoryId: string,
  total: number
): CategorySplitRow[] {
  return [
    {
      id: newCategorySplitId(),
      categoryId,
      amount: total > 0 ? total : 0,
    },
    { id: newCategorySplitId(), categoryId: '', amount: 0 },
  ];
}

export function resolveSplitGroupKey(
  categoryId: string,
  userCategories: FinanceUserCategory[]
): FinanceCategory {
  const custom = userCategories.find(c => c.id === categoryId);
  if (custom) return custom.groupKey;
  if ((FINANCE_CATEGORIES as readonly string[]).includes(categoryId)) {
    return categoryId as FinanceCategory;
  }
  return 'other';
}
