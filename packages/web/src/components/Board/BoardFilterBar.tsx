import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
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

function projectTintStyle(color: string | undefined, on: boolean): CSSProperties | undefined {
  if (!on || !color) return undefined;
  return {
    borderColor: color,
    backgroundColor: `${color}26`,
    color,
  };
}

export function BoardFilterBar({ filters, projects, onChange }: BoardFilterBarProps) {
  const { t } = useT();
  const selectedProjectIds =
    filters.projectIds && filters.projectIds !== 'all' ? filters.projectIds : null;
  const allProjectsOn = !selectedProjectIds;
  const [projectsOpen, setProjectsOpen] = useState(
    () => Boolean(selectedProjectIds)
  );

  const activeKinds = resolvedKindGroups(filters);
  const allKeys = useMemo(
    () => [BOARD_NO_PROJECT, ...projects.map(p => p.id)],
    [projects]
  );

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

  const noneProjectsOn = selectedProjectIds !== null && selectedProjectIds.length === 0;

  const projectTriggerLabel = (() => {
    if (allProjectsOn) return t('board_filter_all_projects');
    if (noneProjectsOn) return t('board_filter_none_projects');
    if (selectedProjectIds.length === 1) {
      const id = selectedProjectIds[0];
      if (id === BOARD_NO_PROJECT) return t('task_no_project');
      const p = projects.find(x => x.id === id);
      return p ? `${p.icon} ${p.name}` : t('board_filter_all_projects');
    }
    return t('board_filter_projects_n').replace(
      '{n}',
      String(selectedProjectIds.length)
    );
  })();

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface/40 px-2 py-2 md:px-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={projectsOpen}
          aria-controls={projectsOpen ? 'board-project-filters' : undefined}
          aria-label={t('board_filter_category_projects')}
          title={
            projectsOpen
              ? t('board_filter_collapse_projects')
              : t('board_filter_expand_projects')
          }
          onClick={() => setProjectsOpen(open => !open)}
          className={cn(
            'inline-flex h-9 max-w-full items-center gap-2 rounded-xl border bg-field px-2.5 text-left text-sm shadow-sm transition-colors',
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
          <span className="min-w-0 truncate font-medium">{projectTriggerLabel}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-text-muted transition-transform',
              projectsOpen && 'rotate-180'
            )}
          />
        </button>

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

      {projectsOpen ? (
        <div className="flex min-w-0 items-center gap-2" id="board-project-filters">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('board_filter_category_projects')}
          </span>
          <div
            className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
            role="group"
            aria-label={t('board_filter_category_projects')}
          >
            <button
              type="button"
              aria-pressed={allProjectsOn}
              onClick={() =>
                onChange({ ...filters, projectIds: 'all', projectId: 'all' })
              }
              className={cn(
                'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-all',
                allProjectsOn
                  ? 'border-accent-teal/45 bg-accent-teal/15 text-accent-teal'
                  : 'border-border/80 bg-transparent text-text-muted/70 hover:border-border hover:text-text-muted'
              )}
            >
              {t('board_filter_all')}
            </button>
            <button
              type="button"
              aria-pressed={noneProjectsOn}
              onClick={() =>
                onChange({ ...filters, projectIds: [], projectId: 'all' })
              }
              className={cn(
                'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-all',
                noneProjectsOn
                  ? 'border-accent-teal/45 bg-accent-teal/15 text-accent-teal'
                  : 'border-border/80 bg-transparent text-text-muted/70 hover:border-border hover:text-text-muted'
              )}
            >
              {t('board_filter_none')}
            </button>
            <FilterChip
              pressed={isProjectOn(BOARD_NO_PROJECT)}
              title={t('task_no_project')}
              onClick={() => onToggleProject(BOARD_NO_PROJECT)}
            >
              {t('task_no_project')}
            </FilterChip>
            {projects.map(p => (
              <FilterChip
                key={p.id}
                pressed={isProjectOn(p.id)}
                title={p.name}
                onClass="border-current"
                style={projectTintStyle(p.color, isProjectOn(p.id))}
                onClick={() => onToggleProject(p.id)}
              >
                {p.color ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                ) : null}
                <span>
                  {p.icon} {p.name}
                </span>
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

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
              <FilterChip
                key={tab.value}
                pressed={on}
                title={
                  on
                    ? `${t(tab.labelKey)} · on`
                    : `${t(tab.labelKey)} · off`
                }
                onClass={tab.onClass}
                onClick={() => onToggleKind(tab.value)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{t(tab.labelKey)}</span>
              </FilterChip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  pressed,
  onClick,
  title,
  onClass,
  style,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  title: string;
  onClass?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      style={style}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all',
        pressed
          ? onClass ?? 'border-accent-teal/45 bg-accent-teal/15 text-accent-teal'
          : 'border-border/80 bg-transparent text-text-muted/70 hover:border-border hover:text-text-muted'
      )}
    >
      <span
        className={cn(
          'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
          pressed
            ? 'border-current bg-current/20'
            : 'border-current/40 bg-transparent'
        )}
      >
        {pressed ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
      </span>
      {children}
    </button>
  );
}
