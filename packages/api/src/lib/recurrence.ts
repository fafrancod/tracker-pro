export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface OccurrenceRange {
  dayId: string;
  endDayId: string;
}

const MULTI_DAY_FREQUENCIES: RecurrenceFrequency[] = ['none', 'monthly', 'yearly'];

export function isMultiDayRecurrenceAllowed(frequency: RecurrenceFrequency): boolean {
  return MULTI_DAY_FREQUENCIES.includes(frequency);
}

export function normalizeRecurrence(
  frequency?: RecurrenceFrequency | null,
  interval?: number | null
): { frequency: RecurrenceFrequency; interval: number } {
  const freq = frequency ?? 'none';
  const n = typeof interval === 'number' && Number.isFinite(interval) ? Math.floor(interval) : 1;
  return {
    frequency: freq,
    interval: Math.max(1, Math.min(365, n)),
  };
}

function parseDay(dayId: string): Date {
  const [y, m, d] = dayId.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO week id compatible con el cliente (date-fns getISOWeek, zona local). */
export function getWeekIdFromDayId(dayId: string): string {
  const date = parseDay(dayId);
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  // Jueves de la semana ISO
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  const year = tmp.getFullYear();
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Horizonte de materialización (nº de ocurrencias).
 * daily: 28 ≈ 4 semanas visibles (antes 90 — roadmap §1.5, perf hábitos).
 */
export function recurrenceHorizon(frequency: RecurrenceFrequency): number {
  switch (frequency) {
    case 'daily':
      return 28;
    case 'weekly':
      return 26;
    case 'monthly':
      return 24;
    case 'yearly':
      return 10;
    default:
      return 1;
  }
}

/**
 * Clamp day-of-month into a calendar month.
 * @param year full year
 * @param monthIndex 0-based month (0 = January)
 * @param dayOfMonth desired day of month (1–31)
 */
export function clampToMonth(year: number, monthIndex: number, dayOfMonth: number): string {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const d = Math.min(Math.max(1, dayOfMonth), daysInMonth);
  return formatDay(new Date(year, monthIndex, d));
}

/** Offset in days from start to end (inclusive span length − 1). */
export function inclusiveDurationDays(startDayId: string, endDayId: string): number {
  const start = parseDay(startDayId);
  const end = parseDay(endDayId);
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export function addDaysToDayId(dayId: string, days: number): string {
  const d = parseDay(dayId);
  d.setDate(d.getDate() + days);
  return formatDay(d);
}

/**
 * Materializa pares {dayId, endDayId} para una serie.
 * - none: un solo par
 * - multi-day + monthly: anclas DOM + clamp por mes, horizonte 24
 * - multi-day + yearly: anclas mes/día + duración, horizonte 10
 * - single-day + daily/weekly/monthly/yearly: lista de starts con end = start
 */
export function materializeOccurrenceRanges(
  startDayId: string,
  endDayId: string,
  frequency: RecurrenceFrequency,
  interval: number
): OccurrenceRange[] {
  const rec = normalizeRecurrence(frequency, interval);
  const end = endDayId || startDayId;
  const isMultiDay = end > startDayId;

  if (rec.frequency === 'none') {
    return [{ dayId: startDayId, endDayId: end }];
  }

  // Multi-day monthly: day-of-month anchors + month-length clamp
  if (isMultiDay && rec.frequency === 'monthly') {
    const start = parseDay(startDayId);
    const endDate = parseDay(end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(endDate.getTime())) {
      return [{ dayId: startDayId, endDayId: end }];
    }
    const startDOM = start.getDate();
    const endDOM = endDate.getDate();
    const max = recurrenceHorizon('monthly');
    const ranges: OccurrenceRange[] = [];
    for (let i = 0; i < max; i++) {
      const base = new Date(start.getFullYear(), start.getMonth() + i * rec.interval, 1);
      const y = base.getFullYear();
      const m = base.getMonth();
      const occStart = clampToMonth(y, m, startDOM);
      let occEnd = clampToMonth(y, m, endDOM);
      if (occEnd < occStart) occEnd = occStart;
      ranges.push({ dayId: occStart, endDayId: occEnd });
    }
    return ranges;
  }

  // Multi-day yearly: preserve month/day + duration across years
  if (isMultiDay && rec.frequency === 'yearly') {
    const start = parseDay(startDayId);
    if (Number.isNaN(start.getTime())) {
      return [{ dayId: startDayId, endDayId: end }];
    }
    const duration = inclusiveDurationDays(startDayId, end);
    const startMonth = start.getMonth();
    const startDOM = start.getDate();
    const max = recurrenceHorizon('yearly');
    const ranges: OccurrenceRange[] = [];
    for (let i = 0; i < max; i++) {
      const y = start.getFullYear() + i * rec.interval;
      const occStart = clampToMonth(y, startMonth, startDOM);
      const occEnd = addDaysToDayId(occStart, duration);
      ranges.push({ dayId: occStart, endDayId: occEnd });
    }
    return ranges;
  }

  // Single-day (or multi-day daily/weekly — rejected at route) → end = start each occurrence
  const dayIds = materializeOccurrenceDayIds(startDayId, rec.frequency, rec.interval);
  return dayIds.map(dayId => ({ dayId, endDayId: dayId }));
}

export function materializeOccurrenceDayIds(
  startDayId: string,
  frequency: RecurrenceFrequency,
  interval: number
): string[] {
  const rec = normalizeRecurrence(frequency, interval);
  if (rec.frequency === 'none') return [startDayId];

  const start = parseDay(startDayId);
  if (Number.isNaN(start.getTime())) return [startDayId];

  const max = recurrenceHorizon(rec.frequency);
  const ids: string[] = [];
  for (let i = 0; i < max; i++) {
    if (rec.frequency === 'daily') {
      const d = new Date(start.getTime());
      d.setDate(d.getDate() + i * rec.interval);
      ids.push(formatDay(d));
    } else if (rec.frequency === 'weekly') {
      const d = new Date(start.getTime());
      d.setDate(d.getDate() + i * rec.interval * 7);
      ids.push(formatDay(d));
    } else if (rec.frequency === 'monthly') {
      const d = new Date(start.getTime());
      d.setMonth(d.getMonth() + i * rec.interval);
      ids.push(formatDay(d));
    } else {
      // yearly — clamp leap day
      const y = start.getFullYear() + i * rec.interval;
      ids.push(clampToMonth(y, start.getMonth(), start.getDate()));
    }
  }
  return ids;
}
