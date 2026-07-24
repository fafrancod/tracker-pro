import { useCallback, useSyncExternalStore } from 'react';
import { useHistoryStore } from '../history/historyStore';
import { taskHistory } from '../history/taskHistory';
import type { HistoryEntry } from '../history/types';

function subscribe(cb: () => void) {
  return useHistoryStore.subscribe(cb);
}

function getSnapshot() {
  return useHistoryStore.getState();
}

/**
 * Historial de sesión: undo/redo/jump + listas past/future.
 */
export function useTaskHistory() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const undo = useCallback(() => taskHistory.undo(), []);
  const redo = useCallback(() => taskHistory.redo(), []);
  const jumpTo = useCallback((id: string) => taskHistory.jumpTo(id), []);

  return {
    past: state.past as HistoryEntry[],
    future: state.future as HistoryEntry[],
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo,
    redo,
    jumpTo,
    clear: state.clear,
  };
}
