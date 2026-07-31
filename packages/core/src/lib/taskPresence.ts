import type { Task } from '../types';
import {
  buildVirtualHabitForDay,
  habitShouldAppearOnDay,
  isHabitKind,
  type HabitSeed,
} from './habits';

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
 * Orden de lista en calendario: incompletas primero, completadas al final;
 * dentro de cada grupo: más temprano → más tarde; sin hora al final;
 * desempate por título e id.
 */
export function compareByStartTime(
  a: Pick<Task, 'startTime' | 'title' | 'id' | 'completed'>,
  b: Pick<Task, 'startTime' | 'title' | 'id' | 'completed'>
): number {
  if (Boolean(a.completed) !== Boolean(b.completed)) {
    return a.completed ? 1 : -1;
  }
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
 * Hábitos lazy: genera instancias virtuales si el seed de la serie aplica al día
 * y aún no hay fila física (roadmap Fase 2).
 */
export function collectTasksCovering(
  tasksByDay: Record<string, Record<string, Task[]>>,
  dayId: string
): LocatedTask[] {
  const result: LocatedTask[] = [];
  const seen = new Set<string>();
  /** seriesId que ya tienen fila real en este dayId */
  const habitSeriesOnDay = new Set<string>();
  /** Mejor seed por seriesId (día de inicio más temprano) */
  const habitSeeds = new Map<string, HabitSeed>();

  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [startDayId, tasks] of Object.entries(days)) {
      for (const task of tasks) {
        if (isHabitKind(task.kind) && task.seriesId) {
          const prev = habitSeeds.get(task.seriesId);
          if (!prev || startDayId < prev.startDayId) {
            habitSeeds.set(task.seriesId, {
              ...task,
              weekId,
              startDayId,
              seriesId: task.seriesId,
            });
          }
          const end = task.endDayId || startDayId;
          if (taskCoversDay(startDayId, end, dayId)) {
            habitSeriesOnDay.add(task.seriesId);
          }
        }

        if (seen.has(task.id)) continue;
        const end = task.endDayId || startDayId;
        if (!taskCoversDay(startDayId, end, dayId)) continue;
        seen.add(task.id);
        result.push({ ...task, weekId, startDayId });
      }
    }
  }

  // Expandir hábitos virtuales para el día (sin fila física).
  for (const seed of habitSeeds.values()) {
    if (habitSeriesOnDay.has(seed.seriesId)) continue;
    if (!habitShouldAppearOnDay(seed.startDayId, dayId, seed.recurrence)) continue;
    const virtual = buildVirtualHabitForDay(seed, dayId);
    if (seen.has(virtual.id)) continue;
    seen.add(virtual.id);
    result.push(virtual);
  }

  result.sort(compareByStartTime);
  return result;
}
