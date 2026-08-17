import { addDaysToDayId } from '../recurrence';
import { getDayId } from '../../services/taskService';
import { useStore } from '../../store';
import {
  createFinanceMovement,
  deleteFinanceMovement,
  fetchFinanceCalendar,
  fetchFinanceMovement,
  updateFinanceMovement,
} from '../../services/financeMovementService';
import type { FinanceMovement, FinanceVaultCtx } from './types';
import type { CreateTaskPayload, Task } from '../../types';
import { getFinanceVaultSession } from './session';

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
}): Promise<{ id: string; linked: NonNullable<Task['linkedFinance']> }> {
  const mov = await createFinanceMovement(
    {
      dayId: opts.dayId,
      flow: opts.flow,
      status: 'planned',
      title: opts.title,
      amount: opts.amount,
      currency: opts.currency,
      certainty: opts.certainty,
    },
    opts.vault
  );
  return { id: mov.id, linked: linkedFinanceFromMovement(mov) };
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
  vault: FinanceVaultCtx
): Promise<void> {
  const movements = await fetchFinanceCalendar(fromDayId, toDayId, vault);
  const byId: Record<string, NonNullable<Task['linkedFinance']>> = {};
  for (const mov of movements) {
    if (!mov.id) continue;
    byId[mov.id] = linkedFinanceFromMovement(mov);
  }
  useStore.getState().applyLinkedFinance(byId);
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
