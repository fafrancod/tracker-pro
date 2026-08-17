import type { HabitKind } from './habits';
import { habitShouldAppearOnDay, isHabitKind, normalizePomodoroCount } from './habits';
import { addDaysToDayId } from './recurrence';
import type { Recurrence, Task } from '../types';

export type HabitPlanMode = 'recurring' | 'specific';

export type LocatedHabit = Task & { dayId: string; weekId?: string };

export interface HabitSeriesSummary {
  seriesId: string;
  seed: LocatedHabit;
  instances: LocatedHabit[];
  kind: HabitKind;
  title: string;
  color: string | null;
  notes: string;
  pomodoroTarget: number;
  recurrence: Recurrence;
  planMode: HabitPlanMode;
  startDayId: string;
}

export interface HabitDayPoint {
  dayId: string;
  expected: boolean;
  done: boolean;
  pomodoroTarget: number;
  pomodoroDone: number;
}

export interface HabitSeriesStats {
  seriesId: string;
  expected: number;
  done: number;
  adherence: number;
  streak: number;
  pomodoroPlanned: number;
  pomodoroDone: number;
  days: HabitDayPoint[];
}

export function habitPlanMode(recurrence: Recurrence | null | undefined): HabitPlanMode {
  return Array.isArray(recurrence?.weekdays) && recurrence!.weekdays!.length === 0
    ? 'specific'
    : 'recurring';
}

export function groupHabitSeries(rows: LocatedHabit[]): HabitSeriesSummary[] {
  const bySeries = new Map<string, LocatedHabit[]>();
  for (const row of rows) {
    if (!isHabitKind(row.kind)) continue;
    const key = row.seriesId ?? row.id;
    const list = bySeries.get(key);
    if (list) list.push(row);
    else bySeries.set(key, [row]);
  }

  const out: HabitSeriesSummary[] = [];
  for (const [seriesId, instances] of bySeries) {
    instances.sort((a, b) => a.dayId.localeCompare(b.dayId));
    const seed = instances[0];
    if (!seed || !isHabitKind(seed.kind)) continue;
    const recurrence = seed.recurrence;
    out.push({
      seriesId,
      seed,
      instances,
      kind: seed.kind,
      title: seed.title,
      color: seed.color,
      notes: seed.notes,
      pomodoroTarget: normalizePomodoroCount(seed.pomodoroTarget),
      recurrence,
      planMode: habitPlanMode(recurrence),
      startDayId: seed.dayId,
    });
  }
  out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  return out;
}

export function listDayIdsInclusive(fromDayId: string, toDayId: string): string[] {
  if (toDayId < fromDayId) return [];
  const out: string[] = [];
  let cursor = fromDayId;
  while (cursor <= toDayId) {
    out.push(cursor);
    cursor = addDaysToDayId(cursor, 1);
    if (out.length > 400) break;
  }
  return out;
}

export function computeHabitSeriesStats(
  series: HabitSeriesSummary,
  fromDayId: string,
  toDayId: string,
  todayId: string
): HabitSeriesStats {
  const byDay = new Map<string, LocatedHabit>();
  for (const inst of series.instances) {
    const prev = byDay.get(inst.dayId);
    if (!prev || inst.updatedAt > prev.updatedAt) byDay.set(inst.dayId, inst);
  }

  const days: HabitDayPoint[] = [];
  for (const dayId of listDayIdsInclusive(fromDayId, toDayId)) {
    const inst = byDay.get(dayId);
    const expected =
      Boolean(inst) ||
      habitShouldAppearOnDay(series.startDayId, dayId, series.recurrence);
    const done = Boolean(inst?.completed);
    days.push({
      dayId,
      expected,
      done,
      pomodoroTarget: normalizePomodoroCount(
        inst?.pomodoroTarget ?? series.pomodoroTarget
      ),
      pomodoroDone: normalizePomodoroCount(inst?.pomodoroDone),
    });
  }

  const relevant = days.filter(d => d.expected && d.dayId <= todayId);
  const expected = relevant.length;
  const done = relevant.filter(d => d.done).length;
  const adherence = expected > 0 ? Math.round((done / expected) * 100) : 0;

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const point = days[i];
    if (!point || point.dayId > todayId || !point.expected) continue;
    if (point.dayId === todayId && !point.done) continue;
    if (point.done) streak += 1;
    else break;
  }

  const pomoWindow = days.filter(d => d.expected && d.dayId <= todayId);
  return {
    seriesId: series.seriesId,
    expected,
    done,
    adherence,
    streak,
    pomodoroPlanned: pomoWindow.reduce((acc, d) => acc + d.pomodoroTarget, 0),
    pomodoroDone: pomoWindow.reduce((acc, d) => acc + d.pomodoroDone, 0),
    days,
  };
}

export function aggregateHabitStats(stats: HabitSeriesStats[]): {
  expected: number;
  done: number;
  adherence: number;
  bestStreak: number;
  pomodoroPlanned: number;
  pomodoroDone: number;
} {
  const expected = stats.reduce((acc, s) => acc + s.expected, 0);
  const done = stats.reduce((acc, s) => acc + s.done, 0);
  return {
    expected,
    done,
    adherence: expected > 0 ? Math.round((done / expected) * 100) : 0,
    bestStreak: stats.reduce((acc, s) => Math.max(acc, s.streak), 0),
    pomodoroPlanned: stats.reduce((acc, s) => acc + s.pomodoroPlanned, 0),
    pomodoroDone: stats.reduce((acc, s) => acc + s.pomodoroDone, 0),
  };
}

export function uniqueSortedDayIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const dayId = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayId) || seen.has(dayId)) continue;
    seen.add(dayId);
    out.push(dayId);
  }
  out.sort();
  return out;
}
