/**
 * Notificaciones locales: Capacitor (Android) + Notification API (web).
 * Programa recordatorios de tareas/tomas con hora a partir del store.
 */

import {
  collectNotifiableOccurrences,
  prefsFromSettings,
  type NotifiableOccurrence,
} from '@core/lib/notifications';
import type { Task, UserSettings } from '@core/types';
import { isNativePlatform } from './capacitor';

const CHANNEL_ID = 'daily-tracker-reminders';
const MAX_SCHEDULED = 64;
/** Reprogramar ventana: próximos N días desde hoy. */
const HORIZON_DAYS = 7;

export type LocalPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getDeviceTimezone(): string {
  return detectTimezone();
}

export async function getLocalPermissionState(): Promise<LocalPermissionState> {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const { display } = await LocalNotifications.checkPermissions();
      if (display === 'granted') return 'granted';
      if (display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  }

  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

export async function requestLocalPermission(): Promise<LocalPermissionState> {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await ensureAndroidChannel();
      const { display } = await LocalNotifications.requestPermissions();
      if (display === 'granted') return 'granted';
      if (display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  }

  if (typeof Notification === 'undefined') return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted') return 'granted';
  if (result === 'denied') return 'denied';
  return 'prompt';
}

async function ensureAndroidChannel(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Recordatorios',
      description: 'Tomas de recetario y tareas con horario',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'default',
    });
  } catch {
    /* channel API Android only */
  }
}

/** Hash estable a id numérico positivo (Capacitor exige number). */
function notificationId(
  taskId: string,
  dayId: string,
  startTime: string,
  mode: string
): number {
  const raw = `${taskId}|${dayId}|${startTime}|${mode}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  // Avoid 0; keep positive 31-bit
  return (Math.abs(h) % 2_000_000_000) + 1;
}

function dayIdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function collectTasksFromStore(
  tasksByDay: Record<string, Record<string, Task[]>>,
  fromDayId: string,
  toDayId: string
): Array<Task & { dayId: string }> {
  const out: Array<Task & { dayId: string }> = [];
  for (const days of Object.values(tasksByDay)) {
    for (const [dayId, list] of Object.entries(days)) {
      if (dayId < fromDayId || dayId > toDayId) continue;
      for (const t of list) {
        out.push({ ...t, dayId });
      }
    }
  }
  return out;
}

export function buildUpcomingOccurrences(
  tasksByDay: Record<string, Record<string, Task[]>>,
  settings: Partial<UserSettings>,
  language: 'es' | 'en' = 'es'
): NotifiableOccurrence[] {
  const prefs = prefsFromSettings({
    ...settings,
    // Local always uses device TZ for scheduling accuracy on the phone/browser
    timezone: detectTimezone(),
  });
  if (!prefs.notifyLocal) return [];

  const now = new Date();
  // Ayer → horizonte: past nudges de hoy y day_before de próximos días
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  const fromDay = dayIdFromDate(start);
  const end = new Date(now);
  end.setDate(end.getDate() + HORIZON_DAYS);
  const toDay = dayIdFromDate(end);

  const tasks = collectTasksFromStore(tasksByDay, fromDay, toDay);
  // Only future fire times
  return collectNotifiableOccurrences(tasks, prefs, {
    language,
    from: now,
  }).slice(0, MAX_SCHEDULED);
}

/**
 * Cancela pendientes del plugin y reprograma la ventana actual.
 * No-op si notifyLocal=false o sin permiso.
 */
export async function rescheduleLocalNotifications(opts: {
  tasksByDay: Record<string, Record<string, Task[]>>;
  settings: Partial<UserSettings>;
  language?: 'es' | 'en';
}): Promise<{ scheduled: number; reason?: string }> {
  const prefs = prefsFromSettings(opts.settings);
  if (!prefs.notifyLocal) {
    await cancelAllLocal();
    return { scheduled: 0, reason: 'disabled' };
  }

  const perm = await getLocalPermissionState();
  if (perm !== 'granted') {
    return { scheduled: 0, reason: perm };
  }

  const occs = buildUpcomingOccurrences(
    opts.tasksByDay,
    opts.settings,
    opts.language ?? 'es'
  );

  if (isNativePlatform()) {
    return scheduleNative(occs);
  }
  return scheduleWeb(occs);
}

async function cancelAllLocal(): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id })),
        });
      }
    } catch {
      /* ignore */
    }
    return;
  }
  clearWebTimers();
}

async function scheduleNative(
  occs: NotifiableOccurrence[]
): Promise<{ scheduled: number; reason?: string }> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await ensureAndroidChannel();

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map(n => ({ id: n.id })),
      });
    }

    if (occs.length === 0) return { scheduled: 0 };

    await LocalNotifications.schedule({
      notifications: occs.map(o => ({
        id: notificationId(o.taskId, o.dayId, o.startTime, o.mode),
        title: o.headline || o.title,
        body: o.body,
        schedule: { at: o.fireAt, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        extra: {
          taskId: o.taskId,
          dayId: o.dayId,
          startTime: o.startTime,
          mode: o.mode,
        },
      })),
    });

    return { scheduled: occs.length };
  } catch (err) {
    console.warn('[localNotifications] native schedule failed', err);
    return { scheduled: 0, reason: 'error' };
  }
}

/** Web: timers en memoria (solo mientras la pestaña está viva). */
const webTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearWebTimers(): void {
  for (const t of webTimers.values()) clearTimeout(t);
  webTimers.clear();
}

function scheduleWeb(
  occs: NotifiableOccurrence[]
): { scheduled: number; reason?: string } {
  clearWebTimers();
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return { scheduled: 0, reason: 'unsupported' };
  }

  const now = Date.now();
  let n = 0;
  for (const o of occs) {
    const delay = o.fireAt.getTime() - now;
    if (delay < 0 || delay > HORIZON_DAYS * 86_400_000) continue;
    const key = `${o.taskId}|${o.dayId}|${o.startTime}|${o.mode}`;
    const handle = setTimeout(() => {
      webTimers.delete(key);
      try {
        new Notification(o.headline || o.title, {
          body: o.body,
          tag: key,
          silent: false,
        });
      } catch {
        /* ignore */
      }
    }, Math.min(delay, 2_147_000_000));
    webTimers.set(key, handle);
    n += 1;
  }
  return { scheduled: n };
}
