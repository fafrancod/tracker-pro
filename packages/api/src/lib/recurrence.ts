export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

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

function recurrenceHorizon(frequency: RecurrenceFrequency): number {
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
    const d = new Date(start.getTime());
    if (rec.frequency === 'daily') {
      d.setDate(d.getDate() + i * rec.interval);
    } else if (rec.frequency === 'weekly') {
      d.setDate(d.getDate() + i * rec.interval * 7);
    } else {
      d.setMonth(d.getMonth() + i * rec.interval);
    }
    ids.push(formatDay(d));
  }
  return ids;
}
