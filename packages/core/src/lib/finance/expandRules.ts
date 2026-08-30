import { listDayIdsInclusive } from '../habitPlan';
import type { FinanceMovement, FinanceRule } from './types';

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function parseDayParts(dayId: string): { y: number; m: number; d: number } {
  const [ys, ms, ds] = dayId.split('-');
  return { y: Number(ys), m: Number(ms), d: Number(ds) };
}

export function financeRuleAppliesOnDay(rule: FinanceRule, dayId: string): boolean {
  if (!rule.active) return false;
  if (dayId < rule.startDayId) return false;
  const { y, m, d } = parseDayParts(dayId);
  if (!y || !m || !d) return false;
  if (rule.frequency === 'monthly') {
    const dim = daysInMonth(y, m - 1);
    const target = Math.min(Math.max(1, rule.recurrenceDay), dim);
    return d === target;
  }
  const weekday = new Date(y, m - 1, d).getDay();
  return weekday === rule.recurrenceDay;
}

export function makeVirtualFinanceId(ruleId: string, dayId: string): string {
  return `fvr:${ruleId}:${dayId}`;
}

function normTitle(title: string): string {
  return title.trim().toLowerCase();
}

function amountsCompatible(a: number, b: number): boolean {
  if (!(a > 0) || !(b > 0)) return true;
  return Math.abs(a - b) < 0.009;
}

function txKey(mov: Pick<FinanceMovement, 'flow' | 'title' | 'dayId'>): string {
  return `${mov.flow}|${normTitle(mov.title)}|${mov.dayId}`;
}

/** Fila del mayor que ya representa esa ocurrencia de la regla (con o sin ruleId). */
export function movementCoversFinanceRule(
  mov: FinanceMovement,
  rule: FinanceRule
): boolean {
  if (mov.status === 'skipped') return false;
  if (mov.flow !== rule.flow) return false;
  if (mov.ruleId && mov.ruleId === rule.id) return true;
  if (normTitle(mov.title) !== normTitle(rule.title) || !normTitle(rule.title)) {
    return false;
  }
  return amountsCompatible(mov.amount, rule.amount);
}

export function expandFinanceRules(
  rules: FinanceRule[],
  movements: FinanceMovement[],
  fromDayId: string,
  toDayId: string
): FinanceMovement[] {
  const covered = new Set<string>();
  const existingTx = new Set<string>();
  for (const mov of movements) {
    if (mov.status === 'skipped') continue;
    existingTx.add(txKey(mov));
    if (mov.ruleId) covered.add(`${mov.ruleId}:${mov.dayId}`);
    for (const rule of rules) {
      if (!rule.active) continue;
      if (movementCoversFinanceRule(mov, rule)) {
        covered.add(`${rule.id}:${mov.dayId}`);
      }
    }
  }
  const extra: FinanceMovement[] = [];
  const days = listDayIdsInclusive(fromDayId, toDayId);
  for (const rule of rules) {
    if (!rule.active) continue;
    for (const dayId of days) {
      if (!financeRuleAppliesOnDay(rule, dayId)) continue;
      if (covered.has(`${rule.id}:${dayId}`)) continue;
      const fingerprint = txKey({
        flow: rule.flow,
        title: rule.title,
        dayId,
      });
      if (existingTx.has(fingerprint)) continue;
      existingTx.add(fingerprint);
      extra.push({
        id: makeVirtualFinanceId(rule.id, dayId),
        dayId,
        flow: rule.flow,
        status: 'planned',
        currency: rule.currency,
        title: rule.title,
        amount: rule.amount,
        notes: rule.notes,
        certainty: rule.certainty,
        accountId: null,
        cardAccountId: null,
        goalId: null,
        creditId: null,
        installmentGroupId: null,
        installmentIndex: null,
        installmentTotal: null,
        tag: null,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        fxPending: false,
        reportingCurrency: null,
        ruleId: rule.id,
        sourceTaskId: null,
        virtual: true,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      });
    }
  }
  return extra;
}
