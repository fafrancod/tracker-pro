import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import {
  bindOfflineSync,
  getPendingOfflineCount,
  subscribeOfflineSync,
  tryFlushOfflineQueue,
} from '@core/offline/bootstrap';
import { isBrowserOnline } from '@core/lib/network';
import { useStore } from '@core/store';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';

/**
 * Shows connectivity state + pending offline mutation count.
 * Syncs queue when the browser comes back online.
 */
export function OfflineBanner() {
  const { t } = useT();
  const uid = useStore(s => s.uid);
  const [online, setOnline] = useState(() => isBrowserOnline());
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastFlushMsg, setLastFlushMsg] = useState<string | null>(null);

  useEffect(() => {
    const unbind = bindOfflineSync();
    setQueueCount(getPendingOfflineCount());
    const unsub = subscribeOfflineSync(ev => {
      setOnline(ev.type !== 'offline' ? isBrowserOnline() : false);
      if (ev.type === 'online') setOnline(true);
      if (ev.type === 'offline') setOnline(false);
      setQueueCount(ev.queueCount);
      if (ev.type === 'flush' && ev.flush) {
        if (ev.flush.processed > 0) {
          setLastFlushMsg(
            t('offline_synced').replace('{n}', String(ev.flush.processed))
          );
          window.setTimeout(() => setLastFlushMsg(null), 4000);
        }
      }
    });
    return () => {
      unbind();
      unsub();
    };
  }, [t]);

  useEffect(() => {
    setQueueCount(getPendingOfflineCount());
  }, [uid]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await tryFlushOfflineQueue();
      setQueueCount(getPendingOfflineCount());
      if (res && res.processed > 0) {
        setLastFlushMsg(t('offline_synced').replace('{n}', String(res.processed)));
        window.setTimeout(() => setLastFlushMsg(null), 4000);
      }
    } finally {
      setSyncing(false);
    }
  }

  const showOffline = !online;
  const showQueue = online && queueCount > 0;
  const showToast = Boolean(lastFlushMsg);

  if (!showOffline && !showQueue && !showToast) return null;

  return (
    <div
      className={cn(
        'fixed left-1/2 z-40 flex max-w-[min(96vw,28rem)] -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-lg',
        'top-[max(0.5rem,env(safe-area-inset-top,0px))]',
        showOffline
          ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
          : showQueue
            ? 'border-accent-teal/40 bg-accent-teal/15 text-text-primary'
            : 'border-accent-green/40 bg-accent-green/15 text-text-primary'
      )}
      role="status"
    >
      {showOffline ? (
        <>
          <CloudOff className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">
            {t('offline_banner')}
            {queueCount > 0
              ? ` · ${t('offline_pending').replace('{n}', String(queueCount))}`
              : ''}
          </span>
        </>
      ) : showQueue ? (
        <>
          <Wifi className="h-3.5 w-3.5 shrink-0 text-accent-teal" />
          <span className="min-w-0">
            {t('offline_pending').replace('{n}', String(queueCount))}
          </span>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className="inline-flex items-center gap-1 rounded-full bg-accent-teal/20 px-2 py-0.5 font-medium text-accent-teal"
          >
            <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} />
            {t('offline_sync_now')}
          </button>
        </>
      ) : (
        <span>{lastFlushMsg}</span>
      )}
    </div>
  );
}
