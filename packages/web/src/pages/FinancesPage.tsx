import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  addDays,
  addMonths,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  Paperclip,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { SimpleSelect } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { CategoriesPanel } from '@/components/Finances/CategoriesPanel';
import { EvolutionPanel } from '@/components/Finances/EvolutionPanel';
import { MovementsListPanel } from '@/components/Finances/MovementsListPanel';
import { TaskImagesField } from '@/components/Board/TaskImagesField';
import {
  CategorySplitEditor,
  initialSplitRows,
  resolveSplitGroupKey,
  type CategorySplitRow,
} from '@/components/Finances/CategorySplitEditor';
import { ApiClientError } from '@core/lib/api';
import { todayCivilDate } from '@core/lib/civilDate';
import {
  getDayId,
  fetchFinanceKindTasks,
  fetchTasksInRange,
} from '@core/services/taskService';
import { useStore } from '@core/store';
import { isFinanceKind } from '@core/lib/financeKinds';
import {
  INFERRED_RULE_PREFIX,
  expandFinanceCredits,
  financeSeriesHintsFromTasks,
  matchFinanceRuleForMovement,
  mergeBoardFinanceIntoMovements,
  syncBoardFinanceToLedger,
  type LocatedFinanceTask,
} from '@core/lib/finance';
import {
  createFinanceMovement,
  deleteFinanceMovement,
  fetchFinanceCalendar,
  fetchFinanceLedger,
  resolveFinanceFx,
  updateFinanceMovement,
  updateFinanceRule,
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
  FinanceRule,
  FinanceRuleFrequency,
} from '@core/lib/finance/types';
import { FINANCE_CATEGORIES } from '@core/lib/finance/types';
import {
  categorySplitsRemaining,
  splitMatchTolerance,
} from '@core/lib/finance/categorySplits';
import { stripInstallmentSuffix } from '@core/lib/finance/installmentSchedule';
import {
  addMonthsToDayId,
  summarizeInstallmentPurchases,
} from '@core/lib/finance/installments';
import { reportingAmountOf } from '@core/lib/finance/fx';
import { unsealFinanceLedger } from '@core/lib/finance/unseal';
import type { FinanceUserCategory } from '@core/lib/finance/types';
import { fetchFinanceCategories } from '@core/services/financeCategoryService';
import {
  defaultCurrencyFromLocale,
  normalizeCurrencyCode,
  SUPPORTED_CURRENCIES,
} from '@core/lib/currencies';

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

function currencySymbol(code: string): string {
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  return '$';
}

type CalView = 'month' | 'week';

const FINANCE_HUBS = [
  'calendar',
  'list',
  'categories',
  'accounts',
  'evolution',
  'credits',
  'goals',
  'investments',
  'health',
] as const;

type FinanceHub = (typeof FINANCE_HUBS)[number];

function parseFinanceHub(raw: string | null): FinanceHub {
  if (raw && (FINANCE_HUBS as readonly string[]).includes(raw)) {
    return raw as FinanceHub;
  }
  return 'calendar';
}

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
  categoryId: string;
  images: string[];
  categorySplits: CategorySplitRow[];
}

function emptyForm(dayId: string, currency: string): MovementForm {
  return {
    dayId,
    flow: 'expense',
    status: 'confirmed',
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
    categoryId: '',
    images: [],
    categorySplits: [],
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
  const uid = useStore(s => s.uid);
  const [searchParams, setSearchParams] = useSearchParams();
  const hub = parseFinanceHub(searchParams.get('tab'));

  function setHub(id: FinanceHub) {
    if (id === 'calendar') setSearchParams({}, { replace: true });
    else setSearchParams({ tab: id }, { replace: true });
  }
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
  const [showAttach, setShowAttach] = useState(false);
  const [editing, setEditing] = useState<FinanceMovement | null>(null);
  const [form, setForm] = useState<MovementForm>(() =>
    emptyForm(todayId, preferred)
  );
  // Keep unsaved creation input while the dialog/attachment picker is opened and closed.
  // This is intentionally in-memory: finance data must not be copied to browser storage.
  const [newMovementDraft, setNewMovementDraft] =
    useState<MovementForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceMovement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterFlow, setFilterFlow] = useState<
    'all' | 'income' | 'expense' | 'investment'
  >('all');
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [credits, setCredits] = useState<FinanceCredit[]>([]);
  const [userCategories, setUserCategories] = useState<FinanceUserCategory[]>(
    []
  );
  const [ledgerMovements, setLedgerMovements] = useState<FinanceMovement[]>([]);
  const [ledgerRules, setLedgerRules] = useState<FinanceRule[]>([]);
  const [boardFinanceTasks, setBoardFinanceTasks] = useState<LocatedFinanceTask[]>(
    []
  );
  const migratedInstallmentGroups = useRef(new Set<string>());
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
      const [rows, accs, gls, crs, ledger, cats, taskRows, financeKindTasks] =
        await Promise.all([
        fetchFinanceCalendar(range.from, range.to, vault ?? undefined),
        fetchFinanceAccounts(),
        fetchFinanceGoals(),
        fetchFinanceCredits(),
        fetchFinanceLedger(),
        fetchFinanceCategories().catch(() => [] as FinanceUserCategory[]),
        uid
          ? fetchTasksInRange(uid, range.from, range.to).catch(() => [])
          : Promise.resolve([]),
        uid ? fetchFinanceKindTasks(uid).catch(() => []) : Promise.resolve([]),
      ]);
      setAccounts(accs);
      setGoals(gls);
      setCredits(crs);
      setUserCategories(cats);
      const opened =
        vault
          ? await unsealFinanceLedger(
              vault.uid,
              vault.dek,
              ledger.movements,
              ledger.rules
            )
          : ledger;
      setLedgerMovements(opened.movements);
      setLedgerRules(opened.rules);
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
      const financeTasks = taskRows.filter(row => isFinanceKind(row.kind));
      setBoardFinanceTasks(financeKindTasks.filter(row => isFinanceKind(row.kind)));
      const withCredits = [
        ...next,
        ...expandFinanceCredits(crs, next, range.from, range.to),
      ];
      setMovements(mergeBoardFinanceIntoMovements(withCredits, financeTasks));
      if (financeTasks.length > 0) {
        const persisted = await syncBoardFinanceToLedger({
          movements: next,
          tasks: financeTasks,
          vault: vault ?? undefined,
        }).catch(() => false);
        if (persisted) {
          const refreshed = await fetchFinanceCalendar(
            range.from,
            range.to,
            vault ?? undefined
          );
          const refreshedWithCredits = [
            ...refreshed,
            ...expandFinanceCredits(crs, refreshed, range.from, range.to),
          ];
          setMovements(
            mergeBoardFinanceIntoMovements(refreshedWithCredits, financeTasks)
          );
        }
      }
    } catch (err) {
      const msg =
        err instanceof ApiClientError &&
        /schema cache|does not exist|PGRST204|42703|42P01|SQL de finanzas/i.test(
          err.message
        )
          ? t('fin_sql_needed')
          : t('fin_load_error');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, showToast, t, vault, preferred, uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const groups = new Map<string, FinanceMovement[]>();
    for (const mov of ledgerMovements) {
      if (!mov.installmentGroupId || (mov.installmentTotal ?? 0) < 2) continue;
      const rows = groups.get(mov.installmentGroupId) ?? [];
      rows.push(mov);
      groups.set(mov.installmentGroupId, rows);
    }
    const legacyPurchases = [...groups.entries()].filter(([groupId, rows]) => {
      const first = rows.find(row => row.installmentIndex === 1);
      return Boolean(
        first &&
          rows.some(row => !row.purchaseDayId) &&
          !migratedInstallmentGroups.current.has(groupId) &&
          accounts.find(account => account.id === first.accountId)?.type === 'credit'
      );
    });
    if (legacyPurchases.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (const [groupId, rows] of legacyPurchases) {
        const first = rows.find(row => row.installmentIndex === 1);
        if (!first) continue;
        const purchaseDayId =
          rows.find(row => row.purchaseDayId)?.purchaseDayId ?? first.dayId;
        migratedInstallmentGroups.current.add(groupId);
        try {
          await Promise.all(
            rows.filter(row => !row.purchaseDayId).map(row => {
              const {
                payloadEnc: _payloadEnc,
                sealed: _sealed,
                virtual: _virtual,
                createdAt: _createdAt,
                ...movementPatch
              } = row;
              return updateFinanceMovement(
                row.id,
                {
                  ...movementPatch,
                  dayId: addMonthsToDayId(row.dayId, 1),
                  purchaseDayId,
                  updatedAt: row.updatedAt,
                },
                vault ?? undefined
              );
            })
          );
        } catch {
          migratedInstallmentGroups.current.delete(groupId);
          if (!cancelled) showToast(t('fin_load_error'), 'error');
          return;
        }
      }
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [accounts, ledgerMovements, reload, showToast, t, vault]);

  const paymentLedger = useMemo(
    () => (ledgerMovements.length > 0 ? ledgerMovements : movements),
    [ledgerMovements, movements]
  );
  const listMovements = useMemo(() => {
    const map = new Map<string, FinanceMovement>();
    for (const mov of paymentLedger) map.set(mov.id, mov);
    for (const mov of movements) {
      const existing = map.get(mov.id);
      if (!existing) map.set(mov.id, mov);
      else if (existing.virtual && !mov.virtual) map.set(mov.id, mov);
    }
    return [...map.values()];
  }, [paymentLedger, movements]);
  const seriesHints = useMemo(
    () => financeSeriesHintsFromTasks(boardFinanceTasks),
    [boardFinanceTasks]
  );
  const installmentPurchases = useMemo(
    () => summarizeInstallmentPurchases(paymentLedger, todayId),
    [paymentLedger, todayId]
  );
  const installmentRowsByGroup = useMemo(() => {
    const rows = new Map<string, FinanceMovement[]>();
    for (const mov of paymentLedger) {
      if (!mov.installmentGroupId) continue;
      const group = rows.get(mov.installmentGroupId) ?? [];
      group.push(mov);
      rows.set(mov.installmentGroupId, group);
    }
    for (const group of rows.values()) {
      group.sort(
        (a, b) =>
          (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0) ||
          a.dayId.localeCompare(b.dayId)
      );
    }
    return rows;
  }, [paymentLedger]);

  const byDay = useMemo(() => {
    const map = new Map<string, FinanceMovement[]>();
    const matchesFilters = (mov: FinanceMovement) => {
      if (filterFlow !== 'all' && mov.flow !== filterFlow) return false;
      return !(
        filterAccountId !== 'all' &&
        mov.accountId !== filterAccountId &&
        mov.cardAccountId !== filterAccountId
      );
    };
    for (const mov of movements) {
      if (!matchesFilters(mov)) continue;
      const list = map.get(mov.dayId) ?? [];
      list.push(mov);
      map.set(mov.dayId, list);
    }
    for (const mov of paymentLedger) {
      const purchaseDayId = mov.purchaseDayId;
      const purchase = mov.installmentGroupId
        ? installmentPurchases.get(mov.installmentGroupId)
        : undefined;
      const creditAccount = accounts.find(account => account.id === mov.accountId);
      if (
        !purchaseDayId ||
        mov.installmentIndex !== 1 ||
        !purchase ||
        creditAccount?.type !== 'credit' ||
        purchaseDayId < range.from ||
        purchaseDayId > range.to ||
        !matchesFilters(mov)
      ) {
        continue;
      }
      const list = map.get(purchaseDayId) ?? [];
      list.unshift({
        ...mov,
        dayId: purchaseDayId,
        amount: purchase.totalAmount,
        virtual: true,
      });
      map.set(purchaseDayId, list);
    }
    return map;
  }, [
    movements,
    paymentLedger,
    installmentPurchases,
    accounts,
    range.from,
    range.to,
    filterFlow,
    filterAccountId,
  ]);

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
  const monthlyBreakdown = useMemo(() => {
    const income: FinanceMovement[] = [];
    const expenses: FinanceMovement[] = [];
    const cardExpenses: FinanceMovement[] = [];
    let incomeTotal = 0;
    let expenseTotal = 0;
    let cardExpenseTotal = 0;
    for (const mov of movements) {
      if (!mov.dayId.startsWith(monthId)) continue;
      if (
        mov.status !== 'confirmed' ||
        mov.flow === 'investment' ||
        mov.tag === 'card_payment' ||
        mov.tag === 'goal_contribution'
      ) {
        continue;
      }
      const amount = reportingAmountOf(mov, summary.currency);
      if (amount == null) continue;
      if (mov.flow === 'income') {
        income.push(mov);
        incomeTotal += amount;
        continue;
      }
      const isCreditCard =
        accounts.find(account => account.id === mov.accountId)?.type === 'credit';
      // Las cuotas se contabilizan como gasto de tarjeta en el mes de compra,
      // no de nuevo en cada mes de vencimiento.
      if (isCreditCard && (mov.installmentTotal ?? 0) > 1) continue;
      if (isCreditCard) {
        cardExpenses.push(mov);
        cardExpenseTotal += amount;
      } else {
        expenses.push(mov);
        expenseTotal += amount;
      }
    }
    for (const [groupId, rows] of installmentRowsByGroup) {
      const first = rows.find(row => row.installmentIndex === 1);
      if (
        !first ||
        first.status !== 'confirmed' ||
        accounts.find(account => account.id === first.accountId)?.type !== 'credit'
      ) {
        continue;
      }
      const purchaseDayId = first.purchaseDayId ?? first.dayId;
      if (!purchaseDayId.startsWith(monthId)) continue;
      const amounts = rows
        .filter(row => row.status !== 'skipped')
        .map(row => reportingAmountOf(row, summary.currency));
      if (!amounts.every((amount): amount is number => amount !== null)) continue;
      const purchaseTotal = amounts.reduce((sum, amount) => sum + amount, 0);
      cardExpenseTotal += purchaseTotal;
      cardExpenses.push({
        ...first,
        id: `card-purchase-${groupId}`,
        dayId: purchaseDayId,
        title: stripInstallmentSuffix(first.title),
        amount: purchaseTotal,
        currency: summary.currency,
        originalCurrency: summary.currency,
        exchangeRate: 1,
        fxPending: false,
        virtual: true,
      });
    }
    return {
      income,
      expenses,
      cardExpenses,
      incomeTotal,
      expenseTotal,
      cardExpenseTotal,
      availableBalance: incomeTotal - expenseTotal,
      balanceIncludingCard: incomeTotal - expenseTotal - cardExpenseTotal,
    };
  }, [
    movements,
    installmentRowsByGroup,
    monthId,
    summary.currency,
    accounts,
  ]);
  useEffect(() => {
    if (dialogOpen && !editing) setNewMovementDraft(form);
  }, [dialogOpen, editing, form]);

  function openCreate(dayId = todayId) {
    setEditing(null);
    const d = Number(dayId.slice(8, 10));
    const nextForm =
      newMovementDraft ?? {
        ...emptyForm(dayId, preferred),
        recurrenceDay: d || 1,
      };
    setShowAttach(nextForm.images.length > 0);
    setForm(nextForm);
    setDialogOpen(true);
  }

  function openEdit(mov: FinanceMovement) {
    if (mov.virtual && mov.ruleId) {
      const sibling = paymentLedger.find(
        item => item.ruleId === mov.ruleId && !item.virtual
      );
      if (sibling) {
        openEdit(sibling);
        return;
      }
    }
    if (mov.virtual && mov.purchaseDayId === mov.dayId && mov.installmentGroupId) {
      const source = paymentLedger.find(item => item.id === mov.id);
      if (source) {
        openEdit(source);
        return;
      }
    }
    if (mov.virtual) {
      const virtualRule = mov.ruleId
        ? ledgerRules.find(rule => rule.id === mov.ruleId)
        : matchFinanceRuleForMovement(ledgerRules, mov);
      setEditing(null);
      setForm({
        ...emptyForm(mov.dayId, mov.currency),
        flow: mov.flow,
        status: 'confirmed',
        title: mov.title,
        amount: mov.amount,
        notes: mov.notes,
        repeat: virtualRule?.frequency ?? 'none',
        recurrenceDay:
          virtualRule?.recurrenceDay ??
          (Number(mov.dayId.slice(8, 10)) || 1),
        creditPayment:
          Boolean(mov.creditId) || mov.tag === 'credit_payment',
        creditId: mov.creditId ?? '',
      });
      setShowAttach(false);
      setDialogOpen(true);
      return;
    }
    const installmentSiblings = mov.installmentGroupId
      ? ledgerMovements
          .filter(item => item.installmentGroupId === mov.installmentGroupId)
          .sort((a, b) => a.dayId.localeCompare(b.dayId))
      : [mov];
    const purchaseRows = installmentSiblings.length > 0 ? installmentSiblings : [mov];
    const firstPurchaseRow = purchaseRows[0];
    const categorySplitMap = new Map<
      string,
      { id: string; categoryId: string; amount: number }
    >();
    for (const row of purchaseRows) {
      for (const split of row.categorySplits ?? []) {
        const previous = categorySplitMap.get(split.categoryId);
        categorySplitMap.set(split.categoryId, {
          id: previous?.id ?? split.id,
          categoryId: split.categoryId,
          amount: (previous?.amount ?? 0) + split.amount,
        });
      }
    }
    const recurringRule = matchFinanceRuleForMovement(
      ledgerRules,
      firstPurchaseRow
    );
    setEditing(mov);
    setShowAttach(
      purchaseRows.some(row => (row.images?.length ?? 0) > 0)
    );
    setForm({
      dayId: firstPurchaseRow.purchaseDayId ?? firstPurchaseRow.dayId,
      flow: firstPurchaseRow.flow,
      status: firstPurchaseRow.status,
      currency: firstPurchaseRow.currency,
      title: stripInstallmentSuffix(firstPurchaseRow.title),
      amount: purchaseRows.reduce((sum, row) => sum + row.amount, 0),
      accountId: firstPurchaseRow.accountId ?? '',
      cardPayment: firstPurchaseRow.tag === 'card_payment',
      cardAccountId: firstPurchaseRow.cardAccountId ?? '',
      goalContribution: firstPurchaseRow.tag === 'goal_contribution',
      goalId: firstPurchaseRow.goalId ?? '',
      installmentTotal: firstPurchaseRow.installmentTotal ?? 1,
      creditPayment: firstPurchaseRow.tag === 'credit_payment',
      creditId: firstPurchaseRow.creditId ?? '',
      ticker: firstPurchaseRow.ticker ?? '',
      assetName: firstPurchaseRow.assetName ?? '',
      quantity: firstPurchaseRow.quantity ?? 1,
      category:
        firstPurchaseRow.category ??
        (firstPurchaseRow.flow === 'investment'
          ? 'invest'
          : firstPurchaseRow.tag === 'credit_payment'
            ? 'debt'
            : 'other'),
      categoryId: firstPurchaseRow.categoryId ?? '',
      images: purchaseRows.find(row => (row.images?.length ?? 0) > 0)?.images ?? [],
      categorySplits:
        categorySplitMap.size > 1
          ? [...categorySplitMap.values()]
          : [],
      notes: firstPurchaseRow.notes,
      repeat: recurringRule?.frequency ?? 'none',
      recurrenceDay:
        recurringRule?.recurrenceDay ??
        (Number((firstPurchaseRow.purchaseDayId ?? firstPurchaseRow.dayId).slice(8, 10)) ||
          1),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const isInvest = form.flow === 'investment';
    const isExpense = form.flow === 'expense';
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
    const splitRows = form.categorySplits.filter(
      r => r.categoryId && r.amount > 0
    );
    let categorySplits:
      | Array<{
          id: string;
          categoryId: string;
          groupKey: FinanceCategory;
          amount: number;
        }>
      | undefined;
    if (!isInvest && splitRows.length >= 2) {
      const leftover = categorySplitsRemaining(splitRows, form.amount);
      if (Math.abs(leftover) > splitMatchTolerance(form.amount)) {
        showToast(
          t('fin_split_mismatch').replace(
            '{amount}',
            money(Math.abs(leftover), form.currency)
          ),
          'error'
        );
        return;
      }
      categorySplits = splitRows.map(row => ({
        id: row.id,
        categoryId: row.categoryId,
        groupKey: resolveSplitGroupKey(row.categoryId, userCategories),
        amount: row.amount,
      }));
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
      accountId: isExpense ? form.accountId || null : null,
      cardAccountId:
        isExpense && form.cardPayment ? form.cardAccountId || null : null,
      goalId:
        isExpense && form.goalContribution ? form.goalId || null : null,
      creditId:
        isExpense && form.creditPayment ? form.creditId || null : null,
      tag: isExpense
        ? form.creditPayment
          ? 'credit_payment'
          : form.goalContribution
            ? 'goal_contribution'
            : form.cardPayment
              ? 'card_payment'
              : null
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
        : isExpense && form.creditPayment
          ? 'debt'
          : categorySplits
            ? categorySplits[0].groupKey
            : form.category,
      categoryId: isInvest
        ? null
        : categorySplits
          ? categorySplits[0].categoryId
          : form.categoryId || null,
      categorySplits,
      images: form.images,
      installmentTotal:
        isExpense &&
        accounts.find(a => a.id === form.accountId)?.type === 'credit' &&
        form.installmentTotal > 1
          ? form.installmentTotal
          : undefined,
      replaceMovementId: editing?.id,
      ...fx,
      recurrence:
        form.repeat !== 'none'
          ? {
              frequency: form.repeat,
              recurrenceDay: form.recurrenceDay,
            }
          : null,
    };
    try {
      if (editing) {
        await createFinanceMovement(payload, vault ?? undefined);
        showToast(
          fx.fxPending ? t('fin_fx_pending') : t('fin_saved'),
          fx.fxPending ? 'info' : 'success'
        );
      } else {
        await createFinanceMovement(payload, vault ?? undefined);
        setNewMovementDraft(null);
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
        /schema cache|does not exist|PGRST204|42703|42P01|SQL de finanzas/i.test(
          err.message
        )
          ? t('fin_sql_needed')
          : err instanceof ApiClientError && err.message
            ? err.message
            : t('fin_save_error');
      showToast(msg, 'error');
    }
  }

  async function toggleMovementStatus(mov: FinanceMovement) {
    if (!['planned', 'confirmed'].includes(mov.status)) return;
    const status = mov.status === 'planned' ? 'confirmed' : 'planned';
    try {
      if (mov.virtual) {
        if (status !== 'confirmed' || (!mov.ruleId && !mov.creditId)) return;
        await createFinanceMovement(
          {
            dayId: mov.dayId,
            flow: mov.flow,
            status: 'confirmed',
            title: mov.title,
            amount: mov.amount,
            currency: mov.currency,
            notes: mov.notes,
            certainty: mov.certainty,
            ruleId: mov.ruleId ?? undefined,
            creditId: mov.creditId ?? undefined,
            tag: mov.tag ?? (mov.creditId ? 'credit_payment' : undefined),
            accountId: mov.accountId ?? undefined,
            categoryId: mov.categoryId ?? undefined,
            category: mov.category ?? (mov.creditId ? 'debt' : undefined),
          },
          vault ?? undefined
        );
      } else {
        await updateFinanceMovement(
          mov.id,
          { status, updatedAt: mov.updatedAt },
          vault ?? undefined
        );
      }
      showToast(t(status === 'confirmed' ? 'fin_status_confirmed' : 'fin_status_planned'), 'success');
      await reload();
    } catch {
      showToast(t('fin_save_error'), 'error');
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

  const hubTitle =
    hub === 'categories'
      ? t('fin_tab_categories')
      : hub === 'accounts'
        ? t('fin_tab_accounts')
        : hub === 'evolution'
          ? t('fin_tab_evolution')
          : hub === 'credits'
            ? t('fin_tab_credits')
            : hub === 'goals'
              ? t('fin_tab_goals')
              : hub === 'investments'
                ? t('fin_tab_investments')
                : hub === 'health'
                  ? t('fin_tab_health')
                  : hub === 'list'
                    ? t('fin_tab_list')
                    : t('nav_finances');

  return (
    <Layout
      title={hubTitle}
      primaryAction={
        hub === 'calendar' || hub === 'list'
          ? { label: t('fin_add'), onClick: () => openCreate(todayId) }
          : undefined
      }
      onFabClick={() => openCreate(todayId)}
      showFab={hub === 'calendar' || hub === 'list'}
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6',
          hub === 'list' ? 'overflow-hidden' : 'overflow-y-auto'
        )}
      >
        <div className="flex flex-wrap gap-1">
          {FINANCE_HUBS.map(id => (
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
                : id === 'list'
                  ? t('fin_tab_list')
                : id === 'accounts'
                  ? t('fin_tab_accounts')
                  : id === 'goals'
                    ? t('fin_tab_goals')
                    : id === 'credits'
                      ? t('fin_tab_credits')
                      : id === 'investments'
                        ? t('fin_tab_investments')
                        : id === 'health'
                          ? t('fin_tab_health')
                          : id === 'evolution'
                            ? t('fin_tab_evolution')
                            : t('fin_tab_categories')}
            </button>
          ))}
        </div>

        {hub === 'list' ? (
          <MovementsListPanel
            movements={listMovements}
            rules={ledgerRules}
            seriesHints={seriesHints}
            credits={credits}
            money={money}
            onEdit={openEdit}
            onUpdateRule={(rule, patch, sample) => {
              void (async () => {
                try {
                  if (rule.id.startsWith(INFERRED_RULE_PREFIX)) {
                    const cadence = {
                      frequency: patch.frequency ?? rule.frequency,
                      recurrenceDay: patch.recurrenceDay ?? rule.recurrenceDay,
                    };
                    await createFinanceMovement(
                      {
                        dayId: sample.dayId,
                        flow: sample.flow,
                        status: sample.status,
                        currency: sample.currency,
                        title: sample.title,
                        amount: sample.amount,
                        notes: sample.notes,
                        certainty: sample.certainty,
                        recurrence: cadence,
                        replaceMovementId:
                          sample.virtual || sample.id.startsWith('rule:')
                            ? undefined
                            : sample.id,
                      },
                      vault ?? undefined
                    );
                  } else {
                    await updateFinanceRule(rule.id, patch);
                  }
                  showToast(t('fin_saved'), 'success');
                  await reload();
                } catch {
                  showToast(t('fin_save_error'), 'error');
                }
              })();
            }}
          />
        ) : null}

        {hub === 'accounts' ? (
          <AccountsPanel
            accounts={accounts}
            movements={ledgerMovements.length ? ledgerMovements : movements}
            defaultCurrency={preferred}
            todayDayId={todayId}
            monthId={monthId}
            vault={vault}
            onChanged={reload}
          />
        ) : null}

        {hub === 'evolution' ? (
          <EvolutionPanel
            movements={ledgerMovements.length ? ledgerMovements : movements}
            rules={ledgerRules}
            credits={credits}
            userCategories={userCategories}
            monthId={monthId}
            reportingCurrency={preferred}
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

        {hub === 'categories' ? (
          <CategoriesPanel
            categories={userCategories}
            movements={ledgerMovements.length ? ledgerMovements : movements}
            monthId={monthId}
            defaultCurrency={preferred}
            onChanged={reload}
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
            value={money(monthlyBreakdown.incomeTotal, summary.currency)}
            tone="green"
            secondary={{
              label: t('fin_kpi_planned'),
              value: money(summary.plannedIncome, summary.currency),
              tone: 'green',
            }}
            detail={
              <MonthlyBreakdownTooltip
                sections={[
                  {
                    label: t('fin_total_income'),
                    tone: 'green',
                    movements: monthlyBreakdown.income,
                    total: monthlyBreakdown.incomeTotal,
                  },
                ]}
                currency={summary.currency}
                emptyLabel={t('fin_breakdown_empty')}
              />
            }
          />
          <Kpi
            label={t('fin_total_expense')}
            value={money(monthlyBreakdown.expenseTotal, summary.currency)}
            tone="red"
            secondary={{
              label: t('fin_credit_card_expenses'),
              value: money(monthlyBreakdown.cardExpenseTotal, summary.currency),
              tone: 'violet',
            }}
            detail={
              <MonthlyBreakdownTooltip
                sections={[
                  {
                    label: t('fin_total_expense'),
                    tone: 'red',
                    movements: monthlyBreakdown.expenses,
                    total: monthlyBreakdown.expenseTotal,
                  },
                  {
                    label: t('fin_credit_card_expenses'),
                    tone: 'violet',
                    movements: monthlyBreakdown.cardExpenses,
                    total: monthlyBreakdown.cardExpenseTotal,
                  },
                ]}
                currency={summary.currency}
                emptyLabel={t('fin_breakdown_empty')}
              />
            }
          />
          <Kpi
            label={t('fin_balance_available')}
            value={money(monthlyBreakdown.availableBalance, summary.currency)}
            tone={monthlyBreakdown.availableBalance >= 0 ? 'teal' : 'red'}
            secondary={{
              label: t('fin_balance_including_card'),
              value: money(monthlyBreakdown.balanceIncludingCard, summary.currency),
              tone: monthlyBreakdown.balanceIncludingCard >= 0 ? 'teal' : 'red',
            }}
          />
          <Kpi
            label={t('fin_balance')}
            value={money(summary.balance, summary.currency)}
            tone={summary.balance >= 0 ? 'teal' : 'red'}
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
                    {list.slice(0, view === 'week' ? 8 : 3).map(mov => {
                      const installment = mov.installmentGroupId
                        ? installmentPurchases.get(mov.installmentGroupId)
                        : undefined;
                      const creditInstallment = Boolean(
                        installment &&
                          accounts.find(account => account.id === mov.accountId)
                            ?.type === 'credit'
                      );
                      const creditPurchase = Boolean(
                        creditInstallment &&
                          ((mov.virtual && mov.purchaseDayId === mov.dayId) ||
                            // Compras creadas antes de guardar purchaseDayId: su primera
                            // cuota está en la fecha de compra y se representa como total.
                            (!mov.purchaseDayId && mov.installmentIndex === 1))
                      );
                      const calendarAmount = creditPurchase
                        ? installment?.totalAmount ?? mov.amount
                        : mov.amount;
                      const installmentLabel = installment
                        ? t('fin_installment_of')
                            .replace(
                              '{current}',
                              String(mov.installmentIndex ?? 1)
                            )
                            .replace('{total}', String(installment.totalInstallments))
                        : '';
                      const installmentRows = installment
                        ? installmentRowsByGroup.get(mov.installmentGroupId ?? '') ?? []
                        : [];
                      const movementChip = (
                        <span
                            role="presentation"
                            onClick={e => {
                              e.stopPropagation();
                              openEdit(mov);
                            }}
                            className={cn(
                              'block truncate rounded px-1.5 py-0.5 text-[10px] leading-tight',
                              creditPurchase
                                ? 'bg-violet-500/20 font-semibold text-violet-800 dark:text-violet-200'
                                : mov.flow === 'income'
                                  ? 'bg-accent-green/15 text-accent-green'
                                  : mov.flow === 'investment'
                                    ? 'bg-accent-teal/15 text-accent-teal'
                                    : 'bg-accent-red/15 text-accent-red',
                              mov.status === 'planned' && 'opacity-70',
                              mov.virtual && !creditPurchase && 'border border-dashed border-current'
                            )}
                          >
                            {creditPurchase
                              ? '💳 −'
                              : mov.flow === 'income'
                                ? '+'
                                : mov.flow === 'investment'
                                  ? '◆'
                                  : '−'}
                            {money(calendarAmount, mov.currency)}{' '}
                            {creditInstallment ? stripInstallmentSuffix(mov.title) : mov.title}
                            {creditInstallment ? (
                              <span
                                className={cn(
                                  'ml-1 rounded px-1 text-[9px] font-semibold tabular-nums',
                                  creditPurchase
                                    ? 'bg-violet-500/15'
                                    : 'bg-accent-red/15 text-accent-red'
                                )}
                              >
                                {creditPurchase
                                  ? t('fin_installment_purchase').replace(
                                      '{total}',
                                      String(installment?.totalInstallments ?? 1)
                                    )
                                  : installmentLabel}
                              </span>
                            ) : null}
                            {creditPurchase && installment ? (
                              <span className="ml-1 hidden text-[9px] font-medium opacity-80 md:inline">
                                · {t('fin_installment_total_cost')}: {money(installment.totalAmount, mov.currency)}
                              </span>
                            ) : null}
                            {mov.flow !== 'investment' && mov.status === 'planned' ? (
                              <span
                                role="checkbox"
                                aria-checked="false"
                                aria-label={t('fin_mark_confirmed')}
                                tabIndex={0}
                                onClick={e => {
                                  e.stopPropagation();
                                  void toggleMovementStatus(mov);
                                }}
                                onKeyDown={e => {
                                  if (e.key !== 'Enter' && e.key !== ' ') return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void toggleMovementStatus(mov);
                                }}
                                className="ml-1 inline-flex align-middle text-current hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current"
                              >
                                <Circle className="h-3 w-3" />
                              </span>
                            ) : mov.flow !== 'investment' && mov.status === 'confirmed' ? (
                              <span
                                role="checkbox"
                                aria-checked="true"
                                aria-label={t('fin_mark_planned')}
                                tabIndex={0}
                                onClick={e => {
                                  e.stopPropagation();
                                  void toggleMovementStatus(mov);
                                }}
                                onKeyDown={e => {
                                  if (e.key !== 'Enter' && e.key !== ' ') return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void toggleMovementStatus(mov);
                                }}
                                className="ml-1 inline-flex align-middle text-current hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current"
                              >
                                <CircleCheck className="h-3 w-3" />
                              </span>
                            ) : null}
                            {(mov.images?.length ?? 0) > 0 ? ' 📎' : ''}
                            {mov.fxPending ? ' · FX' : ''}
                        </span>
                      );
                      return (
                        <li key={mov.id}>
                          {creditInstallment && installment ? (
                            <Tooltip delayDuration={180}>
                              <TooltipTrigger asChild>{movementChip}</TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="start"
                                className="w-64 border-border !bg-[var(--color-background-solid)] p-3 text-text-primary shadow-xl"
                              >
                                <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-border pb-2">
                                  <span className="text-[11px] font-medium text-text-muted">
                                    {t('fin_installment_total_cost')}
                                  </span>
                                  <strong className="text-sm tabular-nums text-text-primary">
                                    −{money(installment.totalAmount, mov.currency)}
                                  </strong>
                                </div>
                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                  {t('fin_installments')}
                                </p>
                                <ul className="space-y-1">
                                  {installmentRows.map(row => (
                                    <li
                                      key={row.id}
                                      className="flex items-center justify-between gap-3 rounded bg-field px-2 py-1 text-[10px]"
                                    >
                                      <span className="text-text-muted">
                                        {t('fin_installment_of')
                                          .replace(
                                            '{current}',
                                            String(row.installmentIndex ?? 1)
                                          )
                                          .replace(
                                            '{total}',
                                            String(installment.totalInstallments)
                                          )}
                                        <span className="ml-1 text-text-primary">{row.dayId}</span>
                                      </span>
                                      <strong className="shrink-0 tabular-nums text-accent-red">
                                        −{money(row.amount, row.currency)}
                                      </strong>
                                    </li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            movementChip
                          )}
                        </li>
                      );
                    })}
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
                  onChange={e => {
                    const flow = e.target.value as FinanceMovementFlow;
                    setForm(f =>
                      flow === 'income'
                        ? {
                            ...f,
                            flow,
                            accountId: '',
                            installmentTotal: 1,
                            cardPayment: false,
                            cardAccountId: '',
                            goalContribution: false,
                            goalId: '',
                            creditPayment: false,
                            creditId: '',
                          }
                        : { ...f, flow }
                    );
                  }}
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
                  <option value="confirmed">{t('fin_status_confirmed')}</option>
                  <option value="planned">{t('fin_status_planned')}</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_amount')}</span>
                <DecimalInput
                  prefix={currencySymbol(form.currency)}
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
            {form.flow !== 'income' ? (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_payment_method')}</span>
                <select
                  value={form.accountId}
                  onChange={e => {
                    const accountId = e.target.value;
                    const acc = accounts.find(a => a.id === accountId);
                    setForm(f => ({
                      ...f,
                      accountId,
                      installmentTotal:
                        acc?.type === 'credit' ? f.installmentTotal : 1,
                    }));
                  }}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="">{t('fin_payment_none')}</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {[
                        acc.name ||
                          t(`fin_account_type_${acc.type}` as 'fin_account_type_other'),
                        acc.type !== 'cash' ? acc.institution : '',
                        t(`fin_account_type_${acc.type}` as 'fin_account_type_other'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </option>
                  ))}
                </select>
                {accounts.length === 0 ? (
                  <span className="block text-[11px] text-text-muted">
                    {t('fin_payment_empty_hint')}
                  </span>
                ) : null}
              </label>
            ) : null}
            {form.flow === 'expense' &&
              accounts.find(a => a.id === form.accountId)?.type === 'credit' && (
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
            {form.flow !== 'investment' && !form.creditPayment && (
              <div className="space-y-2">
                {form.categorySplits.length >= 2 ? (
                  <>
                    <CategorySplitEditor
                      total={form.amount}
                      currency={form.currency}
                      rows={form.categorySplits}
                      userCategories={userCategories}
                      onChange={categorySplits =>
                        setForm(f => ({
                          ...f,
                          categorySplits,
                          categoryId: categorySplits[0]?.categoryId || f.categoryId,
                          category: resolveSplitGroupKey(
                            categorySplits[0]?.categoryId || f.categoryId,
                            userCategories
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm(f => ({ ...f, categorySplits: [] }))
                      }
                      className="text-xs text-text-muted underline"
                    >
                      {t('fin_split_off')}
                    </button>
                  </>
                ) : (
                  <>
                    <label className="block space-y-1 text-xs text-text-muted">
                      <span>{t('fin_field_category')}</span>
                      <select
                        value={form.categoryId || form.category}
                        onChange={e => {
                          const value = e.target.value;
                          const custom = userCategories.find(c => c.id === value);
                          setForm(f => ({
                            ...f,
                            categoryId: custom ? custom.id : '',
                            category: custom
                              ? custom.groupKey
                              : (value as FinanceCategory),
                          }));
                        }}
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                      >
                        {userCategories.length > 0
                          ? userCategories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name ||
                                  t(`fin_cat_${cat.groupKey}` as 'fin_cat_other')}
                              </option>
                            ))
                          : FINANCE_CATEGORIES.filter(c => c !== 'invest').map(
                              cat => (
                                <option key={cat} value={cat}>
                                  {t(`fin_cat_${cat}` as 'fin_cat_other')}
                                </option>
                              )
                            )}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setForm(f => ({
                          ...f,
                          categorySplits: initialSplitRows(
                            f.categoryId || f.category,
                            f.amount
                          ),
                        }))
                      }
                      className="text-xs text-accent-teal"
                    >
                      {t('fin_split_on')}
                    </button>
                  </>
                )}
              </div>
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
            {form.flow !== 'investment' && (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_repeat')}</span>
                <SimpleSelect
                  value={form.repeat}
                  onChange={value =>
                    setForm(f => ({
                      ...f,
                      repeat: value as MovementForm['repeat'],
                      recurrenceDay:
                        value === 'weekly'
                          ? Math.min(6, f.recurrenceDay > 6 ? 1 : f.recurrenceDay)
                          : Math.min(31, Math.max(1, f.recurrenceDay || 1)),
                    }))
                  }
                  options={[
                    { value: 'none', label: t('fin_repeat_none') },
                    { value: 'monthly', label: t('fin_freq_monthly') },
                    { value: 'weekly', label: t('fin_freq_weekly') },
                  ]}
                />
              </label>
            )}
            {form.repeat === 'monthly' ? (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_monthday')}</span>
                <SimpleSelect
                  value={String(form.recurrenceDay)}
                  onChange={value =>
                    setForm(f => ({ ...f, recurrenceDay: Number(value) || 1 }))
                  }
                  options={Array.from({ length: 31 }, (_, i) => ({
                    value: String(i + 1),
                    label: t('fin_list_month_day').replace('{n}', String(i + 1)),
                  }))}
                />
              </label>
            ) : null}
            {form.repeat === 'weekly' ? (
              <label className="block space-y-1 text-xs text-text-muted">
                <span>{t('fin_field_weekday')}</span>
                <SimpleSelect
                  value={String(form.recurrenceDay)}
                  onChange={value =>
                    setForm(f => ({ ...f, recurrenceDay: Number(value) }))
                  }
                  options={[
                    t('fin_weekday_0'),
                    t('fin_weekday_1'),
                    t('fin_weekday_2'),
                    t('fin_weekday_3'),
                    t('fin_weekday_4'),
                    t('fin_weekday_5'),
                    t('fin_weekday_6'),
                  ].map((label, i) => ({ value: String(i), label }))}
                />
              </label>
            ) : null}
            <label className="block space-y-1 text-xs text-text-muted">
              <span>{t('fin_field_notes')}</span>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-border bg-field px-3 py-2 text-sm"
              />
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAttach(v => !v)}
                className="flex items-center gap-1.5 text-xs text-accent-teal"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {showAttach
                  ? t('fin_attach_hide')
                  : form.images.length > 0
                    ? t('fin_attach_show_n').replace(
                        '{n}',
                        String(form.images.length)
                      )
                    : t('fin_attach_show')}
              </button>
              {showAttach ? (
                <TaskImagesField
                  images={form.images}
                  onChange={images => setForm(f => ({ ...f, images }))}
                  compact
                />
              ) : null}
            </div>
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
  secondary,
  detail,
}: {
  label: string;
  value: string;
  tone: KpiTone;
  secondary?: { label: string; value: string; tone: KpiTone };
  detail?: ReactNode;
}) {
  const card = (
    <div className="rounded-2xl border border-border bg-surface px-3 py-3">
      <div className={cn('grid gap-3', secondary && 'grid-cols-2')}>
        <div className="min-w-0">
          <p className="text-[11px] text-text-muted">{label}</p>
          <p className={cn('text-lg font-semibold tabular-nums', kpiToneClass(tone))}>
            {value}
          </p>
        </div>
        {secondary ? (
          <div className="min-w-0 border-l border-border pl-3 text-right">
            <p className="truncate text-[10px] text-text-muted">{secondary.label}</p>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                kpiToneClass(secondary.tone)
              )}
            >
              {secondary.value}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
  return detail ? (
    <Tooltip delayDuration={180}>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-h-80 w-80 overflow-y-auto border-border !bg-[var(--color-background-solid)] p-3 text-text-primary shadow-xl"
      >
        {detail}
      </TooltipContent>
    </Tooltip>
  ) : (
    card
  );
}

type KpiTone = 'green' | 'red' | 'teal' | 'violet' | 'muted';

function kpiToneClass(tone: KpiTone): string {
  if (tone === 'green') return 'text-accent-green';
  if (tone === 'red') return 'text-accent-red';
  if (tone === 'teal') return 'text-accent-teal';
  if (tone === 'violet') return 'text-violet-600 dark:text-violet-300';
  return 'text-text-primary';
}

function MonthlyBreakdownTooltip({
  sections,
  currency,
  emptyLabel,
}: {
  sections: Array<{
    label: string;
    tone: KpiTone;
    movements: FinanceMovement[];
    total: number;
  }>;
  currency: string;
  emptyLabel: string;
}) {
  const movementCount = sections.reduce((count, section) => count + section.movements.length, 0);
  if (movementCount === 0) {
    return <p className="text-xs text-text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {sections.map(section => (
        <section key={section.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
            <span className="text-[11px] font-semibold text-text-muted">{section.label}</span>
            <strong className={cn('text-xs tabular-nums', kpiToneClass(section.tone))}>
              {section.tone === 'green' ? '' : '−'}{money(section.total, currency)}
            </strong>
          </div>
          {section.movements.length > 0 ? (
            <ul className="space-y-1">
              {section.movements.map(movement => (
                <MonthlyBreakdownRow
                  key={movement.id}
                  movement={movement}
                  currency={currency}
                  tone={section.tone}
                />
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-text-muted">{emptyLabel}</p>
          )}
        </section>
      ))}
    </div>
  );
}

function MonthlyBreakdownRow({
  movement,
  currency,
  tone,
}: {
  movement: FinanceMovement;
  currency: string;
  tone: KpiTone;
}) {
  const amount = reportingAmountOf(movement, currency) ?? 0;
  return (
    <li className="flex items-center justify-between gap-3 rounded bg-field px-2 py-1 text-[10px]">
      <span className="min-w-0 truncate text-text-primary">
        <span className="mr-1 text-text-muted">{movement.dayId}</span>
        {stripInstallmentSuffix(movement.title)}
      </span>
      <strong className={cn('shrink-0 tabular-nums', kpiToneClass(tone))}>
        {tone === 'green' ? '+' : '−'}{money(amount, currency)}
      </strong>
    </li>
  );
}
