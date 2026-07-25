/**
 * Caché de frescura de rangos de tareas en el store (roadmap Fase 3.5).
 * Evita re-fetch completo en Continuo / Resumen / Mes si el rango ya se cargó.
 */

export const TASK_RANGE_FRESH_MS = 45_000;

type RangeEntry = { from: string; to: string; at: number };

const loadedRanges: RangeEntry[] = [];

/** Marca un rango [from,to] inclusive (dayId YYYY-MM-DD) como cargado ahora. */
export function markTasksRangeLoaded(fromDayId: string, toDayId: string): void {
  if (!fromDayId || !toDayId) return;
  const from = fromDayId <= toDayId ? fromDayId : toDayId;
  const to = fromDayId <= toDayId ? toDayId : fromDayId;
  const now = Date.now();
  loadedRanges.push({ from, to, at: now });
  // Podar entradas viejas (> 5 min)
  const cutoff = now - 5 * 60_000;
  for (let i = loadedRanges.length - 1; i >= 0; i--) {
    if (loadedRanges[i].at < cutoff) loadedRanges.splice(i, 1);
  }
}

/**
 * ¿El store ya tiene un fetch reciente que cubre [from,to]?
 * Contención total: algún rango cargado engloba el pedido y no expiró.
 */
export function isTasksRangeFresh(
  fromDayId: string,
  toDayId: string,
  maxAgeMs: number = TASK_RANGE_FRESH_MS
): boolean {
  if (!fromDayId || !toDayId) return false;
  const from = fromDayId <= toDayId ? fromDayId : toDayId;
  const to = fromDayId <= toDayId ? toDayId : fromDayId;
  const now = Date.now();
  return loadedRanges.some(
    r => r.from <= from && r.to >= to && now - r.at < maxAgeMs
  );
}

export function clearTasksRangeCache(): void {
  loadedRanges.length = 0;
}

/** Solo tests. */
export function _debugTasksRangeCache(): RangeEntry[] {
  return [...loadedRanges];
}
