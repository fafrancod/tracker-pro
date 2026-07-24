import { useStore } from '../store';
import { isBrowserOnline } from '../lib/network';
import { hydrateTasksByDay, loadTaskCache, saveTaskCache } from '../lib/taskCache';
import {
  flushOfflineQueue,
  offlineQueueCount,
  type FlushResult,
} from '../lib/offlineQueue';
import { isDemoMode } from '../lib/demoMode';

let onlineBound = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let unsubPersist: (() => void) | null = null;

export type OfflineSyncListener = (event: {
  type: 'online' | 'offline' | 'flush' | 'queue';
  queueCount: number;
  flush?: FlushResult;
}) => void;

const listeners = new Set<OfflineSyncListener>();

export function subscribeOfflineSync(cb: OfflineSyncListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(
  type: 'online' | 'offline' | 'flush' | 'queue',
  flush?: FlushResult
): void {
  const uid = useStore.getState().uid;
  const queueCount = uid ? offlineQueueCount(uid) : 0;
  for (const cb of listeners) {
    try {
      cb({ type, queueCount, flush });
    } catch {
      /* ignore */
    }
  }
}

export function notifyOfflineQueueChanged(): void {
  emit('queue');
}

/** Hydrate empty buckets from last successful snapshot. */
export function hydrateFromTaskCache(uid: string): number {
  if (isDemoMode()) return 0;
  const cached = loadTaskCache(uid);
  if (!cached) return 0;
  const store = useStore.getState();
  const patches = hydrateTasksByDay(store.tasksByDay, cached);
  for (const p of patches) {
    store.setDayTasks(p.weekId, p.dayId, p.tasks);
  }
  return patches.length;
}

/** Debounced persist of tasksByDay for the current user. */
export function startTaskCachePersistence(): () => void {
  if (isDemoMode()) return () => undefined;
  if (unsubPersist) return unsubPersist;

  unsubPersist = useStore.subscribe(state => {
    const uid = state.uid;
    if (!uid) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      saveTaskCache(uid, useStore.getState().tasksByDay);
    }, 400);
  });

  return () => {
    if (persistTimer) clearTimeout(persistTimer);
    unsubPersist?.();
    unsubPersist = null;
  };
}

export async function tryFlushOfflineQueue(): Promise<FlushResult | null> {
  if (isDemoMode()) return null;
  if (!isBrowserOnline()) return null;
  const uid = useStore.getState().uid;
  if (!uid) return null;
  if (offlineQueueCount(uid) === 0) return null;
  const result = await flushOfflineQueue(uid);
  emit('flush', result);
  // Refresh cache after successful flush
  saveTaskCache(uid, useStore.getState().tasksByDay);
  return result;
}

/**
 * Bind window online/offline once. Call from web app boot (AuthProvider or App).
 */
type BrowserWindow = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

export function bindOfflineSync(): () => void {
  const win = (globalThis as { window?: BrowserWindow }).window;
  if (!win || onlineBound) {
    return () => undefined;
  }
  onlineBound = true;

  const stopPersist = startTaskCachePersistence();

  const onOnline = () => {
    emit('online');
    void tryFlushOfflineQueue();
  };
  const onOffline = () => {
    emit('offline');
  };

  win.addEventListener('online', onOnline);
  win.addEventListener('offline', onOffline);

  // Initial hydrate + flush if already online with pending queue
  const uid = useStore.getState().uid;
  if (uid) {
    hydrateFromTaskCache(uid);
    if (isBrowserOnline()) void tryFlushOfflineQueue();
  }

  return () => {
    win.removeEventListener('online', onOnline);
    win.removeEventListener('offline', onOffline);
    stopPersist();
    onlineBound = false;
  };
}

export function getPendingOfflineCount(): number {
  const uid = useStore.getState().uid;
  return uid ? offlineQueueCount(uid) : 0;
}
