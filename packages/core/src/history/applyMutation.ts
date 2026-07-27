import { findTaskLocation, useStore } from '../store';
import {
  createTask,
  deleteTask,
  moveTask,
  updateTask,
} from '../services/taskService';
import { addDaysToDayId, inclusiveDurationDays } from '../lib/recurrence';
import type { Task, UpdateTaskPayload } from '../types';
import type { HistoryMutation, LocatedTaskSnapshot } from './types';

function taskToUpdatePayload(task: Task): UpdateTaskPayload {
  return {
    title: task.title,
    completed: task.completed,
    projectId: task.projectId,
    priority: task.priority,
    notes: task.notes,
    tags: task.tags,
    order: task.order,
    movedFrom: task.movedFrom,
    endDayId: task.endDayId,
    recurrenceFrequency: task.recurrence.frequency,
    recurrenceInterval: task.recurrence.interval,
    urgency: task.urgency,
    importance: task.importance,
    kind: task.kind,
    color: task.color,
    startTime: task.startTime,
    endTime: task.endTime,
    involvedContactIds: task.involvedContactIds,
    location: task.location,
    departureTime: task.departureTime,
    // Instance-only checklist — must round-trip on undo/redo.
    steps: task.steps ?? [],
  };
}

function seriesSharedPatch(task: Task): UpdateTaskPayload {
  return {
    title: task.title,
    notes: task.notes,
    tags: task.tags,
    projectId: task.projectId,
    priority: task.priority,
    urgency: task.urgency,
    importance: task.importance,
    kind: task.kind,
    color: task.color,
    startTime: task.startTime,
    endTime: task.endTime,
    involvedContactIds: task.involvedContactIds,
    location: task.location,
    departureTime: task.departureTime,
  };
}

function patchToPartialTask(payload: UpdateTaskPayload): Partial<Task> {
  const patch: Partial<Task> = {};
  if (payload.title !== undefined) patch.title = payload.title;
  if (payload.projectId !== undefined) patch.projectId = payload.projectId;
  if (payload.priority !== undefined) patch.priority = payload.priority;
  if (payload.notes !== undefined) patch.notes = payload.notes;
  if (payload.tags !== undefined) patch.tags = payload.tags;
  if (payload.order !== undefined) patch.order = payload.order;
  if (payload.movedFrom !== undefined) patch.movedFrom = payload.movedFrom;
  if (payload.endDayId !== undefined) patch.endDayId = payload.endDayId;
  if (payload.urgency !== undefined) patch.urgency = payload.urgency;
  if (payload.importance !== undefined) patch.importance = payload.importance;
  if (payload.kind !== undefined) patch.kind = payload.kind;
  if (payload.color !== undefined) patch.color = payload.color;
  if (payload.startTime !== undefined) patch.startTime = payload.startTime;
  if (payload.endTime !== undefined) patch.endTime = payload.endTime;
  if (payload.involvedContactIds !== undefined) {
    patch.involvedContactIds = payload.involvedContactIds;
  }
  if (payload.location !== undefined) patch.location = payload.location;
  if (payload.departureTime !== undefined) patch.departureTime = payload.departureTime;
  if (payload.steps !== undefined) patch.steps = payload.steps;
  if (payload.completed !== undefined) {
    patch.completed = payload.completed;
    patch.completedAt = payload.completed ? new Date().toISOString() : null;
  }
  if (payload.recurrenceFrequency !== undefined || payload.recurrenceInterval !== undefined) {
    // leave recurrence to caller if needed
  }
  return patch;
}

function applyOptimisticUpdate(
  weekId: string,
  dayId: string,
  taskId: string,
  seriesId: string | null | undefined,
  applyTo: 'instance' | 'series',
  payload: UpdateTaskPayload
) {
  const store = useStore.getState();
  const partial = patchToPartialTask(payload);
  if (applyTo === 'series' && seriesId) {
    const seriesPartial: Partial<Task> = { ...partial };
    delete seriesPartial.completed;
    delete seriesPartial.completedAt;
    delete seriesPartial.endDayId;
    delete seriesPartial.order;
    delete seriesPartial.movedFrom;
    delete seriesPartial.steps;
    store.patchSeriesOptimistic(seriesId, seriesPartial);
    // instance-only bits on the one row (incl. checklist)
    const inst: Partial<Task> = {};
    if (payload.completed !== undefined) {
      inst.completed = payload.completed;
      inst.completedAt = payload.completed ? new Date().toISOString() : null;
    }
    if (payload.endDayId !== undefined) inst.endDayId = payload.endDayId;
    if (payload.order !== undefined) inst.order = payload.order;
    if (payload.movedFrom !== undefined) inst.movedFrom = payload.movedFrom;
    if (payload.steps !== undefined) inst.steps = payload.steps;
    if (Object.keys(inst).length > 0) {
      store.updateTaskOptimistic(weekId, dayId, taskId, inst);
    }
  } else {
    store.updateTaskOptimistic(weekId, dayId, taskId, partial);
  }
}

/**
 * Aplica una mutación del historial (forward o inverse) contra store + API.
 * No registra historial (evita bucles).
 */
export async function applyHistoryMutation(mut: HistoryMutation): Promise<void> {
  const store = useStore.getState();

  switch (mut.op) {
    case 'update': {
      applyOptimisticUpdate(
        mut.weekId,
        mut.dayId,
        mut.taskId,
        mut.seriesId,
        mut.applyTo,
        mut.patch
      );
      await updateTask(mut.weekId, mut.dayId, mut.taskId, {
        ...mut.patch,
        applyTo: mut.applyTo,
      });
      return;
    }
    case 'delete': {
      store.removeTaskOptimistic(mut.weekId, mut.dayId, mut.taskId);
      await deleteTask(mut.weekId, mut.dayId, mut.taskId);
      return;
    }
    case 'create': {
      // Re-create (undo de delete o redo de create). El payload del inverse
      // de delete ya fuerza frequency none; el forward de create conserva
      // la recurrencia original.
      const result = await createTask(mut.weekId, mut.dayId, mut.payload);
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
          involvedContactIds: instance.involvedContactIds ?? [],
          location: instance.location ?? null,
          departureTime: instance.departureTime ?? null,
          steps: instance.steps ?? [],
          rx: instance.rx,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
        });
      }
      return;
    }
    case 'move': {
      const fromLoc = findTaskLocation(mut.taskId);
      const fromWeekId = fromLoc?.weekId ?? mut.fromWeekId;
      const fromDayId = fromLoc?.dayId ?? mut.fromDayId;
      const task = fromLoc?.task ?? mut.taskBefore;

      const duration =
        inclusiveDurationDays(fromDayId, task.endDayId || fromDayId) - 1;
      const newEnd = duration > 0 ? addDaysToDayId(mut.toDayId, duration) : mut.toDayId;

      store.removeTaskOptimistic(fromWeekId, fromDayId, mut.taskId);
      store.addTaskOptimistic(mut.toWeekId, mut.toDayId, {
        ...task,
        endDayId: newEnd,
        movedFrom: `${fromWeekId}/${fromDayId}`,
        order: 0,
        updatedAt: new Date().toISOString(),
      });
      await moveTask(fromWeekId, fromDayId, mut.taskId, mut.toWeekId, mut.toDayId);
      return;
    }
    default:
      return;
  }
}

/** Construye el inverse de un update a partir del snapshot before. */
export function inverseUpdateFromBefore(
  weekId: string,
  dayId: string,
  taskId: string,
  seriesId: string | null,
  applyTo: 'instance' | 'series',
  before: Task
): HistoryMutation {
  const patch =
    applyTo === 'series' ? seriesSharedPatch(before) : taskToUpdatePayload(before);
  return {
    op: 'update',
    weekId,
    dayId,
    taskId,
    seriesId,
    applyTo,
    patch,
  };
}

export function snapshotFromTask(
  weekId: string,
  dayId: string,
  task: Task
): LocatedTaskSnapshot {
  return { weekId, dayId, task: { ...task, tags: [...task.tags] } };
}

export { taskToUpdatePayload, seriesSharedPatch, patchToPartialTask };
