import { useEffect, useCallback, useMemo } from 'react';
import { findTaskLocation, useStore } from '../store';
import {
  subscribeTasks,
  getWeekId,
  getDayId,
  type LocatedTaskRow,
} from '../services/taskService';
import { collectTasksCovering } from '../lib/taskPresence';
import type { CreateTaskPayload, UpdateTaskPayload, Task } from '../types';
import { taskHistory } from '../history/taskHistory';

export function useTasks(weekId: string, dayId: string) {
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const startDayTasks = useStore(s => s.tasksByDay[weekId]?.[dayId] ?? []);
  const {
    setDayTasks,
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
        const existing = useStore.getState().tasksByDay[weekId]?.[dayId];
        if (existing === undefined) setDayTasks(weekId, dayId, []);
      }
    });
    return unsub;
  }, [uid, weekId, dayId, setDayTasks]);

  const addTask = useCallback(
    async (payload: CreateTaskPayload) => {
      if (!uid) return;
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
