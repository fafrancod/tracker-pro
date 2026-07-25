import type { Task, TaskKind, UserSettings } from '../types';
import { isRxKind } from './rx';
import { addDaysToDayId } from './recurrence';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const NOTIFY_MINUTES_OPTIONS = [0, 5, 10, 15, 30, 60] as const;
export const NOTIFY_PAST_AFTER_OPTIONS = [15, 30, 60, 120, 240] as const;

/** Tres modos de recordatorio del producto. */
export type NotifyMode = 'before' | 'day_before' | 'past';

export interface NotifiableOccurrence {
  taskId: string;
  title: string;
  dayId: string;
  /** HH:mm o '' si la entrada no tiene hora. */
  startTime: string;
  kind: TaskKind;
  mode: NotifyMode;
  /** Instant UTC when the notification should fire. */
  fireAt: Date;
  /** Instant UTC of the activity (or noon for all-day). */
  dueAt: Date;
  /** Título corto de la notificación (banner). */
  headline: string;
  body: string;
}

export interface NotificationPrefs {
  notifyLocal: boolean;
  notifyEmail: boolean;
  /** Aviso X minutos antes (o en el momento si 0). */
  notifyBeforeEnabled: boolean;
  notifyMinutesBefore: number;
  /** “Recuerda que mañana vas a…” el día anterior a la hora indicada. */
  notifyDayBefore: boolean;
  /** Hora local HH:mm del aviso del día anterior. Default 20:00. */
  notifyDayBeforeTime: string;
  /** “¿Ya hiciste esto?” tras la hora programada si sigue incompleto. */
  notifyPastIncomplete: boolean;
  /** Minutos después de la hora de inicio para el nudge. */
  notifyPastAfterMinutes: number;
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
    notifyBeforeEnabled: partial?.notifyBeforeEnabled ?? true,
    notifyMinutesBefore: normalizeMinutesBefore(partial?.notifyMinutesBefore),
    notifyDayBefore: partial?.notifyDayBefore ?? true,
    notifyDayBeforeTime: normalizeDayBeforeTime(partial?.notifyDayBeforeTime),
    notifyPastIncomplete: partial?.notifyPastIncomplete ?? true,
    notifyPastAfterMinutes: normalizePastAfter(partial?.notifyPastAfterMinutes),
    notifyTasks: partial?.notifyTasks ?? true,
    notifyRx: partial?.notifyRx ?? true,
    timezone: partial?.timezone?.trim() || 'UTC',
  };
}

export function prefsFromSettings(
  settings: Partial<UserSettings> | null | undefined
): NotificationPrefs {
  return defaultNotificationPrefs({
    notifyLocal: settings?.notifyLocal,
    notifyEmail: settings?.notifyEmail,
    notifyBeforeEnabled: settings?.notifyBeforeEnabled,
    notifyMinutesBefore: settings?.notifyMinutesBefore,
    notifyDayBefore: settings?.notifyDayBefore,
    notifyDayBeforeTime: settings?.notifyDayBeforeTime,
    notifyPastIncomplete: settings?.notifyPastIncomplete,
    notifyPastAfterMinutes: settings?.notifyPastAfterMinutes,
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
  return allowed.reduce((best, cur) =>
    Math.abs(cur - n) < Math.abs(best - n) ? cur : best
  );
}

export function normalizePastAfter(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return 30;
  const allowed = NOTIFY_PAST_AFTER_OPTIONS as readonly number[];
  if (allowed.includes(n)) return n;
  return allowed.reduce((best, cur) =>
    Math.abs(cur - n) < Math.abs(best - n) ? cur : best
  );
}

export function normalizeDayBeforeTime(value: unknown): string {
  if (typeof value === 'string' && TIME_RE.test(value)) return value;
  return '20:00';
}

/**
 * Dedupe estable: una entrega por tarea + modo + canal.
 * Incluye startTime para no colisionar tomas del mismo día.
 */
export function notificationFireKey(
  taskId: string,
  dayId: string,
  startTime: string,
  mode: NotifyMode,
  channel: 'email' | 'local'
): string {
  return `${taskId}|${dayId}|${startTime || 'allday'}|${mode}|${channel}`;
}

/**
 * Interpreta dayId + HH:mm como hora civil en `timeZone` y devuelve Date UTC.
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

export function buildModeCopy(
  mode: NotifyMode,
  kind: TaskKind,
  title: string,
  startTime: string | null | undefined,
  minutesBefore: number,
  language: 'es' | 'en' = 'es'
): { headline: string; body: string } {
  const isRx = isRxKind(kind);
  const time = startTime && TIME_RE.test(startTime) ? startTime : null;

  if (language === 'en') {
    if (mode === 'day_before') {
      return {
        headline: 'Tomorrow',
        body: time
          ? `Remember tomorrow at ${time}: ${title}`
          : `Remember tomorrow: ${title}`,
      };
    }
    if (mode === 'past') {
      return {
        headline: isRx ? 'Did you take it?' : 'Done yet?',
        body: time
          ? `Did you already do this? ${title} (${time})`
          : `Did you already do this? ${title}`,
      };
    }
    // before
    if (minutesBefore <= 0) {
      return {
        headline: isRx ? 'Dose now' : 'Now',
        body: time ? `${title} (${time})` : title,
      };
    }
    return {
      headline: `In ${minutesBefore} min`,
      body: time ? `${title} (${time})` : title,
    };
  }

  // es
  if (mode === 'day_before') {
    return {
      headline: 'Mañana',
      body: time
        ? `Recuerda que mañana a las ${time} vas a: ${title}`
        : `Recuerda que mañana vas a: ${title}`,
    };
  }
  if (mode === 'past') {
    return {
      headline: isRx ? '¿Ya tomaste?' : '¿Ya lo hiciste?',
      body: time
        ? `¿Ya hiciste esto? ${title} (${time})`
        : `¿Ya hiciste esto? ${title}`,
    };
  }
  if (minutesBefore <= 0) {
    return {
      headline: isRx ? 'Toma ahora' : 'Ahora',
      body: time ? `${title} (${time})` : title,
    };
  }
  return {
    headline: `En ${minutesBefore} min`,
    body: time ? `${title} (${time})` : title,
  };
}

/** @deprecated use buildModeCopy — kept for callers that only need body of "before". */
export function buildOccurrenceBody(
  kind: TaskKind,
  title: string,
  startTime: string,
  minutesBefore: number,
  language: 'es' | 'en' = 'es'
): string {
  return buildModeCopy('before', kind, title, startTime, minutesBefore, language).body;
}

function shouldIncludeKind(kind: TaskKind, prefs: NotificationPrefs): boolean {
  if (isRxKind(kind)) return prefs.notifyRx;
  if (kind === 'task' || kind === 'reminder') return prefs.notifyTasks;
  return false;
}

type TaskInput = Pick<Task, 'id' | 'title' | 'completed' | 'kind' | 'startTime'> & {
  dayId: string;
};

function pushIfInWindow(
  out: NotifiableOccurrence[],
  occ: NotifiableOccurrence,
  from?: Date,
  to?: Date
): void {
  if (from && occ.fireAt < from) return;
  if (to && occ.fireAt > to) return;
  out.push(occ);
}

/**
 * Genera avisos en los 3 modos habilitados:
 * - before: X min antes (requiere hora)
 * - day_before: día anterior a la hora configurada
 * - past: X min después de la hora si sigue incompleto (requiere hora)
 */
export function collectNotifiableOccurrences(
  tasks: TaskInput[],
  prefs: NotificationPrefs,
  options?: {
    language?: 'es' | 'en';
    from?: Date;
    to?: Date;
    includeCompleted?: boolean;
  }
): NotifiableOccurrence[] {
  const language = options?.language ?? 'es';
  const minutesBefore = normalizeMinutesBefore(prefs.notifyMinutesBefore);
  const pastAfter = normalizePastAfter(prefs.notifyPastAfterMinutes);
  const dayBeforeTime = normalizeDayBeforeTime(prefs.notifyDayBeforeTime);
  const out: NotifiableOccurrence[] = [];

  for (const task of tasks) {
    if (!options?.includeCompleted && task.completed) continue;
    if (!shouldIncludeKind(task.kind, prefs)) continue;

    const hasTime = Boolean(task.startTime && TIME_RE.test(task.startTime));
    const startTime = hasTime ? (task.startTime as string) : '';

    let dueAt: Date;
    try {
      dueAt = hasTime
        ? zonedDateTimeToUtc(task.dayId, startTime, prefs.timezone)
        : zonedDateTimeToUtc(task.dayId, '12:00', prefs.timezone);
    } catch {
      continue;
    }

    // 1) Antes / en el momento
    if (prefs.notifyBeforeEnabled && hasTime) {
      const fireAt = new Date(dueAt.getTime() - minutesBefore * 60_000);
      const copy = buildModeCopy(
        'before',
        task.kind,
        task.title,
        startTime,
        minutesBefore,
        language
      );
      pushIfInWindow(
        out,
        {
          taskId: task.id,
          title: task.title,
          dayId: task.dayId,
          startTime,
          kind: task.kind,
          mode: 'before',
          fireAt,
          dueAt,
          headline: copy.headline,
          body: copy.body,
        },
        options?.from,
        options?.to
      );
    }

    // 2) Día anterior — “mañana vas a…”
    if (prefs.notifyDayBefore) {
      try {
        const prevDay = addDaysToDayId(task.dayId, -1);
        const fireAt = zonedDateTimeToUtc(prevDay, dayBeforeTime, prefs.timezone);
        const copy = buildModeCopy(
          'day_before',
          task.kind,
          task.title,
          startTime || null,
          0,
          language
        );
        pushIfInWindow(
          out,
          {
            taskId: task.id,
            title: task.title,
            dayId: task.dayId,
            startTime,
            kind: task.kind,
            mode: 'day_before',
            fireAt,
            dueAt,
            headline: copy.headline,
            body: copy.body,
          },
          options?.from,
          options?.to
        );
      } catch {
        /* skip bad day */
      }
    }

    // 3) Pasado incompleto — “¿ya hiciste esto?”
    if (prefs.notifyPastIncomplete && hasTime) {
      const fireAt = new Date(dueAt.getTime() + pastAfter * 60_000);
      const copy = buildModeCopy(
        'past',
        task.kind,
        task.title,
        startTime,
        0,
        language
      );
      pushIfInWindow(
        out,
        {
          taskId: task.id,
          title: task.title,
          dayId: task.dayId,
          startTime,
          kind: task.kind,
          mode: 'past',
          fireAt,
          dueAt,
          headline: copy.headline,
          body: copy.body,
        },
        options?.from,
        options?.to
      );
    }
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
