import { useState, type ReactNode } from 'react';
import { Menu, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Sidebar, NAV_ITEMS } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { FAB } from './FAB';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { isDemoMode } from '@core/lib/demoMode';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/hooks/useT';

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

export function Layout({ children, title, primaryAction, onFabClick, showFab = true }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { t } = useT();

  const matched = NAV_ITEMS.find(i => location.pathname.startsWith(i.to));
  const headerTitle = title ?? (matched ? t(matched.labelKey) : '');

  const fabHandler = onFabClick ?? primaryAction?.onClick;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop */}
      <div className="hidden md:flex">
        <Sidebar variant="desktop" />
      </div>

      {/* Drawer mobile */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 md:px-5">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary md:hidden"
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

        {/* Content */}
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>

      {/* FAB — accesible en todas las pantallas donde aplique */}
      {showFab && fabHandler && (
        <FAB onClick={fabHandler} label={primaryAction?.label ?? 'Nueva tarea'} />
      )}
    </div>
  );
}
