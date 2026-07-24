import { create } from 'zustand';
import type { HistoryEntry } from './types';
import { HISTORY_LIMIT } from './types';

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
  push: (entry: HistoryEntry) => void;
  /** Saca la última de past y la mueve a future. */
  popUndo: () => HistoryEntry | null;
  /** Saca la primera de future y la mueve a past. */
  popRedo: () => HistoryEntry | null;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  push: entry =>
    set(state => {
      const past = [...state.past, entry];
      while (past.length > HISTORY_LIMIT) past.shift();
      return { past, future: [] };
    }),

  popUndo: () => {
    const { past } = get();
    if (past.length === 0) return null;
    const entry = past[past.length - 1];
    set({ past: past.slice(0, -1), future: [entry, ...get().future] });
    return entry;
  },

  popRedo: () => {
    const { future } = get();
    if (future.length === 0) return null;
    const entry = future[0];
    set({ future: future.slice(1), past: [...get().past, entry] });
    return entry;
  },

  clear: () => set({ past: [], future: [] }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

export function generateHistoryId(): string {
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
