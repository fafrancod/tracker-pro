import { findTaskLocation, useStore } from '../store';
import {
  createTask,
  deleteTask,
  moveTask,
  updateTask,
} from '../services/taskService';
import type {
  CreateTaskPayload,
  Task,
  TaskApplyTo,
  UpdateTaskPayload,
} from '../types';
import type { OfflineMutationInput } from '../lib/offlineQueue';
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
  getWeekIdFromDayId,
  inclusiveDurationDays,
} from '../lib/recurrence';
import { shouldQueueMutation } from '../lib/network';
import { enqueueOfflineMutation } from '../lib/offlineQueue';
import { notifyOfflineQueueChanged } from '../offline/bootstrap';
import { isDemoMode } from '../lib/demoMode';
import { isVirtualHabitId, parseVirtualHabitId } from '../lib/habits';

function truncateTitle(title: string, max = 40): string {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function currentUid(): string | null {
  return useStore.getState().uid;
}

function queueIfNeeded(uid: string | null, mut: OfflineMutationInput): boolean {
  if (!uid || isDemoMode()) return false;
  if (!shouldQueueMutation()) return false;
  enqueueOfflineMutation(uid, mut);
  notifyOfflineQueueChanged();
  return true;
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
    // Allow create form to target another start day than the open column/sheet.
    const { startDayId: payloadStart, ...restPayload } = payload;
    const targetDayId =
      typeof payloadStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payloadStart)
        ? payloadStart
        : dayId;
    const targetWeekId =
      targetDayId === dayId ? weekId : getWeekIdFromDayId(targetDayId);
    const apiPayload: CreateTaskPayload = {
      ...restPayload,
      endDayId: restPayload.endDayId ?? targetDayId,
    };

    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const order = store.tasksByDay[targetWeekId]?.[targetDayId]?.length ?? 0;
    const now = new Date().toISOString();
    const recurrence = normalizeRecurrence(
      apiPayload.recurrenceFrequency,
      apiPayload.recurrenceInterval
    );
    const optimisticTask: Task = {
      id: optimisticId,
      title: apiPayload.title,
      completed: false,
      completedAt: null,
      projectId: apiPayload.projectId ?? null,
      priority: apiPayload.priority ?? 'medium',
      notes: apiPayload.notes ?? '',
      order,
      tags: apiPayload.tags ?? [],
      movedFrom: null,
      seriesId: null,
      recurrence,
      endDayId: apiPayload.endDayId ?? targetDayId,
      urgency: apiPayload.urgency ?? null,
      importance: apiPayload.importance ?? null,
      kind: apiPayload.kind ?? 'task',
      color: apiPayload.color ?? null,
      startTime: apiPayload.startTime ?? null,
      endTime: apiPayload.endTime ?? null,
      rx: null,
      involvedContactIds: apiPayload.involvedContactIds ?? [],
      location: apiPayload.location ?? null,
      departureTime: apiPayload.departureTime ?? null,
      steps: apiPayload.steps ?? [],
      finance: apiPayload.finance ?? null,
      createdAt: now,
      updatedAt: now,
    };
    store.addTaskOptimistic(targetWeekId, targetDayId, optimisticTask);

    const uid = currentUid();
    if (queueIfNeeded(uid, {
      op: 'create',
      weekId: targetWeekId,
      dayId: targetDayId,
      payload: apiPayload,
      clientId: optimisticId,
    })) {
      // Offline: keep optimistic row; server create deferred.
      const entry: HistoryEntry = {
        id: generateHistoryId(),
        at: Date.now(),
        label: label ?? `Creaste «${truncateTitle(apiPayload.title)}» (offline)`,
        kind: 'create',
        forward: {
          op: 'create',
          weekId: targetWeekId,
          dayId: targetDayId,
          payload: apiPayload,
          created: [{ weekId: targetWeekId, dayId: targetDayId, id: optimisticId }],
        },
        inverse: {
          op: 'delete',
          weekId: targetWeekId,
          dayId: targetDayId,
          taskId: optimisticId,
          snapshot: snapshotFromTask(targetWeekId, targetDayId, optimisticTask),
        },
      };
      useHistoryStore.getState().push(entry);
      multiCreateMap.set(entry.id, [
        { weekId: targetWeekId, dayId: targetDayId, id: optimisticId },
      ]);
      return;
    }

    try {
      const result = await createTask(
        targetWeekId,
        targetDayId,
        apiPayload,
        optimisticId
      );
      store.removeTaskOptimistic(targetWeekId, targetDayId, optimisticId);
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
          rx: instance.rx,
          involvedContactIds: instance.involvedContactIds ?? [],
          location: instance.location ?? null,
          departureTime: instance.departureTime ?? null,
          steps: instance.steps ?? [],
          finance: instance.finance ?? null,
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
        weekId: targetWeekId,
        dayId: targetDayId,
        payload: apiPayload,
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
        label: label ?? `Creaste «${truncateTitle(apiPayload.title)}»`,
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
      if (uid && shouldQueueMutation(err)) {
        enqueueOfflineMutation(uid, {
          op: 'create',
          weekId: targetWeekId,
          dayId: targetDayId,
          payload: apiPayload,
          clientId: optimisticId,
        });
        notifyOfflineQueueChanged();
        const entry: HistoryEntry = {
          id: generateHistoryId(),
          at: Date.now(),
          label: label ?? `Creaste «${truncateTitle(apiPayload.title)}» (offline)`,
          kind: 'create',
          forward: {
            op: 'create',
            weekId: targetWeekId,
            dayId: targetDayId,
            payload: apiPayload,
            created: [
              { weekId: targetWeekId, dayId: targetDayId, id: optimisticId },
            ],
          },
          inverse: {
            op: 'delete',
            weekId: targetWeekId,
            dayId: targetDayId,
            taskId: optimisticId,
            snapshot: snapshotFromTask(targetWeekId, targetDayId, optimisticTask),
          },
        };
        useHistoryStore.getState().push(entry);
        multiCreateMap.set(entry.id, [
          { weekId: targetWeekId, dayId: targetDayId, id: optimisticId },
        ]);
        return;
      }
      store.removeTaskOptimistic(targetWeekId, targetDayId, optimisticId);
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

    // Hábito virtual (lazy): no está en buckets del store; materializa vía API.
    if (isVirtualHabitId(taskId)) {
      const parsed = parseVirtualHabitId(taskId);
      await updateTask(
        weekId,
        parsed?.dayId ?? dayId,
        taskId,
        payload
      );
      return;
    }

    const loc = findTaskLocation(taskId);
    const locWeekId = loc?.weekId ?? weekId;
    const locDayId = loc?.dayId ?? dayId;
    const before = loc?.task;
    if (!before) {
      await updateTask(locWeekId, locDayId, taskId, payload);
      return;
    }

    const applyTo: TaskApplyTo =
      payload.applyTo === 'series' && before.seriesId ? 'series' : 'instance';
    const { applyTo: _a, ...fields } = payload;
    const patch: UpdateTaskPayload = { ...fields };

    // Optimistic
    const partial = patchToPartialTask(patch);
    // rxSubject / dosis → merge en Task.rx (no está en patchToPartialTask genérico)
    if (
      patch.rxSubject !== undefined ||
      patch.rxAmount !== undefined ||
      patch.rxUnit !== undefined
    ) {
      const baseRx = before.rx ?? {
        subject: null,
        amount: 1,
        unit: 'pills' as const,
        phaseIndex: 0,
        planStartDayId: locDayId,
        phases: [],
      };
      partial.rx = {
        ...baseRx,
        subject: patch.rxSubject !== undefined ? patch.rxSubject : baseRx.subject,
        amount: patch.rxAmount !== undefined ? patch.rxAmount : baseRx.amount,
        unit: patch.rxUnit !== undefined ? patch.rxUnit : baseRx.unit,
      };
    }
    if (applyTo === 'series' && before.seriesId) {
      const seriesPartial = { ...partial };
      delete seriesPartial.completed;
      delete seriesPartial.completedAt;
      delete seriesPartial.endDayId;
      delete seriesPartial.order;
      delete seriesPartial.movedFrom;
      // steps never propagate to the whole series (API instance-only)
      delete seriesPartial.steps;
      store.patchSeriesOptimistic(before.seriesId, seriesPartial);
      const inst: Partial<Task> = {};
      if (patch.completed !== undefined) {
        inst.completed = patch.completed;
        inst.completedAt = patch.completed ? new Date().toISOString() : null;
      }
      if (patch.endDayId !== undefined) inst.endDayId = patch.endDayId;
      if (patch.steps !== undefined) inst.steps = patch.steps;
      if (Object.keys(inst).length) {
        store.updateTaskOptimistic(locWeekId, locDayId, taskId, inst);
      }
    } else {
      store.updateTaskOptimistic(locWeekId, locDayId, taskId, partial);
    }

    const uid = currentUid();
    const serverPatch = { ...patch, applyTo };

    const pushHistory = (offline: boolean) => {
      const kind = applyTo === 'series' ? 'update_series' : 'update';
      const defaultLabel =
        applyTo === 'series'
          ? `Editaste la serie «${truncateTitle(before.title)}»`
          : `Editaste «${truncateTitle(before.title)}»`;
      useHistoryStore.getState().push({
        id: generateHistoryId(),
        at: Date.now(),
        label: offline ? `${label ?? defaultLabel} (offline)` : label ?? defaultLabel,
        kind,
        forward: {
          op: 'update',
          weekId: locWeekId,
          dayId: locDayId,
          taskId,
          seriesId: before.seriesId,
          applyTo,
          patch: serverPatch,
        },
        inverse: inverseUpdateFromBefore(
          locWeekId,
          locDayId,
          taskId,
          before.seriesId,
          applyTo,
          before
        ),
      });
    };

    if (
      queueIfNeeded(uid, {
        op: 'update',
        weekId: locWeekId,
        dayId: locDayId,
        taskId,
        payload: serverPatch,
      })
    ) {
      pushHistory(true);
      return;
    }

    try {
      await updateTask(locWeekId, locDayId, taskId, serverPatch);
      pushHistory(false);
    } catch (err) {
      if (uid && shouldQueueMutation(err)) {
        enqueueOfflineMutation(uid, {
          op: 'update',
          weekId: locWeekId,
          dayId: locDayId,
          taskId,
          payload: serverPatch,
        });
        notifyOfflineQueueChanged();
        pushHistory(true);
        return;
      }
      // Revert optimistic on hard failure
      store.updateTaskOptimistic(locWeekId, locDayId, taskId, before);
      throw err;
    }
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

    const pushDelHistory = (offline: boolean) => {
      useHistoryStore.getState().push({
        id: generateHistoryId(),
        at: Date.now(),
        label:
          (label ?? `Eliminaste «${truncateTitle(task.title)}»`) +
          (offline ? ' (offline)' : ''),
        kind: 'delete',
        forward,
        inverse,
      });
    };

    const uid = currentUid();
    if (
      queueIfNeeded(uid, {
        op: 'delete',
        weekId: locWeekId,
        dayId: locDayId,
        taskId,
      })
    ) {
      pushDelHistory(true);
      return;
    }

    try {
      await deleteTask(locWeekId, locDayId, taskId);
      pushDelHistory(false);
    } catch (err) {
      if (uid && shouldQueueMutation(err)) {
        enqueueOfflineMutation(uid, {
          op: 'delete',
          weekId: locWeekId,
          dayId: locDayId,
          taskId,
        });
        notifyOfflineQueueChanged();
        pushDelHistory(true);
        return;
      }
      store.addTaskOptimistic(locWeekId, locDayId, task);
      throw err;
    }
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
    // Always resolve the real start bucket (drag may start from a mid-span day).
    const loc = findTaskLocation(task.id);
    const srcWeekId = loc?.weekId ?? fromWeekId;
    const srcDayId = loc?.dayId ?? fromDayId;
    const live = loc?.task ?? task;
    // inclusiveDurationDays already returns offset (end − start in days).
    const duration = inclusiveDurationDays(srcDayId, live.endDayId || srcDayId);
    const newEnd = addDaysToDayId(toDayId, duration);
    const now = new Date().toISOString();
    const before = { ...live, tags: [...(live.tags ?? [])] };

    store.removeTaskOptimistic(srcWeekId, srcDayId, live.id);
    // Guard: also clear any duplicate if it was under a wrong bucket.
    if (srcWeekId !== fromWeekId || srcDayId !== fromDayId) {
      store.removeTaskOptimistic(fromWeekId, fromDayId, live.id);
    }
    store.addTaskOptimistic(toWeekId, toDayId, {
      ...live,
      endDayId: newEnd,
      movedFrom: `${srcWeekId}/${srcDayId}`,
      order: 0,
      updatedAt: now,
    });

    const forward: HistoryMutation = {
      op: 'move',
      fromWeekId: srcWeekId,
      fromDayId: srcDayId,
      toWeekId,
      toDayId,
      taskId: live.id,
      taskBefore: before,
    };
    const inverse: HistoryMutation = {
      op: 'move',
      fromWeekId: toWeekId,
      fromDayId: toDayId,
      toWeekId: srcWeekId,
      toDayId: srcDayId,
      taskId: live.id,
      taskBefore: {
        ...before,
        endDayId: newEnd,
        movedFrom: `${srcWeekId}/${srcDayId}`,
      },
    };

    const pushMove = (offline: boolean) => {
      useHistoryStore.getState().push({
        id: generateHistoryId(),
        at: Date.now(),
        label:
          (label ?? `Moviste «${truncateTitle(live.title)}»`) +
          (offline ? ' (offline)' : ''),
        kind: 'move',
        forward,
        inverse,
      });
    };

    const uid = currentUid();
    if (
      queueIfNeeded(uid, {
        op: 'move',
        fromWeekId: srcWeekId,
        fromDayId: srcDayId,
        toWeekId,
        toDayId,
        taskId: live.id,
      })
    ) {
      pushMove(true);
      return;
    }

    try {
      await moveTask(srcWeekId, srcDayId, live.id, toWeekId, toDayId);
      pushMove(false);
    } catch (err) {
      if (uid && shouldQueueMutation(err)) {
        enqueueOfflineMutation(uid, {
          op: 'move',
          fromWeekId: srcWeekId,
          fromDayId: srcDayId,
          toWeekId,
          toDayId,
          taskId: live.id,
        });
        notifyOfflineQueueChanged();
        pushMove(true);
        return;
      }
      store.removeTaskOptimistic(toWeekId, toDayId, live.id);
      store.addTaskOptimistic(srcWeekId, srcDayId, before);
      throw err;
    }
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
