import type { Task, TaskKind, UserSettings } from '../types';
import { isRxKind } from './rx';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const NOTIFY_MINUTES_OPTIONS = [0, 5, 10, 15, 30, 60] as const;

export interface NotifiableOccurrence {
  taskId: string;
  title: string;
  dayId: string;
  startTime: string;
  kind: TaskKind;
  /** Instant UTC when the notification should fire. */
  fireAt: Date;
  /** Instant UTC of the scheduled activity (dayId + startTime in tz). */
  dueAt: Date;
  body: string;
}

export interface NotificationPrefs {
  notifyLocal: boolean;
  notifyEmail: boolean;
  notifyMinutesBefore: number;
  notifyTasks: boolean;
  notifyRx: boolean;
  timezone: string;
}

export function defaultNotificationPrefs(
  partial?: Partial<NotificationPrefs>
): NotificationPrefs {
  return {
    notifyLocal: partial?.notifyLocal ?? true,
    notifyEmail: partial?.notifyEmail ?? false,
    notifyMinutesBefore: normalizeMinutesBefore(partial?.notifyMinutesBefore),
    notifyTasks: partial?.notifyTasks ?? true,
    notifyRx: partial?.notifyRx ?? true,
    timezone: partial?.timezone?.trim() || 'UTC',
  };
}

export function prefsFromSettings(settings: Partial<UserSettings> | null | undefined): NotificationPrefs {
  return defaultNotificationPrefs({
    notifyLocal: settings?.notifyLocal,
    notifyEmail: settings?.notifyEmail,
    notifyMinutesBefore: settings?.notifyMinutesBefore,
    notifyTasks: settings?.notifyTasks,
    notifyRx: settings?.notifyRx,
    timezone: settings?.timezone,
  });
}

export function normalizeMinutesBefore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 10;
  const allowed = NOTIFY_MINUTES_OPTIONS as readonly number[];
  if (allowed.includes(n)) return n;
  // Clamp to nearest allowed
  return allowed.reduce((best, cur) =>
    Math.abs(cur - n) < Math.abs(best - n) ? cur : best
  );
}

/** Stable key for dedupe: one delivery per task occurrence + channel. */
export function notificationFireKey(
  taskId: string,
  dayId: string,
  startTime: string,
  channel: 'email' | 'local'
): string {
  return `${taskId}|${dayId}|${startTime}|${channel}`;
}

/**
 * Interpreta dayId + HH:mm como hora civil en `timeZone` y devuelve Date UTC.
 * Usa Intl sin dependencias externas (iteración de offset).
 */
export function zonedDateTimeToUtc(
  dayId: string,
  hhmm: string,
  timeZone: string
): Date {
  if (!TIME_RE.test(hhmm)) {
    throw new Error(`Hora inválida: ${hhmm}`);
  }
  const [ys, ms, ds] = dayId.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const [hh, mm] = hhmm.split(':').map(Number);
  if (![y, m, d, hh, mm].every(n => Number.isFinite(n))) {
    throw new Error(`Fecha/hora inválida: ${dayId} ${hhmm}`);
  }

  const tz = timeZone.trim() || 'UTC';
  // Primera estimación: tratar los componentes como UTC
  let utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0);

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  for (let i = 0; i < 4; i++) {
    const parts = fmt.formatToParts(new Date(utcMs));
    const get = (type: string) =>
      Number(parts.find(p => p.type === type)?.value ?? NaN);
    const asIfUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second')
    );
    const desired = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
    const delta = desired - asIfUtc;
    if (delta === 0) break;
    utcMs += delta;
  }

  return new Date(utcMs);
}

export function buildOccurrenceBody(
  kind: TaskKind,
  title: string,
  startTime: string,
  minutesBefore: number,
  language: 'es' | 'en' = 'es'
): string {
  const isRx = isRxKind(kind);
  if (language === 'en') {
    if (minutesBefore <= 0) {
      return isRx ? `Dose now: ${title} (${startTime})` : `Now: ${title} (${startTime})`;
    }
    return isRx
      ? `Dose in ${minutesBefore} min: ${title} (${startTime})`
      : `In ${minutesBefore} min: ${title} (${startTime})`;
  }
  if (minutesBefore <= 0) {
    return isRx ? `Toma ahora: ${title} (${startTime})` : `Ahora: ${title} (${startTime})`;
  }
  return isRx
    ? `Toma en ${minutesBefore} min: ${title} (${startTime})`
    : `En ${minutesBefore} min: ${title} (${startTime})`;
}

function shouldIncludeKind(kind: TaskKind, prefs: NotificationPrefs): boolean {
  if (isRxKind(kind)) return prefs.notifyRx;
  if (kind === 'task' || kind === 'reminder') return prefs.notifyTasks;
  return false;
}

/**
 * Construye ocurrencias notificables a partir de tareas con startTime.
 * `now` y ventana se usan para filtrar (opcional en cliente).
 */
export function collectNotifiableOccurrences(
  tasks: Array<
    Pick<Task, 'id' | 'title' | 'completed' | 'kind' | 'startTime'> & {
      dayId: string;
    }
  >,
  prefs: NotificationPrefs,
  options?: {
    language?: 'es' | 'en';
    /** Solo incluir fireAt en [from, to] (inclusive). */
    from?: Date;
    to?: Date;
    /** Si true, incluye completadas (default false). */
    includeCompleted?: boolean;
  }
): NotifiableOccurrence[] {
  const language = options?.language ?? 'es';
  const minutesBefore = normalizeMinutesBefore(prefs.notifyMinutesBefore);
  const out: NotifiableOccurrence[] = [];

  for (const task of tasks) {
    if (!options?.includeCompleted && task.completed) continue;
    if (!task.startTime || !TIME_RE.test(task.startTime)) continue;
    if (!shouldIncludeKind(task.kind, prefs)) continue;

    let dueAt: Date;
    try {
      dueAt = zonedDateTimeToUtc(task.dayId, task.startTime, prefs.timezone);
    } catch {
      continue;
    }
    const fireAt = new Date(dueAt.getTime() - minutesBefore * 60_000);
    if (options?.from && fireAt < options.from) continue;
    if (options?.to && fireAt > options.to) continue;

    out.push({
      taskId: task.id,
      title: task.title,
      dayId: task.dayId,
      startTime: task.startTime,
      kind: task.kind,
      fireAt,
      dueAt,
      body: buildOccurrenceBody(
        task.kind,
        task.title,
        task.startTime,
        minutesBefore,
        language
      ),
    });
  }

  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** True si `fireAt` cae en la ventana [now - lateGraceMs, now + earlyMs]. */
export function isDueNow(
  fireAt: Date,
  now: Date,
  opts?: { lateGraceMs?: number; earlyMs?: number }
): boolean {
  const late = opts?.lateGraceMs ?? 90_000;
  const early = opts?.earlyMs ?? 30_000;
  const t = fireAt.getTime();
  const n = now.getTime();
  return t >= n - late && t <= n + early;
}
