import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';
import {
  createFinanceEntry,
  deleteFinanceEntry,
  fetchFinanceEntries,
  updateFinanceEntry,
} from '@core/services/financeService';
import {
  entriesForMonth,
  monthIdFromDate,
  summarizeFinanceMonth,
} from '@core/lib/financeSummary';
import type {
  CreateFinanceEntryPayload,
  FinanceEntry,
  FinanceFlow,
  FinanceFrequency,
  FinanceKind,
} from '@core/types';

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

const EMPTY_FORM: CreateFinanceEntryPayload = {
  title: '',
  amount: 0,
  currency: 'EUR',
  flow: 'expense',
  kind: 'specific',
  frequency: null,
  recurrenceDay: null,
  entryDate: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
  active: true,
};

export function FinancesPage() {
  const { t, locale } = useT();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [form, setForm] = useState<CreateFinanceEntryPayload>(EMPTY_FORM);
  const [filterFlow, setFilterFlow] = useState<'all' | FinanceFlow>('all');
  const [filterKind, setFilterKind] = useState<'all' | FinanceKind>('all');

  const monthId = monthIdFromDate(monthCursor);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchFinanceEntries();
      setEntries(list);
    } catch {
      showToast(t('fin_load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const summary = useMemo(
    () => summarizeFinanceMonth(entries, monthId),
    [entries, monthId]
  );

  const monthEntries = useMemo(() => {
    let list = entriesForMonth(entries, monthId);
    if (filterFlow !== 'all') list = list.filter(e => e.flow === filterFlow);
    if (filterKind !== 'all') list = list.filter(e => e.kind === filterKind);
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [entries, monthId, filterFlow, filterKind]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      entryDate: format(monthCursor, 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  }

  function openEdit(entry: FinanceEntry) {
    setEditing(entry);
    setForm({
      title: entry.title,
      amount: entry.amount,
      currency: entry.currency,
      flow: entry.flow,
      kind: entry.kind,
      frequency: entry.frequency,
      recurrenceDay: entry.recurrenceDay,
      entryDate: entry.entryDate,
      notes: entry.notes,
      active: entry.active,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const title = form.title.trim();
    if (!title) {
      showToast(t('fin_title_required'), 'error');
      return;
    }
    if (!(form.amount >= 0)) {
      showToast(t('fin_amount_required'), 'error');
      return;
    }
    const payload: CreateFinanceEntryPayload = {
      ...form,
      title,
      frequency: form.kind === 'recurring' ? form.frequency ?? 'monthly' : null,
      recurrenceDay:
        form.kind === 'recurring'
          ? form.recurrenceDay ?? (form.frequency === 'weekly' ? 1 : 1)
          : null,
      entryDate:
        form.kind === 'recurring' ? null : form.entryDate || format(new Date(), 'yyyy-MM-dd'),
    };
    try {
      if (editing) {
        await updateFinanceEntry(editing.id, payload);
        showToast(t('fin_saved'), 'success');
      } else {
        await createFinanceEntry(payload);
        showToast(t('fin_created'), 'success');
      }
      setDialogOpen(false);
      await reload();
    } catch {
      showToast(t('fin_save_error'), 'error');
    }
  }

  async function handleDelete(entry: FinanceEntry) {
    if (!confirm(t('fin_delete_confirm').replace('{title}', entry.title))) return;
    try {
      await deleteFinanceEntry(entry.id);
      showToast(t('fin_deleted'), 'info');
      await reload();
    } catch {
      showToast(t('fin_save_error'), 'error');
    }
  }

  function kindLabel(k: FinanceKind): string {
    if (k === 'recurring') return t('fin_kind_recurring');
    if (k === 'expected') return t('fin_kind_expected');
    return t('fin_kind_specific');
  }

  function flowLabel(f: FinanceFlow): string {
    return f === 'income' ? t('fin_flow_income') : t('fin_flow_expense');
  }

  const monthLabel = format(monthCursor, 'MMMM yyyy', { locale });

  return (
    <Layout
      title={t('nav_finances')}
      primaryAction={{ label: t('fin_add'), onClick: openCreate }}
      onFabClick={openCreate}
      showFab
    >
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
        {/* Month nav */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonthCursor(c => startOfMonth(addMonths(c, -1)))}
            aria-label={t('board_prev_week')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[10rem] text-center text-sm font-semibold capitalize text-text-primary">
            {monthLabel}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonthCursor(c => startOfMonth(addMonths(c, 1)))}
            aria-label={t('board_next_week')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 text-xs"
            onClick={() => setMonthCursor(startOfMonth(new Date()))}
          >
            {t('fin_this_month')}
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryCard
            label={t('fin_total_income')}
            value={money(summary.totalIncome, summary.currency)}
            tone="green"
          />
          <SummaryCard
            label={t('fin_total_expense')}
            value={money(summary.totalExpense, summary.currency)}
            tone="red"
          />
          <SummaryCard
            label={t('fin_balance')}
            value={money(summary.balance, summary.currency)}
            tone={summary.balance >= 0 ? 'teal' : 'red'}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <MiniStat
            label={t('fin_income_recurring')}
            value={money(summary.incomeRecurring, summary.currency)}
          />
          <MiniStat
            label={t('fin_income_expected')}
            value={money(summary.incomeExpected, summary.currency)}
          />
          <MiniStat
            label={t('fin_income_specific')}
            value={money(summary.incomeSpecific, summary.currency)}
          />
          <MiniStat
            label={t('fin_expense_recurring')}
            value={money(summary.expenseRecurring, summary.currency)}
          />
          <MiniStat
            label={t('fin_expense_expected')}
            value={money(summary.expenseExpected, summary.currency)}
          />
          <MiniStat
            label={t('fin_expense_specific')}
            value={money(summary.expenseSpecific, summary.currency)}
          />
        </div>

        {/* Filters + list */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterFlow}
            onChange={e => setFilterFlow(e.target.value as 'all' | FinanceFlow)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs text-text-primary"
          >
            <option value="all">{t('fin_filter_all_flows')}</option>
            <option value="income">{t('fin_flow_income')}</option>
            <option value="expense">{t('fin_flow_expense')}</option>
          </select>
          <select
            value={filterKind}
            onChange={e => setFilterKind(e.target.value as 'all' | FinanceKind)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs text-text-primary"
          >
            <option value="all">{t('fin_filter_all_kinds')}</option>
            <option value="recurring">{t('fin_kind_recurring')}</option>
            <option value="expected">{t('fin_kind_expected')}</option>
            <option value="specific">{t('fin_kind_specific')}</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-text-muted">{t('status_checking')}</p>
        ) : monthEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-muted">
              <Wallet className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">
              {t('fin_empty_title')}
            </h2>
            <p className="max-w-sm text-xs text-text-muted">{t('fin_empty_hint')}</p>
            <Button onClick={openCreate} size="sm" className="mt-1">
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('fin_add')}
            </Button>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {monthEntries.map(entry => (
              <li
                key={entry.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5',
                  !entry.active && 'opacity-50'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    entry.flow === 'income'
                      ? 'bg-accent-green/15 text-accent-green'
                      : 'bg-accent-red/15 text-accent-red'
                  )}
                >
                  {entry.flow === 'income' ? '+' : '−'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {entry.title}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {flowLabel(entry.flow)} · {kindLabel(entry.kind)}
                    {entry.kind === 'recurring' && entry.frequency
                      ? ` · ${entry.frequency === 'monthly' ? t('fin_freq_monthly') : t('fin_freq_weekly')}`
                      : ''}
                    {entry.entryDate
                      ? ` · ${format(parseISO(`${entry.entryDate}T00:00:00`), 'd MMM', { locale })}`
                      : ''}
                  </p>
                </div>
                <p
                  className={cn(
                    'shrink-0 text-sm font-semibold tabular-nums',
                    entry.flow === 'income'
                      ? 'text-accent-green'
                      : 'text-accent-red'
                  )}
                >
                  {entry.flow === 'income' ? '+' : '−'}
                  {money(entry.amount, entry.currency)}
                </p>
                <button
                  type="button"
                  className="rounded p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
                  onClick={() => openEdit(entry)}
                  aria-label={t('task_ctx_edit')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-text-muted hover:bg-background hover:text-accent-red"
                  onClick={() => void handleDelete(entry)}
                  aria-label={t('action_delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('fin_edit') : t('fin_add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_field_title')}</span>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="h-9 text-sm"
                placeholder={t('fin_title_ph')}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_flow')}</span>
                <select
                  value={form.flow}
                  onChange={e =>
                    setForm(f => ({ ...f, flow: e.target.value as FinanceFlow }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-text-primary"
                >
                  <option value="expense">{t('fin_flow_expense')}</option>
                  <option value="income">{t('fin_flow_income')}</option>
                </select>
              </label>
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_kind')}</span>
                <select
                  value={form.kind}
                  onChange={e => {
                    const kind = e.target.value as FinanceKind;
                    setForm(f => ({
                      ...f,
                      kind,
                      frequency:
                        kind === 'recurring' ? f.frequency ?? 'monthly' : null,
                      recurrenceDay:
                        kind === 'recurring' ? f.recurrenceDay ?? 1 : null,
                      entryDate:
                        kind === 'recurring'
                          ? null
                          : f.entryDate || format(new Date(), 'yyyy-MM-dd'),
                    }));
                  }}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-text-primary"
                >
                  <option value="specific">{t('fin_kind_specific')}</option>
                  <option value="expected">{t('fin_kind_expected')}</option>
                  <option value="recurring">{t('fin_kind_recurring')}</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_amount')}</span>
                <DecimalInput
                  value={form.amount}
                  onChange={v => setForm(f => ({ ...f, amount: v }))}
                  min={0}
                  max={1_000_000_000}
                  className="h-9 text-sm"
                />
              </label>
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_currency')}</span>
                <Input
                  value={form.currency ?? 'EUR'}
                  onChange={e =>
                    setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))
                  }
                  className="h-9 text-sm"
                  maxLength={8}
                />
              </label>
            </div>

            {form.kind === 'recurring' ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1 text-xs text-text-muted">
                  <span>{t('fin_field_frequency')}</span>
                  <select
                    value={form.frequency ?? 'monthly'}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        frequency: e.target.value as FinanceFrequency,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-text-primary"
                  >
                    <option value="monthly">{t('fin_freq_monthly')}</option>
                    <option value="weekly">{t('fin_freq_weekly')}</option>
                  </select>
                </label>
                <label className="block space-y-1 text-xs text-text-muted">
                  <span>
                    {form.frequency === 'weekly'
                      ? t('fin_field_weekday')
                      : t('fin_field_monthday')}
                  </span>
                  {form.frequency === 'weekly' ? (
                    <select
                      value={form.recurrenceDay ?? 1}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          recurrenceDay: Number(e.target.value),
                        }))
                      }
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-text-primary"
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map(d => (
                        <option key={d} value={d}>
                          {t(`fin_weekday_${d}` as 'fin_weekday_0')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={form.recurrenceDay ?? 1}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          recurrenceDay: Math.min(
                            31,
                            Math.max(1, Number(e.target.value) || 1)
                          ),
                        }))
                      }
                      className="h-9 text-sm"
                    />
                  )}
                </label>
              </div>
            ) : (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_date')}</span>
                <input
                  type="date"
                  value={form.entryDate ?? ''}
                  onChange={e =>
                    setForm(f => ({ ...f, entryDate: e.target.value || null }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-text-primary"
                />
              </label>
            )}

            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_field_notes')}</span>
              <textarea
                value={form.notes ?? ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm text-text-primary"
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={form.active !== false}
                onChange={e =>
                  setForm(f => ({ ...f, active: e.target.checked }))
                }
              />
              {t('fin_field_active')}
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                {t('action_cancel')}
              </Button>
              <Button size="sm" onClick={() => void handleSave()}>
                {t('action_save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'red' | 'teal';
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums',
          tone === 'green' && 'text-accent-green',
          tone === 'red' && 'text-accent-red',
          tone === 'teal' && 'text-accent-teal'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 px-3 py-2">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}
