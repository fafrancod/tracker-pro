import type { Task } from '../types';

/**
 * Fusiona tareas de un día sin perder filas locales (optimistic o recién creadas)
 * cuando un fetch en vuelo devuelve un snapshot anterior al insert.
 *
 * - Mismo id → gana `incoming` (servidor).
 * - Solo en `existing` → se conserva (evita el “parpadeo y desaparece”).
 */
export function mergeDayTaskLists(existing: Task[], incoming: Task[]): Task[] {
  const byId = new Map<string, Task>();
  for (const t of existing) {
    byId.set(t.id, t);
  }
  for (const t of incoming) {
    byId.set(t.id, t);
  }
  return Array.from(byId.values()).sort((a, b) => a.order - b.order);
}
