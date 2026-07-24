import { addDays, addMonths, addWeeks, format, parseISO, getISOWeek } from 'date-fns';
import type { Recurrence, RecurrenceFrequency } from '../types';

export const DEFAULT_RECURRENCE: Recurrence = {
  frequency: 'none',
  interval: 1,
};

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

/** Horizonte de materialización por frecuencia (nº de ocurrencias, incluida la primera). */
export function recurrenceHorizon(frequency: RecurrenceFrequency): number {
  switch (frequency) {
    case 'daily':
      return 90;
    case 'weekly':
      return 52;
    case 'monthly':
      return 24;
    default:
      return 1;
  }
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
    else d = addMonths(start, i * rec.interval);
    ids.push(format(d, 'yyyy-MM-dd'));
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
    every: (n: number, unit: string) => string;
  }
): string {
  if (!isRecurring(recurrence)) return labels.none;
  const unit =
    recurrence.frequency === 'daily'
      ? labels.daily
      : recurrence.frequency === 'weekly'
        ? labels.weekly
        : labels.monthly;
  if (recurrence.interval === 1) return unit;
  return labels.every(recurrence.interval, unit);
}
