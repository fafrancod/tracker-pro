import { useMemo, useState } from 'react';
import { Pencil, Repeat, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { expandFinanceRules } from '@core/lib/finance/expandRules';
import { addDaysToDayId } from '@core/lib/recurrence';
import type { FinanceMovement, FinanceRule } from '@core/lib/finance/types';

type RecurrenceFilter = 'all' | 'recurring' | 'one_off';
type FlowFilter = 'all' | 'income' | 'expense' | 'investment';

export function MovementsListPanel({
  movements,
  rules,
  todayDayId,
  money,
  onEdit,
}: {
  movements: FinanceMovement[];
  rules: FinanceRule[];
  todayDayId: string;
  money: (n: number, currency: string) => string;
  onEdit: (mov: FinanceMovement) => void;
}) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceFilter>('all');
  const [flow, setFlow] = useState<FlowFilter>('all');

  const rows = useMemo(() => {
    const from = addDaysToDayId(todayDayId, -400);
    const to = addDaysToDayId(todayDayId, 400);
    const extra = expandFinanceRules(rules, movements, from, to);
    const byId = new Map<string, FinanceMovement>();
    for (const mov of [...movements, ...extra]) {
      if (!byId.has(mov.id)) byId.set(mov.id, mov);
    }
    const q = query.trim().toLowerCase();
    return [...byId.values()]
      .filter(mov => {
        if (flow !== 'all' && mov.flow !== flow) return false;
        const recurring = Boolean(mov.ruleId);
        if (recurrence === 'recurring' && !recurring) return false;
        if (recurrence === 'one_off' && recurring) return false;
        if (!q) return true;
        return (
          mov.title.toLowerCase().includes(q) ||
          mov.notes.toLowerCase().includes(q) ||
          mov.dayId.includes(q)
        );
      })
      .sort(
        (a, b) =>
          b.dayId.localeCompare(a.dayId) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      );
  }, [movements, rules, todayDayId, query, recurrence, flow]);

  const ruleById = useMemo(() => {
    const map = new Map(rules.map(rule => [rule.id, rule]));
    return map;
  }, [rules]);

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
          {rows.map(mov => {
            const rule = mov.ruleId ? ruleById.get(mov.ruleId) : undefined;
            const recurring = Boolean(mov.ruleId);
            return (
              <li key={mov.id}>
                <button
                  type="button"
                  onClick={() => onEdit(mov)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-background"
                >
                  <span
                    className={cn(
                      'w-14 shrink-0 text-[11px] tabular-nums text-text-muted',
                    )}
                  >
                    {mov.dayId.slice(5)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-primary">
                      {mov.title || t('fin_list_untitled')}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-text-muted">
                      <span>
                        {mov.flow === 'income'
                          ? t('fin_flow_income')
                          : mov.flow === 'investment'
                            ? t('fin_flow_investment')
                            : t('fin_flow_expense')}
                      </span>
                      <span>·</span>
                      <span>
                        {mov.status === 'confirmed'
                          ? t('fin_status_confirmed')
                          : mov.status === 'planned'
                            ? t('fin_status_planned')
                            : mov.status}
                      </span>
                      {recurring ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-teal/15 px-1.5 py-0.5 font-medium text-accent-teal">
                          <Repeat className="h-3 w-3" />
                          {t('fin_kind_recurring')}
                          {rule
                            ? ` · ${
                                rule.frequency === 'weekly'
                                  ? t('fin_freq_weekly')
                                  : t('fin_freq_monthly')
                              }`
                            : ''}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-semibold tabular-nums',
                      mov.flow === 'income'
                        ? 'text-accent-green'
                        : mov.flow === 'investment'
                          ? 'text-accent-teal'
                          : 'text-accent-red'
                    )}
                  >
                    {mov.flow === 'income' ? '+' : mov.flow === 'expense' ? '−' : ''}
                    {money(mov.amount, mov.currency)}
                  </span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
