import { useMemo } from 'react';
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
import { Flame, ListChecks } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { ProGate } from '@/components/ProGate';
import { useWeek } from '@core/hooks/useWeek';
import { useAnalytics } from '@core/hooks/useAnalytics';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import { useT } from '@/hooks/useT';
import type { Task } from '@core/types';

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
  const { locale, weekdayFormat, shortDateFormat } = useT();
  const { currentWeekId, days } = useWeek({ locale, weekdayFormat, shortDateFormat });
  const { data: backendAnalytics } = useAnalytics(currentWeekId);
  const { projects } = useProjects();

  // Si el backend todavia no calculo el doc, derivamos local-only desde el
  // store (la unica fuente que tenemos sin pegarle a Firestore por cada query).
  const tasksByDay = useStore(s => s.tasksByDay[currentWeekId] ?? {});

  const dailyChart = useMemo(() => {
    return days.map(d => {
      const tasks = tasksByDay[d.dayId] ?? [];
      const completed =
        backendAnalytics?.completionsByDay?.[d.dayId] ??
        tasks.filter(t => t.completed).length;
      return {
        day: d.label,
        date: d.dateLabel,
        completed,
        pending: Math.max(0, tasks.length - completed),
      };
    });
  }, [days, tasksByDay, backendAnalytics]);

  const projectChart = useMemo(() => {
    const counts: Record<string, number> = {};
    if (backendAnalytics?.completionsByProject) {
      Object.assign(counts, backendAnalytics.completionsByProject);
    } else {
      for (const dayId of Object.keys(tasksByDay)) {
        const list = tasksByDay[dayId] ?? [];
        for (const t of list as Task[]) {
          if (!t.completed) continue;
          const key = t.projectId ?? '__none';
          counts[key] = (counts[key] ?? 0) + 1;
        }
      }
    }
    return Object.entries(counts).map(([projectId, value]) => {
      const project = projects.find(p => p.id === projectId);
      return {
        name: project ? `${project.icon} ${project.name}` : 'Sin proyecto',
        value,
        color: project?.color ?? '#7d8590',
      };
    });
  }, [backendAnalytics, tasksByDay, projects]);

  const totalCompleted = dailyChart.reduce((acc, d) => acc + d.completed, 0);
  const totalPending = dailyChart.reduce((acc, d) => acc + d.pending, 0);
  const streak = backendAnalytics?.streakCount ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
        </div>

        {/* Bar chart */}
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Completadas por día</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart}>
                <CartesianGrid stroke="#30363d" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="#7d8590" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#7d8590" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}
                  labelStyle={{ color: '#e6edf3', fontSize: 12 }}
                />
                <Bar dataKey="completed" fill="#3fb950" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" fill="#30363d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Donut */}
        <section className="rounded-lg border border-border bg-surface p-4">
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
                    paddingAngle={2}
                  >
                    {projectChart.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: '#e6edf3', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#7d8590' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {!backendAnalytics && (
          <p className="text-center text-[11px] text-text-muted">
            Mostrando datos derivados del board. Cuando el worker calcule los agregados, este panel
            va a usar `users/{'{uid}'}/analytics/{currentWeekId}`.
          </p>
        )}
      </div>
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
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className={`mb-1 flex items-center gap-1.5 text-xs ${accent}`}>
        {icon}
        <span className="text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}
