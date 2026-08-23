import { useMemo } from 'react';
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
import { format, parseISO } from 'date-fns';
import { useT } from '@/hooks/useT';
import { chartTooltipStyle, isDocumentDark } from '@/lib/macPalette';
import {
  buildInstallmentSchedule,
  listMonthIds,
} from '@core/lib/finance';
import type { FinanceMovement } from '@core/lib/finance';

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

export function InstallmentScheduleChart({
  movements,
  monthId,
  reportingCurrency,
}: {
  movements: FinanceMovement[];
  monthId: string;
  reportingCurrency: string;
}) {
  const { t, locale } = useT();
  const monthIds = useMemo(() => listMonthIds(monthId, 12), [monthId]);
  const model = useMemo(
    () =>
      buildInstallmentSchedule(movements, monthIds, id =>
        format(parseISO(`${id}-01`), 'MMM yy', { locale })
      ),
    [locale, monthIds, movements]
  );
  const dark = isDocumentDark();
  const tip = chartTooltipStyle(dark);
  const hasData = model.segments.length > 0 && model.rows.some(r => r.total > 0);

  if (!hasData) {
    return (
      <p className="py-6 text-center text-xs text-text-muted">
        {t('fin_evo_installment_empty')}
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={model.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={dark ? 'rgba(142,142,147,0.22)' : 'rgba(60,60,67,0.12)'}
            vertical={false}
          />
          <XAxis
            dataKey="monthLabel"
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
          {model.segments.length <= 8 ? (
            <Legend wrapperStyle={{ fontSize: 11 }} />
          ) : null}
          {model.segments.map((seg, i) => (
            <Bar
              key={seg.key}
              dataKey={seg.key}
              name={seg.label}
              stackId="cuotas"
              fill={seg.color}
              radius={i === model.segments.length - 1 ? [3, 3, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
