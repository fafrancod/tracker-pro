import type { Task } from '../types';

const KEY = 'daily-tracker:task-cache:v1';
/** Keep offline snapshot up to 7 days. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TasksByDay = Record<string, Record<string, Task[]>>;

interface TaskCachePayload {
  uid: string;
  savedAt: number;
  tasksByDay: TasksByDay;
}

type StorageLike = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};

function storage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

export function saveTaskCache(uid: string, tasksByDay: TasksByDay): void {
  const ls = storage();
  if (!ls || !uid) return;
  try {
    const payload: TaskCachePayload = {
      uid,
      savedAt: Date.now(),
      tasksByDay,
    };
    ls.setItem(KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

export function loadTaskCache(uid: string): TasksByDay | null {
  const ls = storage();
  if (!ls || !uid) return null;
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TaskCachePayload;
    if (parsed.uid !== uid) return null;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > TTL_MS) return null;
    if (!parsed.tasksByDay || typeof parsed.tasksByDay !== 'object') return null;
    return parsed.tasksByDay;
  } catch {
    return null;
  }
}

export function clearTaskCache(): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Merge cached buckets into the live store without wiping fresher data. */
export function hydrateTasksByDay(
  current: TasksByDay,
  cached: TasksByDay
): { weekId: string; dayId: string; tasks: Task[] }[] {
  const toApply: { weekId: string; dayId: string; tasks: Task[] }[] = [];
  for (const [weekId, days] of Object.entries(cached)) {
    for (const [dayId, tasks] of Object.entries(days)) {
      if (!Array.isArray(tasks)) continue;
      const existing = current[weekId]?.[dayId];
      if (existing === undefined) {
        toApply.push({ weekId, dayId, tasks });
      }
    }
  }
  return toApply;
}
