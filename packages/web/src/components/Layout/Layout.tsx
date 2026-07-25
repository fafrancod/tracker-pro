import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, Sparkles, Plus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Sidebar, NAV_ITEMS } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { FAB } from './FAB';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isDemoMode } from '@core/lib/demoMode';
import { useT } from '@/hooks/useT';
import { usePageChromeApi } from './PageChromeContext';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Si está definido, el FAB usa este handler. Si no, se reutiliza primaryAction.onClick. */
  onFabClick?: () => void;
  /** Permite ocultar el FAB en pantallas donde no aplica. */
  showFab?: boolean;
}

/**
 * Dentro de AppShell: publica título/FAB al chrome (API estable) y solo renderiza children.
 * Fuera de AppShell: monta el layout completo (fallback).
 */
export function Layout({
  children,
  title,
  primaryAction,
  onFabClick,
  showFab = true,
}: LayoutProps) {
  const chromeApi = usePageChromeApi();
  const titleKey = title ?? '';
  const actionLabel = primaryAction?.label ?? '';
  const hasPrimary = Boolean(primaryAction);
  const hasFabClick = Boolean(onFabClick);

  // Siempre el handler más reciente sin re-disparar setState.
  const primaryRef = useRef(primaryAction);
  primaryRef.current = primaryAction;
  const fabRef = useRef(onFabClick);
  fabRef.current = onFabClick;

  // Deps solo strings/flags → no bucle Maximum update depth (#185).
  useLayoutEffect(() => {
    if (!chromeApi) return;
    chromeApi.setChrome({
      title: titleKey,
      showFab,
      primaryAction: hasPrimary
        ? {
            label: actionLabel,
            onClick: () => {
              primaryRef.current?.onClick();
            },
          }
        : null,
      onFabClick: hasFabClick
        ? () => {
            fabRef.current?.();
          }
        : null,
    });
  }, [chromeApi, titleKey, showFab, actionLabel, hasPrimary, hasFabClick]);

  useEffect(() => {
    if (!chromeApi) return;
    return () => {
      chromeApi.resetChrome();
    };
  }, [chromeApi]);

  if (chromeApi) {
    return <>{children}</>;
  }

  return (
    <StandaloneLayout
      title={title}
      primaryAction={primaryAction}
      onFabClick={onFabClick}
      showFab={showFab}
    >
      {children}
    </StandaloneLayout>
  );
}

function StandaloneLayout({
  children,
  title,
  primaryAction,
  onFabClick,
  showFab = true,
}: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { t } = useT();

  const matched = NAV_ITEMS.find(i => location.pathname.startsWith(i.to));
  const headerTitle = title ?? (matched ? t(matched.labelKey) : '');
  const fabHandler = onFabClick ?? primaryAction?.onClick;

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

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>

      {showFab && fabHandler && (
        <FAB onClick={fabHandler} label={primaryAction?.label ?? 'Nueva tarea'} />
      )}
    </div>
  );
}
