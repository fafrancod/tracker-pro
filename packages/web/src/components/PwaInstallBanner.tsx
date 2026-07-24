import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'daily-tracker:pwa-install-dismissed';

/**
 * Android Chrome: captura beforeinstallprompt y muestra banner para instalar la PWA.
 */
export function PwaInstallBanner() {
  const { t } = useT();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* ignore */
    }

    // Already standalone
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    function onBip(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setVisible(false);
  }

  function handleDismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  if (!visible || !deferred) return null;

  return (
    <div
      className={cn(
        'fixed left-3 right-3 z-40 flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-lg',
        'bottom-[max(5.5rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))]'
      )}
      role="dialog"
      aria-label={t('pwa_install_title')}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-teal/15 text-accent-teal">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{t('pwa_install_title')}</p>
        <p className="text-[11px] text-text-muted">{t('pwa_install_desc')}</p>
      </div>
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="shrink-0 rounded-lg bg-accent-teal px-3 py-2 text-xs font-semibold text-background"
      >
        {t('pwa_install_action')}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-background"
        aria-label={t('action_close')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
