import type { Recurrence, Task } from '../types';
import { getWeekIdFromDayId } from './recurrence';

export type HabitKind = 'habit_good' | 'habit_quit';

/** Tope razonable de pomodoros por día (25 min × 24 = 10 h). */
export const MAX_DAILY_POMODOROS = 24;

export function normalizePomodoroCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_DAILY_POMODOROS, Math.round(value)));
}

export function isHabitKind(kind: string | null | undefined): kind is HabitKind {
  return kind === 'habit_good' || kind === 'habit_quit';
}

export function isHabitGood(kind: string | null | undefined): boolean {
  return kind === 'habit_good';
}

export function isHabitQuit(kind: string | null | undefined): boolean {
  return kind === 'habit_quit';
}

/** Color por defecto del hábito. */
export function defaultHabitColor(kind: HabitKind): string {
  return kind === 'habit_good' ? '#3fb950' : '#f85149';
}

/** Prefijo de ids virtuales: vh:{seriesId}:{dayId} */
export const VIRTUAL_HABIT_PREFIX = 'vh:';

export function isVirtualHabitId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(VIRTUAL_HABIT_PREFIX);
}

export function makeVirtualHabitId(seriesId: string, dayId: string): string {
  return `${VIRTUAL_HABIT_PREFIX}${seriesId}:${dayId}`;
}

export function parseVirtualHabitId(
  id: string
): { seriesId: string; dayId: string } | null {
  if (!isVirtualHabitId(id)) return null;
  const rest = id.slice(VIRTUAL_HABIT_PREFIX.length);
  const idx = rest.lastIndexOf(':');
  if (idx <= 0) return null;
  const seriesId = rest.slice(0, idx);
  const dayId = rest.slice(idx + 1);
  if (!seriesId || !/^\d{4}-\d{2}-\d{2}$/.test(dayId)) return null;
  return { seriesId, dayId };
}

function parseDay(dayId: string): Date {
  const [y, m, d] = dayId.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayDiff(startDayId: string, dayId: string): number {
  const a = parseDay(startDayId).getTime();
  const b = parseDay(dayId).getTime();
  return Math.round((b - a) / 86400000);
}

/** ISO 1 = lunes … 7 = domingo (civil local del dayId). */
export function isoWeekdayFromDayId(dayId: string): number {
  const js = parseDay(dayId).getDay();
  return js === 0 ? 7 : js;
}

/**
 * ¿El hábito (seed) debe mostrarse en dayId según su recurrencia?
 * Solo días >= inicio del seed.
 *
 * `weekdays`:
 * - omitido: frequency + interval clásico
 * - `[]`: solo el día seed (plan de fechas concretas; el resto son filas físicas)
 * - `[1,3,5]`: esos días ISO, cada `interval` semanas desde el seed
 */
export function habitShouldAppearOnDay(
  seedStartDayId: string,
  dayId: string,
  recurrence: Recurrence | null | undefined
): boolean {
  if (dayId < seedStartDayId) return false;
  const diff = dayDiff(seedStartDayId, dayId);
  if (diff < 0) return false;

  const weekdays = recurrence?.weekdays;
  if (Array.isArray(weekdays)) {
    if (weekdays.length === 0) return dayId === seedStartDayId;
    if (!weekdays.includes(isoWeekdayFromDayId(dayId))) return false;
    const interval = Math.max(1, recurrence?.interval ?? 1);
    if (interval <= 1) return true;
    return Math.floor(diff / 7) % interval === 0;
  }

  const freq = recurrence?.frequency ?? 'daily';
  const interval = Math.max(1, recurrence?.interval ?? 1);
  if (freq === 'daily' || freq === 'none') {
    return diff % interval === 0;
  }
  if (freq === 'weekly') {
    return diff % (7 * interval) === 0;
  }
  // monthly/yearly: solo si ya hay fila física (no expandimos virtual por mes)
  return dayId === seedStartDayId;
}

export type HabitSeed = Task & {
  weekId: string;
  startDayId: string;
  seriesId: string;
};

/**
 * Construye una instancia virtual de hábito para un día (sin fila en DB).
 */
export function buildVirtualHabitForDay(
  seed: HabitSeed,
  dayId: string
): Task & { weekId: string; startDayId: string } {
  const seriesId = seed.seriesId;
  return {
    ...seed,
    id: makeVirtualHabitId(seriesId, dayId),
    completed: false,
    completedAt: null,
    endDayId: dayId,
    startTime: null,
    endTime: null,
    pomodoroTarget: normalizePomodoroCount(seed.pomodoroTarget),
    pomodoroDone: 0,
    weekId: getWeekIdFromDayId(dayId),
    startDayId: dayId,
    // El “orden” virtual no importa; se reordena al materializar
    order: seed.order,
    updatedAt: seed.updatedAt,
  };
}
