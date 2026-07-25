import type { TaskKind, TaskStep } from '../types';

/** Tareas, recordatorios y eventos pueden llevar checklist de pasos. */
export function kindSupportsSteps(kind: TaskKind | string | null | undefined): boolean {
  return (
    kind === 'task' ||
    kind === 'reminder' ||
    kind === 'event' ||
    kind === 'possible_event'
  );
}

export function normalizeTaskSteps(raw: unknown): TaskStep[] {
  if (!Array.isArray(raw)) return [];
  const out: TaskStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    if (!title) continue;
    const id =
      typeof o.id === 'string' && o.id.trim()
        ? o.id.trim().slice(0, 80)
        : `step-${out.length + 1}`;
    out.push({
      id,
      title: title.slice(0, 280),
      completed: Boolean(o.completed),
    });
    if (out.length >= 40) break;
  }
  return out;
}

export function newStepId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function stepsEqual(a: TaskStep[], b: TaskStep[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].title !== b[i].title ||
      a[i].completed !== b[i].completed
    ) {
      return false;
    }
  }
  return true;
}
