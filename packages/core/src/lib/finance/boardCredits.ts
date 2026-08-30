import type { Task } from '../../types';
import { DEFAULT_RECURRENCE, getWeekIdFromDayId } from '../recurrence';
import {
  creditInstallmentDayId,
  firstCreditDueDayId,
} from './evolution';
import { installmentTitle } from './installments';
import { monthIdFromDayId } from './movementSummary';
import type {
  FinanceCredit,
  FinanceCreditKind,
  FinanceMovement,
} from './types';

/** Cubo de store para cuotas sintetizadas. No se persiste ni se suscribe al API. */
export const BOARD_CREDIT_WEEK_ID = '__credits__';

/** Prefijo de ids virtuales: fcredit:{creditId}:{dayId} */
export const BOARD_CREDIT_PREFIX = 'fcredit:';

export function isBoardCreditWeekId(
  weekId: string | null | undefined
): boolean {
  return weekId === BOARD_CREDIT_WEEK_ID;
}

export function isBoardCreditTaskId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(BOARD_CREDIT_PREFIX);
}

export function makeBoardCreditTaskId(creditId: string, dayId: string): string {
  return `${BOARD_CREDIT_PREFIX}${creditId}:${dayId}`;
}

export function parseBoardCreditTaskId(
  id: string
): { creditId: string; dayId: string } | null {
  if (!isBoardCreditTaskId(id)) return null;
  const rest = id.slice(BOARD_CREDIT_PREFIX.length);
  const idx = rest.lastIndexOf(':');
  if (idx <= 0) return null;
  const creditId = rest.slice(0, idx);
  const dayId = rest.slice(idx + 1);
  if (!creditId || !/^\d{4}-\d{2}-\d{2}$/.test(dayId)) return null;
  return { creditId, dayId };
}

export function boardCreditColor(kind: FinanceCreditKind): string {
  switch (kind) {
    case 'mortgage':
      return '#58a6ff';
    case 'consumer':
      return '#f0883e';
    case 'auto':
      return '#3fb950';
    default:
      return '#a371f7';
  }
}

export type BoardCreditTask = Task & { weekId: string; startDayId: string };

function paidByCreditMonth(
  movements: FinanceMovement[]
): Map<string, Map<string, FinanceMovement>> {
  const paid = new Map<string, Map<string, FinanceMovement>>();
  for (const mov of movements) {
    if (!mov.creditId || mov.status === 'skipped' || mov.flow !== 'expense') {
      continue;
    }
    const byMonth = paid.get(mov.creditId) ?? new Map<string, FinanceMovement>();
    const monthId = monthIdFromDayId(mov.dayId);
    const prev = byMonth.get(monthId);
    if (!prev || (prev.status !== 'confirmed' && mov.status === 'confirmed')) {
      byMonth.set(monthId, mov);
    }
    paid.set(mov.creditId, byMonth);
  }
  return paid;
}

export function creditScheduleBounds(credits: FinanceCredit[]): {
  from: string;
  to: string;
} | null {
  let from = '';
  let to = '';
  for (const credit of credits) {
    if (credit.archived) continue;
    if (credit.termMonths < 1) continue;
    const first = firstCreditDueDayId(credit);
    const last = creditInstallmentDayId(credit, credit.termMonths - 1);
    if (!from || first < from) from = first;
    if (!to || last > to) to = last;
  }
  if (!from || !to) return null;
  return { from, to };
}

export function buildBoardCreditTask(
  credit: FinanceCredit,
  dayId: string,
  installmentIndex: number,
  paid: FinanceMovement | null
): BoardCreditTask {
  const total = Math.max(1, credit.termMonths);
  const confirmed = Boolean(paid && paid.status === 'confirmed');
  const amount = paid?.amount ?? credit.monthlyInstallment;
  const currency = paid?.currency ?? credit.currency;
  const movementId =
    paid && !paid.virtual && paid.id ? paid.id : null;
  return {
    id: makeBoardCreditTaskId(credit.id, dayId),
    title: installmentTitle(credit.name || 'Crédito', installmentIndex, total),
    completed: confirmed,
    completedAt: confirmed ? paid?.updatedAt || paid?.createdAt || null : null,
    projectId: null,
    projectCategoryId: null,
    priority: 'medium',
    notes: credit.notes ?? '',
    order: 80 + installmentIndex,
    tags: [],
    movedFrom: null,
    seriesId: null,
    recurrence: { ...DEFAULT_RECURRENCE },
    endDayId: dayId,
    urgency: null,
    importance: null,
    kind: 'finance_expense',
    color: boardCreditColor(credit.kind),
    startTime: null,
    endTime: null,
    rx: null,
    involvedContactIds: [],
    location: null,
    departureTime: null,
    steps: [],
    images: [],
    finance: {
      amount,
      currency,
      certainty: 'fixed',
    },
    financeMovementId: movementId,
    linkedFinance: {
      flow: 'expense',
      amount,
      currency,
      status: confirmed ? 'confirmed' : 'planned',
    },
    createdAt: credit.createdAt,
    updatedAt: paid?.updatedAt ?? credit.updatedAt,
    weekId: getWeekIdFromDayId(dayId),
    startDayId: dayId,
  };
}

/**
 * Cada cuota de consumo / hipotecario / auto / otro, en su día de vencimiento.
 * Si ese mes ya tiene un pago de crédito, la pastilla aparece completada.
 * Si el pago ya está vinculado a una tarea del tablero, no se duplica.
 */
export function expandCreditsForBoard(
  credits: FinanceCredit[],
  movements: FinanceMovement[],
  fromDayId?: string,
  toDayId?: string
): BoardCreditTask[] {
  const paid = paidByCreditMonth(movements);
  const out: BoardCreditTask[] = [];
  for (const credit of credits) {
    if (credit.archived) continue;
    const months = Math.max(0, Math.floor(credit.termMonths) || 0);
    if (months < 1) continue;
    const byMonth = paid.get(credit.id);
    for (let i = 0; i < months; i += 1) {
      const dayId = creditInstallmentDayId(credit, i);
      if (fromDayId && dayId < fromDayId) continue;
      if (toDayId && dayId > toDayId) continue;
      const existing = byMonth?.get(monthIdFromDayId(dayId)) ?? null;
      if (existing?.sourceTaskId) continue;
      out.push(buildBoardCreditTask(credit, dayId, i + 1, existing));
    }
  }
  return out;
}

export function boardCreditTasksByDay(
  tasks: BoardCreditTask[]
): Record<string, Task[]> {
  const byDay: Record<string, Task[]> = {};
  for (const task of tasks) {
    const dayId = task.startDayId;
    if (!byDay[dayId]) byDay[dayId] = [];
    const { weekId: _w, startDayId: _s, ...rest } = task;
    byDay[dayId].push(rest);
  }
  return byDay;
}
