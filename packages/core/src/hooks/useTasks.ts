import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import {
  subscribeTasks,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  getWeekId,
  getDayId,
} from '../services/taskService';
import { normalizeRecurrence } from '../lib/recurrence';
import type { CreateTaskPayload, UpdateTaskPayload, Task } from '../types';

export function useTasks(weekId: string, dayId: string) {
  const uid = useStore(s => s.uid);
  const tasks = useStore(s => s.tasksByDay[weekId]?.[dayId] ?? []);
  const {
    setDayTasks,
    addTaskOptimistic,
    updateTaskOptimistic,
    removeTaskOptimistic,
    reorderTasks,
  } = useStore();

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeTasks(uid, weekId, dayId, tasks => {
      setDayTasks(weekId, dayId, tasks);
    });
    return unsub;
  }, [uid, weekId, dayId, setDayTasks]);

  const addTask = useCallback(
    async (payload: CreateTaskPayload) => {
      if (!uid) return;
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const order = tasks.length;
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
        seriesId: recurrence.frequency === 'none' ? null : optimisticId,
        recurrence,
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
            createdAt: instance.createdAt,
            updatedAt: instance.updatedAt,
          });
        }
      } catch (err) {
        removeTaskOptimistic(weekId, dayId, optimisticId);
        throw err;
      }
    },
    [uid, weekId, dayId, tasks.length, addTaskOptimistic, removeTaskOptimistic]
  );

  const editTask = useCallback(
    async (taskId: string, payload: UpdateTaskPayload) => {
      if (!uid) return;
      const patch: Partial<Task> = {};
      if (payload.title !== undefined) patch.title = payload.title;
      if (payload.projectId !== undefined) patch.projectId = payload.projectId;
      if (payload.priority !== undefined) patch.priority = payload.priority;
      if (payload.notes !== undefined) patch.notes = payload.notes;
      if (payload.tags !== undefined) patch.tags = payload.tags;
      if (payload.order !== undefined) patch.order = payload.order;
      if (payload.movedFrom !== undefined) patch.movedFrom = payload.movedFrom;
      if (payload.completed !== undefined) {
        patch.completed = payload.completed;
        patch.completedAt = payload.completed ? new Date().toISOString() : null;
      }
      if (payload.recurrenceFrequency !== undefined || payload.recurrenceInterval !== undefined) {
        const current = tasks.find(t => t.id === taskId);
        patch.recurrence = normalizeRecurrence(
          payload.recurrenceFrequency ?? current?.recurrence.frequency,
          payload.recurrenceInterval ?? current?.recurrence.interval
        );
      }
      updateTaskOptimistic(weekId, dayId, taskId, patch);
      await updateTask(weekId, dayId, taskId, payload);
    },
    [uid, weekId, dayId, tasks, updateTaskOptimistic]
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!uid) return;
      removeTaskOptimistic(weekId, dayId, taskId);
      await deleteTask(weekId, dayId, taskId);
    },
    [uid, weekId, dayId, removeTaskOptimistic]
  );

  const moveTaskToDay = useCallback(
    async (task: Task, toDate: Date) => {
      if (!uid) return;
      const toWeekId = getWeekId(toDate);
      const toDayId = getDayId(toDate);
      const now = new Date().toISOString();

      removeTaskOptimistic(weekId, dayId, task.id);
      addTaskOptimistic(toWeekId, toDayId, {
        ...task,
        movedFrom: `${weekId}/${dayId}`,
        order: 0,
        updatedAt: now,
      });

      try {
        await moveTask(weekId, dayId, task.id, toWeekId, toDayId);
      } catch (err) {
        removeTaskOptimistic(toWeekId, toDayId, task.id);
        addTaskOptimistic(weekId, dayId, task);
        throw err;
      }
    },
    [uid, weekId, dayId, removeTaskOptimistic, addTaskOptimistic]
  );

  const reorder = useCallback(
    (reorderedTasks: Task[]) => {
      reorderTasks(weekId, dayId, reorderedTasks);
    },
    [weekId, dayId, reorderTasks]
  );

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return { tasks, addTask, editTask, removeTask, moveTaskToDay, reorder, progress, completedCount };
}
