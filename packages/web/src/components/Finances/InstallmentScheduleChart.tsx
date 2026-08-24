import { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useT } from '@/hooks/useT';
import { chartTooltipStyle, isDocumentDark } from '@/lib/macPalette';
import {
  DEFAULT_CATEGORY_COLORS,
  buildCategoryInstallmentSchedule,
  buildInstallmentSchedule,
  isInstallmentInCategory,
  isInstallmentMovement,
  listMonthIds,
} from '@core/lib/finance';
import type {
  FinanceCategory,
  FinanceMovement,
  FinanceUserCategory,
} from '@core/lib/finance';

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

function displayInstallment(movement: FinanceMovement): string {
  const title = movement.title || 'Cuota';
  if (/cuota\s+\d+\s+(?:de|\/)\s*\d+/iu.test(title)) return title;
  if ((movement.installmentTotal ?? 0) > 1) {
    return `${title} · Cuota ${movement.installmentIndex ?? 1} de ${movement.installmentTotal}`;
  }
  return title;
}

/** Monthly installments: categories outside, purchases and cuota numbers inside. */
export function InstallmentScheduleChart({
  movements,
  monthId,
  reportingCurrency,
  userCategories = [],
}: {
  movements: FinanceMovement[];
  monthId: string;
  reportingCurrency: string;
  userCategories?: FinanceUserCategory[];
}) {
  const { t, locale } = useT();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const monthIds = useMemo(() => listMonthIds(monthId, 12), [monthId]);
  const formatMonth = useCallback(
    (id: string) => format(parseISO(`${id}-01`), 'MMM yy', { locale }),
    [locale]
  );
  const resolveCategory = useCallback(
    (categoryId: string) => {
      const custom = userCategories.find(category => category.id === categoryId);
      if (custom) return { label: custom.name, color: custom.color };
      const group = categoryId as FinanceCategory;
      const valid = Object.prototype.hasOwnProperty.call(DEFAULT_CATEGORY_COLORS, group);
      return {
        label: valid ? t(`fin_cat_${group}` as 'fin_cat_other') : t('fin_cat_other'),
        color: valid ? DEFAULT_CATEGORY_COLORS[group] : DEFAULT_CATEGORY_COLORS.other,
      };
    },
    [t, userCategories]
  );
  const categoryModel = useMemo(
    () =>
      buildCategoryInstallmentSchedule(
        movements,
        monthIds,
        formatMonth,
        resolveCategory
      ),
    [formatMonth, monthIds, movements, resolveCategory]
  );
  const detailMovements = useMemo(
    () =>
      selectedCategoryId
        ? movements.filter(movement =>
            isInstallmentInCategory(movement, selectedCategoryId)
          )
        : [],
    [movements, selectedCategoryId]
  );
  const detailModel = useMemo(
    () => buildInstallmentSchedule(detailMovements, monthIds, formatMonth),
    [detailMovements, formatMonth, monthIds]
  );
  const activeCategory = selectedCategoryId
    ? categoryModel.segments.find(segment => segment.categoryId === selectedCategoryId)
    : null;
  const model = activeCategory ? detailModel : categoryModel;
  const dark = isDocumentDark();
  const tip = chartTooltipStyle(dark);
  const hasData =
    categoryModel.segments.length > 0 &&
    categoryModel.rows.some(row => row.total > 0);

  const monthlyDetails = useMemo(() => {
    if (!activeCategory) return [];
    const window = new Set(monthIds);
    return detailMovements
      .filter(movement => isInstallmentMovement(movement))
      .filter(movement => window.has(movement.dayId.slice(0, 7)))
      .sort((a, b) => a.dayId.localeCompare(b.dayId));
  }, [activeCategory, detailMovements, monthIds]);

  if (!hasData) {
    return (
      <p className="py-6 text-center text-xs text-text-muted">
        {t('fin_evo_installment_empty')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {activeCategory ? (
          <button
            type="button"
            onClick={() => setSelectedCategoryId(null)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent-teal hover:bg-accent-teal/10"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {t('fin_evo_categories')}
          </button>
        ) : (
          <p className="text-xs text-text-muted">{t('fin_evo_category_hint')}</p>
        )}
        {activeCategory ? (
          <button
            type="button"
            onClick={() => setSelectedCategoryId(null)}
            className="text-xs font-semibold text-text-primary underline decoration-dotted underline-offset-4"
            title={t('fin_evo_categories')}
          >
            {activeCategory.label}
          </button>
        ) : null}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={model.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={dark ? 'rgba(142,142,147,0.22)' : 'rgba(60,60,67,0.12)'}
              vertical={false}
            />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: 'currentColor' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: 'currentColor' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={value =>
                new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
              }
            />
            <Tooltip
              contentStyle={tip}
              formatter={(value, name) => [money(Number(value) || 0, reportingCurrency), String(name)]}
            />
            {model.segments.length <= 8 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
            {model.segments.map((segment, index) => (
              <Bar
                key={segment.key}
                dataKey={segment.key}
                name={segment.label}
                stackId="cuotas"
                fill={segment.color}
                radius={index === model.segments.length - 1 ? [3, 3, 0, 0] : 0}
                onClick={
                  !activeCategory && 'categoryId' in segment
                    ? () => setSelectedCategoryId(segment.categoryId)
                    : undefined
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!activeCategory ? (
        <div className="flex flex-wrap gap-1.5">
          {categoryModel.segments.map(segment => (
            <button
              key={segment.key}
              type="button"
              onClick={() =>
                setSelectedCategoryId(current =>
                  current === segment.categoryId ? null : segment.categoryId
                )
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-text-primary hover:border-accent-teal/50 hover:bg-accent-teal/5"
              title={t('fin_evo_category_open').replace('{category}', segment.label)}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-1 rounded-lg border border-border bg-background/40 p-2">
          <p className="px-1 text-[11px] font-medium text-text-muted">{t('fin_evo_category_detail')}</p>
          {monthlyDetails.map(movement => (
            <div key={movement.id} className="flex items-center justify-between gap-3 rounded-md px-1 py-1 text-xs">
              <span className="min-w-0 truncate text-text-primary">{displayInstallment(movement)}</span>
              <span className="shrink-0 font-medium tabular-nums text-text-muted">
                {formatMonth(movement.dayId.slice(0, 7))} · {money(movement.amount, reportingCurrency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
