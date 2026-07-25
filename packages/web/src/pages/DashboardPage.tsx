import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfISOWeek, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  CheckCircle2,
  Circle,
  ListChecks,
  ArrowRight,
  CalendarDays,
  Pill,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from '@/components/Board';
import { RxTreatmentsPanel } from '@/components/Recetario/RxTreatmentsPanel';
import { RxPhasesEndingPanel } from '@/components/Recetario/RxPhasesEndingPanel';
import { useTasks } from '@core/hooks/useTasks';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import {
  ensureTasksRangeLoaded,
  fetchAllTasks,
  getDayId,
  getWeekId,
  mergeLocatedRowsIntoStore,
} from '@core/services/taskService';
import { collectTasksCovering } from '@core/lib/taskPresence';
import { isDemoMode } from '@core/lib/demoMode';
import {
  buildRxSubjectGroups,
  collectRxTasksFromStore,
  isRxKind,
  listPhasesEndingInRange,
} from '@core/lib/rx';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import { WellbeingAnalyticsPanel } from '@/components/Dashboard/WellbeingAnalyticsPanel';
import type { Task } from '@core/types';

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function DashboardPage() {
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const [remoteRx, setRemoteRx] = useState<Task[]>([]);

  // Siempre la semana ISO de HOY (no la del tablero, que puede estar en otro mes).
  const today = useMemo(() => new Date(), []);
  const thisWeekId = getWeekId(today);
  const todayId = getDayId(today);
  const weekStart = startOfISOWeek(today);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return {
        date: d,
        dayId: getDayId(d),
        label: capitalize(format(d, weekdayFormat, { locale })),
        dateLabel: capitalize(format(d, shortDateFormat, { locale })),
      };
    });
  }, [weekStart, locale, weekdayFormat, shortDateFormat]);

  const weekFrom = days[0]?.dayId;
  const weekTo = days[6]?.dayId;

  // Fase 3.5: semana del resumen sin re-fetch si el store ya tiene el rango fresco.
  useEffect(() => {
    if (!uid || isDemoMode() || !weekFrom || !weekTo) return;
    void ensureTasksRangeLoaded(uid, weekFrom, weekTo).catch(() => {
      /* el resto de la UI sigue con lo que haya en store */
    });
  }, [uid, weekFrom, weekTo]);

  // Carga recetarios completos para % de avance (planes multi-día).
  const loadRx = useCallback(async () => {
    if (!uid || isDemoMode()) {
      setRemoteRx([]);
      return;
    }
    try {
      const rows = await fetchAllTasks(uid);
      const rxRows = rows.filter(r => isRxKind(r.kind));
      mergeLocatedRowsIntoStore(rxRows);
      setRemoteRx(
        rxRows.map(r => {
          const { weekId: _w, dayId, ...task } = r;
          return { ...(task as Task), dayId };
        })
      );
    } catch {
      /* UI usa lo que haya en store */
    }
  }, [uid]);

  useEffect(() => {
    void loadRx();
  }, [loadRx]);

  // Suscripción al día de hoy (toggles en vivo).
  const {
    tasks: todayTasks,
    editTask,
    progress: todayProgress,
  } = useTasks(thisWeekId, todayId);

  // Por día: presencia multi-día (collectTasksCovering), no solo bucket de inicio.
  const weekDayStats = useMemo(() => {
    return days.map(d => {
      const list = collectTasksCovering(tasksByDay, d.dayId);
      const completed = list.filter(t => t.completed).length;
      return {
        dayId: d.dayId,
        label: d.label,
        dateLabel: d.dateLabel,
        total: list.length,
        completed,
        isToday: d.dayId === todayId,
      };
    });
  }, [days, tasksByDay, todayId]);

  // KPIs de la semana: tareas únicas que tocan algún día de la semana.
  const weekStats = useMemo(() => {
    const seen = new Map<string, boolean>();
    for (const d of days) {
      for (const t of collectTasksCovering(tasksByDay, d.dayId)) {
        if (!seen.has(t.id)) seen.set(t.id, t.completed);
      }
    }
    const total = seen.size;
    const completed = [...seen.values()].filter(Boolean).length;
    return {
      total,
      completed,
      pending: total - completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [days, tasksByDay]);

  // Streak local: días seguidos hacia atrás con ≥1 tarea y todas completadas.
  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, -i);
      const dId = getDayId(d);
      const list = collectTasksCovering(tasksByDay, dId);
      if (list.length === 0) break;
      if (list.every(t => t.completed)) count++;
      else break;
    }
    return count;
  }, [tasksByDay, today]);

  /** Tomas del recetario de hoy, ordenadas por hora (pendientes primero). */
  const todayDoses = useMemo(() => {
    return todayTasks
      .filter(t => isRxKind(t.kind))
      .slice()
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99');
      });
  }, [todayTasks]);

  const pendingDoses = todayDoses.filter(t => !t.completed).length;

  const rxGroups = useMemo(() => {
    const storeRx = collectRxTasksFromStore(tasksByDay);
    const byId = new Map<string, Task>();
    for (const t of remoteRx) byId.set(t.id, t);
    for (const t of storeRx) byId.set(t.id, t);
    // En resumen: solo sujetos con tratamientos activos o tomas de hoy.
    return buildRxSubjectGroups([...byId.values()], todayId, {
      includeFinished: false,
    }).filter(g => g.todayDoses.length > 0 || g.treatments.some(tr => tr.isActive));
  }, [remoteRx, tasksByDay, todayId]);

  const phasesEnding = useMemo(() => {
    const treatments = rxGroups.flatMap(g => g.treatments);
    const to = getDayId(addDays(today, 6));
    return listPhasesEndingInRange(treatments, todayId, to);
  }, [rxGroups, today, todayId]);

  return (
    <Layout title={t('dashboard_title')} showFab={false}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              icon={<Flame className="h-4 w-4" />}
              label={t('dashboard_streak')}
              value={streak}
              accent="text-accent-pink"
            />
            <Kpi
              icon={<CheckCircle2 className="h-4 w-4" />}
              label={t('dashboard_completed')}
              value={weekStats.completed}
              accent="text-accent-green"
            />
            <Kpi
              icon={<Circle className="h-4 w-4" />}
              label={t('dashboard_pending')}
              value={weekStats.pending}
              accent="text-text-muted"
            />
            <Kpi
              icon={<ListChecks className="h-4 w-4" />}
              label={t('dashboard_completion_rate')}
              value={`${weekStats.rate}%`}
              accent="text-accent-teal"
            />
          </div>

          <WellbeingAnalyticsPanel />

          {/* Recetario: tomas de hoy + avance de tratamientos por persona/mascota */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-accent-pink" />
                <h2 className="text-sm font-semibold text-text-primary">
                  {t('dashboard_rx_title')}
                </h2>
                {todayDoses.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t('dashboard_doses_badge')
                      .replace('{pending}', String(pendingDoses))
                      .replace('{total}', String(todayDoses.length))}
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[11px]"
                onClick={() => navigate('/recetario')}
              >
                {t('dashboard_open_recetario')}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            <p className="mb-3 text-[11px] text-text-muted">{t('dashboard_rx_subtitle')}</p>

            {rxGroups.length === 0 ? (
              <div className="rounded border border-dashed border-border p-4 text-center text-xs text-text-muted">
                {t('dashboard_no_doses_today')}
              </div>
            ) : (
              <div className="space-y-3">
                <RxPhasesEndingPanel items={phasesEnding} />
                <RxTreatmentsPanel
                  groups={rxGroups}
                  onToggleDose={task => void editTask(task.id, { completed: !task.completed })}
                  emptyLabel={t('dashboard_no_doses_today')}
                  compact
                />
              </div>
            )}
          </section>

          {/* Hoy */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-accent-teal" />
                <h2 className="text-sm font-semibold text-text-primary">{t('dashboard_today')}</h2>
                <Badge variant="secondary" className="text-[10px]">
                  {format(today, shortDateFormat, { locale })}
                </Badge>
              </div>
              <ProgressRing
                progress={todayProgress}
                completed={todayTasks.filter(t => t.completed).length}
                total={todayTasks.length}
                size={36}
              />
            </div>

            {todayTasks.length === 0 ? (
              <div className="rounded border border-dashed border-border p-4 text-center text-xs text-text-muted">
                {t('dashboard_no_tasks_today')}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {todayTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    projectColor={projects.find(p => p.id === task.projectId)?.color}
                    projectIcon={projects.find(p => p.id === task.projectId)?.icon}
                    projectName={projects.find(p => p.id === task.projectId)?.name}
                    onToggle={() => editTask(task.id, { completed: !task.completed })}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Esta semana */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">
                {t('dashboard_this_week')}
              </h2>
              <span className="text-[11px] text-text-muted">
                {weekStats.completed}/{weekStats.total} · {weekStats.rate}%
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDayStats.map(d => (
                <button
                  key={d.dayId}
                  type="button"
                  onClick={() => navigate('/board')}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md border border-border bg-background p-2 text-xs transition-colors hover:border-accent-teal/40',
                    d.isToday && 'border-accent-teal/60 ring-1 ring-accent-teal/30'
                  )}
                >
                  <span className="font-semibold text-text-primary">{d.label.slice(0, 3)}</span>
                  <span className="text-[10px] text-text-muted">{d.dateLabel}</span>
                  <span className="text-[11px]">
                    <span className="text-accent-green">{d.completed}</span>
                    <span className="text-text-muted">/{d.total || 0}</span>
                  </span>
                </button>
              ))}
            </div>
            {weekStats.total === 0 && (
              <p className="mt-3 text-center text-[11px] text-text-muted">
                {t('dashboard_no_tasks_today')}
              </p>
            )}
            <Button
              onClick={() => navigate('/board')}
              className="mt-4 w-full gap-2 sm:w-auto"
              size="sm"
            >
              {t('dashboard_jump_to_board')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className={cn('mb-1 flex items-center gap-1.5 text-xs', accent)}>
        {icon}
        <span className="text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function TaskRow({
  task,
  projectColor,
  projectIcon,
  projectName,
  onToggle,
}: {
  task: Task;
  projectColor?: string;
  projectIcon?: string;
  projectName?: string;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          task.completed
            ? 'border-accent-green bg-accent-green/20 text-accent-green'
            : 'border-border hover:border-accent-green'
        )}
        aria-label={task.completed ? 'Desmarcar' : 'Marcar como completada'}
      >
        {task.completed && <CheckCircle2 className="h-2.5 w-2.5" />}
      </button>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          task.completed ? 'text-text-muted line-through' : 'text-text-primary'
        )}
      >
        {task.title}
      </span>
      {projectColor && (
        <span
          className="inline-flex max-w-[140px] items-center gap-1 truncate whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: projectColor + '33', color: projectColor }}
          title={projectName}
        >
          <span aria-hidden>{projectIcon}</span>
          <span className="truncate">{projectName}</span>
        </span>
      )}
    </li>
  );
}


