import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ListChecks,
  FolderKanban,
  BarChart3,
  ScrollText,
  Settings,
  Shield,
  Grid2x2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { appVersion } from '@/lib/appVersion';
import { useT } from '@/hooks/useT';
import { userAvatarUrl, userDisplayName } from '@/lib/userDisplay';
import type { TKey } from '@/lib/i18n';

export interface NavItem {
  to: string;
  labelKey: TKey;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

// El playbook indica que el segundo item debe ser la acción/entidad principal.
// En task tracker la entidad principal son las Tareas.
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav_summary', icon: LayoutDashboard },
  { to: '/board', labelKey: 'nav_tasks', icon: ListChecks },
  { to: '/eisenhower', labelKey: 'nav_eisenhower', icon: Grid2x2 },
  { to: '/projects', labelKey: 'nav_projects', icon: FolderKanban },
  { to: '/analytics', labelKey: 'nav_analytics', icon: BarChart3 },
  { to: '/activity', labelKey: 'nav_activity', icon: ScrollText },
  { to: '/settings', labelKey: 'nav_settings', icon: Settings },
  { to: '/admin', labelKey: 'nav_admin', icon: Shield, adminOnly: true },
];

interface SidebarProps {
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
}

export function Sidebar({ variant = 'desktop', onNavigate }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { t } = useT();
  // Admin se decide por backend en el futuro; por ahora se oculta.
  const isAdmin = false;
  const items = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface',
        variant === 'drawer' && 'w-full max-w-xs'
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <ListChecks className="h-5 w-5 text-accent-teal" />
        <span className="text-sm font-bold tracking-tight text-text-primary">Daily Tracker</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent-teal/10 text-accent-teal'
                    : 'text-text-muted hover:bg-background hover:text-text-primary'
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>

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
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
        >
          {t('action_sign_out')}
        </button>
        <p className="mt-2 text-[10px] text-text-muted">
          v{appVersion.version} · {appVersion.channel}
        </p>
      </div>
    </aside>
  );
}
