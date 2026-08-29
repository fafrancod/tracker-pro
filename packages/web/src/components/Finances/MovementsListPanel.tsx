import { useMemo, useState } from 'react';
import { CreditCard, Pencil, Repeat, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import {
  collapseFinanceListRows,
  type FinanceListRow,
} from '@core/lib/finance/listRows';
import type { FinanceMovement, FinanceRule, FinanceRuleFrequency } from '@core/lib/finance/types';
import type { TKey } from '@/lib/i18n';

function rowSample(row: FinanceListRow): FinanceMovement {
  return row.kind === 'one_off' ? row.movement : row.sample;
}

function rowTitle(row: FinanceListRow): string {
  if (row.kind === 'one_off') return row.movement.title;
  if (row.kind === 'installment') return row.title;
  return row.rule.title;
}

function rowAmount(row: FinanceListRow): number {
  return row.kind === 'installment' ? row.totalAmount : rowSample(row).amount;
}

type RecurrenceFilter = 'all' | 'recurring' | 'one_off';
type FlowFilter = 'all' | 'income' | 'expense' | 'investment';

const WEEKDAY_KEYS: TKey[] = [
  'fin_weekday_0',
  'fin_weekday_1',
  'fin_weekday_2',
  'fin_weekday_3',
  'fin_weekday_4',
  'fin_weekday_5',
  'fin_weekday_6',
];

export function MovementsListPanel({
  movements,
  rules,
  money,
  onEdit,
  onUpdateRule,
}: {
  movements: FinanceMovement[];
  rules: FinanceRule[];
  money: (n: number, currency: string) => string;
  onEdit: (mov: FinanceMovement) => void;
  onUpdateRule: (
    rule: FinanceRule,
    patch: { frequency?: FinanceRuleFrequency; recurrenceDay?: number },
    sample: FinanceMovement
  ) => void;
}) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceFilter>('all');
  const [flow, setFlow] = useState<FlowFilter>('all');

  const freqOptions = [
    { value: 'monthly', label: t('fin_freq_monthly') },
    { value: 'weekly', label: t('fin_freq_weekly') },
  ];
  const weekdayOptions = WEEKDAY_KEYS.map((key, i) => ({
    value: String(i),
    label: t(key),
  }));
  const monthDayOptions = Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: t('fin_list_month_day').replace('{n}', String(i + 1)),
  }));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return collapseFinanceListRows(movements, rules).filter(row => {
      const sample = rowSample(row);
      if (flow !== 'all' && sample.flow !== flow) return false;
      if (recurrence === 'recurring' && row.kind !== 'series') return false;
      if (recurrence === 'one_off' && row.kind === 'series') return false;
      if (!q) return true;
      const title = rowTitle(row);
      const notes =
        row.kind === 'one_off'
          ? row.movement.notes
          : row.kind === 'series'
            ? row.rule.notes
            : row.sample.notes;
      return (
        title.toLowerCase().includes(q) ||
        notes.toLowerCase().includes(q) ||
        sample.dayId.includes(q) ||
        (row.kind === 'installment' && row.endsOn.includes(q))
      );
    });
  }, [movements, rules, query, recurrence, flow]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('fin_list_search')}
          className="h-9 pl-8 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ['all', t('fin_list_filter_all')],
            ['recurring', t('fin_list_filter_recurring')],
            ['one_off', t('fin_list_filter_one_off')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setRecurrence(id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs',
              recurrence === id
                ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                : 'border-border text-text-muted'
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px self-center bg-border" />
        {(
          [
            ['all', t('fin_filter_all_flows')],
            ['income', t('fin_flow_income')],
            ['expense', t('fin_flow_expense')],
            ['investment', t('fin_flow_investment')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFlow(id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs',
              flow === id
                ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                : 'border-border text-text-muted'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-text-primary">{t('fin_list_empty')}</p>
          <p className="mt-1 text-xs text-text-muted">{t('fin_list_empty_hint')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {rows.map(row => {
            const sample = rowSample(row);
            const title = rowTitle(row);
            const amount = rowAmount(row);
            const paidRatio =
              row.kind === 'installment' && row.totalCount > 0
                ? Math.min(1, row.paidCount / row.totalCount)
                : 0;
            return (
              <li key={row.key} className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => onEdit(sample)}
                  className="min-w-0 flex-1 text-left hover:opacity-90"
                >
                  <span className="block truncate text-sm text-text-primary">
                    {title || t('fin_list_untitled')}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-text-muted">
                    {row.kind === 'series' ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-teal/15 px-1.5 py-0.5 font-medium text-accent-teal">
                        <Repeat className="h-3 w-3" />
                        {t('fin_kind_recurring')}
                      </span>
                    ) : row.kind === 'installment' ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 font-medium text-violet-700 dark:text-violet-200">
                        <CreditCard className="h-3 w-3" />
                        {t('fin_list_installments')}
                      </span>
                    ) : (
                      <span>{sample.dayId}</span>
                    )}
                    <span>·</span>
                    <span>
                      {sample.flow === 'income'
                        ? t('fin_flow_income')
                        : sample.flow === 'investment'
                          ? t('fin_flow_investment')
                          : t('fin_flow_expense')}
                    </span>
                    {row.kind === 'one_off' ? (
                      <>
                        <span>·</span>
                        <span>
                          {sample.status === 'confirmed'
                            ? t('fin_status_confirmed')
                            : t('fin_status_planned')}
                        </span>
                      </>
                    ) : null}
                    {row.kind === 'installment' ? (
                      <>
                        <span>·</span>
                        <span>
                          {t('fin_list_installment_meta')
                            .replace('{paid}', String(row.paidCount))
                            .replace('{total}', String(row.totalCount))
                            .replace('{remaining}', String(row.remainingCount))
                            .replace('{date}', row.endsOn)}
                        </span>
                      </>
                    ) : null}
                  </span>
                  {row.kind === 'installment' ? (
                    <span
                      className="mt-1 block h-1 max-w-[9rem] overflow-hidden rounded-full bg-border"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.round(paidRatio * 100)}%` }}
                      />
                    </span>
                  ) : null}
                </button>
                {row.kind === 'series' ? (
                  <div
                    className="flex shrink-0 flex-wrap items-center gap-1"
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    <SimpleSelect
                      aria-label={t('fin_repeat')}
                      value={row.rule.frequency}
                      onChange={value =>
                        onUpdateRule(
                          row.rule,
                          {
                            frequency: value as FinanceRuleFrequency,
                            recurrenceDay:
                              value === 'weekly'
                                ? Math.min(
                                    6,
                                    Math.max(
                                      0,
                                      row.rule.recurrenceDay > 6 ? 1 : row.rule.recurrenceDay
                                    )
                                  )
                                : Math.min(31, Math.max(1, row.rule.recurrenceDay || 1)),
                          },
                          row.sample
                        )
                      }
                      options={freqOptions}
                      className="h-8 w-[7.5rem] text-[11px]"
                    />
                    <SimpleSelect
                      aria-label={
                        row.rule.frequency === 'weekly'
                          ? t('fin_field_weekday')
                          : t('fin_field_monthday')
                      }
                      value={String(row.rule.recurrenceDay)}
                      onChange={value =>
                        onUpdateRule(
                          row.rule,
                          { recurrenceDay: Number(value) },
                          row.sample
                        )
                      }
                      options={
                        row.rule.frequency === 'weekly'
                          ? weekdayOptions
                          : monthDayOptions
                      }
                      className="h-8 w-[8.5rem] text-[11px]"
                    />
                  </div>
                ) : null}
                <span
                  className={cn(
                    'shrink-0 text-sm font-semibold tabular-nums',
                    sample.flow === 'income'
                      ? 'text-accent-green'
                      : sample.flow === 'investment'
                        ? 'text-accent-teal'
                        : 'text-accent-red'
                  )}
                >
                  {sample.flow === 'income' ? '+' : sample.flow === 'expense' ? '−' : ''}
                  {money(amount, sample.currency)}
                </span>
                <button
                  type="button"
                  onClick={() => onEdit(sample)}
                  className="rounded-md p-1 text-text-muted hover:bg-background hover:text-text-primary"
                  aria-label={t('fin_edit')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
