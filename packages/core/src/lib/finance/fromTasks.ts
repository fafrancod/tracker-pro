import type { Task } from '../../types';
import { isFinanceKind } from '../financeKinds';
import { isCalendarDayId } from '../inbox';
import { isRecurring } from '../recurrence';
import { monthIdFromDayId } from './movementSummary';
import { financeTitlesMatch } from './title';
import type { FinanceListSeriesHint } from './listRows';
import type { FinanceMovement, FinanceRule, FinanceRuleFrequency } from './types';

export type LocatedFinanceTask = Task & { weekId: string; dayId: string };

export const BOARD_FINANCE_ID_PREFIX = 'ftask:';

function cadenceFromFinanceTask(
  task: LocatedFinanceTask
): { frequency: FinanceRuleFrequency; recurrenceDay: number } | null {
  if (!isRecurring(task.recurrence)) return null;
  const freq = task.recurrence.frequency;
  const [ys, ms, ds] = task.dayId.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const weekday = y && m && d ? new Date(y, m - 1, d).getDay() : 1;
  if (freq === 'weekly') {
    const iso = task.recurrence.weekdays?.[0];
    const js = iso == null ? weekday : iso === 7 ? 0 : iso;
    return { frequency: 'weekly', recurrenceDay: js };
  }
  if (freq === 'monthly' || freq === 'yearly') {
    return { frequency: 'monthly', recurrenceDay: d || 1 };
  }
  if (freq === 'daily') {
    return { frequency: 'weekly', recurrenceDay: weekday };
  }
  return null;
}

/** Series recurrentes del tablero (finance_income/expense) para colapsar la lista. */
export function financeSeriesHintsFromTasks(
  tasks: LocatedFinanceTask[]
): FinanceListSeriesHint[] {
  const bySeries = new Map<string, FinanceListSeriesHint>();
  for (const task of tasks) {
    if (!isFinanceKind(task.kind)) continue;
    const cadence = cadenceFromFinanceTask(task);
    if (!cadence) continue;
    const seriesId = task.seriesId || task.id;
    const existing = bySeries.get(seriesId);
    if (existing) {
      existing.sourceTaskIds.push(task.id);
      if (task.dayId < existing.startDayId) existing.startDayId = task.dayId;
      continue;
    }
    bySeries.set(seriesId, {
      seriesId,
      title: task.title,
      flow: task.kind === 'finance_income' ? 'income' : 'expense',
      frequency: cadence.frequency,
      recurrenceDay: cadence.recurrenceDay,
      startDayId: task.dayId,
      amount: amountOf(task),
      currency: currencyOf(task),
      notes: task.notes ?? '',
      certainty: task.finance?.certainty ?? 'fixed',
      sourceTaskIds: [task.id],
    });
  }
  return [...bySeries.values()];
}

export interface FinanceRuleAlignment {
  ruleId: string;
  frequency: FinanceRuleFrequency;
  recurrenceDay: number;
}

/**
 * The board task is the source of truth for a linked recurring finance event.
 * A previous date edit could leave its ledger rule on an old day, making the
 * List say "Día 29" while the Finance calendar continued expanding the rule
 * for another day. Reconcile the rule before rendering the calendar.
 */
export function planFinanceRuleAlignment(
  tasks: LocatedFinanceTask[],
  rules: FinanceRule[],
  movements: FinanceMovement[]
): FinanceRuleAlignment[] {
  const representativeBySeries = new Map<
    string,
    { task: LocatedFinanceTask; frequency: FinanceRuleFrequency; recurrenceDay: number }
  >();
  for (const task of tasks) {
    if (!isFinanceKind(task.kind)) continue;
    const cadence = cadenceFromFinanceTask(task);
    if (!cadence) continue;
    const seriesKey = task.seriesId || task.id;
    const existing = representativeBySeries.get(seriesKey);
    if (!existing || task.dayId < existing.task.dayId) {
      representativeBySeries.set(seriesKey, { task, ...cadence });
    }
  }

  const updates = new Map<string, FinanceRuleAlignment>();
  for (const representative of representativeBySeries.values()) {
    const { task, frequency, recurrenceDay } = representative;
    const linked = task.financeMovementId
      ? movements.find(movement => movement.id === task.financeMovementId)
      : undefined;
    const rule =
      (linked?.ruleId ? rules.find(item => item.id === linked.ruleId) : undefined) ??
      rules.find(
        item =>
          item.active &&
          item.flow === (task.kind === 'finance_income' ? 'income' : 'expense') &&
          financeTitlesMatch(item.title, task.title) &&
          sameAmount(item.amount, amountOf(task))
      );
    if (!rule) continue;
    if (rule.frequency === frequency && rule.recurrenceDay === recurrenceDay) continue;
    updates.set(rule.id, { ruleId: rule.id, frequency, recurrenceDay });
  }
  return [...updates.values()];
}

function amountOf(task: LocatedFinanceTask): number {
  const n = task.finance?.amount ?? task.linkedFinance?.amount ?? 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function currencyOf(task: LocatedFinanceTask): string {
  return (
    task.finance?.currency ??
    task.linkedFinance?.currency ??
    'EUR'
  ).toUpperCase();
}

export function financeTaskToMovement(task: LocatedFinanceTask): FinanceMovement | null {
  if (!isFinanceKind(task.kind) || !isCalendarDayId(task.dayId)) return null;
  const amount = amountOf(task);
  if (!(amount > 0)) return null;
  const flow = task.kind === 'finance_income' ? 'income' : 'expense';
  const currency = currencyOf(task);
  const now = task.updatedAt || task.createdAt || new Date().toISOString();
  return {
    id: task.financeMovementId || `${BOARD_FINANCE_ID_PREFIX}${task.id}`,
    dayId: task.dayId,
    purchaseDayId: task.dayId,
    flow,
    status: task.completed ? 'confirmed' : 'planned',
    currency,
    title: task.title,
    amount,
    notes: task.notes ?? '',
    certainty: task.finance?.certainty ?? 'fixed',
    accountId: null,
    cardAccountId: null,
    goalId: null,
    creditId: null,
    installmentGroupId: null,
    installmentIndex: null,
    installmentTotal: null,
    tag: null,
    originalAmount: amount,
    originalCurrency: currency,
    exchangeRate: 1,
    fxPending: false,
    reportingCurrency: currency,
    category: null,
    categoryId: null,
    images: [],
    categorySplits: [],
    ruleId: null,
    sourceTaskId: task.id,
    virtual: !task.financeMovementId,
    createdAt: task.createdAt || now,
    updatedAt: now,
  };
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.009;
}

export function coveringMovementForTask(
  movements: FinanceMovement[],
  task: LocatedFinanceTask
): FinanceMovement | undefined {
  const monthly =
    task.recurrence?.frequency === 'monthly' ||
    task.recurrence?.frequency === 'yearly';

  if (task.financeMovementId) {
    const byId = movements.find(m => m.id === task.financeMovementId);
    if (byId && (byId.dayId === task.dayId || !monthly || !byId.ruleId)) {
      return byId;
    }
  }
  const bySource = movements.find(m => m.sourceTaskId === task.id);
  if (bySource && (bySource.dayId === task.dayId || !monthly || !bySource.ruleId)) {
    return bySource;
  }
  const amount = amountOf(task);
  const flow = task.kind === 'finance_income' ? 'income' : 'expense';
  return movements.find(m => {
    if (m.status === 'skipped' || m.flow !== flow) return false;
    if (!financeTitlesMatch(m.title, task.title)) return false;
    if (amount > 0 && m.amount > 0 && !sameAmount(m.amount, amount)) return false;
    if (m.dayId === task.dayId) return true;
    // Keep supporting legacy monthly rows without rule_id, but never use a
    // rule-backed scheduled row as proof that a moved board occurrence exists.
    if (
      monthly &&
      !m.ruleId &&
      monthIdFromDayId(m.dayId) === monthIdFromDayId(task.dayId)
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Une ingresos/gastos del tablero al mayor de Finances.
 * Una tarea completada confirma el movimiento cubierto; si no hay fila, se deriva.
 */
export function mergeBoardFinanceIntoMovements(
  movements: FinanceMovement[],
  tasks: LocatedFinanceTask[]
): FinanceMovement[] {
  let out = movements.map(m => ({ ...m }));
  for (const task of tasks) {
    if (!isFinanceKind(task.kind)) continue;
    const derived = financeTaskToMovement(task);
    if (!derived) continue;
    const covering = coveringMovementForTask(out, task);
    if (covering) {
      // Non-recurring (or legacy rule-less) movements are one concrete row;
      // mirror a board date change in the calendar immediately. The sync plan
      // persists this retarget after the merge.
      if (covering.dayId !== task.dayId) {
        covering.dayId = task.dayId;
        covering.sourceTaskId = covering.sourceTaskId ?? task.id;
      }
      if (task.completed && covering.status === 'planned') {
        covering.status = 'confirmed';
        covering.sourceTaskId = covering.sourceTaskId ?? task.id;
      }
      continue;
    }
    // The linked seed of a recurring finance rule is a schedule, not an
    // immutable occurrence.  If the board task was rescheduled, hide that
    // stale schedule for this month so the task-derived occurrence is the one
    // rendered and summed. The ledger sync below will then materialize the
    // corrected occurrence, preserving the rule for following months.
    const monthly =
      task.recurrence?.frequency === 'monthly' ||
      task.recurrence?.frequency === 'yearly';
    if (monthly) {
      out = out.filter(m => {
        if (!m.ruleId || m.dayId === task.dayId) return true;
        if (m.status === 'skipped' || m.flow !== derived.flow) return true;
        if (!financeTitlesMatch(m.title, task.title)) return true;
        if (!sameAmount(m.amount, derived.amount)) return true;
        return monthIdFromDayId(m.dayId) !== monthIdFromDayId(task.dayId);
      });
    }
    out.push(derived);
  }
  return out;
}

export type BoardFinanceSyncAction =
  | { type: 'create'; task: LocatedFinanceTask }
  | { type: 'confirm'; task: LocatedFinanceTask; movementId: string }
  | { type: 'retarget'; task: LocatedFinanceTask; movementId: string }
  | { type: 'materialize'; task: LocatedFinanceTask; ruleId: string };

export function planBoardFinanceSync(
  movements: FinanceMovement[],
  tasks: LocatedFinanceTask[]
): BoardFinanceSyncAction[] {
  const actions: BoardFinanceSyncAction[] = [];
  const seen = new Set<string>();
  for (const task of tasks) {
    if (!isFinanceKind(task.kind) || !isCalendarDayId(task.dayId)) continue;
    if (!(amountOf(task) > 0)) continue;
    const covering = coveringMovementForTask(movements, task);
    if (!covering) {
      actions.push({ type: 'create', task });
      continue;
    }
    if (covering.virtual) {
      if (task.completed && covering.ruleId && !seen.has(covering.id)) {
        seen.add(covering.id);
        actions.push({ type: 'materialize', task, ruleId: covering.ruleId });
      } else if (!covering.ruleId) {
        actions.push({ type: 'create', task });
      }
      continue;
    }
    if (covering.dayId !== task.dayId && !covering.ruleId) {
      actions.push({ type: 'retarget', task, movementId: covering.id });
      continue;
    }
    if (task.completed && covering.status === 'planned') {
      actions.push({ type: 'confirm', task, movementId: covering.id });
    }
  }
  return actions;
}
