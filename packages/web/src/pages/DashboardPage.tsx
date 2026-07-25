import { useMemo } from 'react';
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
import { useWeek } from '@core/hooks/useWeek';
import { useTasks } from '@core/hooks/useTasks';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import { getDayId } from '@core/services/taskService';
import { formatDose, isRxKind } from '@core/lib/rx';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import type { Task } from '@core/types';

export function DashboardPage() {
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { currentWeekId, days, todayDayId, isCurrentWeek } = useWeek({
    locale,
    weekdayFormat,
    shortDateFormat,
  });
  const navigate = useNavigate();
  const { projects } = useProjects();

  // El hook useTasks asegura suscripción al día de hoy (en real mode con Firestore).
  const todayWeekId = currentWeekId;
  const todayId = todayDayId ?? days[0].dayId;
  const { tasks: todayTasks, editTask, progress: todayProgress } = useTasks(todayWeekId, todayId);

  // Tareas de toda la semana (lectura desde el store; los DayColumns suscriben).
  const weekTasks = useStore(s => s.tasksByDay[currentWeekId] ?? {});
  const weekStats = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (const dayId of Object.keys(weekTasks)) {
      const list = weekTasks[dayId] ?? [];
      total += list.length;
      completed += list.filter(t => t.completed).length;
    }
    return { total, completed, pending: total - completed, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [weekTasks]);

  // Streak local-only basado en cuántos días seguidos (hacia atrás desde hoy) con
  // al menos una tarea, todas completadas. Stub razonable hasta que el backend lo calcule.
  const streak = useMemo(() => {
    const today = new Date();
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, -i);
      const dId = getDayId(d);
      const wId = `${d.getUTCFullYear()}-W${String(Math.ceil(((d.getTime() - startOfISOWeek(new Date(d.getUTCFullYear(), 0, 4)).getTime()) / 86400000 + 1) / 7))
        .padStart(2, '0')}`;
      const list = useStore.getState().tasksByDay[wId]?.[dId];
      if (!list || list.length === 0) break;
      if (list.every(t => t.completed)) count++;
      else break;
    }
    return count;
  }, [weekTasks]);

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

          {/* Próximas tomas del día (recetario) */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-accent-pink" />
                <h2 className="text-sm font-semibold text-text-primary">
                  {t('dashboard_doses_today')}
                </h2>
                {todayDoses.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {pendingDoses}/{todayDoses.length}
                  </Badge>
                )}
              </div>
            </div>

            {todayDoses.length === 0 ? (
              <div className="rounded border border-dashed border-border p-4 text-center text-xs text-text-muted">
                {t('dashboard_no_doses_today')}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {todayDoses.map(task => (
                  <DoseRow
                    key={task.id}
                    task={task}
                    onToggle={() => editTask(task.id, { completed: !task.completed })}
                    t={t}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Hoy */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-accent-teal" />
                <h2 className="text-sm font-semibold text-text-primary">{t('dashboard_today')}</h2>
                <Badge variant="secondary" className="text-[10px]">
                  {format(new Date(), shortDateFormat, { locale })}
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

          {/* Atajos */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">{t('dashboard_this_week')}</h2>
            <div className="grid grid-cols-7 gap-2">
              {days.map(d => {
                const list = weekTasks[d.dayId] ?? [];
                const completed = list.filter(t => t.completed).length;
                const total = list.length;
                const isToday = isCurrentWeek && d.dayId === todayDayId;
                return (
                  <button
                    key={d.dayId}
                    onClick={() => navigate('/board')}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md border border-border bg-background p-2 text-xs transition-colors hover:border-accent-teal/40',
                      isToday && 'border-accent-teal/60 ring-1 ring-accent-teal/30'
                    )}
                  >
                    <span className="font-semibold text-text-primary">{d.label.slice(0, 3)}</span>
                    <span className="text-[10px] text-text-muted">{d.dateLabel}</span>
                    <span className="text-[11px]">
                      <span className="text-accent-green">{completed}</span>
                      <span className="text-text-muted">/{total || 0}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Button onClick={() => navigate('/board')} className="mt-4 w-full gap-2 sm:w-auto" size="sm">
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

function DoseRow({
  task,
  onToggle,
  t,
}: {
  task: Task;
  onToggle: () => void;
  t: (key: Parameters<ReturnType<typeof useT>['t']>[0]) => string;
}) {
  const doseLabel =
    task.rx != null ? formatDose(task.rx.amount, task.rx.unit) : null;
  const subject = task.rx?.subject?.trim() || null;

  return (
    <li
      className={cn(
        'flex items-center gap-2.5 rounded-md border px-2.5 py-2',
        task.completed
          ? 'border-border bg-background/60 opacity-70'
          : 'border-border bg-background'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          task.completed
            ? 'border-accent-green bg-accent-green/20 text-accent-green'
            : 'border-border hover:border-accent-green'
        )}
        aria-label={
          task.completed ? t('dashboard_dose_done') : t('dashboard_dose_pending')
        }
      >
        {task.completed && <CheckCircle2 className="h-3 w-3" />}
      </button>

      <span
        className={cn(
          'w-12 shrink-0 text-center text-sm font-semibold tabular-nums',
          task.completed ? 'text-text-muted' : 'text-accent-teal'
        )}
      >
        {task.startTime ?? '—'}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            task.completed ? 'text-text-muted line-through' : 'text-text-primary'
          )}
        >
          {task.title}
        </p>
        <p className="truncate text-[11px] text-text-muted">
          {[doseLabel, subject].filter(Boolean).join(' · ') ||
            (task.kind === 'rx_pet' ? t('task_kind_rx_pet') : t('task_kind_rx_human'))}
        </p>
      </div>

      {doseLabel && (
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {doseLabel}
        </Badge>
      )}
    </li>
  );
}
