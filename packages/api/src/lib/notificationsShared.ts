/**
 * Mirror of packages/core/src/lib/notifications.ts for the API bundle.
 * Keep in sync when changing scheduling rules.
 */

import { addDaysToDayId } from './recurrence.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const NOTIFY_MINUTES_OPTIONS = [0, 5, 10, 15, 30, 60] as const;
export const NOTIFY_PAST_AFTER_OPTIONS = [15, 30, 60, 120, 240] as const;

export type NotifyMode = 'before' | 'day_before' | 'past';

export interface NotificationPrefs {
  notifyLocal: boolean;
  notifyEmail: boolean;
  notifyBeforeEnabled: boolean;
  notifyMinutesBefore: number;
  notifyDayBefore: boolean;
  notifyDayBeforeTime: string;
  notifyPastIncomplete: boolean;
  notifyPastAfterMinutes: number;
  notifyTasks: boolean;
  notifyRx: boolean;
  timezone: string;
}

export interface NotifiableOccurrence {
  taskId: string;
  title: string;
  dayId: string;
  startTime: string;
  kind: string;
  mode: NotifyMode;
  fireAt: Date;
  dueAt: Date;
  headline: string;
  body: string;
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
  settings: Record<string, unknown> | Partial<NotificationPrefs> | null | undefined
): NotificationPrefs {
  if (!settings) return defaultNotificationPrefs();
  const s = settings as Record<string, unknown>;
  return defaultNotificationPrefs({
    notifyLocal: s.notifyLocal as boolean | undefined,
    notifyEmail: s.notifyEmail as boolean | undefined,
    notifyBeforeEnabled: s.notifyBeforeEnabled as boolean | undefined,
    notifyMinutesBefore: s.notifyMinutesBefore as number | undefined,
    notifyDayBefore: s.notifyDayBefore as boolean | undefined,
    notifyDayBeforeTime: s.notifyDayBeforeTime as string | undefined,
    notifyPastIncomplete: s.notifyPastIncomplete as boolean | undefined,
    notifyPastAfterMinutes: s.notifyPastAfterMinutes as number | undefined,
    notifyTasks: s.notifyTasks as boolean | undefined,
    notifyRx: s.notifyRx as boolean | undefined,
    timezone: s.timezone as string | undefined,
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

export function notificationFireKey(
  taskId: string,
  dayId: string,
  startTime: string,
  mode: NotifyMode,
  channel: 'email' | 'local'
): string {
  return `${taskId}|${dayId}|${startTime || 'allday'}|${mode}|${channel}`;
}

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

function isRxKind(kind: string): boolean {
  return kind === 'rx_human' || kind === 'rx_pet';
}

export function buildModeCopy(
  mode: NotifyMode,
  kind: string,
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

function shouldIncludeKind(kind: string, prefs: NotificationPrefs): boolean {
  if (isRxKind(kind)) return prefs.notifyRx;
  if (
    kind === 'task' ||
    kind === 'reminder' ||
    kind === 'possible_event' ||
    kind === 'event'
  ) {
    return prefs.notifyTasks;
  }
  return false;
}

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

export function collectNotifiableOccurrences(
  tasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    kind: string;
    startTime: string | null;
    dayId: string;
    /** Hora de salida prevista (eventos). Prioridad sobre startTime para avisos. */
    departureTime?: string | null;
    location?: string | null;
  }>,
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

    // Eventos: ancla de notificaciones = salida prevista si existe; si no, horario del evento.
    const anchorRaw =
      task.kind === 'event' && task.departureTime && TIME_RE.test(task.departureTime)
        ? task.departureTime
        : task.startTime;
    const hasTime = Boolean(anchorRaw && TIME_RE.test(anchorRaw));
    const startTime = hasTime ? (anchorRaw as string) : '';
    const displayTitle =
      task.kind === 'event' && task.location
        ? `${task.title} · ${task.location}`
        : task.title;

    let dueAt: Date;
    try {
      dueAt = hasTime
        ? zonedDateTimeToUtc(task.dayId, startTime, prefs.timezone)
        : zonedDateTimeToUtc(task.dayId, '12:00', prefs.timezone);
    } catch {
      continue;
    }

    if (prefs.notifyBeforeEnabled && hasTime) {
      const fireAt = new Date(dueAt.getTime() - minutesBefore * 60_000);
      const copy = buildModeCopy(
        'before',
        task.kind,
        displayTitle,
        startTime,
        minutesBefore,
        language
      );
      pushIfInWindow(
        out,
        {
          taskId: task.id,
          title: displayTitle,
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

    if (prefs.notifyDayBefore) {
      try {
        const prevDay = addDaysToDayId(task.dayId, -1);
        const fireAt = zonedDateTimeToUtc(prevDay, dayBeforeTime, prefs.timezone);
        const copy = buildModeCopy(
          'day_before',
          task.kind,
          displayTitle,
          startTime || null,
          0,
          language
        );
        pushIfInWindow(
          out,
          {
            taskId: task.id,
            title: displayTitle,
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
        /* skip */
      }
    }

    if (prefs.notifyPastIncomplete && hasTime) {
      const fireAt = new Date(dueAt.getTime() + pastAfter * 60_000);
      const copy = buildModeCopy(
        'past',
        task.kind,
        displayTitle,
        startTime,
        0,
        language
      );
      pushIfInWindow(
        out,
        {
          taskId: task.id,
          title: displayTitle,
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
