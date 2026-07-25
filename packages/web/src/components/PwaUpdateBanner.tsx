import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { applyPwaUpdate, subscribePwaUpdate } from '@/lib/pwaUpdate';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Banner cuando hay una nueva versión de la PWA lista para activar.
 * Especialmente importante en apps instaladas en escritorio (standalone).
 */
export function PwaUpdateBanner() {
  const { t } = useT();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    return subscribePwaUpdate(state => {
      setNeedRefresh(state.needRefresh);
      if (state.needRefresh) setDismissed(false);
    });
  }, []);

  if (!needRefresh || dismissed) return null;

  async function handleUpdate() {
    setApplying(true);
    try {
      await applyPwaUpdate();
    } catch {
      window.location.reload();
    }
  }

  return (
    <div
      className={cn(
        'fixed left-3 right-3 z-50 flex items-center gap-3 rounded-xl border border-accent-teal/40 bg-surface p-3 shadow-lg',
        'top-[max(0.75rem,env(safe-area-inset-top))] sm:left-auto sm:right-4 sm:top-4 sm:max-w-md'
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-teal/15 text-accent-teal">
        <RefreshCw className={cn('h-5 w-5', applying && 'animate-spin')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{t('pwa_update_title')}</p>
        <p className="text-[11px] text-text-muted">{t('pwa_update_desc')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" className="h-8 gap-1 text-xs" disabled={applying} onClick={() => void handleUpdate()}>
          {applying ? t('pwa_update_applying') : t('pwa_update_action')}
        </Button>
        <button
          type="button"
          className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
          onClick={() => setDismissed(true)}
          aria-label={t('action_close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
