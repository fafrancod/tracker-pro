import { useMemo, useState } from 'react';
import {
  CalendarHeart,
  Check,
  CheckSquare,
  ChevronDown,
  Flag,
  FolderKanban,
  Leaf,
  MapPin,
  Wallet,
} from 'lucide-react';
import type { Importance, Project, Urgency } from '@core/types';
import type { BoardKindGroup, BoardTaskFilters } from '@core/types';
import {
  BOARD_NO_PROJECT,
  resolvedKindGroups,
  toggleKindGroup,
  toggleProjectKey,
} from '@core/lib/boardFilters';
import { useT } from '@/hooks/useT';
import type { TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  tintEventActive,
  tintHabitActive,
  tintHoliday,
  tintPossibleActive,
} from '@/lib/tintClasses';
import { CycleSelect } from '@/components/ui/cycle-select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const KIND_TABS: Array<{
  value: BoardKindGroup;
  labelKey: TKey;
  icon: typeof CheckSquare;
  onClass: string;
}> = [
  {
    value: 'tasks',
    labelKey: 'board_filter_kind_tasks',
    icon: CheckSquare,
    onClass: 'border-accent-teal/45 bg-accent-teal/15 text-accent-teal',
  },
  {
    value: 'events',
    labelKey: 'board_filter_category_events',
    icon: MapPin,
    onClass: tintEventActive,
  },
  {
    value: 'possible',
    labelKey: 'board_filter_category_possible',
    icon: CalendarHeart,
    onClass: tintPossibleActive,
  },
  {
    value: 'habits',
    labelKey: 'board_filter_category_habits',
    icon: Leaf,
    onClass: tintHabitActive,
  },
  {
    value: 'finances',
    labelKey: 'board_filter_category_finances',
    icon: Wallet,
    onClass: 'border-accent-teal/45 bg-accent-teal/15 text-accent-teal',
  },
  {
    value: 'holidays',
    labelKey: 'board_filter_category_holidays',
    icon: Flag,
    onClass: tintHoliday,
  },
];

interface BoardFilterBarProps {
  filters: BoardTaskFilters;
  projects: Project[];
  onChange: (next: BoardTaskFilters) => void;
}

export function BoardFilterBar({ filters, projects, onChange }: BoardFilterBarProps) {
  const { t } = useT();
  const [projectsOpen, setProjectsOpen] = useState(false);

  const activeKinds = resolvedKindGroups(filters);
  const allKeys = useMemo(
    () => [BOARD_NO_PROJECT, ...projects.map(p => p.id)],
    [projects]
  );
  const selectedProjectIds =
    filters.projectIds && filters.projectIds !== 'all' ? filters.projectIds : null;
  const allProjectsOn = !selectedProjectIds;

  function isKindOn(group: BoardKindGroup): boolean {
    return activeKinds === 'all' || activeKinds.includes(group);
  }

  function isProjectOn(key: string): boolean {
    return allProjectsOn || Boolean(selectedProjectIds?.includes(key));
  }

  function onToggleKind(group: BoardKindGroup) {
    const kinds = toggleKindGroup(
      activeKinds === 'all' ? 'all' : activeKinds,
      group
    );
    onChange({ ...filters, kinds, category: 'all' });
  }

  function onToggleProject(key: string) {
    const projectIds = toggleProjectKey(
      filters.projectIds ?? 'all',
      key,
      allKeys
    );
    onChange({ ...filters, projectIds, projectId: 'all' });
  }

  const projectTriggerLabel = (() => {
    if (allProjectsOn) return t('board_filter_all_projects');
    if (selectedProjectIds.length === 1) {
      const id = selectedProjectIds[0];
      if (id === BOARD_NO_PROJECT) return t('task_no_project');
      const p = projects.find(x => x.id === id);
      return p ? `${p.icon} ${p.name}` : t('board_filter_all_projects');
    }
    if (selectedProjectIds.length === 0) return t('eisenhower_deselect_all');
    return t('board_filter_projects_n').replace(
      '{n}',
      String(selectedProjectIds.length)
    );
  })();

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface/40 px-2 py-2 md:px-3">
      {/*
        The project and priority controls have a predictable width, while the
        six kind filters do not. Keeping all of them in one wrapping row made
        the kind filters collapse into a tall, narrow column in desktop widths
        where the sidebar is still open. Give filters their own horizontal row
        so the calendar keeps the vertical room it needs.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu open={projectsOpen} onOpenChange={setProjectsOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('board_filter_project')}
              className={cn(
                'inline-flex h-9 min-w-[13.5rem] max-w-full items-center gap-2 rounded-xl border bg-field px-2.5 text-left text-sm shadow-sm transition-colors',
                'hover:border-accent-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/30',
                allProjectsOn
                  ? 'border-border text-text-primary'
                  : 'border-accent-teal/40 text-text-primary'
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  allProjectsOn ? 'bg-background text-text-muted' : 'bg-accent-teal/15 text-accent-teal'
                )}
              >
                <FolderKanban className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {projectTriggerLabel}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-1.5"
          >
            <div className="mb-1 flex gap-1 px-0.5">
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filters, projectIds: 'all', projectId: 'all' })
                }
                className={cn(
                  'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
                  allProjectsOn
                    ? 'bg-accent-teal/15 text-accent-teal'
                    : 'text-text-muted hover:bg-background hover:text-text-primary'
                )}
              >
                {t('eisenhower_select_all')}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filters, projectIds: [], projectId: 'all' })
                }
                className="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-text-muted hover:bg-background hover:text-text-primary"
              >
                {t('eisenhower_deselect_all')}
              </button>
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-64 overflow-y-auto py-1">
              <ProjectCheckRow
                checked={isProjectOn(BOARD_NO_PROJECT)}
                label={t('task_no_project')}
                muted
                onToggle={() => onToggleProject(BOARD_NO_PROJECT)}
              />
              {projects.map(p => (
                <ProjectCheckRow
                  key={p.id}
                  checked={isProjectOn(p.id)}
                  label={`${p.icon} ${p.name}`}
                  color={p.color}
                  onToggle={() => onToggleProject(p.id)}
                />
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <CycleSelect
            aria-label={t('board_filter_urgency')}
            value={filters.urgency ?? 'all'}
            options={[
              { value: 'all', label: t('board_filter_urgency') },
              { value: 'urgent', label: t('urgency_urgent') },
              { value: 'not_urgent', label: t('urgency_not_urgent') },
            ]}
            onChange={v =>
              onChange({ ...filters, urgency: v as Urgency | 'all' })
            }
          />
          <CycleSelect
            aria-label={t('board_filter_importance')}
            value={filters.importance ?? 'all'}
            options={[
              { value: 'all', label: t('board_filter_importance') },
              { value: 'important', label: t('importance_important') },
              { value: 'not_important', label: t('importance_not_important') },
            ]}
            onChange={v =>
              onChange({ ...filters, importance: v as Importance | 'all' })
            }
          />
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {t('board_filter_show')}
        </span>
        <div
          className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
          role="group"
          aria-label={t('board_filter_kinds')}
        >
          {KIND_TABS.map(tab => {
            const Icon = tab.icon;
            const on = isKindOn(tab.value);
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={on}
                title={
                  on
                    ? `${t(tab.labelKey)} · on`
                    : `${t(tab.labelKey)} · off`
                }
                onClick={() => onToggleKind(tab.value)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all',
                  on
                    ? tab.onClass
                    : 'border-border/80 bg-transparent text-text-muted/70 hover:border-border hover:text-text-muted'
                )}
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
                    on
                      ? 'border-current bg-current/20'
                      : 'border-current/40 bg-transparent'
                  )}
                >
                  {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectCheckRow({
  checked,
  label,
  color,
  muted,
  onToggle,
}: {
  checked: boolean;
  label: string;
  color?: string;
  muted?: boolean;
  onToggle: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={e => {
        e.preventDefault();
        onToggle();
      }}
      className="cursor-pointer rounded-lg px-2 py-2"
    >
      <span
        className={cn(
          'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border',
          checked
            ? 'border-accent-teal bg-accent-teal text-white'
            : 'border-border bg-field'
        )}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      {color ? (
        <span
          className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className={cn('min-w-0 truncate', muted && 'text-text-muted')}>
        {label}
      </span>
    </DropdownMenuItem>
  );
}
