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
        createdAt: now,
        updatedAt: now,
      };
      addTaskOptimistic(weekId, dayId, optimisticTask);
      try {
        // Pasamos `optimisticId` como eventId para que reintentos no doble-cuenten usage.
        await createTask(weekId, dayId, payload, optimisticId);
      } catch (err) {
        // Rollback optimista: el listener real va a re-sincronizar pero quitamos
        // ya el placeholder para que el error sea inmediato.
        removeTaskOptimistic(weekId, dayId, optimisticId);
        throw err;
      }
    },
    [uid, weekId, dayId, tasks.length, addTaskOptimistic, removeTaskOptimistic]
  );

  const editTask = useCallback(
    async (taskId: string, payload: UpdateTaskPayload) => {
      if (!uid) return;
      updateTaskOptimistic(weekId, dayId, taskId, payload);
      await updateTask(weekId, dayId, taskId, payload);
    },
    [uid, weekId, dayId, updateTaskOptimistic]
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

      // Push optimista al destino con el MISMO id que tiene en origen:
      // - En real mode el listener Firestore va a re-emitir la lista del
      //   destino y como el id coincide no hay duplicado.
      // - En demo mode no hay listener; este push es lo unico que hace
      //   visible el movimiento.
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
        // Rollback: vuelvo a poner en origen y saco del destino.
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
