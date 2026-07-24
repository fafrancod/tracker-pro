import { getSupabase } from '../supabase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { subscribeTable } from '../lib/realtime';
import {
  materializeOccurrenceDayIds,
  normalizeRecurrence,
  getWeekIdFromDayId,
} from '../lib/recurrence';
import type { Task, CreateTaskPayload, UpdateTaskPayload, Recurrence } from '../types';
import { getISOWeek, format } from 'date-fns';

export type TasksUnsubscribe = () => void;

export function getWeekId(date: Date): string {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getDayId(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

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

/** Carga tareas en un rango de dayId inclusive (para vista mes). */
export async function fetchTasksInRange(
  uid: string,
  fromDayId: string,
  toDayId: string
): Promise<Array<Task & { weekId: string; dayId: string }>> {
  if (isDemoMode()) return [];

  const { data, error } = await getSupabase()
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .gte('day_id', fromDayId)
    .lte('day_id', toDayId)
    .order('day_id', { ascending: true })
    .order('order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    ...mapTask(row.id as string, row),
    weekId: (row.week_id as string) ?? getWeekIdFromDayId(row.day_id as string),
    dayId: row.day_id as string,
  }));
}

export function subscribeTasks(
  uid: string,
  weekId: string,
  dayId: string,
  cb: (tasks: Task[]) => void
): TasksUnsubscribe {
  if (isDemoMode()) return () => undefined;

  void fetchTasks(uid, weekId, dayId).then(cb);

  return subscribeTable({
    topic: `tasks:${uid}:${weekId}:${dayId}`,
    table: 'tasks',
    filter: `user_id=eq.${uid}`,
    onChange: () => {
      void fetchTasks(uid, weekId, dayId).then(cb);
    },
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
  const res = await api.post<CreateTaskResponse>('/api/tasks', {
    weekId,
    dayId,
    title: payload.title,
    projectId: payload.projectId ?? null,
    priority: payload.priority ?? 'medium',
    notes: payload.notes ?? '',
    tags: payload.tags ?? [],
    recurrenceFrequency: payload.recurrenceFrequency ?? 'none',
    recurrenceInterval: payload.recurrenceInterval ?? 1,
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
  const dayIds = materializeOccurrenceDayIds(dayId, recurrence.frequency, recurrence.interval);
  const seriesId = recurrence.frequency === 'none' ? null : firstId;
  const now = new Date().toISOString();
  const instances = dayIds.map((occDayId, index) => {
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
      createdAt: now,
      updatedAt: now,
      weekId: occDayId === dayId ? weekId : getWeekIdFromDayId(occDayId),
      dayId: occDayId,
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
    createdAt: (raw.created_at as string) ?? (raw.createdAt as string) ?? new Date(0).toISOString(),
    updatedAt: (raw.updated_at as string) ?? (raw.updatedAt as string) ?? new Date(0).toISOString(),
  };
}
