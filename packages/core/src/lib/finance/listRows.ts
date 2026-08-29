import { addMonthsToDayId } from './installments';
import {
  isInstallmentMovement,
  stripInstallmentSuffix,
} from './installmentSchedule';
import type { FinanceMovement, FinanceRule, FinanceRuleFrequency } from './types';

export const INFERRED_RULE_PREFIX = 'inferred:';

export type FinanceListRow =
  | { key: string; kind: 'one_off'; movement: FinanceMovement }
  | {
      key: string;
      kind: 'series';
      rule: FinanceRule;
      sample: FinanceMovement;
      instanceCount: number;
    }
  | {
      key: string;
      kind: 'installment';
      sample: FinanceMovement;
      title: string;
      paidCount: number;
      remainingCount: number;
      totalCount: number;
      endsOn: string;
      totalAmount: number;
    };

function normTitle(title: string): string {
  return title.trim().toLowerCase();
}

function monthDayOf(dayId: string): number {
  return Number(dayId.slice(8, 10)) || 1;
}

function weekdayOf(dayId: string): number {
  const [ys, ms, ds] = dayId.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return 1;
  return new Date(y, m - 1, d).getDay();
}

function dayGap(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

function installmentListKey(mov: FinanceMovement): string | null {
  if (!isInstallmentMovement(mov)) return null;
  if (mov.installmentGroupId) return `g:${mov.installmentGroupId}`;
  if ((mov.installmentTotal ?? 0) > 1) {
    return `t:${stripInstallmentSuffix(mov.title) || mov.id}`;
  }
  return null;
}

function installmentEndsOn(instances: FinanceMovement[], totalCount: number): string {
  const sorted = [...instances].sort(
    (a, b) =>
      (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0) ||
      a.dayId.localeCompare(b.dayId)
  );
  const last = sorted[sorted.length - 1]!;
  const lastIndex = last.installmentIndex ?? sorted.length;
  const missing = Math.max(0, totalCount - lastIndex);
  return missing > 0 ? addMonthsToDayId(last.dayId, missing) : last.dayId;
}

function rowSortDay(row: FinanceListRow): string {
  if (row.kind === 'one_off') return row.movement.dayId;
  if (row.kind === 'installment') {
    return row.sample.purchaseDayId ?? row.sample.dayId;
  }
  return row.sample.dayId;
}

function rowSortTitle(row: FinanceListRow): string {
  if (row.kind === 'one_off') return row.movement.title;
  if (row.kind === 'installment') return row.title;
  return row.rule.title;
}

export function matchFinanceRuleForMovement(
  rules: FinanceRule[],
  mov: Pick<FinanceMovement, 'flow' | 'title' | 'amount' | 'ruleId'>
): FinanceRule | undefined {
  if (mov.ruleId) {
    const byId = rules.find(rule => rule.id === mov.ruleId);
    if (byId) return byId;
  }
  const title = normTitle(mov.title);
  if (!title) return undefined;
  const same = rules.filter(
    rule => rule.active && rule.flow === mov.flow && normTitle(rule.title) === title
  );
  if (same.length === 0) return undefined;
  const amountMatch = same.find(rule => Math.abs(rule.amount - mov.amount) < 0.009);
  return amountMatch ?? same[0];
}

/** Cadencia regular (mensual mismo día, o semanal mismo weekday con huecos múltiplo de 7). */
export function inferFinanceCadence(
  dayIds: string[]
): { frequency: FinanceRuleFrequency; recurrenceDay: number } | null {
  const unique = [...new Set(dayIds.filter(Boolean))].sort();
  if (unique.length < 2) return null;
  const weekdays = new Set(unique.map(weekdayOf));
  const monthDays = new Set(unique.map(monthDayOf));
  const gaps: number[] = [];
  for (let i = 1; i < unique.length; i += 1) {
    gaps.push(dayGap(unique[i - 1]!, unique[i]!));
  }
  const weeklyGaps = gaps.length > 0 && gaps.every(gap => gap > 0 && gap % 7 === 0);
  if (weekdays.size === 1 && weeklyGaps) {
    return { frequency: 'weekly', recurrenceDay: weekdayOf(unique[0]!) };
  }
  if (monthDays.size === 1) {
    return { frequency: 'monthly', recurrenceDay: monthDayOf(unique[0]!) };
  }
  return null;
}

function inferredRuleId(flow: string, title: string): string {
  const slug = normTitle(title).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${INFERRED_RULE_PREFIX}${flow}:${slug || 'serie'}`;
}

function syntheticRule(
  sample: FinanceMovement,
  cadence: { frequency: FinanceRuleFrequency; recurrenceDay: number },
  instances: FinanceMovement[]
): FinanceRule {
  const first = [...instances].sort((a, b) => a.dayId.localeCompare(b.dayId))[0] ?? sample;
  return {
    id: inferredRuleId(sample.flow, sample.title),
    flow: sample.flow,
    currency: sample.currency,
    frequency: cadence.frequency,
    recurrenceDay: cadence.recurrenceDay,
    startDayId: first.dayId,
    title: sample.title,
    amount: sample.amount,
    notes: sample.notes,
    certainty: sample.certainty,
    active: true,
    createdAt: first.createdAt,
    updatedAt: sample.updatedAt,
  };
}

function sampleFromRule(rule: FinanceRule): FinanceMovement {
  return {
    id: `rule:${rule.id}`,
    dayId: rule.startDayId,
    purchaseDayId: rule.startDayId,
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
    originalAmount: rule.amount,
    originalCurrency: rule.currency,
    exchangeRate: 1,
    fxPending: false,
    reportingCurrency: rule.currency,
    ruleId: rule.id,
    sourceTaskId: null,
    virtual: true,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

export function collapseFinanceListRows(
  movements: FinanceMovement[],
  rules: FinanceRule[]
): FinanceListRow[] {
  const activeRules = rules.filter(rule => rule.active);
  const byRule = new Map<string, FinanceMovement[]>();
  const unmatched: FinanceMovement[] = [];
  const oneOff: FinanceMovement[] = [];
  const installmentGroups = new Map<string, FinanceMovement[]>();

  for (const mov of movements) {
    if (mov.virtual) continue;
    const installmentKey = installmentListKey(mov);
    if (installmentKey) {
      const list = installmentGroups.get(installmentKey) ?? [];
      list.push(mov);
      installmentGroups.set(installmentKey, list);
      continue;
    }
    const matched = matchFinanceRuleForMovement(activeRules, mov);
    if (matched) {
      const list = byRule.get(matched.id) ?? [];
      list.push(mov);
      byRule.set(matched.id, list);
      continue;
    }
    unmatched.push(mov);
  }

  const rows: FinanceListRow[] = [];
  for (const mov of oneOff) {
    rows.push({ key: `one:${mov.id}`, kind: 'one_off', movement: mov });
  }
  for (const [groupKey, instances] of installmentGroups) {
    instances.sort(
      (a, b) =>
        (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0) ||
        a.dayId.localeCompare(b.dayId)
    );
    const sample = instances[0]!;
    const totalCount = Math.max(
      ...instances.map(item => item.installmentTotal ?? 0),
      instances.length
    );
    const paidCount = instances.filter(item => item.status === 'confirmed').length;
    rows.push({
      key: `inst:${groupKey}`,
      kind: 'installment',
      sample,
      title: stripInstallmentSuffix(sample.title) || sample.title,
      paidCount,
      remainingCount: Math.max(0, totalCount - paidCount),
      totalCount,
      endsOn: installmentEndsOn(instances, totalCount),
      totalAmount: instances.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    });
  }

  const used = new Set<string>();
  const ruleById = new Map(activeRules.map(rule => [rule.id, rule]));
  for (const [ruleId, instances] of byRule) {
    instances.sort((a, b) => b.dayId.localeCompare(a.dayId));
    const sample = instances[0]!;
    const rule = ruleById.get(ruleId);
    if (!rule) {
      rows.push({ key: `one:${sample.id}`, kind: 'one_off', movement: sample });
      continue;
    }
    used.add(ruleId);
    rows.push({
      key: `series:${ruleId}`,
      kind: 'series',
      rule,
      sample,
      instanceCount: instances.length,
    });
  }

  const leftoverGroups = new Map<string, FinanceMovement[]>();
  for (const mov of unmatched) {
    const key = `${mov.flow}|${normTitle(mov.title)}`;
    const list = leftoverGroups.get(key) ?? [];
    list.push(mov);
    leftoverGroups.set(key, list);
  }
  for (const group of leftoverGroups.values()) {
    const cadence = inferFinanceCadence(group.map(item => item.dayId));
    if (!cadence) {
      for (const mov of group) {
        rows.push({ key: `one:${mov.id}`, kind: 'one_off', movement: mov });
      }
      continue;
    }
    group.sort((a, b) => b.dayId.localeCompare(a.dayId));
    const sample = group[0]!;
    const rule = syntheticRule(sample, cadence, group);
    rows.push({
      key: `series:${rule.id}`,
      kind: 'series',
      rule,
      sample,
      instanceCount: group.length,
    });
  }

  const seriesFingerprints = new Set(
    rows
      .filter((row): row is Extract<FinanceListRow, { kind: 'series' }> => row.kind === 'series')
      .map(row => `${row.rule.flow}|${normTitle(row.rule.title)}`)
  );
  for (const rule of activeRules) {
    if (used.has(rule.id)) continue;
    if (seriesFingerprints.has(`${rule.flow}|${normTitle(rule.title)}`)) continue;
    rows.push({
      key: `series:${rule.id}`,
      kind: 'series',
      rule,
      sample: sampleFromRule(rule),
      instanceCount: 0,
    });
  }

  rows.sort((a, b) => {
    const byDay = rowSortDay(b).localeCompare(rowSortDay(a));
    if (byDay !== 0) return byDay;
    return rowSortTitle(a).localeCompare(rowSortTitle(b), undefined, {
      sensitivity: 'base',
    });
  });
  return rows;
}
