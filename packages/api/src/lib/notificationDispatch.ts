import {
  collectNotifiableOccurrences,
  notificationFireKey,
  prefsFromSettings,
  type NotificationPrefs,
} from './notificationsShared.js';
import { generateId } from './ids.js';
import { isEmailConfigured, reminderEmailHtml, sendEmail } from './email.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

export interface DispatchSummary {
  scannedUsers: number;
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
  emailConfigured: boolean;
}

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  settings: Record<string, unknown> | null;
};

type TaskRow = {
  id: string;
  title: string;
  completed: boolean;
  kind: string;
  start_time: string | null;
  day_id: string;
  departure_time?: string | null;
  location?: string | null;
};

function kindLabel(kind: string, language: 'es' | 'en'): string {
  if (kind === 'rx_human') return language === 'en' ? 'Prescription (human)' : 'Recetario (humano)';
  if (kind === 'rx_pet') return language === 'en' ? 'Prescription (pet)' : 'Recetario (mascota)';
  if (kind === 'reminder') return language === 'en' ? 'Reminder' : 'Recordatorio';
  if (kind === 'event') return language === 'en' ? 'Event' : 'Evento';
  if (kind === 'possible_event') {
    return language === 'en' ? 'Possible event' : 'Evento posible';
  }
  return language === 'en' ? 'Task' : 'Tarea';
}

function modeLabel(mode: string, language: 'es' | 'en'): string {
  if (mode === 'day_before') return language === 'en' ? 'Tomorrow' : 'Mañana';
  if (mode === 'past') return language === 'en' ? 'Follow-up' : 'Seguimiento';
  return language === 'en' ? 'Upcoming' : 'Próximo';
}

function languageFromSettings(settings: Record<string, unknown> | null): 'es' | 'en' {
  return settings?.language === 'en' ? 'en' : 'es';
}

/**
 * Escanea perfiles con notifyEmail y envía correos de ventanas debidas.
 * Idempotente vía notification_deliveries.fire_key.
 */
export async function dispatchDueEmailNotifications(
  now = new Date()
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    scannedUsers: 0,
    candidates: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    emailConfigured: isEmailConfigured(),
  };

  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    logger.warn('notification dispatch skipped: supabase not configured');
    return summary;
  }

  // Ventana amplia: worker cada ~60s + grace 2 min
  const from = new Date(now.getTime() - 2 * 60_000);
  const to = new Date(now.getTime() + 45_000);

  const { data: profiles, error: profileErr } = await getSupabaseAdmin()
    .from('profiles')
    .select('id, name, email, settings')
    .not('email', 'is', null);

  if (profileErr) throw profileErr;
  if (!profiles?.length) return summary;

  // day_id range: yesterday → tomorrow (timezone-safe buffer in UTC dates)
  const dayIds = surroundingDayIds(now, 1);

  for (const raw of profiles as ProfileRow[]) {
    const settings = (raw.settings ?? {}) as Record<string, unknown>;
    const prefs: NotificationPrefs = prefsFromSettings(
      settings as Parameters<typeof prefsFromSettings>[0]
    );
    if (!prefs.notifyEmail) continue;
    if (!raw.email) continue;

    summary.scannedUsers += 1;
    const language = languageFromSettings(settings);

    // Incluye sin hora (day_before) y con hora (before + past)
    const { data: tasks, error: taskErr } = await getSupabaseAdmin()
      .from('tasks')
      .select('id, title, completed, kind, start_time, day_id, departure_time, location')
      .eq('user_id', raw.id)
      .eq('completed', false)
      .in('day_id', dayIds);

    if (taskErr) {
      logger.warn({ err: taskErr, userId: raw.id }, 'notification task query failed');
      continue;
    }

    const mapped = ((tasks ?? []) as TaskRow[]).map(t => ({
      id: t.id,
      title: t.title,
      completed: Boolean(t.completed),
      kind: (t.kind as 'task') ?? 'task',
      startTime: t.start_time,
      dayId: t.day_id,
      departureTime: t.departure_time ?? null,
      location: t.location ?? null,
    }));

    const occs = collectNotifiableOccurrences(mapped, prefs, {
      language,
      from,
      to,
    });

    for (const occ of occs) {
      summary.candidates += 1;
      const fireKey = notificationFireKey(
        occ.taskId,
        occ.dayId,
        occ.startTime,
        occ.mode,
        'email'
      );

      // Dedupe: try insert first with unique constraint
      const deliveryId = generateId();
      const { error: insertErr } = await getSupabaseAdmin()
        .from('notification_deliveries')
        .insert({
          id: deliveryId,
          user_id: raw.id,
          task_id: occ.taskId,
          channel: 'email',
          fire_key: fireKey,
          scheduled_for: occ.fireAt.toISOString(),
          status: 'sent',
        });

      if (insertErr) {
        // Unique violation → already delivered
        if (
          insertErr.code === '23505' ||
          /duplicate|unique/i.test(insertErr.message ?? '')
        ) {
          summary.skipped += 1;
          continue;
        }
        logger.warn({ err: insertErr, fireKey }, 'delivery insert failed');
        summary.failed += 1;
        continue;
      }

      const subject = `${config.email.appName}: ${occ.headline}`;

      const html = reminderEmailHtml({
        userName: raw.name || raw.email.split('@')[0],
        title: occ.title,
        dayId: occ.dayId,
        startTime: occ.startTime || '—',
        body: occ.body,
        kindLabel: `${kindLabel(occ.kind, language)} · ${modeLabel(occ.mode, language)}`,
      });

      const result = await sendEmail({
        to: raw.email,
        subject,
        html,
        text: `${occ.headline}\n${occ.body}\n${occ.title}\n${occ.dayId} ${occ.startTime}`,
      });

      if (result.skipped) {
        summary.skipped += 1;
        await getSupabaseAdmin()
          .from('notification_deliveries')
          .update({ status: 'skipped', error: 'email_not_configured' })
          .eq('id', deliveryId);
        continue;
      }

      if (!result.ok) {
        summary.failed += 1;
        await getSupabaseAdmin()
          .from('notification_deliveries')
          .update({ status: 'failed', error: result.error ?? 'send_failed' })
          .eq('id', deliveryId);
        continue;
      }

      summary.sent += 1;
    }
  }

  return summary;
}

function surroundingDayIds(now: Date, radiusDays: number): string[] {
  const ids: string[] = [];
  for (let i = -radiusDays; i <= radiusDays + 1; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    ids.push(`${y}-${m}-${day}`);
  }
  // Also include local-ish calendar days from host
  for (let i = -radiusDays; i <= radiusDays + 1; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    ids.push(`${y}-${m}-${day}`);
  }
  return [...new Set(ids)];
}

export async function sendTestEmailToUser(opts: {
  email: string;
  name: string;
  language?: 'es' | 'en';
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const language = opts.language ?? 'es';
  const subject =
    language === 'en'
      ? `${config.email.appName}: test notification`
      : `${config.email.appName}: notificación de prueba`;
  const body =
    language === 'en'
      ? 'This is a test email from Daily Tracker.'
      : 'Este es un correo de prueba de Daily Tracker.';
  const html = reminderEmailHtml({
    userName: opts.name || opts.email.split('@')[0],
    title: language === 'en' ? 'Test reminder' : 'Recordatorio de prueba',
    dayId: new Date().toISOString().slice(0, 10),
    startTime: new Date().toISOString().slice(11, 16),
    body,
    kindLabel: language === 'en' ? 'System' : 'Sistema',
  });
  return sendEmail({ to: opts.email, subject, html, text: body });
}
