import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  format,
  getDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { FinanceVaultGate } from '@/components/Finances/FinanceVaultGate';
import { AccountsPanel } from '@/components/Finances/AccountsPanel';
import { GoalsPanel } from '@/components/Finances/GoalsPanel';
import { CreditsPanel } from '@/components/Finances/CreditsPanel';
import { InvestmentsPanel } from '@/components/Finances/InvestmentsPanel';
import { HealthPanel } from '@/components/Finances/HealthPanel';
import { ApiClientError } from '@core/lib/api';
import { todayCivilDate } from '@core/lib/civilDate';
import { getDayId } from '@core/services/taskService';
import {
  createFinanceMovement,
  deleteFinanceMovement,
  fetchFinanceCalendar,
  fetchFinanceLedger,
  resolveFinanceFx,
  updateFinanceMovement,
  type FinanceVaultCtx,
} from '@core/services/financeMovementService';
import { fetchFinanceAccounts } from '@core/services/financeAccountService';
import { fetchFinanceGoals } from '@core/services/financeGoalService';
import { fetchFinanceCredits } from '@core/services/financeCreditService';
import {
  monthIdFromDayId,
  summarizeMovementsByCurrency,
} from '@core/lib/finance/movementSummary';
import type {
  CreateFinanceMovementPayload,
  FinanceAccount,
  FinanceCategory,
  FinanceCredit,
  FinanceGoal,
  FinanceMovement,
  FinanceMovementFlow,
  FinanceMovementStatus,
  FinanceRuleFrequency,
} from '@core/lib/finance/types';
import { FINANCE_CATEGORIES } from '@core/lib/finance/types';
import {
  defaultCurrencyFromLocale,
  normalizeCurrencyCode,
  SUPPORTED_CURRENCIES,
} from '@core/lib/currencies';

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

type CalView = 'month' | 'week';

interface MovementForm {
  dayId: string;
  flow: FinanceMovementFlow;
  status: FinanceMovementStatus;
  currency: string;
  title: string;
  amount: number;
  notes: string;
  repeat: 'none' | FinanceRuleFrequency;
  recurrenceDay: number;
  accountId: string;
  cardPayment: boolean;
  cardAccountId: string;
  goalContribution: boolean;
  goalId: string;
  installmentTotal: number;
  creditPayment: boolean;
  creditId: string;
  ticker: string;
  assetName: string;
  quantity: number;
  category: FinanceCategory;
}

function emptyForm(dayId: string, currency: string): MovementForm {
  return {
    dayId,
    flow: 'expense',
    status: 'planned',
    currency,
    title: '',
    amount: 0,
    notes: '',
    repeat: 'none',
    recurrenceDay: 1,
    accountId: '',
    cardPayment: false,
    cardAccountId: '',
    goalContribution: false,
    goalId: '',
    installmentTotal: 1,
    creditPayment: false,
    creditId: '',
    ticker: '',
    assetName: '',
    quantity: 1,
    category: 'other',
  };
}

export function FinancesPage() {
  return (
    <FinanceVaultGate>
      {vault => <FinancesCalendar vault={vault} />}
    </FinanceVaultGate>
  );
}

function FinancesCalendar({ vault }: { vault: FinanceVaultCtx | null }) {
  const { t, locale, language } = useT();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const preferred = normalizeCurrencyCode(
    settings.preferredCurrency,
    defaultCurrencyFromLocale(language === 'en' ? 'en-US' : 'es-CL')
  );
  const today = useMemo(
    () => todayCivilDate(settings.timezone),
    [settings.timezone]
  );
  const todayId = getDayId(today);

  const [view, setView] = useState<CalView>('month');
  const [cursor, setCursor] = useState(() => startOfMonth(today));
  const [movements, setMovements] = useState<FinanceMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceMovement | null>(null);
  const [form, setForm] = useState<MovementForm>(() =>
    emptyForm(todayId, preferred)
  );
  const [deleteTarget, setDeleteTarget] = useState<FinanceMovement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterFlow, setFilterFlow] = useState<
    'all' | 'income' | 'expense' | 'investment'
  >('all');
  const [hub, setHub] = useState<
    | 'calendar'
    | 'accounts'
    | 'goals'
    | 'credits'
    | 'investments'
    | 'health'
  >('calendar');
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [credits, setCredits] = useState<FinanceCredit[]>([]);
  const [ledgerMovements, setLedgerMovements] = useState<FinanceMovement[]>([]);
  const [filterAccountId, setFilterAccountId] = useState('all');

  const weekStartsOn = settings.weekStartsOnMonday ? 1 : 0;
  const monthStart = startOfMonth(cursor);
  const monthId = format(monthStart, 'yyyy-MM');
  const gridStart = startOfWeek(monthStart, { weekStartsOn: weekStartsOn as 0 | 1 });
  const weekStart =
    view === 'week'
      ? startOfWeek(cursor, { weekStartsOn: weekStartsOn as 0 | 1 })
      : gridStart;

  const range = useMemo(() => {
    if (view === 'week') {
      const from = getDayId(weekStart);
      const to = getDayId(addDays(weekStart, 6));
      return { from, to };
    }
    const from = getDayId(gridStart);
    const to = getDayId(addDays(gridStart, 41));
    return { from, to };
  }, [view, weekStart, gridStart]);

  const cells = useMemo(() => {
    const start = view === 'week' ? weekStart : gridStart;
    const count = view === 'week' ? 7 : 42;
    return Array.from({ length: count }, (_, i) => {
      const date = addDays(start, i);
      return { date, dayId: getDayId(date) };
    });
  }, [view, weekStart, gridStart]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, accs, gls, crs, ledger] = await Promise.all([
        fetchFinanceCalendar(range.from, range.to, vault ?? undefined),
        fetchFinanceAccounts(),
        fetchFinanceGoals(),
        fetchFinanceCredits(),
        fetchFinanceLedger(),
      ]);
      setAccounts(accs);
      setGoals(gls);
      setCredits(crs);
      setLedgerMovements(ledger.movements);
      const pending = rows.filter(m => m.fxPending && !m.virtual);
      let next = rows;
      if (pending.length > 0) {
        let converted = 0;
        for (const mov of pending) {
          const fx = await resolveFinanceFx({
            amount: mov.amount,
            currency: mov.originalCurrency || mov.currency,
            reportingCurrency: preferred,
            dayId: mov.dayId,
          });
          if (fx.fxPending) continue;
          await updateFinanceMovement(
            mov.id,
            { ...fx, updatedAt: mov.updatedAt },
            vault ?? undefined
          );
          converted += 1;
        }
        next = converted
          ? await fetchFinanceCalendar(range.from, range.to, vault ?? undefined)
          : rows;
      }
      setMovements(next);
    } catch (err) {
      const msg =
        err instanceof ApiClientError &&
        /schema cache|does not exist|PGRST|finance_movements/i.test(err.message)
          ? t('fin_sql_needed')
          : t('fin_load_error');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, showToast, t, vault, preferred]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const byDay = useMemo(() => {
    const map = new Map<string, FinanceMovement[]>();
    for (const mov of movements) {
      if (filterFlow !== 'all' && mov.flow !== filterFlow) continue;
      if (
        filterAccountId !== 'all' &&
        mov.accountId !== filterAccountId &&
        mov.cardAccountId !== filterAccountId
      ) {
        continue;
      }
      const list = map.get(mov.dayId) ?? [];
      list.push(mov);
      map.set(mov.dayId, list);
    }
    return map;
  }, [movements, filterFlow, filterAccountId]);

  const summaries = useMemo(
    () => summarizeMovementsByCurrency(movements, monthId, preferred),
    [movements, monthId, preferred]
  );
  const currencyKeys = Object.keys(summaries).sort();
  const [summaryCurrency, setSummaryCurrency] = useState(preferred);
  useEffect(() => {
    if (currencyKeys.length === 0) {
      setSummaryCurrency(preferred);
      return;
    }
    if (!currencyKeys.includes(summaryCurrency)) {
      setSummaryCurrency(
        currencyKeys.includes(preferred) ? preferred : currencyKeys[0]
      );
    }
  }, [currencyKeys, preferred, summaryCurrency]);
  const summary = summaries[summaryCurrency] ?? {
    monthId,
    currency: summaryCurrency,
    confirmedIncome: 0,
    confirmedExpense: 0,
    plannedIncome: 0,
    plannedExpense: 0,
    balance: 0,
  };

  function openCreate(dayId = todayId) {
    setEditing(null);
    const d = Number(dayId.slice(8, 10));
    setForm({
      ...emptyForm(dayId, preferred),
      recurrenceDay: d || 1,
    });
    setDialogOpen(true);
  }

  function openEdit(mov: FinanceMovement) {
    if (mov.virtual) {
      setEditing(null);
      setForm({
        ...emptyForm(mov.dayId, mov.currency),
        flow: mov.flow,
        status: 'confirmed',
        title: mov.title,
        amount: mov.amount,
        notes: mov.notes,
        repeat: 'none',
      });
      setDialogOpen(true);
      return;
    }
    setEditing(mov);
    setForm({
      dayId: mov.dayId,
      flow: mov.flow,
      status: mov.status,
      currency: mov.currency,
      title: mov.title,
      amount: mov.amount,
      accountId: mov.accountId ?? '',
      cardPayment: mov.tag === 'card_payment',
      cardAccountId: mov.cardAccountId ?? '',
      goalContribution: mov.tag === 'goal_contribution',
      goalId: mov.goalId ?? '',
      installmentTotal: mov.installmentTotal ?? 1,
      creditPayment: mov.tag === 'credit_payment',
      creditId: mov.creditId ?? '',
      ticker: mov.ticker ?? '',
      assetName: mov.assetName ?? '',
      quantity: mov.quantity ?? 1,
      category:
        mov.category ??
        (mov.flow === 'investment'
          ? 'invest'
          : mov.tag === 'credit_payment'
            ? 'debt'
            : 'other'),
      notes: mov.notes,
      repeat: 'none',
      recurrenceDay: Number(mov.dayId.slice(8, 10)) || 1,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const isInvest = form.flow === 'investment';
    const ticker = form.ticker.trim().toUpperCase();
    const title =
      form.title.trim() ||
      (isInvest ? form.assetName.trim() || ticker : '');
    if (!title) {
      showToast(t('fin_title_required'), 'error');
      return;
    }
    if (isInvest && !ticker) {
      showToast(t('fin_invest_ticker_required'), 'error');
      return;
    }
    const fx = await resolveFinanceFx({
      amount: form.amount,
      currency: form.currency,
      reportingCurrency: preferred,
      dayId: form.dayId,
    });
    const payload: CreateFinanceMovementPayload = {
      dayId: form.dayId,
      flow: form.flow,
      status: form.status,
      currency: form.currency,
      title,
      amount: form.amount,
      notes: form.notes,
      accountId: form.accountId || null,
      cardAccountId:
        !isInvest && form.cardPayment ? form.cardAccountId || null : null,
      goalId:
        !isInvest && form.goalContribution ? form.goalId || null : null,
      creditId: !isInvest && form.creditPayment ? form.creditId || null : null,
      tag: isInvest
        ? null
        : form.creditPayment
          ? 'credit_payment'
          : form.goalContribution
            ? 'goal_contribution'
            : form.cardPayment
              ? 'card_payment'
              : null,
      investmentSide: isInvest ? editing?.investmentSide ?? 'buy' : null,
      ticker: isInvest ? ticker : null,
      assetName: isInvest ? form.assetName.trim() || ticker : null,
      quantity: isInvest ? form.quantity : null,
      investedAmount: isInvest ? form.amount : null,
      investmentStatus: isInvest ? editing?.investmentStatus ?? 'open' : null,
      closesLotId: isInvest ? editing?.closesLotId ?? null : null,
      category: isInvest
        ? 'invest'
        : form.creditPayment
          ? 'debt'
          : form.category,
      installmentTotal:
        form.installmentTotal > 1 ? form.installmentTotal : undefined,
      ...fx,
      recurrence:
        !editing && form.repeat !== 'none'
          ? {
              frequency: form.repeat,
              recurrenceDay:
                form.repeat === 'weekly'
                  ? getDay(new Date(`${form.dayId}T00:00:00`))
                  : form.recurrenceDay,
            }
          : null,
    };
    try {
      if (editing) {
        await updateFinanceMovement(
          editing.id,
          {
            dayId: payload.dayId,
            flow: payload.flow,
            status: payload.status,
            currency: payload.currency,
            title: payload.title,
            amount: payload.amount,
            notes: payload.notes,
            accountId: payload.accountId,
            tag: payload.tag,
            cardAccountId: payload.cardAccountId,
            goalId: payload.goalId,
            creditId: payload.creditId,
            originalAmount: payload.originalAmount,
            originalCurrency: payload.originalCurrency,
            exchangeRate: payload.exchangeRate,
            fxPending: payload.fxPending,
            reportingCurrency: payload.reportingCurrency,
            investmentSide: payload.investmentSide,
            ticker: payload.ticker,
            assetName: payload.assetName,
            quantity: payload.quantity,
            investedAmount: payload.investedAmount,
            investmentStatus: payload.investmentStatus,
            closesLotId: payload.closesLotId,
            category: payload.category,
            updatedAt: editing.updatedAt,
          },
          vault ?? undefined
        );
        showToast(
          fx.fxPending ? t('fin_fx_pending') : t('fin_saved'),
          fx.fxPending ? 'info' : 'success'
        );
      } else {
        await createFinanceMovement(payload, vault ?? undefined);
        showToast(
          fx.fxPending ? t('fin_fx_pending') : t('fin_created'),
          fx.fxPending ? 'info' : 'success'
        );
      }
      setDialogOpen(false);
      await reload();
    } catch (err) {
      const msg =
        err instanceof ApiClientError &&
        /schema cache|does not exist|PGRST|finance_/i.test(err.message)
          ? t('fin_sql_needed')
          : t('fin_save_error');
      showToast(msg, 'error');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteTarget.virtual) return;
    setDeleting(true);
    try {
      await deleteFinanceMovement(deleteTarget.id);
      showToast(t('fin_deleted'), 'info');
      setDeleteTarget(null);
      await reload();
    } catch {
      showToast(t('fin_save_error'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const monthLabel = format(cursor, 'MMMM yyyy', { locale });
  const weekdayLabels = cells.slice(0, 7).map(c =>
    format(c.date, 'EEE', { locale })
  );

  return (
    <Layout
      title={t('nav_finances')}
      primaryAction={{ label: t('fin_add'), onClick: () => openCreate(todayId) }}
      onFabClick={() => openCreate(todayId)}
      showFab
    >
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
        <div className="flex gap-1">
          {(
            [
              'calendar',
              'accounts',
              'goals',
              'credits',
              'investments',
              'health',
            ] as const
          ).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setHub(id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                hub === id
                  ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                  : 'border-border text-text-muted'
              )}
            >
              {id === 'calendar'
                ? t('fin_tab_calendar')
                : id === 'accounts'
                  ? t('fin_tab_accounts')
                  : id === 'goals'
                    ? t('fin_tab_goals')
                    : id === 'credits'
                      ? t('fin_tab_credits')
                      : id === 'investments'
                        ? t('fin_tab_investments')
                        : t('fin_tab_health')}
            </button>
          ))}
        </div>

        {hub === 'accounts' ? (
          <AccountsPanel
            accounts={accounts}
            movements={ledgerMovements.length ? ledgerMovements : movements}
            onChanged={reload}
          />
        ) : null}

        {hub === 'credits' ? (
          <CreditsPanel
            credits={credits}
            movements={ledgerMovements.length ? ledgerMovements : movements}
            todayDayId={todayId}
            defaultCurrency={preferred}
            onChanged={reload}
          />
        ) : null}

        {hub === 'goals' ? (
          <GoalsPanel
            goals={goals}
            accounts={accounts}
            movements={ledgerMovements.length ? ledgerMovements : movements}
            todayDayId={todayId}
            defaultCurrency={preferred}
            onChanged={reload}
          />
        ) : null}

        {hub === 'investments' ? (
          <InvestmentsPanel
            movements={ledgerMovements.length ? ledgerMovements : movements}
            accounts={accounts}
            todayDayId={todayId}
            defaultCurrency={preferred}
            onChanged={reload}
          />
        ) : null}

        {hub === 'health' ? (
          <HealthPanel
            movements={ledgerMovements.length ? ledgerMovements : movements}
            credits={credits}
            monthId={monthId}
            reportingCurrency={preferred}
          />
        ) : null}

        {hub === 'calendar' ? (
        <>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setCursor(c =>
                view === 'week' ? addDays(c, -7) : startOfMonth(addMonths(c, -1))
              )
            }
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
            onClick={() =>
              setCursor(c =>
                view === 'week' ? addDays(c, 7) : startOfMonth(addMonths(c, 1))
              )
            }
            aria-label={t('board_next_week')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCursor(startOfMonth(today))}
          >
            {t('fin_this_month')}
          </Button>
          <div className="ml-auto flex gap-1">
            {(['month', 'week'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px]',
                  view === v
                    ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                    : 'border-border text-text-muted'
                )}
              >
                {v === 'month' ? t('fin_view_month') : t('fin_view_week')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi
            label={t('fin_total_income')}
            value={money(summary.confirmedIncome, summary.currency)}
            tone="green"
          />
          <Kpi
            label={t('fin_total_expense')}
            value={money(summary.confirmedExpense, summary.currency)}
            tone="red"
          />
          <Kpi
            label={t('fin_balance')}
            value={money(summary.balance, summary.currency)}
            tone={summary.balance >= 0 ? 'teal' : 'red'}
          />
          <Kpi
            label={t('fin_kpi_planned')}
            value={money(
              summary.plannedIncome + summary.plannedExpense,
              summary.currency
            )}
            tone="muted"
          />
        </div>

        {currencyKeys.length > 1 && (
          <select
            value={summaryCurrency}
            onChange={e => setSummaryCurrency(e.target.value)}
            className="h-8 w-fit rounded-md border border-border bg-background px-2 text-xs"
          >
            {currencyKeys.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap gap-1.5">
          {(['all', 'expense', 'income', 'investment'] as const).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterFlow(id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                filterFlow === id
                  ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                  : 'border-border text-text-muted'
              )}
            >
              {id === 'all'
                ? t('fin_filter_all_flows')
                : id === 'income'
                  ? t('fin_flow_income')
                  : id === 'investment'
                    ? t('fin_flow_investment')
                    : t('fin_flow_expense')}
            </button>
          ))}
          {accounts.length > 0 && (
            <select
              value={filterAccountId}
              onChange={e => setFilterAccountId(e.target.value)}
              className="h-7 rounded-full border border-border bg-background px-2 text-xs"
            >
              <option value="all">{t('fin_account_all')}</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name || acc.type}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-text-muted">{t('status_checking')}</p>
        ) : (
          <div
            className={cn(
              'grid gap-px overflow-hidden rounded-xl border border-border bg-border',
              view === 'week' ? 'grid-cols-7' : 'grid-cols-7'
            )}
          >
            {weekdayLabels.map(label => (
              <div
                key={label}
                className="bg-surface px-1.5 py-1 text-center text-[10px] font-medium uppercase text-text-muted"
              >
                {label}
              </div>
            ))}
            {cells.map(cell => {
              const inMonth = monthIdFromDayId(cell.dayId) === monthId;
              const list = byDay.get(cell.dayId) ?? [];
              const isToday = cell.dayId === todayId;
              return (
                <button
                  key={cell.dayId}
                  type="button"
                  onClick={() => openCreate(cell.dayId)}
                  className={cn(
                    'flex min-h-[5.5rem] flex-col gap-0.5 bg-background p-1 text-left',
                    view === 'week' && 'min-h-[12rem]',
                    !inMonth && view === 'month' && 'opacity-40',
                    isToday && 'ring-1 ring-inset ring-accent-teal'
                  )}
                >
                  <span
                    className={cn(
                      'self-start rounded-full px-1.5 text-[11px] tabular-nums',
                      isToday
                        ? 'bg-accent-teal text-white'
                        : 'text-text-muted'
                    )}
                  >
                    {format(cell.date, 'd')}
                  </span>
                  <ul className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {list.slice(0, view === 'week' ? 8 : 3).map(mov => (
                      <li key={mov.id}>
                        <span
                          role="presentation"
                          onClick={e => {
                            e.stopPropagation();
                            openEdit(mov);
                          }}
                          className={cn(
                            'block truncate rounded px-1 py-0.5 text-[10px] leading-tight',
                            mov.flow === 'income'
                              ? 'bg-accent-green/15 text-accent-green'
                              : mov.flow === 'investment'
                                ? 'bg-accent-teal/15 text-accent-teal'
                                : 'bg-accent-red/15 text-accent-red',
                            mov.status === 'planned' && 'opacity-70',
                            mov.virtual && 'border border-dashed border-current'
                          )}
                        >
                          {mov.flow === 'income'
                            ? '+'
                            : mov.flow === 'investment'
                              ? '◆'
                              : '−'}
                          {mov.title}
                          {mov.fxPending ? ' · FX' : ''}
                        </span>
                      </li>
                    ))}
                    {list.length > (view === 'week' ? 8 : 3) && (
                      <li className="px-1 text-[10px] text-text-muted">
                        +{list.length - (view === 'week' ? 8 : 3)}
                      </li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
        )}

        {!loading && movements.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Wallet className="h-5 w-5 text-text-muted" />
            <p className="text-sm font-medium text-text-primary">
              {t('fin_empty_title')}
            </p>
            <p className="max-w-sm text-xs text-text-muted">{t('fin_empty_hint')}</p>
          </div>
        )}
        </>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('fin_edit') : t('fin_add')}</DialogTitle>
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
                    setForm(f => ({
                      ...f,
                      flow: e.target.value as FinanceMovementFlow,
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="expense">{t('fin_flow_expense')}</option>
                  <option value="income">{t('fin_flow_income')}</option>
                  <option value="investment">{t('fin_flow_investment')}</option>
                </select>
              </label>
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_status')}</span>
                <select
                  value={form.status}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      status: e.target.value as FinanceMovementStatus,
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="planned">{t('fin_status_planned')}</option>
                  <option value="confirmed">{t('fin_status_confirmed')}</option>
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
                <select
                  value={form.currency}
                  onChange={e =>
                    setForm(f => ({ ...f, currency: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {form.flow === 'expense' && !form.creditPayment && (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_category')}</span>
                <select
                  value={form.category}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      category: e.target.value as FinanceCategory,
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  {FINANCE_CATEGORIES.filter(c => c !== 'invest').map(cat => (
                    <option key={cat} value={cat}>
                      {t(`fin_cat_${cat}` as 'fin_cat_other')}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {form.flow === 'investment' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1 text-xs text-text-muted">
                    <span>{t('fin_invest_ticker')}</span>
                    <Input
                      value={form.ticker}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          ticker: e.target.value.toUpperCase(),
                        }))
                      }
                      className="h-9 text-sm uppercase"
                      placeholder="AAPL"
                    />
                  </label>
                  <label className="block space-y-1 text-xs text-text-muted">
                    <span>{t('fin_invest_qty')}</span>
                    <DecimalInput
                      value={form.quantity}
                      onChange={v => setForm(f => ({ ...f, quantity: v }))}
                      min={0}
                      max={1_000_000_000}
                      className="h-9 text-sm"
                    />
                  </label>
                </div>
                <label className="block space-y-1 text-xs text-text-muted">
                  <span>{t('fin_invest_name')}</span>
                  <Input
                    value={form.assetName}
                    onChange={e =>
                      setForm(f => ({ ...f, assetName: e.target.value }))
                    }
                    className="h-9 text-sm"
                  />
                </label>
              </>
            )}
            {accounts.length > 0 && (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_account')}</span>
                <select
                  value={form.accountId}
                  onChange={e =>
                    setForm(f => ({ ...f, accountId: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="">{t('fin_account_all')}</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || acc.type}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {goals.length > 0 && form.flow === 'expense' && (
              <>
                <label className="flex items-center gap-2 text-xs text-text-primary">
                  <input
                    type="checkbox"
                    checked={form.goalContribution}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        goalContribution: e.target.checked,
                        cardPayment: e.target.checked ? false : f.cardPayment,
                      }))
                    }
                  />
                  {t('fin_goal_contribution')}
                </label>
                {form.goalContribution && (
                  <label className="block space-y-1 text-xs text-text-muted">
                    <span>{t('fin_goal_contribution_of')}</span>
                    <select
                      value={form.goalId}
                      onChange={e =>
                        setForm(f => ({ ...f, goalId: e.target.value }))
                      }
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    >
                      <option value="">{t('fin_tab_goals')}</option>
                      {goals.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {!editing && form.flow === 'expense' && (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_installments')}</span>
                <Input
                  type="number"
                  min={1}
                  max={48}
                  value={form.installmentTotal}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      installmentTotal: Math.max(
                        1,
                        Math.min(48, Number(e.target.value) || 1)
                      ),
                    }))
                  }
                  className="h-9 text-sm"
                />
              </label>
            )}
            {credits.length > 0 && form.flow === 'expense' && (
              <>
                <label className="flex items-center gap-2 text-xs text-text-primary">
                  <input
                    type="checkbox"
                    checked={form.creditPayment}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        creditPayment: e.target.checked,
                        cardPayment: e.target.checked ? false : f.cardPayment,
                        goalContribution: e.target.checked
                          ? false
                          : f.goalContribution,
                      }))
                    }
                  />
                  {t('fin_credit_payment')}
                </label>
                {form.creditPayment && (
                  <label className="block space-y-1 text-xs text-text-muted">
                    <span>{t('fin_credit_payment_of')}</span>
                    <select
                      value={form.creditId}
                      onChange={e =>
                        setForm(f => ({ ...f, creditId: e.target.value }))
                      }
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    >
                      <option value="">{t('fin_tab_credits')}</option>
                      {credits.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {accounts.some(a => a.type === 'credit') && form.flow === 'expense' && (
              <>
                <label className="flex items-center gap-2 text-xs text-text-primary">
                  <input
                    type="checkbox"
                    checked={form.cardPayment}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        cardPayment: e.target.checked,
                        goalContribution: e.target.checked
                          ? false
                          : f.goalContribution,
                      }))
                    }
                  />
                  {t('fin_card_payment')}
                </label>
                {form.cardPayment && (
                  <label className="block space-y-1 text-xs text-text-muted">
                    <span>{t('fin_card_payment_of')}</span>
                    <select
                      value={form.cardAccountId}
                      onChange={e =>
                        setForm(f => ({ ...f, cardAccountId: e.target.value }))
                      }
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    >
                      <option value="">{t('fin_account_all')}</option>
                      {accounts
                        .filter(a => a.type === 'credit')
                        .map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name || acc.type}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            )}
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_field_date')}</span>
              <Input
                type="date"
                value={form.dayId}
                onChange={e => setForm(f => ({ ...f, dayId: e.target.value }))}
                className="h-9 text-sm"
              />
            </label>
            {!editing && form.flow !== 'investment' && (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_repeat')}</span>
                <select
                  value={form.repeat}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      repeat: e.target.value as MovementForm['repeat'],
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="none">{t('fin_repeat_none')}</option>
                  <option value="monthly">{t('fin_freq_monthly')}</option>
                  <option value="weekly">{t('fin_freq_weekly')}</option>
                </select>
              </label>
            )}
            {form.repeat === 'monthly' && !editing && (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_monthday')}</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.recurrenceDay}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      recurrenceDay: Number(e.target.value) || 1,
                    }))
                  }
                  className="h-9 text-sm"
                />
              </label>
            )}
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_field_notes')}</span>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-border bg-field px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-between pt-1">
              {editing && !editing.virtual ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-accent-red"
                  onClick={() => {
                    setDeleteTarget(editing);
                    setDialogOpen(false);
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {t('action_delete')}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                >
                  {t('action_cancel')}
                </Button>
                <Button type="button" onClick={() => void handleSave()}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {editing ? t('action_save') : t('fin_add')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('action_delete')}
        description={deleteTarget?.title ?? ''}
        confirmLabel={t('action_delete')}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </Layout>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'red' | 'teal' | 'muted';
}) {
  const color =
    tone === 'green'
      ? 'text-accent-green'
      : tone === 'red'
        ? 'text-accent-red'
        : tone === 'teal'
          ? 'text-accent-teal'
          : 'text-text-primary';
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-3">
      <p className="text-[11px] text-text-muted">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', color)}>{value}</p>
    </div>
  );
}
