import type { CreateTaskPayload, Task, TaskApplyTo, UpdateTaskPayload } from '../types';

export type HistoryKind = 'create' | 'update' | 'delete' | 'move' | 'update_series';

/** Snapshot de ubicación + tarea (para undo de delete / move). */
export interface LocatedTaskSnapshot {
  weekId: string;
  dayId: string;
  task: Task;
}

/**
 * Mutación serializable (sin closures) que se puede reaplicar.
 * El re-aplicador vive en applyHistoryMutation.
 */
export type HistoryMutation =
  | {
      op: 'create';
      weekId: string;
      dayId: string;
      payload: CreateTaskPayload;
      /** Rellenado tras create exitoso (ids reales). */
      created?: Array<{ weekId: string; dayId: string; id: string }>;
    }
  | {
      op: 'update';
      weekId: string;
      dayId: string;
      taskId: string;
      seriesId?: string | null;
      applyTo: TaskApplyTo;
      patch: UpdateTaskPayload;
    }
  | {
      op: 'delete';
      weekId: string;
      dayId: string;
      taskId: string;
      /** Snapshot previo para recrear en undo. */
      snapshot: LocatedTaskSnapshot;
    }
  | {
      op: 'move';
      fromWeekId: string;
      fromDayId: string;
      toWeekId: string;
      toDayId: string;
      taskId: string;
      /** Task state before move (incluye endDayId original). */
      taskBefore: Task;
    };

export interface HistoryEntry {
  id: string;
  at: number;
  /** Texto legible ya resuelto (castellano/en en el momento de la acción). */
  label: string;
  kind: HistoryKind;
  forward: HistoryMutation;
  inverse: HistoryMutation;
}

export const HISTORY_LIMIT = 50;
