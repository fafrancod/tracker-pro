import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { InstallmentScheduleChart } from '@/components/Finances/InstallmentScheduleChart';
import { format, parseISO } from 'date-fns';
import { useT } from '@/hooks/useT';
import {
  chartTooltipStyle,
  isDocumentDark,
  macSystem,
} from '@/lib/macPalette';
import { expandFinanceRules } from '@core/lib/finance/expandRules';
import {
  listMonthIds,
  summarizeMonthlyEvolution,
} from '@core/lib/finance/evolution';
import type {
  FinanceCredit,
  FinanceMovement,
  FinanceRule,
  FinanceUserCategory,
} from '@core/lib/finance/types';

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

export function EvolutionPanel({
  movements,
  rules,
  credits,
  userCategories,
  monthId,
  reportingCurrency,
}: {
  movements: FinanceMovement[];
  rules: FinanceRule[];
  credits: FinanceCredit[];
  userCategories: FinanceUserCategory[];
  monthId: string;
  reportingCurrency: string;
}) {
  const { t, locale } = useT();
  const monthIds = useMemo(() => listMonthIds(monthId, 12), [monthId]);
  const fromDayId = `${monthIds[0]}-01`;
  const toDayId = `${monthIds[monthIds.length - 1]}-31`;

  const rows = useMemo(() => {
    const virtuals = expandFinanceRules(rules, movements, fromDayId, toDayId);
    return summarizeMonthlyEvolution([...movements, ...virtuals], {
      monthIds,
      reportingCurrency,
      credits,
    });
  }, [credits, fromDayId, monthIds, movements, reportingCurrency, rules, toDayId]);

  const chartData = useMemo(
    () =>
      rows.map(row => ({
        ...row,
        label: format(parseISO(`${row.monthId}-01`), 'MMM yy', { locale }),
      })),
    [locale, rows]
  );

  const hasData = rows.some(r => r.income > 0 || r.expense > 0);
  const dark = isDocumentDark();
  const tip = chartTooltipStyle(dark);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <BarChart3 className="h-5 w-5 text-text-muted" />
        <p className="text-sm font-medium text-text-primary">{t('fin_evo_empty')}</p>
        <p className="max-w-sm text-xs text-text-muted">{t('fin_evo_empty_hint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">{t('fin_evo_legend')}</p>
      <div className="h-80 w-full rounded-xl border border-border bg-surface p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={dark ? 'rgba(142,142,147,0.22)' : 'rgba(60,60,67,0.12)'}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'currentColor' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v =>
                new Intl.NumberFormat('es-CL', {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                }).format(Number(v) || 0)
              }
            />
            <Tooltip
              contentStyle={tip}
              formatter={(value, name) => [
                money(Number(value) || 0, reportingCurrency),
                String(name),
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="income"
              name={t('fin_evo_income')}
              fill={macSystem.green}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="expenseUnit"
              stackId="exp"
              name={t('fin_evo_unit')}
              fill={macSystem.orange}
            />
            <Bar
              dataKey="expenseInstallment"
              stackId="exp"
              name={t('fin_evo_installments')}
              fill={macSystem.purple}
            />
            <Bar
              dataKey="expenseRecurring"
              stackId="exp"
              name={t('fin_evo_recurring')}
              fill={macSystem.blue}
            />
            <Bar
              dataKey="expenseCredit"
              stackId="exp"
              name={t('fin_evo_credits')}
              fill={macSystem.red}
              radius={[4, 4, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="cumulative"
              name={t('fin_evo_cumulative')}
              stroke={macSystem.teal}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border border-border bg-surface p-3">
        <p className="mb-2 text-xs font-semibold text-text-primary">
          {t('fin_evo_installment_chart')}
        </p>
        <InstallmentScheduleChart
          movements={movements}
          monthId={monthId}
          reportingCurrency={reportingCurrency}
          userCategories={userCategories}
        />
      </div>
    </div>
  );
}
