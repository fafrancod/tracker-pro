/** Helpers for HH:mm task schedules and hour grids. */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm || !TIME_RE.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Effective end minutes; default +60 if only start. Cap at 24:00 (1440). */
export function effectiveEndMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): number | null {
  const start = parseTimeToMinutes(startTime);
  if (start === null) return null;
  const end = parseTimeToMinutes(endTime);
  if (end !== null && end >= start) return end;
  return Math.min(start + 60, 24 * 60);
}

/**
 * ¿El tramo cruza medianoche de forma válida?
 * Solo multi-día (endDayId > startDayId) admite endTime < startTime (ej. 20:00→03:00).
 * Mismo día: end debe ser >= start si ambos están definidos.
 */
export function isValidTaskTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  startDayId?: string | null,
  endDayId?: string | null
): boolean {
  if (!startTime || !endTime) return true;
  const multi = Boolean(startDayId && endDayId && endDayId > startDayId);
  if (multi) return true;
  return endTime >= startTime;
}

export type DayRoleInSpan = 'single' | 'start' | 'middle' | 'end';

export function dayRoleInSpan(
  viewDayId: string,
  startDayId: string,
  endDayId: string
): DayRoleInSpan {
  const end = endDayId || startDayId;
  if (startDayId === end) return 'single';
  if (viewDayId === startDayId) return 'start';
  if (viewDayId === end) return 'end';
  return 'middle';
}

/**
 * Posiciona un bloque en la grilla de un día concreto del span.
 * Multi-día con 20:00→03:00: día inicio hasta fin de grilla; día fin desde inicio hasta 03:00.
 */
export function layoutInGridForDay(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  range: HourRange,
  hourHeightPx: number,
  viewDayId: string,
  startDayId: string,
  endDayId: string
): { top: number; height: number } | null {
  const role = dayRoleInSpan(viewDayId, startDayId, endDayId || startDayId);
  if (role === 'single') {
    return layoutInGrid(startTime, endTime, range, hourHeightPx);
  }

  const gridStart = range.startHour * 60;
  const gridEnd = range.endHour * 60;
  if (gridEnd <= gridStart) return null;

  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  let segStart: number;
  let segEnd: number;

  if (role === 'start') {
    // Desde hora de inicio hasta fin del día visible.
    if (start === null) return null;
    segStart = start;
    segEnd = gridEnd;
  } else if (role === 'end') {
    // Desde inicio del día visible hasta hora de fin (puede ser < startTime del tramo).
    if (end === null) {
      // Sin fin explícito: barra corta al inicio del día.
      segStart = gridStart;
      segEnd = Math.min(gridStart + 60, gridEnd);
    } else {
      segStart = gridStart;
      segEnd = end;
    }
  } else {
    // Días intermedios: bloque a lo largo de la grilla.
    segStart = gridStart;
    segEnd = gridEnd;
  }

  const clampedStart = Math.max(segStart, gridStart);
  const clampedEnd = Math.min(segEnd, gridEnd);
  if (clampedEnd <= clampedStart) {
    // Fuera de la ventana visible.
    if (segEnd <= gridStart || segStart >= gridEnd) {
      return {
        top: segEnd <= gridStart ? 0 : ((gridEnd - gridStart) / 60) * hourHeightPx - hourHeightPx * 0.35,
        height: Math.max(hourHeightPx * 0.35, 18),
      };
    }
    return null;
  }

  const top = ((clampedStart - gridStart) / 60) * hourHeightPx;
  const height = Math.max(((clampedEnd - clampedStart) / 60) * hourHeightPx, 18);
  return { top, height };
}

export function hasSchedule(startTime: string | null | undefined): boolean {
  return parseTimeToMinutes(startTime) !== null;
}

export interface HourRange {
  startHour: number;
  endHour: number;
}

export function normalizeHourRange(
  dayStartHour: number,
  dayEndHour: number
): HourRange {
  let start = Math.floor(Number.isFinite(dayStartHour) ? dayStartHour : 7);
  let end = Math.floor(Number.isFinite(dayEndHour) ? dayEndHour : 22);
  start = Math.max(0, Math.min(23, start));
  end = Math.max(start + 1, Math.min(24, end));
  return { startHour: start, endHour: end };
}

export function hourLabels(range: HourRange): number[] {
  const labels: number[] = [];
  for (let h = range.startHour; h < range.endHour; h++) labels.push(h);
  return labels;
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Position a timed block inside a day column.
 * Returns null if unscheduled.
 */
export function layoutInGrid(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  range: HourRange,
  hourHeightPx: number
): { top: number; height: number } | null {
  const start = parseTimeToMinutes(startTime);
  if (start === null) return null;
  const end = effectiveEndMinutes(startTime, endTime) ?? start + 60;
  const gridStart = range.startHour * 60;
  const gridEnd = range.endHour * 60;
  const totalMin = gridEnd - gridStart;
  if (totalMin <= 0) return null;

  const clampedStart = Math.max(start, gridStart);
  const clampedEnd = Math.min(end, gridEnd);
  if (clampedEnd <= clampedStart) {
    // Outside visible window — pin a thin bar at edge if overlapping logic fails
    if (end <= gridStart) {
      return { top: 0, height: Math.max(hourHeightPx * 0.35, 18) };
    }
    if (start >= gridEnd) {
      return {
        top: (totalMin / 60) * hourHeightPx - hourHeightPx * 0.35,
        height: Math.max(hourHeightPx * 0.35, 18),
      };
    }
    return null;
  }

  const top = ((clampedStart - gridStart) / 60) * hourHeightPx;
  const height = Math.max(((clampedEnd - clampedStart) / 60) * hourHeightPx, 18);
  return { top, height };
}
