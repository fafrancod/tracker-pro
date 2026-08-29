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

function isInstallment(mov: FinanceMovement): boolean {
  return Boolean(mov.installmentGroupId && (mov.installmentTotal ?? 0) > 1);
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

  for (const mov of movements) {
    if (mov.virtual) continue;
    if (isInstallment(mov)) {
      oneOff.push(mov);
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
    const da = a.kind === 'one_off' ? a.movement.dayId : a.sample.dayId;
    const db = b.kind === 'one_off' ? b.movement.dayId : b.sample.dayId;
    const byDay = db.localeCompare(da);
    if (byDay !== 0) return byDay;
    const ta = a.kind === 'one_off' ? a.movement.title : a.rule.title;
    const tb = b.kind === 'one_off' ? b.movement.title : b.rule.title;
    return ta.localeCompare(tb, undefined, { sensitivity: 'base' });
  });
  return rows;
}
