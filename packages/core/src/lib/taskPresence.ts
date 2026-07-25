import type { Task } from '../types';

/** True when dayId is inside the inclusive [startDayId, endDayId] span. */
export function taskCoversDay(startDayId: string, endDayId: string, dayId: string): boolean {
  return dayId >= startDayId && dayId <= endDayId;
}

export type LocatedTask = Task & { weekId: string; startDayId: string };

/** Clave de orden horario: sin HH:mm al final del día. */
export function startTimeSortKey(startTime: string | null | undefined): string {
  if (!startTime || !/^\d{2}:\d{2}/.test(startTime)) return '99:99';
  return startTime.slice(0, 5);
}

/**
 * Orden de lista en calendario: más temprano → más tarde;
 * sin hora al final; desempate por título e id.
 */
export function compareByStartTime(
  a: Pick<Task, 'startTime' | 'title' | 'id'>,
  b: Pick<Task, 'startTime' | 'title' | 'id'>
): number {
  const byTime = startTimeSortKey(a.startTime).localeCompare(
    startTimeSortKey(b.startTime)
  );
  if (byTime !== 0) return byTime;
  const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  if (byTitle !== 0) return byTitle;
  return a.id.localeCompare(b.id);
}

/**
 * Scan store buckets (start-day only) and return unique tasks whose span covers dayId.
 * Sorted by start time (early → late); unscheduled last.
 */
export function collectTasksCovering(
  tasksByDay: Record<string, Record<string, Task[]>>,
  dayId: string
): LocatedTask[] {
  const result: LocatedTask[] = [];
  const seen = new Set<string>();

  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [startDayId, tasks] of Object.entries(days)) {
      for (const task of tasks) {
        if (seen.has(task.id)) continue;
        const end = task.endDayId || startDayId;
        if (!taskCoversDay(startDayId, end, dayId)) continue;
        seen.add(task.id);
        result.push({ ...task, weekId, startDayId });
      }
    }
  }

  result.sort(compareByStartTime);
  return result;
}
