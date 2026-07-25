import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { config } from '../config.js';
import { isEmailConfigured } from '../lib/email.js';
import {
  dispatchDueEmailNotifications,
  sendTestEmailToUser,
} from '../lib/notificationDispatch.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

export const notificationsRouter = Router();

function cronAuthorized(req: Request): boolean {
  const secret = config.cronSecret?.trim();
  if (!secret) return false;
  const header = String(req.headers['x-cron-secret'] ?? '');
  const auth = String(req.headers.authorization ?? '');
  if (header && header === secret) return true;
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

/**
 * Auth flexible para dispatch:
 * - Si hay CRON_SECRET y coincide → OK (cron / Railway)
 * - Si no → requireAuth de usuario
 */
async function requireCronOrUser(req: Request, res: Response, next: NextFunction) {
  if (cronAuthorized(req)) {
    next();
    return;
  }
  if (config.cronSecret?.trim()) {
    // Secret configurado pero no enviado → 401 (no caer a user auth accidental)
    next(ApiError.unauthorized('Cron secret inválido'));
    return;
  }
  return requireAuth(req, res, next);
}

/**
 * Dispatch manual / cron externo.
 * Auth: x-cron-secret o Authorization: Bearer <CRON_SECRET>
 * Sin CRON_SECRET: requiere usuario autenticado (dev).
 */
notificationsRouter.post(
  '/dispatch',
  rateLimit({ windowMs: 60_000, max: 10 }),
  requireCronOrUser,
  async (_req, res, next) => {
    try {
      const summary = await dispatchDueEmailNotifications();
      res.json({ ok: true, ...summary });
    } catch (err) {
      next(err);
    }
  }
);

notificationsRouter.get(
  '/status',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 30 }),
  async (req, res, next) => {
    try {
      const uid = req.user!.uid;
      const { data: profile } = await getSupabaseAdmin()
        .from('profiles')
        .select('settings')
        .eq('id', uid)
        .maybeSingle();

      const settings = (profile?.settings ?? {}) as Record<string, unknown>;

      res.json({
        emailConfigured: isEmailConfigured(),
        notifyEmail: Boolean(settings.notifyEmail),
        notifyLocal: settings.notifyLocal !== false,
        notifyMinutesBefore: settings.notifyMinutesBefore ?? 10,
        workerEmbedded: config.worker.runEmbedded,
        from: isEmailConfigured() ? config.email.from : null,
      });
    } catch (err) {
      next(err);
    }
  }
);

notificationsRouter.post(
  '/test-email',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 5 }),
  async (req, res, next) => {
    try {
      const uid = req.user!.uid;
      const { data: profile, error } = await getSupabaseAdmin()
        .from('profiles')
        .select('name, email, settings')
        .eq('id', uid)
        .maybeSingle();
      if (error) throw error;
      if (!profile?.email) throw ApiError.badRequest('No hay email en el perfil');

      const language =
        (profile.settings as { language?: string } | null)?.language === 'en'
          ? 'en'
          : 'es';

      const result = await sendTestEmailToUser({
        email: profile.email as string,
        name: (profile.name as string) ?? '',
        language,
      });

      if (!result.ok) {
        throw ApiError.badRequest(result.error ?? 'No se pudo enviar el correo');
      }

      res.json({
        ok: true,
        skipped: Boolean(result.skipped),
        message: result.skipped
          ? 'Email no configurado en el servidor (RESEND_API_KEY).'
          : 'Correo de prueba enviado.',
      });
    } catch (err) {
      next(err);
    }
  }
);
