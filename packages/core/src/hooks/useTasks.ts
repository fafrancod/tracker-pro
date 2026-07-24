import { useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../store';
import {
  subscribeTasks,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  getWeekId,
  getDayId,
  type LocatedTaskRow,
} from '../services/taskService';
import { normalizeRecurrence } from '../lib/recurrence';
import { collectTasksCovering } from '../lib/taskPresence';
import type { CreateTaskPayload, UpdateTaskPayload, Task } from '../types';

export function useTasks(weekId: string, dayId: string) {
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const startDayTasks = useStore(s => s.tasksByDay[weekId]?.[dayId] ?? []);
  const {
    setDayTasks,
    addTaskOptimistic,
    updateTaskOptimistic,
    removeTaskOptimistic,
    reorderTasks,
    updateTaskById,
  } = useStore();

  // Presence-aware list: multi-day spans appear on every covered day.
  const tasks = useMemo(
    () => collectTasksCovering(tasksByDay, dayId).map(({ weekId: _w, startDayId: _s, ...task }) => task),
    [tasksByDay, dayId]
  );

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeTasks(uid, weekId, dayId, (rows: LocatedTaskRow[]) => {
      // Merge covering tasks into their **start** day buckets.
      const byStart = new Map<string, LocatedTaskRow[]>();
      for (const row of rows) {
        const key = `${row.weekId}|${row.dayId}`;
        if (!byStart.has(key)) byStart.set(key, []);
        byStart.get(key)!.push(row);
      }
      for (const group of byStart.values()) {
        const w = group[0].weekId;
        const d = group[0].dayId;
        const existing = useStore.getState().tasksByDay[w]?.[d] ?? [];
        const byId = new Map(existing.map(t => [t.id, t]));
        for (const row of group) {
          const { weekId: _w, dayId: _d, ...task } = row;
          byId.set(task.id, task);
        }
        setDayTasks(
          w,
          d,
          Array.from(byId.values()).sort((a, b) => a.order - b.order)
        );
      }
      // Ensure the subscribed start day is marked loaded even if empty.
      if (!byStart.has(`${weekId}|${dayId}`)) {
        // Keep existing start-day tasks; only clear if nothing was there and no covering starts here.
        const existing = useStore.getState().tasksByDay[weekId]?.[dayId];
        if (existing === undefined) setDayTasks(weekId, dayId, []);
      }
    });
    return unsub;
  }, [uid, weekId, dayId, setDayTasks]);

  const addTask = useCallback(
    async (payload: CreateTaskPayload) => {
      if (!uid) return;
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const order = startDayTasks.length;
      const now = new Date().toISOString();
      const recurrence = normalizeRecurrence(
        payload.recurrenceFrequency,
        payload.recurrenceInterval
      );
      const endDayId = payload.endDayId ?? dayId;
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
        seriesId: recurrence.frequency === 'none' ? null : optimisticId,
        recurrence,
        endDayId,
        createdAt: now,
        updatedAt: now,
      };
      addTaskOptimistic(weekId, dayId, optimisticTask);
      try {
        const result = await createTask(weekId, dayId, payload, optimisticId);
        // Reemplaza el optimista del día actual y materializa el resto de la serie.
        removeTaskOptimistic(weekId, dayId, optimisticId);
        for (const instance of result.instances) {
          addTaskOptimistic(instance.weekId, instance.dayId, {
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
            createdAt: instance.createdAt,
            updatedAt: instance.updatedAt,
          });
        }
      } catch (err) {
        removeTaskOptimistic(weekId, dayId, optimisticId);
        throw err;
      }
    },
    [uid, weekId, dayId, startDayTasks.length, addTaskOptimistic, removeTaskOptimistic]
  );

  const editTask = useCallback(
    async (taskId: string, payload: UpdateTaskPayload) => {
      if (!uid) return;
      // Locate task on its start bucket (may differ from current dayId for mid-span).
      const located = collectTasksCovering(useStore.getState().tasksByDay, dayId).find(
        t => t.id === taskId
      );
      const locWeekId = located?.weekId ?? weekId;
      const locDayId = located?.startDayId ?? dayId;

      const patch: Partial<Task> = {};
      if (payload.title !== undefined) patch.title = payload.title;
      if (payload.projectId !== undefined) patch.projectId = payload.projectId;
      if (payload.priority !== undefined) patch.priority = payload.priority;
      if (payload.notes !== undefined) patch.notes = payload.notes;
      if (payload.tags !== undefined) patch.tags = payload.tags;
      if (payload.order !== undefined) patch.order = payload.order;
      if (payload.movedFrom !== undefined) patch.movedFrom = payload.movedFrom;
      if (payload.endDayId !== undefined) patch.endDayId = payload.endDayId;
      if (payload.completed !== undefined) {
        patch.completed = payload.completed;
        patch.completedAt = payload.completed ? new Date().toISOString() : null;
      }
      if (payload.recurrenceFrequency !== undefined || payload.recurrenceInterval !== undefined) {
        const current = located ?? startDayTasks.find(t => t.id === taskId);
        patch.recurrence = normalizeRecurrence(
          payload.recurrenceFrequency ?? current?.recurrence.frequency,
          payload.recurrenceInterval ?? current?.recurrence.interval
        );
      }
      updateTaskOptimistic(locWeekId, locDayId, taskId, patch);
      await updateTask(locWeekId, locDayId, taskId, payload);
    },
    [uid, weekId, dayId, startDayTasks, updateTaskOptimistic]
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!uid) return;
      const located = collectTasksCovering(useStore.getState().tasksByDay, dayId).find(
        t => t.id === taskId
      );
      const locWeekId = located?.weekId ?? weekId;
      const locDayId = located?.startDayId ?? dayId;
      removeTaskOptimistic(locWeekId, locDayId, taskId);
      await deleteTask(locWeekId, locDayId, taskId);
    },
    [uid, weekId, dayId, removeTaskOptimistic]
  );

  const moveTaskToDay = useCallback(
    async (task: Task, toDate: Date) => {
      if (!uid) return;
      const located = collectTasksCovering(useStore.getState().tasksByDay, dayId).find(
        t => t.id === task.id
      );
      const fromWeekId = located?.weekId ?? weekId;
      const fromDayId = located?.startDayId ?? dayId;
      const toWeekId = getWeekId(toDate);
      const toDayId = getDayId(toDate);
      const now = new Date().toISOString();

      // Keep duration when moving multi-day spans.
      const oldEnd = task.endDayId || fromDayId;
      const durationMs =
        new Date(oldEnd + 'T00:00:00').getTime() - new Date(fromDayId + 'T00:00:00').getTime();
      const newEnd = new Date(new Date(toDayId + 'T00:00:00').getTime() + durationMs);
      const newEndDayId = getDayId(newEnd);

      removeTaskOptimistic(fromWeekId, fromDayId, task.id);
      addTaskOptimistic(toWeekId, toDayId, {
        ...task,
        endDayId: newEndDayId,
        movedFrom: `${fromWeekId}/${fromDayId}`,
        order: 0,
        updatedAt: now,
      });

      try {
        await moveTask(fromWeekId, fromDayId, task.id, toWeekId, toDayId);
      } catch (err) {
        removeTaskOptimistic(toWeekId, toDayId, task.id);
        addTaskOptimistic(fromWeekId, fromDayId, task);
        throw err;
      }
    },
    [uid, weekId, dayId, removeTaskOptimistic, addTaskOptimistic]
  );

  const reorder = useCallback(
    (reorderedTasks: Task[]) => {
      // Reorder only applies to tasks that start on this day.
      const startIds = new Set(startDayTasks.map(t => t.id));
      const reorderedStart = reorderedTasks.filter(t => startIds.has(t.id));
      reorderTasks(weekId, dayId, reorderedStart);
    },
    [weekId, dayId, startDayTasks, reorderTasks]
  );

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return {
    tasks,
    addTask,
    editTask,
    removeTask,
    moveTaskToDay,
    reorder,
    progress,
    completedCount,
    updateTaskById,
  };
}
