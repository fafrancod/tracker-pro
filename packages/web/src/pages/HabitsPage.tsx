import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Flame,
  Loader2,
  Pencil,
  Repeat2,
  Sprout,
  Target,
  Timer,
  Trash2,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  HabitFormDialog,
  recurrenceFromForm,
  type HabitFormValue,
} from '@/components/Habits/HabitFormDialog';
import { useTasks } from '@core/hooks/useTasks';
import { useStore } from '@core/store';
import {
  deleteTask,
  deleteTaskSeries,
  ensureHabitInstance,
  fetchAllTasks,
  getDayId,
  getWeekId,
  mergeLocatedRowsIntoStore,
  updateTask,
  type LocatedTaskRow,
} from '@core/services/taskService';
import { isDemoMode } from '@core/lib/demoMode';
import { todayCivilDate } from '@core/lib/civilDate';
import { addDaysToDayId, getWeekIdFromDayId } from '@core/lib/recurrence';
import {
  aggregateHabitStats,
  computeHabitSeriesStats,
  groupHabitSeries,
  uniqueSortedDayIds,
  type HabitSeriesSummary,
} from '@core/lib/habitPlan';
import { isHabitKind } from '@core/lib/habits';
import { useT } from '@/hooks/useT';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/contexts/ToastContext';
import { ApiClientError } from '@core/lib/api';
import { cn } from '@/lib/utils';
import type { TKey } from '@/lib/i18n';
import type { Recurrence } from '@core/types';

type Filter = 'all' | 'habit_good' | 'habit_quit';

function collectStoreHabits(
  tasksByDay: Record<string, Record<string, { kind?: string; id: string }[]>>
): LocatedTaskRow[] {
  const out: LocatedTaskRow[] = [];
  const seen = new Set<string>();
  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [dayId, list] of Object.entries(days)) {
      for (const task of list) {
        if (!isHabitKind(task.kind) || seen.has(task.id)) continue;
        seen.add(task.id);
        out.push({ ...(task as LocatedTaskRow), weekId, dayId });
      }
    }
  }
  return out;
}

function isoToFinKey(iso: number): TKey {
  return `fin_weekday_${iso === 7 ? 0 : iso}` as TKey;
}

function planSummary(recurrence: Recurrence, specificCount: number, t: (k: TKey) => string): string {
  if (Array.isArray(recurrence.weekdays) && recurrence.weekdays.length === 0) {
    return t('habits_plan_summary_specific').replace('{n}', String(specificCount));
  }
  if (recurrence.weekdays && recurrence.weekdays.length > 0) {
    return recurrence.weekdays.map(iso => t(isoToFinKey(iso))).join(', ');
  }
  if (recurrence.frequency === 'daily' && recurrence.interval <= 1) {
    return t('habits_plan_summary_daily');
  }
  if (recurrence.frequency === 'daily') {
    return t('habits_plan_summary_every_n').replace('{n}', String(recurrence.interval));
  }
  if (recurrence.frequency === 'weekly') return t('habits_plan_summary_weekly');
  if (recurrence.frequency === 'monthly') return t('habits_plan_summary_monthly');
  if (recurrence.frequency === 'yearly') return t('habits_plan_summary_yearly');
  return t('habits_plan_summary_daily');
}

export function HabitsPage() {
  const { t, language } = useT();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const today = useMemo(
    () => todayCivilDate(settings.timezone),
    [settings.timezone]
  );
  const todayId = getDayId(today);
  const weekId = getWeekId(today);
  const from30 = addDaysToDayId(todayId, -29);
  const { addTask } = useTasks(weekId, todayId);

  const [filter, setFilter] = useState<Filter>('all');
  const [remote, setRemote] = useState<LocatedTaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HabitSeriesSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HabitSeriesSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadHabits = useCallback(async () => {
    if (!uid || isDemoMode()) {
      setRemote([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchAllTasks(uid);
      const habitRows = rows.filter(r => isHabitKind(r.kind));
      mergeLocatedRowsIntoStore(habitRows);
      setRemote(habitRows);
    } catch (err) {
      console.error('[habits] load failed', err);
      showToast(t('habits_load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [uid, showToast, t]);

  useEffect(() => {
    void loadHabits();
  }, [loadHabits]);

  const storeHabits = useMemo(() => collectStoreHabits(tasksByDay), [tasksByDay]);

  const allHabits = useMemo(() => {
    const byId = new Map<string, LocatedTaskRow>();
    for (const row of remote) byId.set(row.id, row);
    for (const row of storeHabits) byId.set(row.id, row);
    return [...byId.values()];
  }, [remote, storeHabits]);

  const series = useMemo(() => {
    const grouped = groupHabitSeries(allHabits);
    if (filter === 'all') return grouped;
    return grouped.filter(s => s.kind === filter);
  }, [allHabits, filter]);

  const statsBySeries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeHabitSeriesStats>>();
    for (const item of series) {
      map.set(item.seriesId, computeHabitSeriesStats(item, from30, todayId, todayId));
    }
    return map;
  }, [series, from30, todayId]);

  const totals = useMemo(
    () => aggregateHabitStats([...statsBySeries.values()]),
    [statsBySeries]
  );

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: HabitSeriesSummary) {
    setEditing(item);
    setDialogOpen(true);
  }

  async function handleSubmit(value: HabitFormValue) {
    const plan = recurrenceFromForm(value);
    try {
      if (!editing) {
        await addTask({
          title: value.title,
          kind: value.kind,
          notes: value.notes,
          color: value.color,
          pomodoroTarget: value.pomodoroTarget,
          startDayId: plan.specificDayIds?.[0] ?? value.startDayId,
          recurrenceFrequency: plan.frequency,
          recurrenceInterval: plan.interval,
          recurrenceWeekdays: plan.weekdays,
          specificDayIds: plan.specificDayIds,
        });
        showToast(t('habits_created'), 'success');
      } else {
        const seed = editing.seed;
        const seedWeek = seed.weekId ?? getWeekIdFromDayId(seed.dayId);
        await updateTask(seedWeek, seed.dayId, seed.id, {
          title: value.title,
          kind: value.kind,
          notes: value.notes,
          color: value.color,
          pomodoroTarget: value.pomodoroTarget,
          recurrenceFrequency: plan.frequency,
          recurrenceInterval: plan.interval,
          recurrenceWeekdays:
            value.planUi === 'weekdays'
              ? plan.weekdays
              : value.planUi === 'specific'
                ? []
                : null,
          applyTo: 'series',
        });
        if (plan.specificDayIds) {
          const keep = new Set(uniqueSortedDayIds(plan.specificDayIds));
          for (const dayId of keep) {
            if (editing.instances.some(i => i.dayId === dayId)) continue;
            await ensureHabitInstance({ seriesId: editing.seriesId, dayId });
          }
          for (const inst of editing.instances) {
            if (keep.has(inst.dayId) || inst.completed) continue;
            const w = inst.weekId ?? getWeekIdFromDayId(inst.dayId);
            await deleteTask(w, inst.dayId, inst.id);
            useStore.getState().removeTaskOptimistic(w, inst.dayId, inst.id);
          }
        }
        showToast(t('habits_updated'), 'success');
      }
      await loadHabits();
    } catch (err) {
      const msg =
        err instanceof ApiClientError && /column|schema cache|does not exist|PGRST/i.test(err.message)
          ? t('habits_sql_needed')
          : err instanceof Error
            ? err.message
            : t('habits_save_error');
      showToast(msg, 'error');
      throw err;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTaskSeries(deleteTarget.seriesId);
      showToast(t('habits_deleted'), 'info');
      setDeleteTarget(null);
      await loadHabits();
    } catch {
      showToast(t('habits_delete_error'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Layout
      title={t('nav_habits')}
      primaryAction={{ label: t('habits_new'), onClick: openCreate }}
      onFabClick={openCreate}
      showFab
    >
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
        <p className="max-w-2xl text-xs text-text-muted">{t('habits_subtitle')}</p>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi
            icon={<Target className="h-4 w-4" />}
            label={t('habits_adherence')}
            value={`${totals.adherence}%`}
            hint={t('habits_last_30')}
          />
          <Kpi
            icon={<Flame className="h-4 w-4" />}
            label={t('habits_streak')}
            value={String(totals.bestStreak)}
            hint={t('habits_best_streak')}
          />
          <Kpi
            icon={<Repeat2 className="h-4 w-4" />}
            label={t('habits_done')}
            value={`${totals.done}/${totals.expected}`}
            hint={t('habits_expected')}
          />
          <Kpi
            icon={<Timer className="h-4 w-4" />}
            label={t('habits_pomo_week')}
            value={`${totals.pomodoroDone}/${totals.pomodoroPlanned}`}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', t('habits_filter_all')],
              ['habit_good', t('habit_badge_good')],
              ['habit_quit', t('habit_badge_quit')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                filter === id
                  ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                  : 'border-border text-text-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && series.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('habits_loading')}
          </div>
        ) : series.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <Sprout className="mx-auto mb-3 h-8 w-8 text-accent-teal" />
            <h2 className="text-sm font-semibold text-text-primary">{t('habits_empty')}</h2>
            <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">
              {t('habits_empty_hint')}
            </p>
            <Button className="mt-4" onClick={openCreate}>
              {t('habits_new')}
            </Button>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {series.map(item => {
              const stats = statsBySeries.get(item.seriesId);
              return (
                <li
                  key={item.seriesId}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color ?? '#3fb950' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-text-primary">
                            {item.title}
                          </h3>
                          <p className="text-[11px] text-text-muted">
                            {t(
                              item.kind === 'habit_quit'
                                ? 'habit_badge_quit'
                                : 'habit_badge_good'
                            )}
                            {' · '}
                            {planSummary(item.recurrence, item.instances.length, t)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(item)}
                            aria-label={t('habits_edit')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-accent-red"
                            onClick={() => setDeleteTarget(item)}
                            aria-label={t('action_delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-text-muted">
                        <span>
                          {t('habits_adherence')}: {stats?.adherence ?? 0}%
                        </span>
                        <span>
                          {t('habits_streak')}: {stats?.streak ?? 0}
                        </span>
                        <span>
                          {t('habits_done')}: {stats?.done ?? 0}/{stats?.expected ?? 0}
                        </span>
                      </div>

                      <Heatmap
                        days={stats?.days ?? []}
                        todayId={todayId}
                        language={language}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <HabitFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        todayId={todayId}
        initial={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('habits_delete_title')}
        description={t('habits_delete_confirm').replace(
          '{name}',
          deleteTarget?.title ?? ''
        )}
        confirmLabel={t('action_delete')}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </Layout>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-text-muted">
        {icon}
        {label}
      </div>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      {hint && <p className="text-[10px] text-text-muted">{hint}</p>}
    </div>
  );
}

function Heatmap({
  days,
  todayId,
  language,
}: {
  days: Array<{ dayId: string; expected: boolean; done: boolean }>;
  todayId: string;
  language: string;
}) {
  const { t } = useT();
  if (days.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-[10px] text-text-muted">{t('habits_heatmap')}</p>
      <div className="flex flex-wrap gap-1">
        {days.map(d => {
          const title = formatDayLabel(d.dayId, language);
          let cls = 'bg-background border-border';
          if (d.expected && d.done) cls = 'bg-accent-green/80 border-accent-green';
          else if (d.expected && d.dayId <= todayId) cls = 'bg-accent-red/25 border-accent-red/40';
          else if (d.expected) cls = 'bg-accent-teal/20 border-accent-teal/40';
          return (
            <span
              key={d.dayId}
              title={title}
              className={cn('h-2.5 w-2.5 rounded-[3px] border', cls)}
            />
          );
        })}
      </div>
    </div>
  );
}

function formatDayLabel(dayId: string, language: string): string {
  const [y, m, d] = dayId.split('-').map(Number);
  try {
    return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dayId;
  }
}
