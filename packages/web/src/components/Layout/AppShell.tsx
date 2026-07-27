import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Plus, Sparkles } from 'lucide-react';
import { addDays, startOfISOWeek } from 'date-fns';
import { Sidebar, NAV_ITEMS } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { FAB } from './FAB';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isDemoMode } from '@core/lib/demoMode';
import { isBrowserOnline } from '@core/lib/network';
import {
  ensureTasksRangeLoaded,
  getDayId,
} from '@core/services/taskService';
import { useStore } from '@core/store';
import { useContacts } from '@core/hooks/useContacts';
import { useT } from '@/hooks/useT';
import {
  PageChromeProvider,
  usePageChromeState,
} from './PageChromeContext';
import { GlassPanel } from '@/components/ui/glass-panel';

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
  const uid = useStore(s => s.uid);
  // Precarga Círculo para @menciones en tareas/recetarios en cualquier vista.
  useContacts();

  // Fase 4.2: en idle, precargar la semana ISO actual (Resumen + Board listos).
  useEffect(() => {
    if (!uid || isDemoMode() || !isBrowserOnline()) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const today = new Date();
      const weekStart = startOfISOWeek(today);
      const from = getDayId(weekStart);
      const to = getDayId(addDays(weekStart, 6));
      void ensureTasksRangeLoaded(uid, from, to).catch(() => {
        /* silencioso: el board cargará al entrar */
      });
    };
    const ric = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number }
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (typeof ric === 'function') {
      const id = ric(run, { timeout: 2500 });
      return () => {
        cancelled = true;
        (
          globalThis as typeof globalThis & {
            cancelIdleCallback?: (id: number) => void;
          }
        ).cancelIdleCallback?.(id);
      };
    }
    const timer = setTimeout(run, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [uid]);

  const matched = NAV_ITEMS.find(i => location.pathname.startsWith(i.to));
  const headerTitle =
    chrome.title || (matched ? t(matched.labelKey) : '') || t('nav_tasks');

  const primaryAction = chrome.primaryAction;
  // FAB si la página lo pidió O si hay acción primaria / handler (fallback robusto).
  // Evita que el + desaparezca si showFab llega un frame tarde al cambiar de pestaña.
  const fabHandler =
    chrome.onFabClick ?? primaryAction?.onClick ?? null;
  const showFab =
    Boolean(fabHandler) &&
    (chrome.showFab || Boolean(chrome.primaryAction) || Boolean(chrome.onFabClick));

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-background overscroll-none">
      <div className="hidden md:flex">
        <Sidebar variant="desktop" />
      </div>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <GlassPanel
          as="header"
          chrome
          className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3 pt-[env(safe-area-inset-top,0px)] md:px-5"
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted hover:bg-field hover:text-text-primary md:hidden"
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
        </GlassPanel>

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
