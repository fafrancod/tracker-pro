import {
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '../types';
import { getISOWeek, format } from 'date-fns';

export function getWeekId(date: Date): string {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getDayId(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function tasksCol(uid: string, weekId: string, dayId: string) {
  return collection(getDb(), 'users', uid, 'weeks', weekId, 'days', dayId, 'tasks');
}

// Lecturas: el cliente las hace contra Firestore (las rules permiten owner reads).
export async function fetchTasks(uid: string, weekId: string, dayId: string): Promise<Task[]> {
  const q = query(tasksCol(uid, weekId, dayId), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => normalizeTask(d.id, d.data()));
}

export function subscribeTasks(
  uid: string,
  weekId: string,
  dayId: string,
  cb: (tasks: Task[]) => void
): Unsubscribe {
  if (isDemoMode()) {
    // En demo no hay Firestore; los datos viven en el store y se mantienen
    // por las actualizaciones optimistas de los hooks.
    return () => undefined;
  }
  const q = query(tasksCol(uid, weekId, dayId), orderBy('order', 'asc'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => normalizeTask(d.id, d.data())));
  });
}

// Escrituras: backend-only (Firestore rules bloquean writes directos).
//
// El parametro `eventId` permite que reintentos del cliente (mismo eventId) no
// dupliquen el contador en `users/{uid}/usage/{period}`. El backend lo audita
// en `users/{uid}/usageEvents/{eventId}` antes de incrementar.

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
  return normalizeTask(res.id, res as unknown as Record<string, unknown>);
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

// --- Helpers internos -------------------------------------------------------

function normalizeTask(id: string, raw: Record<string, unknown>): Task {
  return {
    id,
    title: (raw.title as string) ?? '',
    completed: (raw.completed as boolean) ?? false,
    completedAt: toIsoString(raw.completedAt),
    projectId: (raw.projectId as string | null) ?? null,
    priority: (raw.priority as Task['priority']) ?? 'medium',
    notes: (raw.notes as string) ?? '',
    order: typeof raw.order === 'number' ? raw.order : 0,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    movedFrom: (raw.movedFrom as string | null) ?? null,
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(raw.updatedAt) ?? new Date(0).toISOString(),
  };
}

// Convierte Firestore Timestamp, Date o string a ISO string (o null).
function toIsoString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      const ts = (value as { toDate: () => Date }).toDate();
      return ts.toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

