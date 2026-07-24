import { addDays, addMonths, startOfISOWeek } from 'date-fns';
import type { Project, Task, Recurrence } from '@core/types';
import { getDayId, getWeekId } from '@core/services/taskService';

export interface DemoSeed {
  projects: Project[];
  tasksByDay: Record<string, Record<string, Task[]>>; // weekId -> dayId -> tasks
  currentWeekId: string;
}

let cached: DemoSeed | null = null;

function pushTask(
  tasksByDay: Record<string, Record<string, Task[]>>,
  date: Date,
  partial: Partial<Task> & { title: string }
): void {
  const weekId = getWeekId(date);
  const dayId = getDayId(date);
  if (!tasksByDay[weekId]) tasksByDay[weekId] = {};
  if (!tasksByDay[weekId][dayId]) tasksByDay[weekId][dayId] = [];
  const recurrence: Recurrence = partial.recurrence ?? { frequency: 'none', interval: 1 };
  const task: Task = {
    id: partial.id ?? `demo-task-${dayId}-${tasksByDay[weekId][dayId].length}`,
    title: partial.title,
    completed: partial.completed ?? false,
    completedAt: partial.completed ? new Date().toISOString() : null,
    projectId: partial.projectId ?? null,
    priority: partial.priority ?? 'medium',
    notes: partial.notes ?? '',
    order: tasksByDay[weekId][dayId].length,
    tags: partial.tags ?? [],
    movedFrom: null,
    seriesId: partial.seriesId ?? null,
    recurrence,
    endDayId: partial.endDayId ?? dayId,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasksByDay[weekId][dayId].push(task);
}

/** Sample data para mostrar la UI sin Supabase ni backend. */
export function getDemoSeed(): DemoSeed {
  if (cached) return cached;

  const now = new Date();
  const weekStart = startOfISOWeek(now);
  const currentWeekId = getWeekId(now);
  const day = (offset: number) => addDays(weekStart, offset);

  const projects: Project[] = [
    {
      id: 'demo-proj-lanzamiento',
      name: 'Lanzamiento beta',
      color: '#58a6ff',
      icon: '🚀',
      order: 0,
      createdAt: new Date(0).toISOString(),
    },
    {
      id: 'demo-proj-rust',
      name: 'Aprender Rust',
      color: '#3fb950',
      icon: '🦀',
      order: 1,
      createdAt: new Date(0).toISOString(),
    },
    {
      id: 'demo-proj-vida',
      name: 'Vida',
      color: '#f778ba',
      icon: '🌱',
      order: 2,
      createdAt: new Date(0).toISOString(),
    },
  ];

  const tasksByDay: Record<string, Record<string, Task[]>> = { [currentWeekId]: {} };
  for (let i = 0; i < 7; i++) tasksByDay[currentWeekId][getDayId(day(i))] = [];

  const sampleTasks: Array<[number, Partial<Task> & { title: string }]> = [
    [0, { title: 'Plan semanal', projectId: 'demo-proj-lanzamiento', priority: 'high', completed: true }],
    [0, { title: 'Revisar pricing', projectId: 'demo-proj-lanzamiento', priority: 'medium', completed: true }],
    [1, { title: 'Capítulo 4 — ownership', projectId: 'demo-proj-rust', priority: 'medium' }],
    [1, { title: 'Llamar al dentista', projectId: 'demo-proj-vida', priority: 'low', completed: true }],
    [2, { title: 'Sprint review', projectId: 'demo-proj-lanzamiento', priority: 'medium' }],
    [2, { title: 'Exercise rust #12', projectId: 'demo-proj-rust', priority: 'low' }],
    [3, { title: 'Mandar invoice', projectId: 'demo-proj-vida', priority: 'high' }],
    [4, { title: 'Demo a Cliente X', projectId: 'demo-proj-lanzamiento', priority: 'high' }],
    [5, { title: 'Caminar 30 min', projectId: 'demo-proj-vida', priority: 'low', completed: true }],
    [6, { title: 'Retro semanal', projectId: 'demo-proj-lanzamiento', priority: 'medium' }],
  ];

  for (const [offset, partial] of sampleTasks) {
    pushTask(tasksByDay, day(offset), partial);
  }

  // Multi-day sample: "Sprint de diseño" mon–fri of current week (complete-once span)
  pushTask(tasksByDay, day(0), {
    id: 'demo-task-sprint-diseno',
    title: 'Sprint de diseño',
    projectId: 'demo-proj-lanzamiento',
    priority: 'high',
    endDayId: getDayId(day(4)),
    notes: 'Rango multi-día de ejemplo (lunes a viernes).',
  });

  // Serie diaria: "Meditar 10 min" esta semana
  const dailySeries = 'demo-series-meditar';
  for (let i = 0; i < 7; i++) {
    pushTask(tasksByDay, day(i), {
      id: `demo-task-meditar-${i}`,
      title: 'Meditar 10 min',
      projectId: 'demo-proj-vida',
      priority: 'low',
      completed: i < 2,
      seriesId: dailySeries,
      recurrence: { frequency: 'daily', interval: 1 },
    });
  }

  // Serie semanal cada 2 semanas: "Informe bi-semanal" (esta semana + +2w + +4w)
  const biweeklySeries = 'demo-series-informe';
  for (let w = 0; w < 3; w++) {
    const d = addDays(weekStart, w * 14);
    pushTask(tasksByDay, d, {
      id: `demo-task-informe-${w}`,
      title: 'Informe bi-semanal',
      projectId: 'demo-proj-lanzamiento',
      priority: 'medium',
      completed: w === 0,
      seriesId: biweeklySeries,
      recurrence: { frequency: 'weekly', interval: 2 },
    });
  }

  // Serie mensual: "Cerrar contabilidad" mes actual + 5 siguientes (mismo día del mes)
  const monthlySeries = 'demo-series-contabilidad';
  const monthAnchor = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate(), 28));
  for (let m = 0; m < 6; m++) {
    const d = addMonths(monthAnchor, m);
    pushTask(tasksByDay, d, {
      id: `demo-task-conta-${m}`,
      title: 'Cerrar contabilidad',
      projectId: 'demo-proj-vida',
      priority: 'high',
      completed: m === 0 && now.getDate() > monthAnchor.getDate(),
      seriesId: monthlySeries,
      recurrence: { frequency: 'monthly', interval: 1 },
    });
  }

  cached = { projects, tasksByDay, currentWeekId };
  return cached;
}
