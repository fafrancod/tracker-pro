import { getSupabase } from '../supabase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { subscribeTable } from '../lib/realtime';
import {
  materializeOccurrenceRanges,
  normalizeRecurrence,
  getWeekIdFromDayId,
} from '../lib/recurrence';
import type { Task, CreateTaskPayload, UpdateTaskPayload, Recurrence } from '../types';
import { getISOWeek, format } from 'date-fns';

export type TasksUnsubscribe = () => void;

export type LocatedTaskRow = Task & { weekId: string; dayId: string };

export function getWeekId(date: Date): string {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getDayId(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Tareas que empiezan en (weekId, dayId) — bucket de start-day.
 * Prefer overlap helpers for mid-span presence.
 */
export async function fetchTasks(uid: string, weekId: string, dayId: string): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .eq('week_id', weekId)
    .eq('day_id', dayId)
    .order('order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapTask(row.id as string, row));
}

/**
 * Overlap fetch for a single day: day_id <= dayId AND end_day_id >= dayId.
 * Returns rows bucketed by **start** day (dayId field = start).
 */
export async function fetchTasksCoveringDay(
  uid: string,
  dayId: string
): Promise<LocatedTaskRow[]> {
  if (isDemoMode()) return [];

  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .lte('day_id', dayId)
    .gte('end_day_id', dayId)
    .order('day_id', { ascending: true })
    .order('order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    ...mapTask(row.id as string, row),
    weekId: (row.week_id as string) ?? getWeekIdFromDayId(row.day_id as string),
    dayId: row.day_id as string,
  }));
}

/**
 * Overlap range load for month/calendar:
 * day_id <= to AND end_day_id >= from (includes spans that start before the window).
 * Rows are keyed by **start** day only.
 */
export async function fetchTasksInRange(
  uid: string,
  fromDayId: string,
  toDayId: string
): Promise<LocatedTaskRow[]> {
  if (isDemoMode()) return [];

  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .lte('day_id', toDayId)
    .gte('end_day_id', fromDayId)
    .order('day_id', { ascending: true })
    .order('order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    ...mapTask(row.id as string, row),
    weekId: (row.week_id as string) ?? getWeekIdFromDayId(row.day_id as string),
    dayId: row.day_id as string,
  }));
}

/**
 * Todas las tareas del usuario (para Eisenhower y listados globales).
 * Opcionalmente filtra por proyecto en cliente tras el select.
 */
export async function fetchAllTasks(
  uid: string,
  opts?: { projectId?: string | null }
): Promise<LocatedTaskRow[]> {
  if (isDemoMode()) return [];

  let query = getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .order('day_id', { ascending: true })
    .order('order', { ascending: true });

  if (opts?.projectId) {
    query = query.eq('project_id', opts.projectId);
  } else if (opts?.projectId === null) {
    query = query.is('project_id', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(row => ({
    ...mapTask(row.id as string, row),
    weekId: (row.week_id as string) ?? getWeekIdFromDayId(row.day_id as string),
    dayId: row.day_id as string,
  }));
}

/**
 * Subscribe to tasks covering a day. Callback receives rows located at their **start** day
 * (not necessarily the subscribed dayId), so the store can merge into start buckets.
 */
export function subscribeTasks(
  uid: string,
  weekId: string,
  dayId: string,
  cb: (rows: LocatedTaskRow[]) => void
): TasksUnsubscribe {
  if (isDemoMode()) return () => undefined;

  const load = () => {
    void fetchTasksCoveringDay(uid, dayId).then(cb);
  };

  load();

  return subscribeTable({
    topic: `tasks:${uid}:${weekId}:${dayId}`,
    table: 'tasks',
    filter: `user_id=eq.${uid}`,
    onChange: load,
  });
}

export interface CreateTaskResult {
  task: Task;
  instances: Array<Task & { weekId: string; dayId: string }>;
}

interface CreateTaskResponse {
  id: string;
  weekId: string;
  dayId: string;
  endDayId?: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  projectId: string | null;
  priority: 'low' | 'medium' | 'high';
  notes: string;
  order: number;
  tags: string[];
  movedFrom: string | null;
  seriesId?: string | null;
  recurrence?: Recurrence;
  instances?: Array<Record<string, unknown>>;
  createdAt?: string;
  updatedAt?: string;
}

export async function createTask(
  weekId: string,
  dayId: string,
  payload: CreateTaskPayload,
  eventId?: string
): Promise<CreateTaskResult> {
  const endDayId = payload.endDayId ?? dayId;
  const res = await api.post<CreateTaskResponse>('/api/tasks', {
    weekId,
    dayId,
    endDayId,
    title: payload.title,
    projectId: payload.projectId ?? null,
    priority: payload.priority ?? 'medium',
    notes: payload.notes ?? '',
    tags: payload.tags ?? [],
    recurrenceFrequency: payload.recurrenceFrequency ?? 'none',
    recurrenceInterval: payload.recurrenceInterval ?? 1,
    urgency: payload.urgency ?? null,
    importance: payload.importance ?? null,
    eventId,
  });

  // Demo: el API stub no materializa; lo hacemos en cliente.
  if (isDemoMode()) {
    return materializeDemoCreate(weekId, dayId, payload, res.id);
  }

  const instancesRaw = Array.isArray(res.instances) ? res.instances : [res as unknown as Record<string, unknown>];
  const instances = instancesRaw.map(raw => {
    const mapped = mapTask((raw.id as string) ?? res.id, raw);
    return {
      ...mapped,
      weekId: (raw.weekId as string) ?? (raw.week_id as string) ?? weekId,
      dayId: (raw.dayId as string) ?? (raw.day_id as string) ?? dayId,
    };
  });

  return {
    task: instances[0] ?? mapTask(res.id, res as unknown as Record<string, unknown>),
    instances,
  };
}

function materializeDemoCreate(
  weekId: string,
  dayId: string,
  payload: CreateTaskPayload,
  firstId: string
): CreateTaskResult {
  const recurrence = normalizeRecurrence(
    payload.recurrenceFrequency,
    payload.recurrenceInterval
  );
  const endDayId = payload.endDayId ?? dayId;
  const ranges = materializeOccurrenceRanges(
    dayId,
    endDayId,
    recurrence.frequency,
    recurrence.interval
  );
  const seriesId = recurrence.frequency === 'none' ? null : firstId;
  const now = new Date().toISOString();
  const instances = ranges.map((range, index) => {
    const id = index === 0 ? firstId : `${firstId}-${index}`;
    const task: Task & { weekId: string; dayId: string } = {
      id,
      title: payload.title,
      completed: false,
      completedAt: null,
      projectId: payload.projectId ?? null,
      priority: payload.priority ?? 'medium',
      notes: payload.notes ?? '',
      order: 0,
      tags: payload.tags ?? [],
      movedFrom: null,
      seriesId,
      recurrence,
      endDayId: range.endDayId,
      urgency: payload.urgency ?? null,
      importance: payload.importance ?? null,
      createdAt: now,
      updatedAt: now,
      weekId: range.dayId === dayId ? weekId : getWeekIdFromDayId(range.dayId),
      dayId: range.dayId,
    };
    return task;
  });
  return { task: instances[0], instances };
}

export async function updateTask(
  weekId: string,
  dayId: string,
  taskId: string,
  payload: UpdateTaskPayload
): Promise<void> {
  await api.patch<void>(
    `/api/tasks/${encodeURIComponent(weekId)}/${encodeURIComponent(dayId)}/${encodeURIComponent(taskId)}`,
    payload
  );
}

export async function deleteTask(
  weekId: string,
  dayId: string,
  taskId: string
): Promise<void> {
  await api.del<void>(
    `/api/tasks/${encodeURIComponent(weekId)}/${encodeURIComponent(dayId)}/${encodeURIComponent(taskId)}`
  );
}

export async function moveTask(
  fromWeekId: string,
  fromDayId: string,
  taskId: string,
  toWeekId: string,
  toDayId: string
): Promise<void> {
  await api.post<void>(
    `/api/tasks/${encodeURIComponent(fromWeekId)}/${encodeURIComponent(fromDayId)}/${encodeURIComponent(taskId)}/move`,
    { toWeekId, toDayId }
  );
}

export function mapTask(id: string, raw: Record<string, unknown>): Task {
  const frequency =
    (raw.recurrence_frequency as Task['recurrence']['frequency'] | undefined) ??
    (raw.recurrence as Recurrence | undefined)?.frequency ??
    'none';
  const interval =
    (typeof raw.recurrence_interval === 'number' ? raw.recurrence_interval : undefined) ??
    (raw.recurrence as Recurrence | undefined)?.interval ??
    1;

  const startDayId =
    (raw.day_id as string | undefined) ?? (raw.dayId as string | undefined) ?? '';
  const endDayId =
    (raw.end_day_id as string | undefined) ??
    (raw.endDayId as string | undefined) ??
    startDayId;

  const urgencyRaw =
    (raw.urgency as Task['urgency'] | undefined) ?? null;
  const importanceRaw =
    (raw.importance as Task['importance'] | undefined) ?? null;

  return {
    id,
    title: (raw.title as string) ?? '',
    completed: (raw.completed as boolean) ?? false,
    completedAt: (raw.completed_at as string | null) ?? (raw.completedAt as string | null) ?? null,
    projectId: (raw.project_id as string | null) ?? (raw.projectId as string | null) ?? null,
    priority: (raw.priority as Task['priority']) ?? 'medium',
    notes: (raw.notes as string) ?? '',
    order: typeof raw.order === 'number' ? raw.order : 0,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    movedFrom: (raw.moved_from as string | null) ?? (raw.movedFrom as string | null) ?? null,
    seriesId: (raw.series_id as string | null) ?? (raw.seriesId as string | null) ?? null,
    recurrence: normalizeRecurrence(frequency, interval),
    endDayId: endDayId || startDayId,
    urgency: urgencyRaw === 'urgent' || urgencyRaw === 'not_urgent' ? urgencyRaw : null,
    importance:
      importanceRaw === 'important' || importanceRaw === 'not_important' ? importanceRaw : null,
    createdAt: (raw.created_at as string) ?? (raw.createdAt as string) ?? new Date(0).toISOString(),
    updatedAt: (raw.updated_at as string) ?? (raw.updatedAt as string) ?? new Date(0).toISOString(),
  };
}
