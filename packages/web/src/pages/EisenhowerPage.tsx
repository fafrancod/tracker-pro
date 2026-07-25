import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
} from 'date-fns';
import { Layout } from '@/components/Layout';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import {
  fetchTasksInRange,
  getDayId,
  type LocatedTaskRow,
} from '@core/services/taskService';
import { taskHistory } from '@core/history/taskHistory';
import { isDemoMode } from '@core/lib/demoMode';
import type { Importance, RecurrenceFrequency, Task, Urgency } from '@core/types';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';
import { TaskDetailSheet } from '@/components/Board';
import type { TKey } from '@/lib/i18n';

type QuadrantKey = 'do' | 'schedule' | 'delegate' | 'eliminate';

/** Horizonte de la matriz. */
export type PriorityHorizon = '30d' | 'month' | '3m' | '6m' | '1y';

type MatrixRow = LocatedTaskRow & {
  /** Serie mensual/anual: hay instancia completada en el rango y otra futura pendiente. */
  seriesDoneWithNext?: {
    completedDayId: string;
    nextDayId: string;
    frequency: RecurrenceFrequency;
  } | null;
};

const QUADRANTS: Array<{
  key: QuadrantKey;
  urgency: Urgency;
  importance: Importance;
  titleKey: 'eisenhower_do' | 'eisenhower_schedule' | 'eisenhower_delegate' | 'eisenhower_eliminate';
  accent: string;
}> = [
  {
    key: 'do',
    urgency: 'urgent',
    importance: 'important',
    titleKey: 'eisenhower_do',
    accent: 'border-accent-red/40 bg-accent-red/5',
  },
  {
    key: 'schedule',
    urgency: 'not_urgent',
    importance: 'important',
    titleKey: 'eisenhower_schedule',
    accent: 'border-accent-teal/40 bg-accent-teal/5',
  },
  {
    key: 'delegate',
    urgency: 'urgent',
    importance: 'not_important',
    titleKey: 'eisenhower_delegate',
    accent: 'border-amber-500/40 bg-amber-500/5',
  },
  {
    key: 'eliminate',
    urgency: 'not_urgent',
    importance: 'not_important',
    titleKey: 'eisenhower_eliminate',
    accent: 'border-border bg-surface',
  },
];

const HORIZON_OPTIONS: Array<{ value: PriorityHorizon; labelKey: TKey }> = [
  { value: '30d', labelKey: 'eisenhower_horizon_30d' },
  { value: 'month', labelKey: 'eisenhower_horizon_month' },
  { value: '3m', labelKey: 'eisenhower_horizon_3m' },
  { value: '6m', labelKey: 'eisenhower_horizon_6m' },
  { value: '1y', labelKey: 'eisenhower_horizon_1y' },
];

function formatDayLocal(d: Date): string {
  return getDayId(d);
}

/** Rango visible del horizonte + fetch extendido (para ver la próxima repetición). */
function horizonRanges(horizon: PriorityHorizon, now = new Date()): {
  from: string;
  to: string;
  fetchTo: string;
} {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date;
  let to: Date;
  switch (horizon) {
    case 'month':
      from = startOfMonth(today);
      to = endOfMonth(today);
      break;
    case '3m':
      from = today;
      to = addDays(addMonths(today, 3), -1);
      break;
    case '6m':
      from = today;
      to = addDays(addMonths(today, 6), -1);
      break;
    case '1y':
      from = today;
      to = addDays(addMonths(today, 12), -1);
      break;
    case '30d':
    default:
      from = today;
      to = addDays(today, 29);
      break;
  }
  // Extra mes para detectar “próxima repetición” fuera del horizonte corto
  const fetchTo = addDays(to, 40);
  return {
    from: formatDayLocal(from),
    to: formatDayLocal(to),
    fetchTo: formatDayLocal(fetchTo),
  };
}

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

/**
 * Una fila por serie (o id). En series monthly/yearly:
 * si hay completada en el horizonte y otra futura incompleta → badge.
 */
function buildMatrixRows(
  rows: LocatedTaskRow[],
  horizonFrom: string,
  horizonTo: string,
  _todayId: string
): MatrixRow[] {
  void _todayId;
  const groups = new Map<string, LocatedTaskRow[]>();
  for (const row of rows) {
    const key = row.seriesId ? `series:${row.seriesId}` : `task:${row.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const out: MatrixRow[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.dayId.localeCompare(b.dayId));

    const inHorizon = group.filter(r =>
      overlapsRange(r.dayId, r.endDayId, horizonFrom, horizonTo)
    );
    if (inHorizon.length === 0) continue;

    const freq = group[0].recurrence?.frequency ?? 'none';
    const isPeriodic = freq === 'monthly' || freq === 'yearly';

    // Representante para el chip: incompleta más temprana en horizonte; si no, la más reciente en horizonte
    let display =
      inHorizon.find(r => !r.completed) ??
      [...inHorizon].sort((a, b) => b.dayId.localeCompare(a.dayId))[0];

    let seriesDoneWithNext: MatrixRow['seriesDoneWithNext'] = null;

    if (isPeriodic) {
      const completedInHorizon = inHorizon.filter(r => r.completed);
      // Prefer next incomplete after a completed one for badge
      const latestCompletedInHorizon = [...completedInHorizon].sort((a, b) =>
        b.dayId.localeCompare(a.dayId)
      )[0];
      const nextAfterCompleted = latestCompletedInHorizon
        ? group.find(r => !r.completed && r.dayId > latestCompletedInHorizon.dayId)
        : null;

      if (latestCompletedInHorizon && nextAfterCompleted) {
        seriesDoneWithNext = {
          completedDayId: latestCompletedInHorizon.dayId,
          nextDayId: nextAfterCompleted.dayId,
          frequency: freq,
        };
        // Mostrar la completada del periodo si no hay incompleta DENTRO del horizonte
        // (la próxima está fuera o también en horizonte: preferimos incompleta si está en horizonte)
        const nextInHorizon = nextAfterCompleted.dayId <= horizonTo;
        if (nextInHorizon) {
          display = nextAfterCompleted;
        } else {
          // Próxima fuera del horizonte: mostrar la del periodo (completada) con badge
          display = latestCompletedInHorizon;
        }
      }
    }

    out.push({ ...display, seriesDoneWithNext });
  }
  return out;
}

export function EisenhowerPage() {
  const { t, locale, shortDateFormat } = useT();
  const { projects } = useProjects();
  const { showToast } = useToast();
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const setDayTasks = useStore(s => s.setDayTasks);
  const setDetailTask = useStore(s => s.setDetailTask);

  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [horizon, setHorizon] = useState<PriorityHorizon>('30d');
  const [loading, setLoading] = useState(false);
  const [remoteTasks, setRemoteTasks] = useState<LocatedTaskRow[] | null>(null);

  const ranges = useMemo(() => horizonRanges(horizon), [horizon]);
  const todayId = useMemo(() => formatDayLocal(new Date()), []);

  const load = useCallback(async () => {
    if (!uid || isDemoMode()) {
      setRemoteTasks(null);
      return;
    }
    setLoading(true);
    try {
      // fetchTo incluye margen para la próxima repetición mensual
      const rows = await fetchTasksInRange(uid, ranges.from, ranges.fetchTo);
      setRemoteTasks(rows);
      const byWeekDay = new Map<string, Map<string, Task[]>>();
      for (const row of rows) {
        if (!byWeekDay.has(row.weekId)) byWeekDay.set(row.weekId, new Map());
        const days = byWeekDay.get(row.weekId)!;
        if (!days.has(row.dayId)) days.set(row.dayId, []);
        days.get(row.dayId)!.push(row);
      }
      for (const [weekId, days] of byWeekDay) {
        for (const [dayId, list] of days) {
          setDayTasks(weekId, dayId, list);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('No pude cargar las tareas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [uid, ranges.from, ranges.fetchTo, setDayTasks, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const allLocated = useMemo(() => {
    const raw =
      isDemoMode() || remoteTasks === null
        ? collectFromStore(tasksByDay, ranges.from, ranges.fetchTo)
        : remoteTasks;
    return buildMatrixRows(raw, ranges.from, ranges.to, todayId);
  }, [remoteTasks, tasksByDay, ranges.from, ranges.to, ranges.fetchTo, todayId]);

  const filtered = useMemo(() => {
    return allLocated.filter(t => {
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      return true;
    });
  }, [allLocated, projectFilter]);

  const buckets = useMemo(() => {
    const byQ: Record<QuadrantKey | 'uncategorized', MatrixRow[]> = {
      do: [],
      schedule: [],
      delegate: [],
      eliminate: [],
      uncategorized: [],
    };
    for (const task of filtered) {
      if (!task.urgency || !task.importance) {
        byQ.uncategorized.push(task);
        continue;
      }
      const q = QUADRANTS.find(
        x => x.urgency === task.urgency && x.importance === task.importance
      );
      if (q) byQ[q.key].push(task);
      else byQ.uncategorized.push(task);
    }
    for (const key of Object.keys(byQ) as Array<keyof typeof byQ>) {
      byQ[key].sort((a, b) => Number(a.completed) - Number(b.completed));
    }
    return byQ;
  }, [filtered]);

  const rangeLabel = useMemo(() => {
    try {
      const a = format(new Date(ranges.from + 'T12:00:00'), shortDateFormat, { locale });
      const b = format(new Date(ranges.to + 'T12:00:00'), shortDateFormat, { locale });
      return `${a} – ${b}`;
    } catch {
      return `${ranges.from} – ${ranges.to}`;
    }
  }, [ranges.from, ranges.to, locale, shortDateFormat]);

  async function assignQuadrant(
    loc: MatrixRow,
    urgency: Urgency | null,
    importance: Importance | null
  ) {
    const matchesSeries = (t: LocatedTaskRow | Task) =>
      loc.seriesId ? t.seriesId === loc.seriesId : t.id === loc.id;

    setRemoteTasks(prev =>
      prev
        ? prev.map(t => (matchesSeries(t) ? { ...t, urgency, importance } : t))
        : prev
    );

    try {
      await taskHistory.update(loc.weekId, loc.dayId, loc.id, {
        urgency,
        importance,
        applyTo: loc.seriesId ? 'series' : 'instance',
      });
    } catch {
      setRemoteTasks(prev =>
        prev
          ? prev.map(t =>
              matchesSeries(t)
                ? { ...t, urgency: loc.urgency, importance: loc.importance }
                : t
            )
          : prev
      );
      showToast('No pude guardar la clasificación.', 'error');
    }
  }

  function formatShortDay(dayId: string): string {
    try {
      return format(new Date(dayId + 'T12:00:00'), shortDateFormat, { locale });
    } catch {
      return dayId;
    }
  }

  function TaskChip({ loc }: { loc: MatrixRow }) {
    const project = projects.find(p => p.id === loc.projectId);
    const badge = loc.seriesDoneWithNext;
    return (
      <button
        type="button"
        onClick={() =>
          setDetailTask({ weekId: loc.weekId, dayId: loc.dayId, taskId: loc.id })
        }
        onDragStart={e => {
          e.dataTransfer.setData(
            'application/x-task-loc',
            JSON.stringify({
              id: loc.id,
              weekId: loc.weekId,
              dayId: loc.dayId,
            })
          );
          e.dataTransfer.effectAllowed = 'move';
        }}
        draggable
        className={cn(
          'w-full rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs transition-colors hover:border-accent-teal/40',
          loc.completed && !badge && 'opacity-60 line-through',
          loc.completed && badge && 'opacity-90'
        )}
        style={project ? { borderLeft: `3px solid ${project.color}` } : undefined}
      >
        <span
          className={cn(
            'block truncate text-text-primary',
            loc.completed && !badge && 'line-through'
          )}
        >
          {loc.title}
        </span>
        {project && (
          <span className="mt-0.5 block truncate text-[10px] text-text-muted">
            {project.icon} {project.name}
          </span>
        )}
        <span className="mt-0.5 block text-[10px] text-text-muted">
          {formatShortDay(loc.dayId)}
          {loc.endDayId && loc.endDayId !== loc.dayId
            ? ` – ${formatShortDay(loc.endDayId)}`
            : ''}
        </span>
        {badge && (
          <span
            className="mt-1 inline-flex flex-wrap items-center gap-1 rounded-md border border-accent-teal/30 bg-accent-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-teal"
            title={t('eisenhower_series_done_next_title')
              .replace('{done}', formatShortDay(badge.completedDayId))
              .replace('{next}', formatShortDay(badge.nextDayId))}
          >
            <span className="text-accent-green">✓ {t('eisenhower_series_done_period')}</span>
            <span className="text-text-muted">·</span>
            <span>
              {t('eisenhower_series_next')}: {formatShortDay(badge.nextDayId)}
            </span>
          </span>
        )}
      </button>
    );
  }

  function onDropQuadrant(
    e: React.DragEvent,
    urgency: Urgency,
    importance: Importance
  ) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-task-loc');
    if (!raw) return;
    try {
      const { id } = JSON.parse(raw) as { id: string };
      const loc = filtered.find(t => t.id === id);
      if (!loc) return;
      void assignQuadrant(loc, urgency, importance);
    } catch {
      // ignore
    }
  }

  return (
    <Layout title={t('eisenhower_title')} showFab={false}>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            {t('eisenhower_horizon')}
            <select
              value={horizon}
              onChange={e => setHorizon(e.target.value as PriorityHorizon)}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {HORIZON_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <span className="text-[11px] tabular-nums text-text-muted">{rangeLabel}</span>

          <label className="flex items-center gap-2 text-xs text-text-muted">
            {t('eisenhower_project')}
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">{t('eisenhower_all_projects')}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </label>
          {loading && (
            <span className="text-[11px] text-text-muted">{t('status_checking')}</span>
          )}
          <p className="w-full text-[11px] text-text-muted md:ml-auto md:w-auto">
            {t('eisenhower_hint')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2">
            {QUADRANTS.map(q => (
              <section
                key={q.key}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onDropQuadrant(e, q.urgency, q.importance)}
                className={cn(
                  'flex min-h-[180px] flex-col rounded-lg border p-3',
                  q.accent
                )}
              >
                <header className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-text-primary">
                    {t(q.titleKey)}
                  </h2>
                  <span className="text-[10px] tabular-nums text-text-muted">
                    {buckets[q.key].length}
                  </span>
                </header>
                <div className="flex flex-1 flex-col gap-1.5">
                  {buckets[q.key].length === 0 ? (
                    <p className="text-[11px] text-text-muted">{t('eisenhower_empty')}</p>
                  ) : (
                    buckets[q.key].map(loc => (
                      <div key={loc.id} className="flex gap-1">
                        <div className="min-w-0 flex-1">
                          <TaskChip loc={loc} />
                        </div>
                        <button
                          type="button"
                          title={t(q.titleKey)}
                          className="shrink-0 rounded border border-border px-1.5 text-[10px] text-text-muted hover:bg-background"
                          onClick={() =>
                            void assignQuadrant(loc, q.urgency, q.importance)
                          }
                        >
                          →
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>

          <section className="mx-auto mt-4 max-w-5xl rounded-lg border border-dashed border-border p-3">
            <h2 className="mb-2 text-sm font-semibold text-text-primary">
              {t('eisenhower_uncategorized')}
            </h2>
            {buckets.uncategorized.length === 0 ? (
              <p className="text-[11px] text-text-muted">{t('eisenhower_empty')}</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {buckets.uncategorized.map(loc => (
                  <div key={loc.id} className="flex flex-col gap-1">
                    <TaskChip loc={loc} />
                    <div className="flex flex-wrap gap-1">
                      {QUADRANTS.map(q => (
                        <button
                          key={q.key}
                          type="button"
                          className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-text-muted hover:border-accent-teal/40 hover:text-text-primary"
                          onClick={() =>
                            void assignQuadrant(loc, q.urgency, q.importance)
                          }
                        >
                          {t(q.titleKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <TaskDetailSheet />
    </Layout>
  );
}
