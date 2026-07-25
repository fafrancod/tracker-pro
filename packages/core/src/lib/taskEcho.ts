/**
 * Eco de mutaciones propias (roadmap Fase 3.3).
 * Tras create/update/delete local, Realtime reenvía el mismo cambio:
 * lo ignoramos un breve ventana para no pisar el optimistic ni re-aplicar.
 */

const ECHO_MS = 2000;
const ownMutations = new Map<string, number>();

export function noteOwnTaskMutation(...taskIds: Array<string | null | undefined>): void {
  const now = Date.now();
  for (const id of taskIds) {
    if (id) ownMutations.set(id, now);
  }
  if (ownMutations.size > 300) {
    for (const [k, t] of ownMutations) {
      if (now - t > ECHO_MS) ownMutations.delete(k);
    }
  }
}

export function isOwnTaskEcho(taskId: string): boolean {
  const t = ownMutations.get(taskId);
  return t != null && Date.now() - t < ECHO_MS;
}

/** Solo tests. */
export function clearOwnTaskEcho(): void {
  ownMutations.clear();
}
