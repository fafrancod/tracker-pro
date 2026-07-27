/**
 * Dual-port mirror of packages/core/src/lib/recurrence.ts.
 * Business-day anchors use Chile holidays from @daily-tracker/core.
 */
import {
  firstBusinessDayOfMonth,
  lastBusinessDayOfMonth,
  lastCalendarDayOfMonth,
} from '@daily-tracker/core';

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type MonthlyAnchor =
  | 'day_of_month'
  | 'last_day'
  | 'first_business'
  | 'last_business';

export interface OccurrenceRange {
  dayId: string;
  endDayId: string;
}

const MULTI_DAY_FREQUENCIES: RecurrenceFrequency[] = ['none', 'monthly', 'yearly'];

export function isMultiDayRecurrenceAllowed(frequency: RecurrenceFrequency): boolean {
  return MULTI_DAY_FREQUENCIES.includes(frequency);
}

export function normalizeMonthlyAnchor(raw: unknown): MonthlyAnchor {
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
): { frequency: RecurrenceFrequency; interval: number; monthlyAnchor?: MonthlyAnchor } {
  const freq = frequency ?? 'none';
  const n = typeof interval === 'number' && Number.isFinite(interval) ? Math.floor(interval) : 1;
  return {
    frequency: freq,
    interval: Math.max(1, Math.min(365, n)),
    monthlyAnchor: freq === 'monthly' ? normalizeMonthlyAnchor(monthlyAnchor) : undefined,
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

export function getWeekIdFromDayId(dayId: string): string {
  const date = parseDay(dayId);
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
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

export function clampToMonth(year: number, monthIndex: number, dayOfMonth: number): string {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const d = Math.min(Math.max(1, dayOfMonth), daysInMonth);
  return formatDay(new Date(year, monthIndex, d));
}

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

function monthlyOccurrenceDayId(
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
    const start = parseDay(startDayId);
    const endDate = parseDay(end);
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

  const dayIds = materializeOccurrenceDayIds(
    startDayId,
    rec.frequency,
    rec.interval,
    rec.monthlyAnchor
  );
  return dayIds.map(dayId => ({ dayId, endDayId: dayId }));
}

export function materializeOccurrenceDayIds(
  startDayId: string,
  frequency: RecurrenceFrequency,
  interval: number,
  monthlyAnchor?: MonthlyAnchor | null
): string[] {
  const rec = normalizeRecurrence(frequency, interval, monthlyAnchor);
  if (rec.frequency === 'none') return [startDayId];

  const start = parseDay(startDayId);
  if (Number.isNaN(start.getTime())) return [startDayId];

  const max = recurrenceHorizon(rec.frequency);
  const ids: string[] = [];
  const dom = start.getDate();
  const anchor = rec.monthlyAnchor ?? 'day_of_month';

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
      const base = new Date(
        start.getFullYear(),
        start.getMonth() + i * rec.interval,
        1
      );
      ids.push(
        monthlyOccurrenceDayId(base.getFullYear(), base.getMonth(), dom, anchor)
      );
    } else {
      const y = start.getFullYear() + i * rec.interval;
      ids.push(clampToMonth(y, start.getMonth(), start.getDate()));
    }
  }
  return ids;
}
