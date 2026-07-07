import { getSupabase } from '../supabase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '../types';
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

export function subscribeTasks(
  uid: string,
  weekId: string,
  dayId: string,
  cb: (tasks: Task[]) => void
): TasksUnsubscribe {
  if (isDemoMode()) return () => undefined;

  const supabase = getSupabase();
  void fetchTasks(uid, weekId, dayId).then(cb);

  const channel = supabase
    .channel(`tasks:${uid}:${weekId}:${dayId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${uid}`,
      },
      async () => {
        cb(await fetchTasks(uid, weekId, dayId));
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
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
}

export async function createTask(
  weekId: string,
  dayId: string,
  payload: CreateTaskPayload,
  eventId?: string
): Promise<Task> {
  const res = await api.post<CreateTaskResponse>('/api/tasks', {
    weekId,
    dayId,
    title: payload.title,
    projectId: payload.projectId ?? null,
    priority: payload.priority ?? 'medium',
    notes: payload.notes ?? '',
    tags: payload.tags ?? [],
    eventId,
  });
  return mapTask(res.id, res as unknown as Record<string, unknown>);
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

function mapTask(id: string, raw: Record<string, unknown>): Task {
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
    createdAt: (raw.created_at as string) ?? (raw.createdAt as string) ?? new Date(0).toISOString(),
    updatedAt: (raw.updated_at as string) ?? (raw.updatedAt as string) ?? new Date(0).toISOString(),
  };
}