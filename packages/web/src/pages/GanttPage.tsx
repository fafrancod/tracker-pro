import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { GanttChart } from '@/components/Gantt';
import { TaskDetailSheet } from '@/components/Board';
import { CycleSelect } from '@/components/ui/cycle-select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import { useT } from '@/hooks/useT';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/contexts/ToastContext';
import { isDemoMode } from '@core/lib/demoMode';
import { todayDayId } from '@core/lib/civilDate';
import {
  fetchAllTasks,
  fetchTasksInRange,
  mergeLocatedRowsIntoStore,
  type LocatedTaskRow,
} from '@core/services/taskService';
import type { Task } from '@core/types';
import { renameProjectCategory } from '@core/lib/projectCategories';
import {
  buildGanttGroups,
  ganttDisplayRange,
  ganttHorizonWindow,
  collapseGanttSeries,
  toGanttItem,
  type GanttHorizon,
  type GanttItem,
  type GanttKind,
  type GanttScale,
} from '@core/lib/gantt';

const LIFE_SCOPE = '__life__';

type KindFilter = 'all' | 'tasks' | 'events' | 'possible';

const KIND_MAP: Record<KindFilter, readonly GanttKind[] | undefined> = {
  all: undefined,
  tasks: ['task', 'reminder'],
  events: ['event'],
  possible: ['possible_event'],
};

function overlapsRange(dayId: string, endDayId: string | undefined, from: string, to: string): boolean {
  const end = endDayId && endDayId >= dayId ? endDayId : dayId;
  return dayId <= to && end >= from;
}

function collectFromStore(
  tasksByDay: Record<string, Record<string, Task[]>>,
  from: string,
  to: string
): LocatedTaskRow[] {
  const result: LocatedTaskRow[] = [];
  const seen = new Set<string>();
  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [dayId, tasks] of Object.entries(days)) {
      for (const task of tasks) {
        if (seen.has(task.id)) continue;
        const end = task.endDayId || dayId;
        if (!overlapsRange(dayId, end, from, to)) continue;
        seen.add(task.id);
        result.push({ ...task, weekId, dayId });
      }
    }
  }
  return result;
}

export function GanttPage() {
  const { projectId: projectIdParam } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const { t, locale } = useT();
  const { settings } = useSettings();
  const { projects, editProject } = useProjects();
  const { showToast } = useToast();
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const setDetailTask = useStore(s => s.setDetailTask);

  const [horizon, setHorizon] = useState<GanttHorizon>('1y');
  const [scale, setScale] = useState<GanttScale>('week');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [remoteRows, setRemoteRows] = useState<LocatedTaskRow[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [focusNonce, setFocusNonce] = useState(0);

  const todayId = useMemo(
    () => todayDayId(settings.timezone),
    [settings.timezone]
  );

  const scopedProject = projectIdParam
    ? projects.find(p => p.id === projectIdParam) ?? null
    : null;
  const scopedProjectId = projectIdParam ?? undefined;

  const fetchWindow = useMemo(
    () => ganttHorizonWindow(todayId, horizon),
    [todayId, horizon]
  );

  const load = useCallback(async () => {
    if (!uid || isDemoMode()) {
      setRemoteRows(null);
      return;
    }
    setLoading(true);
    try {
      const rows = fetchWindow
        ? await fetchTasksInRange(uid, fetchWindow.from, fetchWindow.to)
        : await fetchAllTasks(uid, scopedProjectId ? { projectId: scopedProjectId } : undefined);
      setRemoteRows(rows);
      mergeLocatedRowsIntoStore(rows);
    } catch (err) {
      console.error(err);
      showToast(t('gantt_load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [uid, fetchWindow, scopedProjectId, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const located = useMemo(() => {
    if (isDemoMode() || remoteRows === null) {
      if (fetchWindow) {
        return collectFromStore(tasksByDay, fetchWindow.from, fetchWindow.to);
      }
      const all: LocatedTaskRow[] = [];
      const seen = new Set<string>();
      for (const [weekId, days] of Object.entries(tasksByDay)) {
        for (const [dayId, tasks] of Object.entries(days)) {
          for (const task of tasks) {
            if (seen.has(task.id)) continue;
            seen.add(task.id);
            all.push({ ...task, weekId, dayId });
          }
        }
      }
      return all;
    }
    return remoteRows;
  }, [remoteRows, tasksByDay, fetchWindow]);

  const ganttItems = useMemo(() => {
    const items: GanttItem[] = [];
    for (const row of located) {
      const item = toGanttItem(row);
      if (item) items.push(item);
    }
    return collapseGanttSeries(items);
  }, [located]);

  const groups = useMemo(
    () =>
      buildGanttGroups(ganttItems, projects, {
        projectId: scopedProjectId,
        kinds: KIND_MAP[kindFilter],
        includeCompleted,
        unlabeledProject: t('gantt_no_project'),
        unlabeledCategory: t('gantt_no_subproject'),
      }),
    [ganttItems, projects, scopedProjectId, kindFilter, includeCompleted, t]
  );

  const visibleItems = useMemo(
    () => groups.flatMap(g => g.categories.flatMap(c => c.items)),
    [groups]
  );

  const displayRange = useMemo(
    () => ganttDisplayRange(visibleItems, todayId, horizon),
    [visibleItems, todayId, horizon]
  );

  function toggleCollapsed(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openItem(item: GanttItem) {
    setDetailTask({ weekId: item.weekId, dayId: item.startDayId, taskId: item.id });
  }

  async function renameCategory(projectId: string, categoryId: string, name: string) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const next = renameProjectCategory(project.categories, categoryId, name);
    if (!next || next === project.categories) return;
    try {
      await editProject(projectId, { categories: next });
    } catch {
      showToast(t('gantt_rename_error'), 'error');
    }
  }

  const title = scopedProject
    ? t('gantt_project_title').replace('{name}', scopedProject.name)
    : projectIdParam
      ? t('gantt_project_title').replace('{name}', t('gantt_no_project'))
      : t('gantt_life_title');

  const scopeValue = projectIdParam ?? LIFE_SCOPE;
  const scopeOptions = [
    { value: LIFE_SCOPE, label: t('gantt_life') },
    ...projects.map(p => ({ value: p.id, label: p.name })),
  ];

  const kindOptions: Array<{ value: KindFilter; label: string }> = [
    { value: 'all', label: t('gantt_filter_all') },
    { value: 'tasks', label: t('gantt_filter_tasks') },
    { value: 'events', label: t('gantt_filter_events') },
    { value: 'possible', label: t('gantt_filter_possible') },
  ];

  return (
    <Layout title={title} showFab={false}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 md:px-4">
          <CycleSelect
            aria-label={t('gantt_scope')}
            value={scopeValue}
            options={scopeOptions}
            onChange={v => {
              if (v === LIFE_SCOPE) navigate('/gantt');
              else navigate(`/gantt/${v}`);
            }}
            selectClassName="max-w-[180px]"
          />
          <CycleSelect
            aria-label={t('gantt_horizon')}
            value={horizon}
            options={[
              { value: '3m', label: t('gantt_horizon_3m') },
              { value: '6m', label: t('gantt_horizon_6m') },
              { value: '1y', label: t('gantt_horizon_1y') },
              { value: '2y', label: t('gantt_horizon_2y') },
              { value: 'all', label: t('gantt_horizon_all') },
            ]}
            onChange={v => setHorizon(v as GanttHorizon)}
          />
          <CycleSelect
            aria-label={t('gantt_scale')}
            value={scale}
            options={[
              { value: 'day', label: t('gantt_scale_day') },
              { value: 'week', label: t('gantt_scale_week') },
              { value: 'month', label: t('gantt_scale_month') },
            ]}
            onChange={v => setScale(v as GanttScale)}
          />
          <div
            className="inline-flex overflow-hidden rounded-lg border border-border"
            role="group"
            aria-label={t('gantt_filter_kind')}
          >
            {kindOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKindFilter(opt.value)}
                className={cn(
                  'px-2 py-1.5 text-[11px] font-medium transition-colors sm:py-1',
                  kindFilter === opt.value
                    ? 'bg-accent-teal/15 text-accent-teal'
                    : 'text-text-muted hover:bg-background hover:text-text-primary'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-text-muted">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-border accent-teal-500"
              checked={includeCompleted}
              onChange={e => setIncludeCompleted(e.target.checked)}
            />
            {t('gantt_show_completed')}
          </label>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
          <div className="ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFocusNonce(n => n + 1)}
            >
              {t('gantt_today')}
            </Button>
          </div>
        </div>

        <GanttChart
          groups={groups}
          rangeFrom={displayRange.from}
          rangeTo={displayRange.to}
          todayId={todayId}
          scale={scale}
          locale={locale}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          onItemClick={openItem}
          onRenameCategory={renameCategory}
          showProjectHeaders={!projectIdParam}
          todayLabel={t('gantt_today')}
          itemsCountLabel={n => t('gantt_items_count').replace('{n}', String(n))}
          emptyTitle={t('gantt_empty')}
          emptyHint={t('gantt_empty_hint')}
          seriesCountLabel={n => t('gantt_series_count').replace('{n}', String(n))}
          focusNonce={focusNonce}
        />
      </div>
      <TaskDetailSheet />
    </Layout>
  );
}
