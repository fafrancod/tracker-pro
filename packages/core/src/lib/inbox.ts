/** Cubo de store / API para tareas sin fecha (no viven en el calendario). */
export const INBOX_WEEK_ID = '__inbox__';
export const INBOX_DAY_ID = '__undated__';

const DAY_ID_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isInboxDayId(dayId: string | null | undefined): boolean {
  return !dayId || dayId === INBOX_DAY_ID;
}

export function isInboxWeekId(weekId: string | null | undefined): boolean {
  return !weekId || weekId === INBOX_WEEK_ID;
}

export function isCalendarDayId(dayId: string | null | undefined): dayId is string {
  return typeof dayId === 'string' && DAY_ID_RE.test(dayId);
}

export function toInboxLocation(dayId: string | null | undefined, weekId?: string | null): {
  weekId: string;
  dayId: string;
} {
  if (isCalendarDayId(dayId)) {
    return {
      weekId: weekId && !isInboxWeekId(weekId) ? weekId : '',
      dayId,
    };
  }
  return { weekId: INBOX_WEEK_ID, dayId: INBOX_DAY_ID };
}
