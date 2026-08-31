import { listDayIdsInclusive } from '../habitPlan';
import { monthIdFromDayId } from './movementSummary';
import { financeTitlesMatch, normalizeFinanceTitle } from './title';
import type { FinanceMovement, FinanceRule } from './types';

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function parseDayParts(dayId: string): { y: number; m: number; d: number } {
  const [ys, ms, ds] = dayId.split('-');
  return { y: Number(ys), m: Number(ms), d: Number(ds) };
}

/** Día civil del mes con el día de recurrencia mensual, acotado al último día del mes. */
export function shiftDayIdToMonthDay(dayId: string, monthDay: number): string {
  const { y, m } = parseDayParts(dayId);
  if (!y || !m) return dayId;
  const dim = daysInMonth(y, m - 1);
  const d = Math.min(Math.max(1, Math.round(monthDay) || 1), dim);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function financeRuleAppliesOnDay(rule: FinanceRule, dayId: string): boolean {
  if (!rule.active) return false;
  const { y, m, d } = parseDayParts(dayId);
  if (!y || !m || !d) return false;
  if (rule.frequency === 'monthly') {
    // El arranque es el mes, no el día exacto: una serie que nació el 31
    // y pasa al 30 debe seguir pintando agosto.
    if (monthIdFromDayId(dayId) < monthIdFromDayId(rule.startDayId)) return false;
    const dim = daysInMonth(y, m - 1);
    const target = Math.min(Math.max(1, rule.recurrenceDay), dim);
    return d === target;
  }
  if (dayId < rule.startDayId) return false;
  const weekday = new Date(y, m - 1, d).getDay();
  return weekday === rule.recurrenceDay;
}

export function makeVirtualFinanceId(ruleId: string, dayId: string): string {
  return `fvr:${ruleId}:${dayId}`;
}

function amountsCompatible(a: number, b: number): boolean {
  if (!(a > 0) || !(b > 0)) return true;
  return Math.abs(a - b) < 0.009;
}

function txKey(
  mov: Pick<FinanceMovement, 'flow' | 'title' | 'dayId'>,
  monthly: boolean
): string {
  const when = monthly ? monthIdFromDayId(mov.dayId) : mov.dayId;
  return `${mov.flow}|${normalizeFinanceTitle(mov.title)}|${when}`;
}

function ruleOccurrenceKey(rule: FinanceRule, dayId: string): string {
  if (rule.frequency === 'monthly') {
    return `${rule.id}|${monthIdFromDayId(dayId)}`;
  }
  return `${rule.id}|${dayId}`;
}

export function isSyntheticFinanceMovement(mov: FinanceMovement): boolean {
  return (
    Boolean(mov.virtual) ||
    mov.id.startsWith('fvr:') ||
    mov.id.startsWith('ftask:') ||
    mov.id.startsWith('fcr:')
  );
}

export function preferFinanceMovement(
  a: FinanceMovement,
  b: FinanceMovement
): FinanceMovement {
  const score = (m: FinanceMovement) =>
    (isSyntheticFinanceMovement(m) ? 0 : 8) +
    (m.status === 'confirmed' ? 4 : 0) +
    (m.ruleId ? 2 : 0) +
    (m.sourceTaskId ? 1 : 0);
  return score(b) > score(a) ? b : a;
}

/** Fila del mayor que ya representa esa ocurrencia de la regla (con o sin ruleId). */
export function movementCoversFinanceRule(
  mov: FinanceMovement,
  rule: FinanceRule,
  occurrenceDayId?: string
): boolean {
  if (mov.status === 'skipped') return false;
  if (mov.flow !== rule.flow) return false;
  const sameIdentity =
    (mov.ruleId && mov.ruleId === rule.id) ||
    financeTitlesMatch(mov.title, rule.title);
  if (!sameIdentity) return false;
  if (!amountsCompatible(mov.amount, rule.amount)) return false;
  if (!occurrenceDayId) return true;
  if (rule.frequency === 'monthly') {
    return monthIdFromDayId(mov.dayId) === monthIdFromDayId(occurrenceDayId);
  }
  return mov.dayId === occurrenceDayId;
}

/**
 * Si la regla mensual cambió de día (31 → 30), las filas físicas de ese mes
 * se muestran en el día nuevo. Si no, el dedupe las deja en el día viejo
 * y el calendario parece vacío en el día que eligió el usuario.
 */
export function retargetMonthlyRuleOccurrences(
  movements: FinanceMovement[],
  rules: FinanceRule[]
): FinanceMovement[] {
  const monthly = rules.filter(rule => rule.active && rule.frequency === 'monthly');
  if (monthly.length === 0) return movements;
  return movements.map(mov => {
    if (mov.status === 'skipped') return mov;
    const rule =
      (mov.ruleId ? monthly.find(item => item.id === mov.ruleId) : undefined) ??
      // A source-task movement without rule_id is an explicit board
      // occurrence (including a rescheduled one).  Matching it only by title
      // and amount would silently pull it back to the old rule day.
      (!mov.sourceTaskId
        ? monthly.find(
            item =>
              item.flow === mov.flow &&
              financeTitlesMatch(mov.title, item.title) &&
              amountsCompatible(mov.amount, item.amount)
          )
        : undefined);
    if (!rule) return mov;
    const target = shiftDayIdToMonthDay(mov.dayId, rule.recurrenceDay);
    if (target === mov.dayId) return mov;
    return { ...mov, dayId: target };
  });
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
    existingTx.add(txKey(mov, false));
    existingTx.add(txKey(mov, true));
    if (mov.ruleId) {
      const owned = rules.find(item => item.id === mov.ruleId);
      covered.add(
        owned
          ? ruleOccurrenceKey(owned, mov.dayId)
          : `${mov.ruleId}|${mov.dayId}`
      );
    }
    for (const rule of rules) {
      if (!rule.active) continue;
      if (movementCoversFinanceRule(mov, rule, mov.dayId)) {
        covered.add(ruleOccurrenceKey(rule, mov.dayId));
      }
    }
  }
  const extra: FinanceMovement[] = [];
  const days = listDayIdsInclusive(fromDayId, toDayId);
  for (const rule of rules) {
    if (!rule.active) continue;
    const monthly = rule.frequency === 'monthly';
    for (const dayId of days) {
      if (!financeRuleAppliesOnDay(rule, dayId)) continue;
      if (covered.has(ruleOccurrenceKey(rule, dayId))) continue;
      const fingerprint = txKey(
        { flow: rule.flow, title: rule.title, dayId },
        monthly
      );
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

function seriesFingerprint(mov: FinanceMovement): string {
  const amount = Number.isFinite(mov.amount) ? Math.round(mov.amount) : 0;
  return `${mov.flow}|${normalizeFinanceTitle(mov.title)}|${monthIdFromDayId(mov.dayId)}|${amount}`;
}

function dayFingerprint(mov: FinanceMovement): string {
  return `${mov.flow}|${normalizeFinanceTitle(mov.title)}|${mov.dayId}`;
}

function looksLikeMonthlySeries(
  mov: FinanceMovement,
  rules: FinanceRule[]
): boolean {
  if (isSyntheticFinanceMovement(mov) || mov.ruleId) return true;
  const title = normalizeFinanceTitle(mov.title);
  return rules.some(
    rule =>
      rule.active &&
      rule.frequency === 'monthly' &&
      rule.flow === mov.flow &&
      normalizeFinanceTitle(rule.title) === title
  );
}

/**
 * Una transacción mensual (arriendo, sueldo) no debe verse dos veces en el mismo mes:
 * movimiento real + virtual, dpto/depto, o copia del tablero.
 */
export function dedupeFinanceCalendarMovements(
  movements: FinanceMovement[],
  rules: FinanceRule[] = []
): FinanceMovement[] {
  const out: FinanceMovement[] = [];
  const byDay = new Map<string, number>();
  const byMonthSeries = new Map<string, number>();
  for (const mov of movements) {
    if (mov.status === 'skipped') {
      out.push(mov);
      continue;
    }
    const dayKey = dayFingerprint(mov);
    const dayIdx = byDay.get(dayKey);
    if (dayIdx !== undefined) {
      out[dayIdx] = preferFinanceMovement(out[dayIdx]!, mov);
      continue;
    }
    if (looksLikeMonthlySeries(mov, rules)) {
      const monthKey = seriesFingerprint(mov);
      const monthIdx = byMonthSeries.get(monthKey);
      if (monthIdx !== undefined) {
        const kept = preferFinanceMovement(out[monthIdx]!, mov);
        out[monthIdx] = kept;
        byDay.set(dayFingerprint(kept), monthIdx);
        continue;
      }
      byMonthSeries.set(monthKey, out.length);
    }
    byDay.set(dayKey, out.length);
    out.push(mov);
  }
  return out;
}
