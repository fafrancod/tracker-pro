import type { FinanceGoal, FinanceMovement } from './types';

export interface FinanceGoalProgress {
  goalId: string;
  current: number;
  remaining: number;
  monthsLeft: number | null;
  monthlyNeed: number | null;
}

export function monthsBetweenDayIds(fromDayId: string, toDayId: string): number {
  const from = fromDayId.slice(0, 7);
  const to = toDayId.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) return 0;
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function accountBalance(accountId: string, movements: FinanceMovement[]): number {
  let balance = 0;
  for (const mov of movements) {
    if (mov.status !== 'confirmed') continue;
    if (mov.accountId !== accountId) continue;
    if (mov.flow === 'income') balance += mov.amount;
    else if (mov.flow === 'expense') balance -= mov.amount;
  }
  return Math.max(0, balance);
}

function contributionTotal(goalId: string, movements: FinanceMovement[]): number {
  let total = 0;
  for (const mov of movements) {
    if (mov.status !== 'confirmed') continue;
    if (mov.tag !== 'goal_contribution') continue;
    if (mov.goalId !== goalId) continue;
    total += mov.amount;
  }
  return total;
}

export function summarizeGoalProgress(
  goal: FinanceGoal,
  movements: FinanceMovement[],
  todayDayId: string
): FinanceGoalProgress {
  const current = goal.linkedAccountId
    ? accountBalance(goal.linkedAccountId, movements)
    : contributionTotal(goal.id, movements);
  const remaining = Math.max(0, goal.targetAmount - current);
  const rawMonths = goal.targetDayId
    ? monthsBetweenDayIds(todayDayId, goal.targetDayId)
    : null;
  const monthsLeft =
    rawMonths == null ? null : remaining <= 0 ? 0 : Math.max(1, rawMonths);
  const monthlyNeed =
    monthsLeft && monthsLeft > 0 ? remaining / monthsLeft : null;
  return {
    goalId: goal.id,
    current,
    remaining,
    monthsLeft,
    monthlyNeed,
  };
}
