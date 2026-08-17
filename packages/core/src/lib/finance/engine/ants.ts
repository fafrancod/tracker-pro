import type { FinanceMovement } from '../types';
import type { AntExpenseGroup } from './types';
import { resolveMovementCategory } from './snapshot';

/** Umbral por defecto en la moneda del movimiento (CLP ≠ USD). */
export function defaultAntMaxAmount(currency: string): number {
  const code = currency.toUpperCase();
  if (code === 'CLP' || code === 'JPY' || code === 'KRW') return 5000;
  return 10;
}

/**
 * Microgastos repetidos. Una compra de ETF (flow=investment o category=invest)
 * nunca entra: no es gasto hormiga.
 */
export function detectAntExpenses(
  movements: FinanceMovement[],
  monthId: string,
  antMaxAmount?: number
): AntExpenseGroup[] {
  const groups = new Map<string, AntExpenseGroup>();
  for (const mov of movements) {
    if (!mov.dayId.startsWith(monthId)) continue;
    if (mov.status === 'skipped') continue;
    if (mov.flow === 'investment') continue;
    if (mov.flow !== 'expense') continue;
    const category = resolveMovementCategory(mov);
    if (category === 'invest') continue;
    if (
      mov.tag === 'card_payment' ||
      mov.tag === 'goal_contribution' ||
      mov.tag === 'credit_payment'
    ) {
      continue;
    }
    const cap = antMaxAmount ?? defaultAntMaxAmount(mov.currency);
    if (!(mov.amount > 0) || mov.amount > cap) continue;
    const title = (mov.title || category).trim().toLowerCase() || category;
    const key = `${category}:${title}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += mov.amount;
    } else {
      groups.set(key, {
        key,
        title: mov.title || category,
        category,
        count: 1,
        total: mov.amount,
      });
    }
  }
  return [...groups.values()]
    .filter(g => g.count >= 4)
    .sort((a, b) => b.total - a.total);
}
