import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import { fetchAllTasks, type LocatedTaskRow } from '@core/services/taskService';
import { taskHistory } from '@core/history/taskHistory';
import { isDemoMode } from '@core/lib/demoMode';
import type { Importance, Task, Urgency } from '@core/types';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';
import { TaskDetailSheet } from '@/components/Board';

type QuadrantKey = 'do' | 'schedule' | 'delegate' | 'eliminate';

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

function collectFromStore(
  tasksByDay: Record<string, Record<string, Task[]>>
): LocatedTaskRow[] {
  const result: LocatedTaskRow[] = [];
  const seen = new Set<string>();
  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [dayId, tasks] of Object.entries(days)) {
      for (const task of tasks) {
        if (seen.has(task.id)) continue;
        seen.add(task.id);
        result.push({ ...task, weekId, dayId });
      }
    }
  }
  return result;
}

/**
 * Una fila por serie de recurrencia (o por id si no hay seriesId).
 * Preferimos la instancia incompleta más temprana; si todas están hechas, la más temprana.
 */
function dedupeRecurringSeries(rows: LocatedTaskRow[]): LocatedTaskRow[] {
  const byKey = new Map<string, LocatedTaskRow>();
  for (const row of rows) {
    const key = row.seriesId ? `series:${row.seriesId}` : `task:${row.id}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    // Prefer incomplete over completed
    if (prev.completed && !row.completed) {
      byKey.set(key, row);
      continue;
    }
    if (!prev.completed && row.completed) continue;
    // Same completion state → earliest start day
    if (row.dayId < prev.dayId) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export function EisenhowerPage() {
  const { t } = useT();
  const { projects } = useProjects();
  const { showToast } = useToast();
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const setDayTasks = useStore(s => s.setDayTasks);
  const setDetailTask = useStore(s => s.setDetailTask);

  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [remoteTasks, setRemoteTasks] = useState<LocatedTaskRow[] | null>(null);

  const load = useCallback(async () => {
    if (!uid || isDemoMode()) {
      setRemoteTasks(null);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchAllTasks(uid);
      setRemoteTasks(rows);
      // Merge into store for detail sheet / consistency
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
  }, [uid, setDayTasks, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const allLocated = useMemo(() => {
    const raw =
      isDemoMode() || remoteTasks === null
        ? collectFromStore(tasksByDay)
        : remoteTasks;
    return dedupeRecurringSeries(raw);
  }, [remoteTasks, tasksByDay]);

  const filtered = useMemo(() => {
    return allLocated.filter(t => {
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      return true;
    });
  }, [allLocated, projectFilter]);

  const buckets = useMemo(() => {
    const byQ: Record<QuadrantKey | 'uncategorized', LocatedTaskRow[]> = {
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
    // Incomplete first
    for (const key of Object.keys(byQ) as Array<keyof typeof byQ>) {
      byQ[key].sort((a, b) => Number(a.completed) - Number(b.completed));
    }
    return byQ;
  }, [filtered]);

  async function assignQuadrant(
    loc: LocatedTaskRow,
    urgency: Urgency | null,
    importance: Importance | null
  ) {
    // Toda la serie de recurrencia comparte la misma clasificación Eisenhower.
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

  function TaskChip({ loc }: { loc: LocatedTaskRow }) {
    const project = projects.find(p => p.id === loc.projectId);
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
          loc.completed && 'opacity-60 line-through'
        )}
        style={
          project ? { borderLeft: `3px solid ${project.color}` } : undefined
        }
      >
        <span className="block truncate text-text-primary">{loc.title}</span>
        {project && (
          <span className="mt-0.5 block truncate text-[10px] text-text-muted">
            {project.icon} {project.name}
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
          <p className="w-full text-[11px] text-text-muted md:w-auto md:ml-auto">
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
                <header className="mb-2">
                  <h2 className="text-sm font-semibold text-text-primary">
                    {t(q.titleKey)}
                  </h2>
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
