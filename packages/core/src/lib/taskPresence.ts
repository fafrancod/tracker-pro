import type { Task } from '../types';

/** True when dayId is inside the inclusive [startDayId, endDayId] span. */
export function taskCoversDay(startDayId: string, endDayId: string, dayId: string): boolean {
  return dayId >= startDayId && dayId <= endDayId;
}

export type LocatedTask = Task & { weekId: string; startDayId: string };

/**
 * Scan store buckets (start-day only) and return unique tasks whose span covers dayId.
 * Sorted by startDayId then order.
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

  result.sort((a, b) => {
    if (a.startDayId !== b.startDayId) return a.startDayId.localeCompare(b.startDayId);
    return a.order - b.order;
  });
  return result;
}
