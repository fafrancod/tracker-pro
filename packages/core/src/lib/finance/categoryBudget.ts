import type { FinanceUserCategory, FinanceMovement } from './types';
import { resolveMovementCategory } from './engine/snapshot';

export function summarizeCategoryBudget(
  category: FinanceUserCategory,
  movements: FinanceMovement[],
  monthId: string
): { spent: number; limit: number; remaining: number; pct: number } {
  let spent = 0;
  for (const mov of movements) {
    if (!mov.dayId.startsWith(monthId)) continue;
    if (mov.status === 'skipped') continue;
    if (mov.flow !== 'expense') continue;
    if (mov.tag === 'card_payment' || mov.tag === 'goal_contribution') continue;
    const matchesId = Boolean(category.id && mov.categoryId === category.id);
    const matchesGroup =
      !mov.categoryId && resolveMovementCategory(mov) === category.groupKey;
    if (!matchesId && !matchesGroup) continue;
    spent += Number(mov.amount) || 0;
  }
  const limit = category.monthlyBudget;
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  return {
    spent,
    limit,
    remaining: Math.max(0, limit - spent),
    pct,
  };
}

export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  housing: '#0ea5e9',
  food: '#f59e0b',
  transport: '#8b5cf6',
  health: '#ef4444',
  leisure: '#ec4899',
  debt: '#64748b',
  invest: '#14b8a6',
  other: '#94a3b8',
};

export const DEFAULT_CATEGORY_SEEDS: Array<{
  groupKey: import('./types').FinanceCategory;
  name: string;
  necessary: boolean;
}> = [
  { groupKey: 'housing', name: 'Vivienda', necessary: true },
  { groupKey: 'food', name: 'Alimentación', necessary: true },
  { groupKey: 'transport', name: 'Transporte', necessary: true },
  { groupKey: 'health', name: 'Salud', necessary: true },
  { groupKey: 'leisure', name: 'Ocio', necessary: false },
  { groupKey: 'debt', name: 'Deuda', necessary: true },
  { groupKey: 'invest', name: 'Inversión', necessary: true },
  { groupKey: 'other', name: 'Otros', necessary: true },
];
