import { format } from 'date-fns';

/**
 * Civil YYYY-MM-DD of `date` in an IANA zone (e.g. America/Santiago).
 * Empty or invalid zone falls back to the runtime's local calendar.
 */
export function dayIdInTimeZone(
  date: Date,
  timeZone?: string | null
): string {
  const tz = timeZone?.trim();
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* invalid IANA id */
  }
  return format(date, 'yyyy-MM-dd');
}

export function todayDayId(
  timeZone?: string | null,
  now: Date = new Date()
): string {
  return dayIdInTimeZone(now, timeZone);
}

/** Local noon for a civil day — safe for date-fns week/month helpers. */
export function civilDateFromDayId(dayId: string): Date {
  const [ys, ms, ds] = dayId.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (![y, m, d].every(n => Number.isFinite(n))) {
    return new Date();
  }
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function todayCivilDate(
  timeZone?: string | null,
  now: Date = new Date()
): Date {
  return civilDateFromDayId(todayDayId(timeZone, now));
}
