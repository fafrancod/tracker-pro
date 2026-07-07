import { addDays, startOfISOWeek } from 'date-fns';
import type { Project, Task } from '@core/types';
import { getDayId, getWeekId } from '@core/services/taskService';

export interface DemoSeed {
  projects: Project[];
  tasksByDay: Record<string, Record<string, Task[]>>; // weekId -> dayId -> tasks
  currentWeekId: string;
}

let cached: DemoSeed | null = null;

/** Sample data para mostrar la UI sin Firebase ni backend. */
export function getDemoSeed(): DemoSeed {
  if (cached) return cached;

  const now = new Date();
  const weekStart = startOfISOWeek(now);
  const currentWeekId = getWeekId(now);
  const day = (offset: number) => addDays(weekStart, offset);
  const dayId = (offset: number) => getDayId(day(offset));

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

  const tasksByDay: Record<string, Record<string, Task[]>> = { [currentWeekId]: {} };
  for (let i = 0; i < 7; i++) tasksByDay[currentWeekId][dayId(i)] = [];

  let counter = 0;
  for (const [offset, partial] of sampleTasks) {
    const id = `demo-task-${counter++}`;
    const task: Task = {
      id,
      title: partial.title,
      completed: partial.completed ?? false,
      completedAt: partial.completed ? new Date().toISOString() : null,
      projectId: partial.projectId ?? null,
      priority: partial.priority ?? 'medium',
      notes: partial.notes ?? '',
      order: tasksByDay[currentWeekId][dayId(offset)].length,
      tags: partial.tags ?? [],
      movedFrom: null,
      createdAt: new Date(now.getTime() - (7 - offset) * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasksByDay[currentWeekId][dayId(offset)].push(task);
  }

  cached = { projects, tasksByDay, currentWeekId };
  return cached;
}
