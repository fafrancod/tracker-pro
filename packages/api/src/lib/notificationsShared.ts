/**
 * Mirror of packages/core/src/lib/notifications.ts for the API bundle.
 * Keep in sync when changing scheduling rules.
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const NOTIFY_MINUTES_OPTIONS = [0, 5, 10, 15, 30, 60] as const;

export interface NotificationPrefs {
  notifyLocal: boolean;
  notifyEmail: boolean;
  notifyMinutesBefore: number;
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
  fireAt: Date;
  dueAt: Date;
  body: string;
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

export function prefsFromSettings(
  settings: Record<string, unknown> | Partial<NotificationPrefs> | null | undefined
): NotificationPrefs {
  if (!settings) return defaultNotificationPrefs();
  const s = settings as Record<string, unknown>;
  return defaultNotificationPrefs({
    notifyLocal: s.notifyLocal as boolean | undefined,
    notifyEmail: s.notifyEmail as boolean | undefined,
    notifyMinutesBefore: s.notifyMinutesBefore as number | undefined,
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

export function notificationFireKey(
  taskId: string,
  dayId: string,
  startTime: string,
  channel: 'email' | 'local'
): string {
  return `${taskId}|${dayId}|${startTime}|${channel}`;
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

export function buildOccurrenceBody(
  kind: string,
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

function shouldIncludeKind(kind: string, prefs: NotificationPrefs): boolean {
  if (isRxKind(kind)) return prefs.notifyRx;
  if (kind === 'task' || kind === 'reminder') return prefs.notifyTasks;
  return false;
}

export function collectNotifiableOccurrences(
  tasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    kind: string;
    startTime: string | null;
    dayId: string;
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
