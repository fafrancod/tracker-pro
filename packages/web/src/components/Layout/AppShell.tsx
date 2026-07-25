import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Plus, Sparkles } from 'lucide-react';
import { Sidebar, NAV_ITEMS } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { FAB } from './FAB';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isDemoMode } from '@core/lib/demoMode';
import { useT } from '@/hooks/useT';
import {
  PageChromeProvider,
  usePageChromeState,
} from './PageChromeContext';

/**
 * Shell persistente: sidebar + header no se desmontan al cambiar de ruta.
 */
export function AppShell() {
  return (
    <PageChromeProvider>
      <AppShellInner />
    </PageChromeProvider>
  );
}

function AppShellInner() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { t } = useT();
  const chrome = usePageChromeState();

  const matched = NAV_ITEMS.find(i => location.pathname.startsWith(i.to));
  const headerTitle =
    chrome.title || (matched ? t(matched.labelKey) : '') || t('nav_tasks');

  const primaryAction = chrome.primaryAction;
  const showFab = chrome.showFab;
  const fabHandler = chrome.onFabClick ?? primaryAction?.onClick ?? null;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-background overscroll-none">
      <div className="hidden md:flex">
        <Sidebar variant="desktop" />
      </div>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 pt-[env(safe-area-inset-top,0px)] md:px-5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:bg-background hover:text-text-primary md:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h1 className="flex-1 truncate text-base font-bold text-text-primary md:text-lg">
            {headerTitle}
          </h1>

          {isDemoMode() && (
            <Badge variant="pink" className="hidden gap-1 sm:inline-flex">
              <Sparkles className="h-3 w-3" />
              {t('status_demo')}
            </Badge>
          )}

          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              size="sm"
              className="hidden gap-1.5 sm:inline-flex"
            >
              <Plus className="h-4 w-4" />
              {primaryAction.label}
            </Button>
          )}
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>

      {showFab && fabHandler && (
        <FAB onClick={fabHandler} label={primaryAction?.label ?? 'Nueva tarea'} />
      )}
    </div>
  );
}
