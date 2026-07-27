import { addDays, addWeeks, format, parseISO, getISOWeek } from 'date-fns';
import type { MonthlyAnchor, Recurrence, RecurrenceFrequency } from '../types';
import {
  firstBusinessDayOfMonth,
  lastBusinessDayOfMonth,
  lastCalendarDayOfMonth,
} from './chileHolidays';

export const DEFAULT_RECURRENCE: Recurrence = {
  frequency: 'none',
  interval: 1,
  monthlyAnchor: 'day_of_month',
};

export interface OccurrenceRange {
  dayId: string;
  endDayId: string;
}

const MULTI_DAY_FREQUENCIES: RecurrenceFrequency[] = ['none', 'monthly', 'yearly'];

export function isMultiDayRecurrenceAllowed(frequency: RecurrenceFrequency): boolean {
  return MULTI_DAY_FREQUENCIES.includes(frequency);
}

export function normalizeMonthlyAnchor(
  raw: unknown
): MonthlyAnchor {
  if (
    raw === 'last_day' ||
    raw === 'first_business' ||
    raw === 'last_business' ||
    raw === 'day_of_month'
  ) {
    return raw;
  }
  return 'day_of_month';
}

export function normalizeRecurrence(
  frequency?: RecurrenceFrequency | null,
  interval?: number | null,
  monthlyAnchor?: MonthlyAnchor | null
): Recurrence {
  const freq = frequency ?? 'none';
  const n = typeof interval === 'number' && Number.isFinite(interval) ? Math.floor(interval) : 1;
  return {
    frequency: freq,
    interval: Math.max(1, Math.min(365, n)),
    monthlyAnchor:
      freq === 'monthly'
        ? normalizeMonthlyAnchor(monthlyAnchor)
        : undefined,
  };
}

/** Day-of-month anchor for a calendar month. */
export function monthlyOccurrenceDayId(
  year: number,
  monthIndex0: number,
  dayOfMonth: number,
  anchor: MonthlyAnchor
): string {
  switch (anchor) {
    case 'last_day':
      return lastCalendarDayOfMonth(year, monthIndex0);
    case 'first_business':
      return firstBusinessDayOfMonth(year, monthIndex0);
    case 'last_business':
      return lastBusinessDayOfMonth(year, monthIndex0);
    case 'day_of_month':
    default:
      return clampToMonth(year, monthIndex0, dayOfMonth);
  }
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
  interval: number,
  monthlyAnchor?: MonthlyAnchor | null
): OccurrenceRange[] {
  const rec = normalizeRecurrence(frequency, interval, monthlyAnchor);
  const end = endDayId || startDayId;
  const isMultiDay = end > startDayId;
  const anchor = rec.monthlyAnchor ?? 'day_of_month';

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
    const duration = inclusiveDurationDays(startDayId, end);
    const max = recurrenceHorizon('monthly');
    const ranges: OccurrenceRange[] = [];
    for (let i = 0; i < max; i++) {
      const base = new Date(start.getFullYear(), start.getMonth() + i * rec.interval, 1);
      const y = base.getFullYear();
      const m = base.getMonth();
      const occStart = monthlyOccurrenceDayId(y, m, startDOM, anchor);
      // For last_day / business anchors, keep same span length from start.
      let occEnd =
        anchor === 'day_of_month'
          ? clampToMonth(y, m, endDOM)
          : addDaysToDayId(occStart, duration);
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

  const dayIds = materializeOccurrenceDayIds(
    startDayId,
    rec.frequency,
    rec.interval,
    rec.monthlyAnchor
  );
  return dayIds.map(dayId => ({ dayId, endDayId: dayId }));
}

/**
 * Genera dayIds (YYYY-MM-DD) de la serie, empezando en startDayId.
 * Para frequency=none devuelve solo el día inicial.
 */
export function materializeOccurrenceDayIds(
  startDayId: string,
  frequency: RecurrenceFrequency,
  interval: number,
  monthlyAnchor?: MonthlyAnchor | null
): string[] {
  const rec = normalizeRecurrence(frequency, interval, monthlyAnchor);
  if (rec.frequency === 'none') return [startDayId];

  const start = parseISO(startDayId);
  if (Number.isNaN(start.getTime())) return [startDayId];

  const max = recurrenceHorizon(rec.frequency);
  const ids: string[] = [];
  const dom = start.getDate();
  const anchor = rec.monthlyAnchor ?? 'day_of_month';

  for (let i = 0; i < max; i++) {
    if (rec.frequency === 'daily') {
      ids.push(format(addDays(start, i * rec.interval), 'yyyy-MM-dd'));
    } else if (rec.frequency === 'weekly') {
      ids.push(format(addWeeks(start, i * rec.interval), 'yyyy-MM-dd'));
    } else if (rec.frequency === 'monthly') {
      const base = new Date(
        start.getFullYear(),
        start.getMonth() + i * rec.interval,
        1
      );
      ids.push(
        monthlyOccurrenceDayId(
          base.getFullYear(),
          base.getMonth(),
          dom,
          anchor
        )
      );
    } else {
      // yearly — clamp leap day
      const y = start.getFullYear() + i * rec.interval;
      ids.push(clampToMonth(y, start.getMonth(), start.getDate()));
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
