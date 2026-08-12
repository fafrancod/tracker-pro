import type { CreateTaskPayload, UpdateTaskPayload } from '../types';
import {
  createTask,
  deleteTask,
  moveTask,
  updateTask,
} from '../services/taskService';
import { findTaskLocation, useStore } from '../store';

const KEY = 'daily-tracker:offline-queue:v1';

export type OfflineMutation =
  | {
      id: string;
      op: 'create';
      weekId: string;
      dayId: string;
      payload: CreateTaskPayload;
      /** Optimistic client id while offline. */
      clientId: string;
    }
  | {
      id: string;
      op: 'update';
      weekId: string;
      dayId: string;
      taskId: string;
      payload: UpdateTaskPayload;
    }
  | {
      id: string;
      op: 'delete';
      weekId: string;
      dayId: string;
      taskId: string;
    }
  | {
      id: string;
      op: 'move';
      fromWeekId: string;
      fromDayId: string;
      toWeekId: string;
      toDayId: string;
      taskId: string;
    };

interface QueueFile {
  uid: string;
  items: OfflineMutation[];
}

type StorageLike = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};

function storage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function readFile(): QueueFile | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QueueFile;
  } catch {
    return null;
  }
}

function writeFile(file: QueueFile): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify(file));
  } catch {
    /* quota */
  }
}

function queueId(): string {
  return `oq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getOfflineQueue(uid: string): OfflineMutation[] {
  const file = readFile();
  if (!file || file.uid !== uid) return [];
  return file.items ?? [];
}

export function offlineQueueCount(uid: string): number {
  return getOfflineQueue(uid).length;
}

/** Input without requiring `id` (generated if omitted). */
export type OfflineMutationInput =
  | (Omit<Extract<OfflineMutation, { op: 'create' }>, 'id'> & { id?: string })
  | (Omit<Extract<OfflineMutation, { op: 'update' }>, 'id'> & { id?: string })
  | (Omit<Extract<OfflineMutation, { op: 'delete' }>, 'id'> & { id?: string })
  | (Omit<Extract<OfflineMutation, { op: 'move' }>, 'id'> & { id?: string });

export function enqueueOfflineMutation(
  uid: string,
  mut: OfflineMutationInput
): OfflineMutation {
  const item = { ...mut, id: mut.id ?? queueId() } as OfflineMutation;
  const file = readFile();
  if (!file || file.uid !== uid) {
    writeFile({ uid, items: [item] });
    return item;
  }

  // Coalesce: update on same taskId merges payloads; metadata after pending create folds into create.
  if (item.op === 'update') {
    const createIdx = file.items.findIndex(
      m => m.op === 'create' && m.clientId === item.taskId
    );
    if (createIdx >= 0) {
      const create = file.items[createIdx] as Extract<OfflineMutation, { op: 'create' }>;
      const meta = stripToCreateFields(item.payload);
      create.payload = { ...create.payload, ...meta };
      // completed / endDayId still need a post-create update
      if (
        item.payload.completed !== undefined ||
        item.payload.endDayId !== undefined
      ) {
        file.items.push(item);
      }
      writeFile(file);
      return item;
    }
    const updateIdx = file.items.findIndex(
      m => m.op === 'update' && m.taskId === item.taskId
    );
    if (updateIdx >= 0) {
      const prev = file.items[updateIdx] as Extract<OfflineMutation, { op: 'update' }>;
      prev.payload = { ...prev.payload, ...item.payload };
      writeFile(file);
      return prev;
    }
  }

  if (item.op === 'delete') {
    // Drop pending creates/updates for this id
    file.items = file.items.filter(m => {
      if (m.op === 'create' && m.clientId === item.taskId) return false;
      if (m.op === 'update' && m.taskId === item.taskId) return false;
      return true;
    });
    // If it was only a local create, no need to delete on server
    const stillNeedsDelete = !item.taskId.startsWith('optimistic-');
    if (stillNeedsDelete) {
      file.items.push(item);
    }
    writeFile(file);
    return item;
  }

  file.items.push(item);
  writeFile(file);
  return item;
}

function stripToCreateFields(p: UpdateTaskPayload): Partial<CreateTaskPayload> {
  const out: Partial<CreateTaskPayload> = {};
  if (p.title !== undefined) out.title = p.title;
  if (p.projectId !== undefined) out.projectId = p.projectId;
  if (p.priority !== undefined) out.priority = p.priority;
  if (p.notes !== undefined) out.notes = p.notes;
  if (p.tags !== undefined) out.tags = p.tags;
  if (p.urgency !== undefined) out.urgency = p.urgency;
  if (p.importance !== undefined) out.importance = p.importance;
  if (p.kind !== undefined) out.kind = p.kind;
  if (p.color !== undefined) out.color = p.color;
  if (p.startTime !== undefined) out.startTime = p.startTime;
  if (p.endTime !== undefined) out.endTime = p.endTime;
  if (p.recurrenceFrequency !== undefined) out.recurrenceFrequency = p.recurrenceFrequency;
  if (p.recurrenceInterval !== undefined) out.recurrenceInterval = p.recurrenceInterval;
  return out;
}

export function clearOfflineQueue(uid?: string): void {
  const ls = storage();
  if (!ls) return;
  try {
    if (!uid) {
      ls.removeItem(KEY);
      return;
    }
    const file = readFile();
    if (file?.uid === uid) ls.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface FlushResult {
  processed: number;
  failed: number;
  remaining: number;
}

/**
 * Replay queued mutations in order. Last-write-wins on the server.
 * Maps optimistic client ids → server ids for subsequent ops.
 */
export async function flushOfflineQueue(uid: string): Promise<FlushResult> {
  const file = readFile();
  if (!file || file.uid !== uid || file.items.length === 0) {
    return { processed: 0, failed: 0, remaining: 0 };
  }

  const idMap = new Map<string, string>(); // clientId -> serverId
  const remaining: OfflineMutation[] = [];
  let processed = 0;
  let failed = 0;

  for (const mut of file.items) {
    try {
      await applyOne(mut, idMap);
      processed++;
    } catch {
      remaining.push(remapMut(mut, idMap));
      failed++;
      // Keep order: stop further replay? Continue so independent ops can succeed.
    }
  }

  if (remaining.length === 0) {
    clearOfflineQueue(uid);
  } else {
    writeFile({ uid, items: remaining });
  }

  return { processed, failed, remaining: remaining.length };
}

function resolveId(id: string, idMap: Map<string, string>): string {
  return idMap.get(id) ?? id;
}

function remapMut(mut: OfflineMutation, idMap: Map<string, string>): OfflineMutation {
  if (mut.op === 'update') {
    return { ...mut, taskId: resolveId(mut.taskId, idMap) };
  }
  if (mut.op === 'delete' || mut.op === 'move') {
    return { ...mut, taskId: resolveId(mut.taskId, idMap) };
  }
  return mut;
}

async function applyOne(mut: OfflineMutation, idMap: Map<string, string>): Promise<void> {
  const store = useStore.getState();

  switch (mut.op) {
    case 'create': {
      const result = await createTask(mut.weekId, mut.dayId, mut.payload, mut.clientId);
      store.removeTaskOptimistic(mut.weekId, mut.dayId, mut.clientId);
      const first = result.instances[0];
      if (first) idMap.set(mut.clientId, first.id);
      for (const instance of result.instances) {
        store.addTaskOptimistic(instance.weekId, instance.dayId, {
          id: instance.id,
          title: instance.title,
          completed: instance.completed,
          completedAt: instance.completedAt,
          projectId: instance.projectId,
          priority: instance.priority,
          notes: instance.notes,
          order: instance.order,
          tags: instance.tags,
          movedFrom: instance.movedFrom,
          seriesId: instance.seriesId,
          recurrence: instance.recurrence,
          endDayId: instance.endDayId,
          urgency: instance.urgency,
          importance: instance.importance,
          kind: instance.kind,
          color: instance.color,
          startTime: instance.startTime,
          endTime: instance.endTime,
          rx: instance.rx,
          involvedContactIds: instance.involvedContactIds ?? [],
          location: instance.location ?? null,
          departureTime: instance.departureTime ?? null,
          steps: instance.steps ?? [],
          images: instance.images ?? [],
          finance: instance.finance ?? null,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
        });
      }
      return;
    }
    case 'update': {
      const taskId = resolveId(mut.taskId, idMap);
      const loc = findTaskLocation(taskId);
      const weekId = loc?.weekId ?? mut.weekId;
      const dayId = loc?.dayId ?? mut.dayId;
      await updateTask(weekId, dayId, taskId, mut.payload);
      return;
    }
    case 'delete': {
      const taskId = resolveId(mut.taskId, idMap);
      if (taskId.startsWith('optimistic-')) return;
      const loc = findTaskLocation(taskId);
      await deleteTask(loc?.weekId ?? mut.weekId, loc?.dayId ?? mut.dayId, taskId);
      return;
    }
    case 'move': {
      const taskId = resolveId(mut.taskId, idMap);
      if (taskId.startsWith('optimistic-')) return;
      await moveTask(
        mut.fromWeekId,
        mut.fromDayId,
        taskId,
        mut.toWeekId,
        mut.toDayId
      );
      return;
    }
  }
}

