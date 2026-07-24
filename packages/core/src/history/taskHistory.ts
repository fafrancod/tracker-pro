import { findTaskLocation, useStore } from '../store';
import {
  createTask,
  deleteTask,
  moveTask,
  updateTask,
} from '../services/taskService';
import type { CreateTaskPayload, Task, UpdateTaskPayload } from '../types';
import { useHistoryStore, generateHistoryId } from './historyStore';
import {
  applyHistoryMutation,
  inverseUpdateFromBefore,
  patchToPartialTask,
  snapshotFromTask,
} from './applyMutation';
import type { HistoryEntry, HistoryMutation } from './types';
import {
  normalizeRecurrence,
  addDaysToDayId,
  inclusiveDurationDays,
} from '../lib/recurrence';

function truncateTitle(title: string, max = 40): string {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Capa de mutaciones con historial de sesión.
 * Usar desde hooks UI / board en lugar de llamar al service crudo.
 */
export const taskHistory = {
  async create(
    weekId: string,
    dayId: string,
    payload: CreateTaskPayload,
    label?: string
  ): Promise<void> {
    const store = useStore.getState();
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const order = store.tasksByDay[weekId]?.[dayId]?.length ?? 0;
    const now = new Date().toISOString();
    const recurrence = normalizeRecurrence(
      payload.recurrenceFrequency,
      payload.recurrenceInterval
    );
    const optimisticTask: Task = {
      id: optimisticId,
      title: payload.title,
      completed: false,
      completedAt: null,
      projectId: payload.projectId ?? null,
      priority: payload.priority ?? 'medium',
      notes: payload.notes ?? '',
      order,
      tags: payload.tags ?? [],
      movedFrom: null,
      seriesId: null,
      recurrence,
      endDayId: payload.endDayId ?? dayId,
      urgency: payload.urgency ?? null,
      importance: payload.importance ?? null,
      kind: payload.kind ?? 'task',
      color: payload.color ?? null,
      startTime: payload.startTime ?? null,
      endTime: payload.endTime ?? null,
      createdAt: now,
      updatedAt: now,
    };
    store.addTaskOptimistic(weekId, dayId, optimisticTask);

    try {
      const result = await createTask(weekId, dayId, payload, optimisticId);
      store.removeTaskOptimistic(weekId, dayId, optimisticId);
      const created: Array<{ weekId: string; dayId: string; id: string }> = [];
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
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
        });
        created.push({
          weekId: instance.weekId,
          dayId: instance.dayId,
          id: instance.id,
        });
      }

      const forward: HistoryMutation = {
        op: 'create',
        weekId,
        dayId,
        payload,
        created,
      };
      // Undo create = delete all created instances
      const inverse: HistoryMutation =
        created.length === 1
          ? {
              op: 'delete',
              weekId: created[0].weekId,
              dayId: created[0].dayId,
              taskId: created[0].id,
              snapshot: snapshotFromTask(created[0].weekId, created[0].dayId, {
                ...optimisticTask,
                id: created[0].id,
                seriesId: result.instances[0]?.seriesId ?? null,
                recurrence: result.instances[0]?.recurrence ?? recurrence,
              }),
            }
          : {
              // Multi: delete first; remaining cleaned best-effort on undo apply
              op: 'delete',
              weekId: created[0].weekId,
              dayId: created[0].dayId,
              taskId: created[0].id,
              snapshot: snapshotFromTask(
                created[0].weekId,
                created[0].dayId,
                {
                  ...optimisticTask,
                  id: created[0].id,
                  seriesId: result.instances[0]?.seriesId ?? null,
                  recurrence: result.instances[0]?.recurrence ?? recurrence,
                }
              ),
            };

      // For multi-instance create, store custom undo that deletes all
      const entry: HistoryEntry = {
        id: generateHistoryId(),
        at: Date.now(),
        label: label ?? `Creaste «${truncateTitle(payload.title)}»`,
        kind: 'create',
        forward,
        inverse,
      };
      // Attach multi-delete as sequential via custom field on inverse — handle in undoCreate
      (entry as HistoryEntry & { createdIds?: typeof created }).createdIds = created;
      useHistoryStore.getState().push(entry);
      // Monkey-patch: store multi delete list on entry for undo
      multiCreateMap.set(entry.id, created);
    } catch (err) {
      store.removeTaskOptimistic(weekId, dayId, optimisticId);
      throw err;
    }
  },

  async update(
    weekId: string,
    dayId: string,
    taskId: string,
    payload: UpdateTaskPayload,
    label?: string
  ): Promise<void> {
    const store = useStore.getState();
    const loc = findTaskLocation(taskId);
    const locWeekId = loc?.weekId ?? weekId;
    const locDayId = loc?.dayId ?? dayId;
    const before = loc?.task;
    if (!before) {
      await updateTask(locWeekId, locDayId, taskId, payload);
      return;
    }

    const applyTo =
      payload.applyTo === 'series' && before.seriesId ? 'series' : 'instance';
    const { applyTo: _a, ...fields } = payload;
    const patch: UpdateTaskPayload = { ...fields };

    // Optimistic
    const partial = patchToPartialTask(patch);
    if (applyTo === 'series' && before.seriesId) {
      const seriesPartial = { ...partial };
      delete seriesPartial.completed;
      delete seriesPartial.completedAt;
      delete seriesPartial.endDayId;
      delete seriesPartial.order;
      delete seriesPartial.movedFrom;
      store.patchSeriesOptimistic(before.seriesId, seriesPartial);
      const inst: Partial<Task> = {};
      if (patch.completed !== undefined) {
        inst.completed = patch.completed;
        inst.completedAt = patch.completed ? new Date().toISOString() : null;
      }
      if (patch.endDayId !== undefined) inst.endDayId = patch.endDayId;
      if (Object.keys(inst).length) {
        store.updateTaskOptimistic(locWeekId, locDayId, taskId, inst);
      }
    } else {
      store.updateTaskOptimistic(locWeekId, locDayId, taskId, partial);
    }

    await updateTask(locWeekId, locDayId, taskId, { ...patch, applyTo });

    const kind = applyTo === 'series' ? 'update_series' : 'update';
    const defaultLabel =
      applyTo === 'series'
        ? `Editaste la serie «${truncateTitle(before.title)}»`
        : `Editaste «${truncateTitle(before.title)}»`;

    const forward: HistoryMutation = {
      op: 'update',
      weekId: locWeekId,
      dayId: locDayId,
      taskId,
      seriesId: before.seriesId,
      applyTo,
      patch: { ...patch, applyTo },
    };
    const inverse = inverseUpdateFromBefore(
      locWeekId,
      locDayId,
      taskId,
      before.seriesId,
      applyTo,
      before
    );

    useHistoryStore.getState().push({
      id: generateHistoryId(),
      at: Date.now(),
      label: label ?? defaultLabel,
      kind,
      forward,
      inverse,
    });
  },

  async remove(
    weekId: string,
    dayId: string,
    taskId: string,
    label?: string
  ): Promise<void> {
    const store = useStore.getState();
    const loc = findTaskLocation(taskId);
    const locWeekId = loc?.weekId ?? weekId;
    const locDayId = loc?.dayId ?? dayId;
    const task = loc?.task;
    if (!task) {
      await deleteTask(locWeekId, locDayId, taskId);
      return;
    }

    const snap = snapshotFromTask(locWeekId, locDayId, task);
    store.removeTaskOptimistic(locWeekId, locDayId, taskId);
    await deleteTask(locWeekId, locDayId, taskId);

    const forward: HistoryMutation = {
      op: 'delete',
      weekId: locWeekId,
      dayId: locDayId,
      taskId,
      snapshot: snap,
    };
    // Undo delete: re-create as single (frequency none) with same metadata
    const inverse: HistoryMutation = {
      op: 'create',
      weekId: locWeekId,
      dayId: locDayId,
      payload: {
        title: task.title,
        projectId: task.projectId,
        priority: task.priority,
        notes: task.notes,
        tags: task.tags,
        endDayId: task.endDayId,
        recurrenceFrequency: 'none',
        urgency: task.urgency,
        importance: task.importance,
        kind: task.kind,
        color: task.color,
        startTime: task.startTime,
        endTime: task.endTime,
      },
    };

    useHistoryStore.getState().push({
      id: generateHistoryId(),
      at: Date.now(),
      label: label ?? `Eliminaste «${truncateTitle(task.title)}»`,
      kind: 'delete',
      forward,
      inverse,
    });
  },

  async move(
    fromWeekId: string,
    fromDayId: string,
    task: Task,
    toWeekId: string,
    toDayId: string,
    label?: string
  ): Promise<void> {
    const store = useStore.getState();
    const duration = inclusiveDurationDays(fromDayId, task.endDayId || fromDayId) - 1;
    const newEnd = duration > 0 ? addDaysToDayId(toDayId, duration) : toDayId;
    const now = new Date().toISOString();
    const before = { ...task, tags: [...task.tags] };

    store.removeTaskOptimistic(fromWeekId, fromDayId, task.id);
    store.addTaskOptimistic(toWeekId, toDayId, {
      ...task,
      endDayId: newEnd,
      movedFrom: `${fromWeekId}/${fromDayId}`,
      order: 0,
      updatedAt: now,
    });

    try {
      await moveTask(fromWeekId, fromDayId, task.id, toWeekId, toDayId);
    } catch (err) {
      store.removeTaskOptimistic(toWeekId, toDayId, task.id);
      store.addTaskOptimistic(fromWeekId, fromDayId, before);
      throw err;
    }

    const forward: HistoryMutation = {
      op: 'move',
      fromWeekId,
      fromDayId,
      toWeekId,
      toDayId,
      taskId: task.id,
      taskBefore: before,
    };
    const inverse: HistoryMutation = {
      op: 'move',
      fromWeekId: toWeekId,
      fromDayId: toDayId,
      toWeekId: fromWeekId,
      toDayId: fromDayId,
      taskId: task.id,
      taskBefore: {
        ...before,
        endDayId: newEnd,
        movedFrom: `${fromWeekId}/${fromDayId}`,
      },
    };

    useHistoryStore.getState().push({
      id: generateHistoryId(),
      at: Date.now(),
      label: label ?? `Moviste «${truncateTitle(task.title)}»`,
      kind: 'move',
      forward,
      inverse,
    });
  },

  async undo(): Promise<boolean> {
    const entry = useHistoryStore.getState().popUndo();
    if (!entry) return false;

    // Multi-create: delete all instances
    const multi = multiCreateMap.get(entry.id);
    if (entry.kind === 'create' && multi && multi.length > 1) {
      const store = useStore.getState();
      for (const c of multi) {
        store.removeTaskOptimistic(c.weekId, c.dayId, c.id);
        try {
          await deleteTask(c.weekId, c.dayId, c.id);
        } catch {
          // best effort
        }
      }
      return true;
    }

    await applyHistoryMutation(entry.inverse);
    return true;
  },

  async redo(): Promise<boolean> {
    const entry = useHistoryStore.getState().popRedo();
    if (!entry) return false;

    if (entry.kind === 'create' && entry.forward.op === 'create') {
      // Re-apply create from payload
      await applyHistoryMutation(entry.forward);
      return true;
    }

    await applyHistoryMutation(entry.forward);
    return true;
  },

  /**
   * Salta a un nodo del past (ese entry queda como último aplicado)
   * o del future (rehace hasta incluirlo).
   */
  async jumpTo(entryId: string): Promise<void> {
    const { past, future } = useHistoryStore.getState();
    const pastIdx = past.findIndex(e => e.id === entryId);
    if (pastIdx >= 0) {
      // Undo until pastIdx is the last remaining (keep entries 0..pastIdx)
      // User click means "go back TO this state after this action" — i.e. this entry remains applied.
      // If they click an older entry, undo everything after it.
      const undos = past.length - 1 - pastIdx;
      for (let i = 0; i < undos; i++) {
        await taskHistory.undo();
      }
      return;
    }
    const futureIdx = future.findIndex(e => e.id === entryId);
    if (futureIdx >= 0) {
      for (let i = 0; i <= futureIdx; i++) {
        await taskHistory.redo();
      }
    }
  },
};

/** Map entryId → created instances for multi-create undo. */
const multiCreateMap = new Map<
  string,
  Array<{ weekId: string; dayId: string; id: string }>
>();
