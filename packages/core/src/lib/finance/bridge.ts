import { addDaysToDayId } from '../recurrence';
import { getDayId, updateTask } from '../../services/taskService';
import { useStore } from '../../store';
import {
  createFinanceMovement,
  deleteFinanceMovement,
  fetchFinanceCalendar,
  fetchFinanceMovement,
  resolveFinanceFx,
  updateFinanceMovement,
} from '../../services/financeMovementService';
import { fetchFinanceCredits } from '../../services/financeCreditService';
import type { FinanceMovement, FinanceRuleFrequency, FinanceVaultCtx } from './types';
import type { CreateTaskPayload, Task } from '../../types';
import { getFinanceVaultSession } from './session';
import { planBoardFinanceSync, type LocatedFinanceTask } from './fromTasks';
import {
  BOARD_CREDIT_WEEK_ID,
  boardCreditTasksByDay,
  expandCreditsForBoard,
  parseBoardCreditTaskId,
} from './boardCredits';

export function linkedFinanceFromMovement(
  mov: Pick<FinanceMovement, 'flow' | 'amount' | 'currency' | 'status'>
): NonNullable<Task['linkedFinance']> {
  return {
    flow: mov.flow,
    amount: mov.amount,
    currency: mov.currency,
    status: mov.status,
  };
}

export async function createBridgeMovement(opts: {
  dayId: string;
  title: string;
  amount: number;
  currency: string;
  certainty: NonNullable<CreateTaskPayload['financeCertainty']>;
  flow: FinanceMovement['flow'];
  vault?: FinanceVaultCtx;
  reportingCurrency?: string;
  sourceTaskId?: string;
  recurrence?: { frequency: FinanceRuleFrequency; recurrenceDay: number };
}): Promise<{ id: string; linked: NonNullable<Task['linkedFinance']> }> {
  const fx = opts.reportingCurrency
    ? await resolveFinanceFx({
        amount: opts.amount,
        currency: opts.currency,
        reportingCurrency: opts.reportingCurrency,
        dayId: opts.dayId,
      })
    : null;
  const mov = await createFinanceMovement(
    {
      dayId: opts.dayId,
      flow: opts.flow,
      status: 'planned',
      title: opts.title,
      amount: opts.amount,
      currency: opts.currency,
      certainty: opts.certainty,
      sourceTaskId: opts.sourceTaskId,
      recurrence: opts.recurrence,
      ...(fx ?? {}),
    },
    opts.vault
  );
  return { id: mov.id, linked: linkedFinanceFromMovement(mov) };
}

/** Persiste ingresos/gastos del tablero que Finances aún no tiene en el mayor. */
export async function syncBoardFinanceToLedger(opts: {
  movements: FinanceMovement[];
  tasks: LocatedFinanceTask[];
  vault?: FinanceVaultCtx;
}): Promise<boolean> {
  const actions = planBoardFinanceSync(opts.movements, opts.tasks);
  if (actions.length === 0) return false;
  for (const action of actions) {
    if (action.type === 'confirm') {
      await confirmBridgeMovement(action.movementId);
      continue;
    }
    if (action.type === 'retarget') {
      await updateFinanceMovement(action.movementId, {
        dayId: action.task.dayId,
        sourceTaskId: action.task.id,
      });
      continue;
    }
    const task = action.task;
    const amount = task.finance?.amount ?? task.linkedFinance?.amount ?? 0;
    if (!(amount > 0)) continue;
    const created = await createFinanceMovement(
      {
        dayId: task.dayId,
        flow: task.kind === 'finance_income' ? 'income' : 'expense',
        status: task.completed ? 'confirmed' : 'planned',
        title: task.title,
        amount,
        currency: task.finance?.currency ?? task.linkedFinance?.currency,
        certainty: task.finance?.certainty ?? 'fixed',
        sourceTaskId: task.id,
        ruleId: action.type === 'materialize' ? action.ruleId : undefined,
      },
      opts.vault
    );
    // A moved recurrence may still point at its original rule seed. Replace
    // that stale link with the materialized occurrence so future reloads,
    // month totals, and completion confirmation all address the same row.
    if (created.id && created.id !== task.financeMovementId) {
      await updateTask(task.weekId, task.dayId, task.id, {
        financeMovementId: created.id,
      }).catch(() => undefined);
    }
  }
  return true;
}

export async function claimBridgeMovement(
  movementId: string,
  taskId: string
): Promise<void> {
  await updateFinanceMovement(movementId, { sourceTaskId: taskId });
}

export async function confirmBridgeMovement(movementId: string): Promise<void> {
  await updateFinanceMovement(movementId, { status: 'confirmed' });
}

/**
 * Al completar un ingreso/gasto del calendario: confirma el movimiento
 * vinculado o crea uno ese día si la instancia de la serie no tenía puente.
 */
export async function confirmFinanceForCompletedTask(opts: {
  dayId: string;
  title: string;
  kind: Task['kind'];
  finance: Task['finance'];
  financeMovementId: string | null;
  taskId?: string;
  vault?: FinanceVaultCtx;
  reportingCurrency?: string;
}): Promise<string | null> {
  if (opts.kind !== 'finance_income' && opts.kind !== 'finance_expense') {
    return opts.financeMovementId;
  }
  if (opts.financeMovementId) {
    await confirmBridgeMovement(opts.financeMovementId);
    return opts.financeMovementId;
  }
  const amount = opts.finance?.amount ?? 0;
  if (!(amount > 0) || !opts.dayId) return null;
  const created = await createBridgeMovement({
    dayId: opts.dayId,
    title: opts.title,
    amount,
    currency: opts.finance?.currency ?? 'EUR',
    certainty: opts.finance?.certainty ?? 'fixed',
    flow: opts.kind === 'finance_income' ? 'income' : 'expense',
    vault: opts.vault,
    reportingCurrency: opts.reportingCurrency,
    sourceTaskId: opts.taskId,
  });
  await confirmBridgeMovement(created.id);
  return created.id;
}

/** Elimina el movimiento solo si sigue planned. Confirmed se queda en el mayor. */
export async function deletePlannedBridgeMovement(
  movementId: string
): Promise<boolean> {
  const mov = await fetchFinanceMovement(movementId);
  if (mov.status !== 'planned') return false;
  await deleteFinanceMovement(movementId);
  return true;
}

export async function hydrateBoardLinkedFinance(
  fromDayId: string,
  toDayId: string,
  vault?: FinanceVaultCtx
): Promise<void> {
  const [movements, credits] = await Promise.all([
    fetchFinanceCalendar(fromDayId, toDayId, vault),
    fetchFinanceCredits().catch(() => []),
  ]);
  const byId: Record<string, NonNullable<Task['linkedFinance']>> = {};
  for (const mov of movements) {
    if (!mov.id) continue;
    byId[mov.id] = linkedFinanceFromMovement(mov);
  }
  const store = useStore.getState();
  store.applyLinkedFinance(byId);
  store.replaceBoardCreditTasks(
    boardCreditTasksByDay(expandCreditsForBoard(credits, movements))
  );
}

/** Marca pagada una cuota virtual del tablero (no crea tarea; escribe el mayor). */
export async function confirmBoardCreditTask(task: Task): Promise<void> {
  const parsed = parseBoardCreditTaskId(task.id);
  if (!parsed) return;
  if (task.completed && task.financeMovementId) return;
  let movementId = task.financeMovementId;
  let linked = task.linkedFinance ?? null;
  if (movementId) {
    await confirmBridgeMovement(movementId);
    linked = {
      flow: 'expense',
      amount: task.finance?.amount ?? linked?.amount ?? 0,
      currency: task.finance?.currency ?? linked?.currency ?? 'EUR',
      status: 'confirmed',
    };
  } else {
    const amount = task.finance?.amount ?? linked?.amount ?? 0;
    if (!(amount > 0)) return;
    const created = await createFinanceMovement(
      {
        dayId: parsed.dayId,
        flow: 'expense',
        status: 'confirmed',
        title: task.title,
        amount,
        currency: task.finance?.currency ?? linked?.currency ?? 'EUR',
        certainty: 'fixed',
        creditId: parsed.creditId,
        tag: 'credit_payment',
      },
      getFinanceVaultSession() ?? undefined
    );
    movementId = created.id;
    linked = linkedFinanceFromMovement(created);
  }
  useStore.getState().updateTaskOptimistic(BOARD_CREDIT_WEEK_ID, parsed.dayId, task.id, {
    completed: true,
    completedAt: new Date().toISOString(),
    financeMovementId: movementId,
    linkedFinance: linked,
  });
}

export function defaultHydrationWindow(now = new Date()): {
  from: string;
  to: string;
} {
  const today = getDayId(now);
  return {
    from: addDaysToDayId(today, -31),
    to: addDaysToDayId(today, 60),
  };
}

export function requireVaultForMoney(): FinanceVaultCtx | null {
  return getFinanceVaultSession();
}
