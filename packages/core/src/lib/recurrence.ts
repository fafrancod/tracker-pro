import { addDays, addMonths, addWeeks, addYears, format, parseISO, getISOWeek } from 'date-fns';
import type { Recurrence, RecurrenceFrequency } from '../types';

export const DEFAULT_RECURRENCE: Recurrence = {
  frequency: 'none',
  interval: 1,
};

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
): Recurrence {
  const freq = frequency ?? 'none';
  const n = typeof interval === 'number' && Number.isFinite(interval) ? Math.floor(interval) : 1;
  return {
    frequency: freq,
    interval: Math.max(1, Math.min(365, n)),
  };
}

export function isRecurring(recurrence: Recurrence | null | undefined): boolean {
  return Boolean(recurrence && recurrence.frequency !== 'none');
}

/**
 * Horizonte de materialización por frecuencia (nº de ocurrencias, incluida la primera).
 * dual-port con packages/api — daily 28 (ventana ~mes, roadmap §1.5).
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
  return format(new Date(year, monthIndex, d), 'yyyy-MM-dd');
}

/** Offset in days from start to end (inclusive span length − 1). */
export function inclusiveDurationDays(startDayId: string, endDayId: string): number {
  const start = parseISO(startDayId);
  const end = parseISO(endDayId);
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export function addDaysToDayId(dayId: string, days: number): string {
  return format(addDays(parseISO(dayId), days), 'yyyy-MM-dd');
}

/**
 * Materializa pares {dayId, endDayId} para una serie.
 * Dual-port mirror of packages/api/src/lib/recurrence.ts.
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

  if (isMultiDay && rec.frequency === 'monthly') {
    const start = parseISO(startDayId);
    const endDate = parseISO(end);
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

  if (isMultiDay && rec.frequency === 'yearly') {
    const start = parseISO(startDayId);
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

  const dayIds = materializeOccurrenceDayIds(startDayId, rec.frequency, rec.interval);
  return dayIds.map(dayId => ({ dayId, endDayId: dayId }));
}

/**
 * Genera dayIds (YYYY-MM-DD) de la serie, empezando en startDayId.
 * Para frequency=none devuelve solo el día inicial.
 */
export function materializeOccurrenceDayIds(
  startDayId: string,
  frequency: RecurrenceFrequency,
  interval: number
): string[] {
  const rec = normalizeRecurrence(frequency, interval);
  if (rec.frequency === 'none') return [startDayId];

  const start = parseISO(startDayId);
  if (Number.isNaN(start.getTime())) return [startDayId];

  const max = recurrenceHorizon(rec.frequency);
  const ids: string[] = [];
  for (let i = 0; i < max; i++) {
    let d: Date;
    if (rec.frequency === 'daily') d = addDays(start, i * rec.interval);
    else if (rec.frequency === 'weekly') d = addWeeks(start, i * rec.interval);
    else if (rec.frequency === 'monthly') d = addMonths(start, i * rec.interval);
    else d = addYears(start, i * rec.interval);
    // Clamp leap-day yearly: addYears may shift; re-clamp month/day for yearly
    if (rec.frequency === 'yearly') {
      ids.push(clampToMonth(d.getFullYear(), start.getMonth(), start.getDate()));
    } else {
      ids.push(format(d, 'yyyy-MM-dd'));
    }
  }
  return ids;
}

export function getWeekIdFromDayId(dayId: string): string {
  const date = parseISO(dayId);
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function formatRecurrenceLabel(
  recurrence: Recurrence,
  labels: {
    none: string;
    daily: string;
    weekly: string;
    monthly: string;
    yearly: string;
    every: (n: number, unit: string) => string;
  }
): string {
  if (!isRecurring(recurrence)) return labels.none;
  const unit =
    recurrence.frequency === 'daily'
      ? labels.daily
      : recurrence.frequency === 'weekly'
        ? labels.weekly
        : recurrence.frequency === 'monthly'
          ? labels.monthly
          : labels.yearly;
  if (recurrence.interval === 1) return unit;
  return labels.every(recurrence.interval, unit);
}
