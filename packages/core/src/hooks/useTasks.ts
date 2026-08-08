import { useEffect, useCallback, useMemo } from 'react';
import { findTaskLocation, useStore } from '../store';
import {
  subscribeTasks,
  getWeekId,
  getDayId,
  rematerializeRxSeries,
  deleteRxTreatment,
} from '../services/taskService';
import { collectTasksCovering } from '../lib/taskPresence';
import type {
  CreateTaskPayload,
  UpdateTaskPayload,
  RematerializeRxPayload,
  Task,
} from '../types';
import { taskHistory } from '../history/taskHistory';
import { hydrateFromTaskCache } from '../offline/bootstrap';
import { isBrowserOnline } from '../lib/network';

export function useTasks(weekId: string, dayId: string) {
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const startDayTasks = useStore(s => s.tasksByDay[weekId]?.[dayId] ?? []);
  const { reorderTasks, updateTaskById } = useStore();

  // Presence-aware list: multi-day spans appear on every covered day.
  const tasks = useMemo(
    () =>
      collectTasksCovering(tasksByDay, dayId).map(
        ({ weekId: _w, startDayId: _s, ...task }) => task
      ),
    [tasksByDay, dayId]
  );

  // Hydrate empty buckets from offline snapshot once per uid.
  useEffect(() => {
    if (!uid) return;
    hydrateFromTaskCache(uid);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    // Offline: keep cache-hydrated state; no live subscription traffic.
    if (!isBrowserOnline()) return;

    // Fase 3: un canal por uid + ensure de semana ISO (sin refetch por evento RT).
    return subscribeTasks(uid, weekId, dayId);
  }, [uid, weekId, dayId]);

  const addTask = useCallback(
    async (payload: CreateTaskPayload) => {
      if (!uid) {
        throw new Error('Sesión no lista. Recarga la página e inténtalo de nuevo.');
      }
      await taskHistory.create(weekId, dayId, payload);
    },
    [uid, weekId, dayId]
  );

  const editTask = useCallback(
    async (taskId: string, payload: UpdateTaskPayload) => {
      if (!uid) return;
      await taskHistory.update(weekId, dayId, taskId, payload);
    },
    [uid, weekId, dayId]
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!uid) return;
      await taskHistory.remove(weekId, dayId, taskId);
    },
    [uid, weekId, dayId]
  );

  const moveTaskToDay = useCallback(
    async (task: Task, toDate: Date) => {
      if (!uid) return;
      const loc = findTaskLocation(task.id);
      const fromWeekId = loc?.weekId ?? weekId;
      const fromDayId = loc?.dayId ?? dayId;
      await taskHistory.move(
        fromWeekId,
        fromDayId,
        task,
        getWeekId(toDate),
        getDayId(toDate)
      );
    },
    [uid, weekId, dayId]
  );

  const reorder = useCallback(
    (reorderedTasks: Task[]) => {
      const startIds = new Set(startDayTasks.map(t => t.id));
      const reorderedStart = reorderedTasks.filter(t => startIds.has(t.id));
      reorderTasks(weekId, dayId, reorderedStart);
    },
    [weekId, dayId, startDayTasks, reorderTasks]
  );

  const rematerializeRx = useCallback(
    async (taskId: string, payload: RematerializeRxPayload) => {
      if (!uid)
        return {
          created: 0,
          instances: [] as Array<Task & { weekId: string; dayId: string }>,
        };
      return rematerializeRxSeries(weekId, dayId, taskId, payload);
    },
    [uid, weekId, dayId]
  );

  /** Elimina un recetario completo (todas las tomas de la serie). */
  const removeRxTreatment = useCallback(
    async (opts: { seriesId: string | null; tasks: Array<{ id: string }> }) => {
      if (!uid) return { deleted: 0 };
      return deleteRxTreatment(opts);
    },
    [uid]
  );

  const completedCount = tasks.filter(t => t.completed).length;
  const progress =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return {
    tasks,
    addTask,
    editTask,
    removeTask,
    moveTaskToDay,
    reorder,
    rematerializeRx,
    removeRxTreatment,
    progress,
    completedCount,
    updateTaskById,
  };
}
