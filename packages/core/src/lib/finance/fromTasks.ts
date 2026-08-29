import type { Task } from '../../types';
import { isFinanceKind } from '../financeKinds';
import { isCalendarDayId } from '../inbox';
import type { FinanceMovement } from './types';

export type LocatedFinanceTask = Task & { weekId: string; dayId: string };

export const BOARD_FINANCE_ID_PREFIX = 'ftask:';

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
  if (task.financeMovementId) {
    const byId = movements.find(m => m.id === task.financeMovementId);
    if (byId) return byId;
  }
  const bySource = movements.find(m => m.sourceTaskId === task.id);
  if (bySource) return bySource;
  const amount = amountOf(task);
  const flow = task.kind === 'finance_income' ? 'income' : 'expense';
  return movements.find(
    m =>
      m.dayId === task.dayId &&
      m.flow === flow &&
      sameAmount(m.amount, amount) &&
      (m.title || '').trim().toLowerCase() === task.title.trim().toLowerCase()
  );
}

/**
 * Une ingresos/gastos del tablero al mayor de Finances.
 * Una tarea completada confirma el movimiento cubierto; si no hay fila, se deriva.
 */
export function mergeBoardFinanceIntoMovements(
  movements: FinanceMovement[],
  tasks: LocatedFinanceTask[]
): FinanceMovement[] {
  const out = movements.map(m => ({ ...m }));
  for (const task of tasks) {
    if (!isFinanceKind(task.kind)) continue;
    const derived = financeTaskToMovement(task);
    if (!derived) continue;
    const covering = coveringMovementForTask(out, task);
    if (covering) {
      if (task.completed && covering.status === 'planned') {
        covering.status = 'confirmed';
        covering.sourceTaskId = covering.sourceTaskId ?? task.id;
      }
      continue;
    }
    out.push(derived);
  }
  return out;
}

export type BoardFinanceSyncAction =
  | { type: 'create'; task: LocatedFinanceTask }
  | { type: 'confirm'; task: LocatedFinanceTask; movementId: string }
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
    if (task.completed && covering.status === 'planned') {
      actions.push({ type: 'confirm', task, movementId: covering.id });
    }
  }
  return actions;
}
