import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Flame, ListChecks, Timer } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { ProGate } from '@/components/ProGate';
import { useWeek } from '@core/hooks/useWeek';
import { useAnalytics } from '@core/hooks/useAnalytics';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import { collectTasksCovering } from '@core/lib/taskPresence';
import { useT } from '@/hooks/useT';
import { useSettings } from '@/contexts/SettingsContext';
import type { Task } from '@core/types';
import { isHabitKind, normalizePomodoroCount } from '@core/lib/habits';
import { TaskSummaryDialog } from '@/components/Board/TaskSummaryDialog';
import {
  chartTooltipStyle,
  isDocumentDark,
  macChartSeries,
  macSystem,
} from '@/lib/macPalette';

export function AnalyticsPage() {
  const { t } = useT();
  return (
    <Layout title={t('nav_analytics')} showFab={false}>
      <ProGate feature={t('nav_analytics')}>
        <AnalyticsContent />
      </ProGate>
    </Layout>
  );
}

function AnalyticsContent() {
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { settings } = useSettings();
  const { currentWeekId, days } = useWeek({
    locale,
    weekdayFormat,
    shortDateFormat,
    timezone: settings.timezone,
  });
  const { data: backendAnalytics } = useAnalytics(currentWeekId);
  const { projects } = useProjects();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Si el backend todavia no calculo el doc, derivamos local-only desde el
  // store (la unica fuente que tenemos sin pegarle a Firestore por cada query).
  const tasksByWeek = useStore(s => s.tasksByDay);

  const weekTasks = useMemo(() => {
    const unique = new Map<string, Task>();
    for (const day of days) {
      for (const task of collectTasksCovering(tasksByWeek, day.dayId)) {
        if (!unique.has(task.id)) unique.set(task.id, task);
      }
    }
    return [...unique.values()];
  }, [days, tasksByWeek]);

  const dailyChart = useMemo(() => {
    return days.map(d => {
      const tasks = collectTasksCovering(tasksByWeek, d.dayId);
      const completed =
        backendAnalytics?.completionsByDay?.[d.dayId] ??
        tasks.filter(t => t.completed).length;
      return {
        dayId: d.dayId,
        day: d.label,
        date: d.dateLabel,
        completed,
        pending: Math.max(0, tasks.length - completed),
      };
    });
  }, [days, tasksByWeek, backendAnalytics]);

  const projectChart = useMemo(() => {
    const counts: Record<string, number> = {};
    if (backendAnalytics?.completionsByProject) {
      Object.assign(counts, backendAnalytics.completionsByProject);
    } else {
      for (const task of weekTasks) {
        if (!task.completed) continue;
        const key = task.projectId ?? '__none';
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return Object.entries(counts).map(([projectId, value], idx) => {
      const project = projects.find(p => p.id === projectId);
      return {
        name: project ? `${project.icon} ${project.name}` : 'Sin proyecto',
        value,
        color:
          project?.color ??
          macChartSeries[idx % macChartSeries.length] ??
          macSystem.gray,
      };
    });
  }, [backendAnalytics, weekTasks, projects]);

  const pomoDaily = useMemo(() => {
    return days.map(d => {
      const habits = collectTasksCovering(tasksByWeek, d.dayId).filter(t =>
        isHabitKind(t.kind)
      );
      const planned = habits.reduce(
        (acc, t) => acc + normalizePomodoroCount(t.pomodoroTarget),
        0
      );
      const done = habits.reduce(
        (acc, t) => acc + normalizePomodoroCount(t.pomodoroDone),
        0
      );
      return {
        dayId: d.dayId,
        day: d.label,
        planned,
        done,
      };
    });
  }, [days, tasksByWeek]);

  const pomoByHabit = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; planned: number; done: number }
    >();
    for (const d of days) {
      for (const task of collectTasksCovering(tasksByWeek, d.dayId)) {
        if (!isHabitKind(task.kind)) continue;
        const key = task.seriesId ?? task.id;
        const prev = map.get(key) ?? {
          id: key,
          title: task.title,
          planned: 0,
          done: 0,
        };
        prev.title = task.title || prev.title;
        prev.planned += normalizePomodoroCount(task.pomodoroTarget);
        prev.done += normalizePomodoroCount(task.pomodoroDone);
        map.set(key, prev);
      }
    }
    return [...map.values()].filter(h => h.planned > 0 || h.done > 0);
  }, [days, tasksByWeek]);

  const pomoPlanned = pomoDaily.reduce((acc, d) => acc + d.planned, 0);
  const pomoDone = pomoDaily.reduce((acc, d) => acc + d.done, 0);
  const pomoAdherence =
    pomoPlanned > 0 ? Math.round((pomoDone / pomoPlanned) * 100) : 0;

  const totalCompleted = dailyChart.reduce((acc, d) => acc + d.completed, 0);
  const totalPending = dailyChart.reduce((acc, d) => acc + d.pending, 0);
  const streak = backendAnalytics?.streakCount ?? 0;
  const dark = isDocumentDark();
  const grid = dark ? macSystem.gridDark : macSystem.gridLight;
  const axis = dark ? '#a1a1aa' : '#6b7280';
  const tip = chartTooltipStyle(dark);
  const selectedDay = dailyChart.find(day => day.dayId === selectedDayId) ?? null;
  const selectedTasks = selectedDay ? collectTasksCovering(tasksByWeek, selectedDay.dayId) : [];

  function openDaySummary(entry: unknown) {
    const item = entry as { dayId?: string; payload?: { dayId?: string } };
    setSelectedDayId(item.payload?.dayId ?? item.dayId ?? null);
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Kpi
            icon={<ListChecks className="h-4 w-4" />}
            label="Completadas (semana)"
            value={totalCompleted}
            accent="text-accent-green"
          />
          <Kpi
            icon={<ListChecks className="h-4 w-4" />}
            label="Pendientes"
            value={totalPending}
            accent="text-text-muted"
          />
          <Kpi
            icon={<Flame className="h-4 w-4" />}
            label="Streak"
            value={`${streak} sem`}
            accent="text-accent-pink"
          />
          <Kpi
            icon={<Timer className="h-4 w-4" />}
            label={t('analytics_pomo_week')}
            value={`${pomoDone}/${pomoPlanned || 0}`}
            accent="text-accent-teal"
          />
          <Kpi
            icon={<Timer className="h-4 w-4" />}
            label={t('analytics_pomo_adherence')}
            value={pomoPlanned > 0 ? `${pomoAdherence}%` : '—'}
            accent="text-accent-teal"
          />
        </div>

        {/* Bar chart */}
        <section data-chrome="glass" className="analytics-surface rounded-3xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Completadas por día</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tip}
                  labelStyle={{ fontSize: 12 }}
                  cursor={{ fill: dark ? 'rgba(255,255,255,0.045)' : 'rgba(10,132,255,0.06)' }}
                />
                <Bar
                  dataKey="completed"
                  fill={macSystem.green}
                  radius={[9, 9, 3, 3]}
                  activeBar={false}
                  cursor="pointer"
                  onClick={openDaySummary}
                />
                <Bar
                  dataKey="pending"
                  fill={dark ? 'rgba(94,92,230,0.42)' : 'rgba(94,92,230,0.2)'}
                  radius={[9, 9, 3, 3]}
                  activeBar={false}
                  cursor="pointer"
                  onClick={openDaySummary}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Donut */}
        <section data-chrome="glass" className="analytics-surface rounded-3xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Completadas por proyecto</h2>
          {projectChart.length === 0 ? (
            <p className="py-12 text-center text-xs text-text-muted">
              Cuando completes tareas, vas a ver cómo se reparten entre proyectos.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="transparent"
                  >
                    {projectChart.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tip} labelStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: axis }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section data-chrome="glass" className="analytics-surface rounded-3xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            {t('analytics_pomo_by_day')}
          </h2>
          {pomoPlanned === 0 && pomoDone === 0 ? (
            <p className="py-10 text-center text-xs text-text-muted">
              {t('analytics_pomo_empty')}
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pomoDaily}>
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tip}
                    labelStyle={{ fontSize: 12 }}
                    cursor={{ fill: dark ? 'rgba(255,255,255,0.045)' : 'rgba(10,132,255,0.06)' }}
                  />
                  <Bar
                    dataKey="planned"
                    name={t('analytics_pomo_planned')}
                    fill={dark ? 'rgba(94,92,230,0.42)' : 'rgba(94,92,230,0.2)'}
                    radius={[9, 9, 3, 3]}
                    activeBar={false}
                  />
                  <Bar
                    dataKey="done"
                    name={t('analytics_pomo_done')}
                    fill={macSystem.green}
                    radius={[9, 9, 3, 3]}
                    activeBar={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section data-chrome="glass" className="analytics-surface rounded-3xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            {t('analytics_pomo_by_habit')}
          </h2>
          {pomoByHabit.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted">
              {t('analytics_pomo_empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {pomoByHabit.map(h => {
                const pct = h.planned > 0 ? Math.min(100, Math.round((h.done / h.planned) * 100)) : 0;
                return (
                  <li key={h.id} className="rounded-xl border border-border/70 px-3 py-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-text-primary">{h.title}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-text-muted">
                        {h.done}/{h.planned}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-accent-teal"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {!backendAnalytics && (
          <p className="text-center text-[11px] text-text-muted">
            Mostrando datos derivados del board. Cuando el worker calcule los agregados, este panel
            va a usar `users/{'{uid}'}/analytics/{currentWeekId}`.
          </p>
        )}
      </div>
      <TaskSummaryDialog
        open={selectedDay !== null}
        onOpenChange={open => !open && setSelectedDayId(null)}
        title={selectedDay ? `${selectedDay.day} · ${selectedDay.date}` : 'Resumen del día'}
        tasks={selectedTasks}
      />
    </div>
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
    <div data-chrome="glass" className="analytics-surface rounded-2xl border border-border bg-surface p-3">
      <div className={`mb-1 flex items-center gap-1.5 text-xs ${accent}`}>
        {icon}
        <span className="text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-text-primary">{value}</p>
    </div>
  );
}
