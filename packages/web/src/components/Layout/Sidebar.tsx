import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  FolderKanban,
  Users,
  BarChart3,
  ScrollText,
  Settings,
  Shield,
  Grid2x2,
  Bell,
  Hourglass,
  Sparkles,
  BookHeart,
  Pill,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { appVersion } from '@/lib/appVersion';
import { useT } from '@/hooks/useT';
import { userAvatarUrl, userDisplayName } from '@/lib/userDisplay';
import type { TKey } from '@/lib/i18n';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface NavItem {
  to: string;
  labelKey: TKey;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  /** Si true, no se lista en el bucle principal (se renderiza en bloque Memento). */
  skipMainList?: boolean;
}

// El playbook indica que el segundo item debe ser la acción/entidad principal.
// Calendario: tablero día/semana/mes/continuo (tareas, eventos, hábitos…).
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav_summary', icon: LayoutDashboard },
  { to: '/board', labelKey: 'nav_tasks', icon: CalendarDays },
  { to: '/notifications', labelKey: 'nav_notifications', icon: Bell },
  { to: '/eisenhower', labelKey: 'nav_eisenhower', icon: Grid2x2 },
  { to: '/memento-mori', labelKey: 'nav_memento', icon: Hourglass, skipMainList: true },
  { to: '/reflections', labelKey: 'nav_reflections', icon: BookHeart },
  { to: '/recetario', labelKey: 'nav_recetario', icon: Pill },
  { to: '/finances', labelKey: 'nav_finances', icon: Wallet },
  { to: '/projects', labelKey: 'nav_projects', icon: FolderKanban },
  { to: '/circle', labelKey: 'nav_circle', icon: Users },
  { to: '/analytics', labelKey: 'nav_analytics', icon: BarChart3 },
  { to: '/activity', labelKey: 'nav_activity', icon: ScrollText },
  { to: '/settings', labelKey: 'nav_settings', icon: Settings },
  { to: '/admin', labelKey: 'nav_admin', icon: Shield, adminOnly: true },
];

interface SidebarProps {
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
}

function navClass(active: boolean): string {
  return cn(
    'mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
    active
      ? 'bg-accent-teal/10 text-accent-teal'
      : 'text-text-muted hover:bg-background hover:text-text-primary'
  );
}

export function Sidebar({ variant = 'desktop', onNavigate }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { t } = useT();
  const location = useLocation();
  // Admin se decide por backend en el futuro; por ahora se oculta.
  const isAdmin = false;
  const items = NAV_ITEMS.filter(item => (!item.adminOnly || isAdmin) && !item.skipMainList);

  const onMemento = location.pathname === '/memento-mori';
  const onGoalsTab = onMemento && new URLSearchParams(location.search).get('tab') === 'goals';
  const onMapTab = onMemento && !onGoalsTab;

  // Insertar bloque Memento después de Eisenhower (índice de items filtrados)
  const eisenhowerIdx = items.findIndex(i => i.to === '/eisenhower');

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) => navClass(isActive)}
      >
        <Icon className="h-4 w-4" />
        <span>{t(item.labelKey)}</span>
      </NavLink>
    );
  }

  const mementoBlock = (
    <div key="memento-block" className="mb-1">
      <NavLink
        to="/memento-mori"
        onClick={onNavigate}
        className={navClass(onMapTab)}
        end
      >
        <Hourglass className="h-4 w-4" />
        <span>{t('nav_memento')}</span>
      </NavLink>
      <NavLink
        to="/memento-mori?tab=goals"
        onClick={onNavigate}
        className={cn(navClass(onGoalsTab), 'ml-3 pl-2 text-[13px]')}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{t('nav_life_goals')}</span>
      </NavLink>
    </div>
  );

  const navNodes: ReactNode[] = [];
  items.forEach((item, idx) => {
    navNodes.push(renderItem(item));
    if (idx === eisenhowerIdx) {
      navNodes.push(mementoBlock);
    }
  });
  if (eisenhowerIdx < 0) {
    navNodes.push(mementoBlock);
  }

  return (
    <GlassPanel
      as="aside"
      chrome
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-border',
        variant === 'drawer' && 'w-full max-w-xs'
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <CalendarDays className="h-5 w-5 text-accent-teal" />
        <span className="text-sm font-bold tracking-tight text-text-primary">
          Daily Tracker
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">{navNodes}</nav>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-2">
          {userAvatarUrl(user) ? (
            <img src={userAvatarUrl(user)!} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-teal/20 text-xs font-semibold text-accent-teal">
              {userDisplayName(user).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-text-primary">
              {userDisplayName(user)}
            </p>
            <p className="truncate text-[10px] text-text-muted">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full rounded-md border border-border bg-field px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-background hover:text-text-primary"
        >
          {t('action_sign_out')}
        </button>
        <p className="mt-2 text-[10px] text-text-muted">
          v{appVersion.version} · {appVersion.channel}
        </p>
      </div>
    </GlassPanel>
  );
}
