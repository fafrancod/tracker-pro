import { type ReactNode, useState } from 'react';
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
  Files,
  Sprout,
  GanttChart,
  Lightbulb,
  Tags,
  Store,
  CreditCard,
  Landmark,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { appVersion } from '@/lib/appVersion';
import { useT } from '@/hooks/useT';
import { userAvatarUrl, userDisplayName } from '@/lib/userDisplay';
import type { TKey } from '@/lib/i18n';
import { GlassPanel } from '@/components/ui/glass-panel';
import { isAdminUser } from '@core/lib/adminPortal';
import { getBrandName } from '@/lib/publicConfig';
import { requestFocusToday } from '@/lib/calendarToday';

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
  { to: '/gantt', labelKey: 'nav_gantt', icon: GanttChart },
  { to: '/habits', labelKey: 'nav_habits', icon: Sprout },
  { to: '/notifications', labelKey: 'nav_notifications', icon: Bell },
  { to: '/eisenhower', labelKey: 'nav_eisenhower', icon: Grid2x2 },
  { to: '/memento-mori', labelKey: 'nav_memento', icon: Hourglass, skipMainList: true },
  { to: '/reflections', labelKey: 'nav_reflections', icon: BookHeart },
  { to: '/recetario', labelKey: 'nav_recetario', icon: Pill },
  { to: '/finances', labelKey: 'nav_finances', icon: Wallet, skipMainList: true },
  { to: '/projects', labelKey: 'nav_projects', icon: FolderKanban },
  { to: '/ideas', labelKey: 'nav_ideas', icon: Lightbulb },
  { to: '/documents', labelKey: 'nav_documents', icon: Files },
  { to: '/circle', labelKey: 'nav_circle', icon: Users },
  { to: '/analytics', labelKey: 'nav_analytics', icon: BarChart3 },
  { to: '/activity', labelKey: 'nav_activity', icon: ScrollText },
  { to: '/settings', labelKey: 'nav_settings', icon: Settings },
  { to: '/atenas', labelKey: 'nav_admin', icon: Shield, adminOnly: true },
];

interface SidebarProps {
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const NAV_EXPANDED_KEY = 'daily-tracker:nav-expanded';

function navClass(active: boolean, collapsed = false): string {
  return cn(
    'sidebar-nav-item mb-0.5 flex items-center rounded-xl py-2 text-sm transition-all duration-200',
    collapsed ? 'justify-center px-2' : 'gap-3 px-3',
    active
      ? 'sidebar-nav-item-active bg-accent-teal/10 text-accent-teal'
      : 'text-text-muted'
  );
}

function loadNavExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_EXPANDED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function Sidebar({
  variant = 'desktop',
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { user, signOut } = useAuth();
  const { t } = useT();
  const location = useLocation();
  const isAdmin = isAdminUser({
    email: user?.email,
    appMetadata: user?.app_metadata as { admin?: unknown } | undefined,
  });
  const items = NAV_ITEMS.filter(item => (!item.adminOnly || isAdmin) && !item.skipMainList);

  const onMemento = location.pathname === '/memento-mori';
  const onGoalsTab = onMemento && new URLSearchParams(location.search).get('tab') === 'goals';
  const onMapTab = onMemento && !onGoalsTab;
  const onFinances = location.pathname === '/finances';
  const financesTab = onFinances
    ? new URLSearchParams(location.search).get('tab') ?? 'calendar'
    : '';
  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadNavExpanded);

  function persistExpanded(next: Record<string, boolean>) {
    try {
      localStorage.setItem(NAV_EXPANDED_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function toggleSection(id: string) {
    setExpanded(prev => {
      const currently =
        prev[id] === false ? false : prev[id] === true ? true : id === 'finances' ? onFinances : onMemento;
      const next = { ...prev, [id]: !currently };
      persistExpanded(next);
      return next;
    });
  }

  function expandSection(id: string) {
    setExpanded(prev => {
      if (prev[id] === true) return prev;
      const next = { ...prev, [id]: true };
      persistExpanded(next);
      return next;
    });
  }

  const mementoOpen =
    expanded.memento === false ? false : expanded.memento === true || onMemento;
  const financesOpen =
    expanded.finances === false ? false : expanded.finances === true || onFinances;

  // Insertar bloque Memento después de Eisenhower (índice de items filtrados)
  const eisenhowerIdx = items.findIndex(i => i.to === '/eisenhower');
  const recetarioIdx = items.findIndex(i => i.to === '/recetario');

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={collapsed ? t(item.labelKey) : undefined}
        onClick={() => {
          if (item.to === '/board') requestFocusToday();
          onNavigate?.();
        }}
        className={({ isActive }) => navClass(isActive, collapsed)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {collapsed ? null : <span>{t(item.labelKey)}</span>}
      </NavLink>
    );
  }

  const mementoBlock = collapsed ? (
    <NavLink
      key="memento-block"
      to="/memento-mori"
      title={t('nav_memento')}
      onClick={onNavigate}
      className={navClass(onMemento, true)}
    >
      <Hourglass className="h-4 w-4 shrink-0" />
    </NavLink>
  ) : (
    <div key="memento-block" className="mb-1">
      <div className="flex items-center gap-0.5">
        <NavLink
          to="/memento-mori"
          onClick={() => {
            expandSection('memento');
            onNavigate?.();
          }}
          className={cn(navClass(onMapTab), 'min-w-0 flex-1')}
          end
        >
          <Hourglass className="h-4 w-4" />
          <span>{t('nav_memento')}</span>
        </NavLink>
        <button
          type="button"
          aria-expanded={mementoOpen}
          aria-label={t('nav_toggle_section')}
          onClick={() => toggleSection('memento')}
          className="mb-0.5 rounded-lg p-1.5 text-text-muted hover:bg-accent-teal/10 hover:text-text-primary"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              mementoOpen ? 'rotate-0' : '-rotate-90'
            )}
          />
        </button>
      </div>
      {mementoOpen ? (
        <NavLink
          to="/memento-mori?tab=goals"
          onClick={onNavigate}
          className={cn(navClass(onGoalsTab), 'ml-3 pl-2 text-[13px]')}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t('nav_life_goals')}</span>
        </NavLink>
      ) : null}
    </div>
  );

  const financesBlock = collapsed ? (
    <NavLink
      key="finances-block"
      to="/finances"
      title={t('nav_finances')}
      onClick={onNavigate}
      className={navClass(onFinances, true)}
    >
      <Wallet className="h-4 w-4 shrink-0" />
    </NavLink>
  ) : (
    <div key="finances-block" className="mb-1">
      <div className="flex items-center gap-0.5">
        <NavLink
          to="/finances"
          onClick={() => {
            expandSection('finances');
            onNavigate?.();
          }}
          className={cn(
            navClass(onFinances && (!financesTab || financesTab === 'calendar')),
            'min-w-0 flex-1'
          )}
        >
          <Wallet className="h-4 w-4" />
          <span>{t('nav_finances')}</span>
        </NavLink>
        <button
          type="button"
          aria-expanded={financesOpen}
          aria-label={t('nav_toggle_section')}
          onClick={() => toggleSection('finances')}
          className="mb-0.5 rounded-lg p-1.5 text-text-muted hover:bg-accent-teal/10 hover:text-text-primary"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              financesOpen ? 'rotate-0' : '-rotate-90'
            )}
          />
        </button>
      </div>
      {financesOpen ? (
        <>
          <NavLink
            to="/finances?tab=list"
            onClick={onNavigate}
            className={cn(navClass(financesTab === 'list'), 'ml-3 pl-2 text-[13px]')}
          >
            <List className="h-3.5 w-3.5" />
            <span>{t('nav_fin_list')}</span>
          </NavLink>
          <NavLink
            to="/finances?tab=categories"
            onClick={onNavigate}
            className={cn(navClass(financesTab === 'categories'), 'ml-3 pl-2 text-[13px]')}
          >
            <Tags className="h-3.5 w-3.5" />
            <span>{t('nav_fin_categories')}</span>
          </NavLink>
          <NavLink
            to="/finances?tab=merchants"
            onClick={onNavigate}
            className={cn(navClass(financesTab === 'merchants'), 'ml-3 pl-2 text-[13px]')}
          >
            <Store className="h-3.5 w-3.5" />
            <span>{t('nav_fin_merchants')}</span>
          </NavLink>
          <NavLink
            to="/finances?tab=accounts"
            onClick={onNavigate}
            className={cn(navClass(financesTab === 'accounts'), 'ml-3 pl-2 text-[13px]')}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>{t('nav_fin_payment_methods')}</span>
          </NavLink>
          <NavLink
            to="/finances?tab=evolution"
            onClick={onNavigate}
            className={cn(navClass(financesTab === 'evolution'), 'ml-3 pl-2 text-[13px]')}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>{t('nav_fin_evolution')}</span>
          </NavLink>
          <NavLink
            to="/finances?tab=credits"
            onClick={onNavigate}
            className={cn(navClass(financesTab === 'credits'), 'ml-3 pl-2 text-[13px]')}
          >
            <Landmark className="h-3.5 w-3.5" />
            <span>{t('nav_fin_credits')}</span>
          </NavLink>
        </>
      ) : null}
    </div>
  );

  const navNodes: ReactNode[] = [];
  items.forEach((item, idx) => {
    navNodes.push(renderItem(item));
    if (idx === eisenhowerIdx) {
      navNodes.push(mementoBlock);
    }
    if (idx === recetarioIdx) {
      navNodes.push(financesBlock);
    }
  });
  if (eisenhowerIdx < 0) {
    navNodes.push(mementoBlock);
  }
  if (recetarioIdx < 0) {
    navNodes.push(financesBlock);
  }

  return (
    <GlassPanel
      as="aside"
      chrome
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border',
        collapsed ? 'w-16' : 'w-60',
        variant === 'drawer' && 'w-full max-w-xs'
      )}
    >
      <div
        className={cn(
          'flex items-center border-b border-border',
          collapsed ? 'h-auto flex-col gap-1 px-1 py-2' : 'h-14 gap-2 px-4'
        )}
      >
        <CalendarDays className="h-5 w-5 shrink-0 text-accent-teal" />
        {collapsed ? null : (
          <span className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight text-text-primary">
            {getBrandName()}
          </span>
        )}
        {variant === 'desktop' && onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-md p-1 text-text-muted hover:bg-background hover:text-text-primary"
            aria-label={collapsed ? t('nav_expand') : t('nav_collapse')}
            title={collapsed ? t('nav_expand') : t('nav_collapse')}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">{navNodes}</nav>

      <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-3')}>
        <div className={cn('mb-2 flex items-center', collapsed ? 'justify-center' : 'gap-2')}>
          {userAvatarUrl(user) ? (
            <img src={userAvatarUrl(user)!} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-teal/20 text-xs font-semibold text-accent-teal">
              {userDisplayName(user).slice(0, 1).toUpperCase()}
            </div>
          )}
          {collapsed ? null : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text-primary">
                {userDisplayName(user)}
              </p>
              <p className="truncate text-[10px] text-text-muted">{user?.email}</p>
            </div>
          )}
        </div>
        {collapsed ? null : (
          <>
            <button
              onClick={signOut}
              className="sidebar-sign-out w-full rounded-xl border border-border bg-field px-2 py-1.5 text-xs text-text-muted transition-all duration-200"
            >
              {t('action_sign_out')}
            </button>
            <p className="mt-2 text-[10px] text-text-muted">
              v{appVersion.version} · {appVersion.channel}
            </p>
          </>
        )}
      </div>
    </GlassPanel>
  );
}
