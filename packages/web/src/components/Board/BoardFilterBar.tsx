import { useMemo, useState } from 'react';
import {
  CalendarHeart,
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
  tintEvent,
  tintHabit,
  tintHoliday,
  tintPossible,
} from '@/lib/tintClasses';
import { Button } from '@/components/ui/button';
import { CycleSelect } from '@/components/ui/cycle-select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const KIND_TABS: Array<{
  value: BoardKindGroup;
  labelKey: TKey;
  icon: typeof CheckSquare;
  activeClass: string;
}> = [
  {
    value: 'tasks',
    labelKey: 'board_filter_kind_tasks',
    icon: CheckSquare,
    activeClass: 'bg-accent-teal/15 text-accent-teal',
  },
  {
    value: 'events',
    labelKey: 'board_filter_category_events',
    icon: MapPin,
    activeClass: tintEvent,
  },
  {
    value: 'possible',
    labelKey: 'board_filter_category_possible',
    icon: CalendarHeart,
    activeClass: tintPossible,
  },
  {
    value: 'habits',
    labelKey: 'board_filter_category_habits',
    icon: Leaf,
    activeClass: tintHabit,
  },
  {
    value: 'finances',
    labelKey: 'board_filter_category_finances',
    icon: Wallet,
    activeClass: 'bg-accent-teal/15 text-accent-teal',
  },
  {
    value: 'holidays',
    labelKey: 'board_filter_category_holidays',
    icon: Flag,
    activeClass: tintHoliday,
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
  const selectedCount = selectedProjectIds?.length ?? allKeys.length;

  function isKindOn(group: BoardKindGroup): boolean {
    return activeKinds === 'all' || activeKinds.includes(group);
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

  function selectAllProjects() {
    onChange({ ...filters, projectIds: 'all', projectId: 'all' });
  }

  function selectNoProjects() {
    onChange({ ...filters, projectIds: [], projectId: 'all' });
  }

  const projectTriggerLabel = (() => {
    if (allProjectsOn) return t('board_filter_category_projects');
    if (selectedProjectIds.length === 1) {
      const id = selectedProjectIds[0];
      if (id === BOARD_NO_PROJECT) return t('task_no_project');
      const p = projects.find(x => x.id === id);
      return p ? `${p.icon} ${p.name}` : t('board_filter_category_projects');
    }
    return t('board_filter_projects_n').replace('{n}', String(selectedCount));
  })();

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface/60 px-2 py-2 md:flex-row md:items-center md:px-3">
      <div
        className="flex w-full flex-wrap gap-1 sm:w-auto"
        role="group"
        aria-label={t('board_filter_kinds')}
      >
        {KIND_TABS.map(tab => {
          const Icon = tab.icon;
          const active = isKindOn(tab.value);
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleKind(tab.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? cn('border-transparent', tab.activeClass)
                  : 'border-border bg-background text-text-muted hover:bg-surface hover:text-text-primary'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 md:ml-auto">
        <DropdownMenu open={projectsOpen} onOpenChange={setProjectsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-8 gap-1.5 text-xs',
                !allProjectsOn && 'border-accent-teal/40 bg-accent-teal/10 text-accent-teal'
              )}
              aria-label={t('board_filter_project')}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              {projectTriggerLabel}
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
            <DropdownMenuLabel>{t('board_filter_project')}</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={e => {
                e.preventDefault();
                selectAllProjects();
              }}
            >
              {t('eisenhower_select_all')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={e => {
                e.preventDefault();
                selectNoProjects();
              }}
            >
              {t('eisenhower_deselect_all')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={allProjectsOn || Boolean(selectedProjectIds?.includes(BOARD_NO_PROJECT))}
              onCheckedChange={() => onToggleProject(BOARD_NO_PROJECT)}
              onSelect={e => e.preventDefault()}
            >
              <span className="text-text-muted">{t('task_no_project')}</span>
            </DropdownMenuCheckboxItem>
            {projects.map(p => (
              <DropdownMenuCheckboxItem
                key={p.id}
                checked={allProjectsOn || Boolean(selectedProjectIds?.includes(p.id))}
                onCheckedChange={() => onToggleProject(p.id)}
                onSelect={e => e.preventDefault()}
              >
                <span
                  className="mr-2 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.icon} {p.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1">
          <span className="hidden text-[10px] text-text-muted sm:inline">
            {t('board_filter_urgency')}
          </span>
          <CycleSelect
            aria-label={t('board_filter_urgency')}
            value={filters.urgency ?? 'all'}
            options={[
              { value: 'all', label: t('board_filter_all') },
              { value: 'urgent', label: t('urgency_urgent') },
              { value: 'not_urgent', label: t('urgency_not_urgent') },
            ]}
            onChange={v =>
              onChange({ ...filters, urgency: v as Urgency | 'all' })
            }
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden text-[10px] text-text-muted sm:inline">
            {t('board_filter_importance')}
          </span>
          <CycleSelect
            aria-label={t('board_filter_importance')}
            value={filters.importance ?? 'all'}
            options={[
              { value: 'all', label: t('board_filter_all') },
              { value: 'important', label: t('importance_important') },
              { value: 'not_important', label: t('importance_not_important') },
            ]}
            onChange={v =>
              onChange({ ...filters, importance: v as Importance | 'all' })
            }
          />
        </div>
      </div>
    </div>
  );
}
