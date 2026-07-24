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
