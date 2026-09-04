import { Router } from 'express';
import { z } from 'zod';
import { resolveDefaultCurrency } from '@daily-tracker/core';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { currentPeriod } from '../lib/period.js';
import { ApiError } from '../errors.js';

export const authRouter = Router();

authRouter.use(requireAuth);
authRouter.use(rateLimit({ windowMs: 60_000, max: 40 }));

const presenceSchema = z.object({
  path: z.string().max(200).optional(),
  appVersion: z.string().max(40).optional(),
  platform: z.enum(['web', 'native']).optional(),
});

const deleteMeSchema = z.object({
  email: z.string().trim().min(3).max(320),
});

authRouter.delete(
  '/me',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 3 }),
  async (req, res, next) => {
    try {
      const { uid, email } = req.user!;
      const body = deleteMeSchema.parse(req.body ?? {});
      const expected = (email ?? '').trim().toLowerCase();
      if (!expected || body.email.trim().toLowerCase() !== expected) {
        throw ApiError.forbidden('El email no coincide');
      }

      const admin = getSupabaseAdmin();
      const { error: anonError } = await admin
        .from('error_logs')
        .update({ uid: null, ip: null, user_agent: null })
        .eq('uid', uid);
      if (anonError) throw anonError;

      const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
      if (deleteError) throw deleteError;

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post('/presence', async (req, res, next) => {
  try {
    const { uid } = req.user!;
    const body = presenceSchema.parse(req.body ?? {});
    const patch: Record<string, string> = {
      last_seen_at: new Date().toISOString(),
    };
    if (body.path) patch.last_path = body.path;
    if (body.appVersion) patch.last_app_version = body.appVersion;
    if (body.platform) patch.last_platform = body.platform;

    const { error } = await getSupabaseAdmin().from('profiles').update(patch).eq('id', uid);
    if (error) {
      res.status(200).json({ persisted: false });
      return;
    }
    res.status(200).json({ persisted: true });
  } catch (err) {
    next(err);
  }
});

const bootstrapSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  timezone: z.string().min(1).max(80).optional(),
});

function buildDefaultSettings(timezone?: string) {
  const tz = timezone?.trim() || 'UTC';
  return {
    autoRollIncomplete: false,
    defaultProjectId: null,
    weekStartsOnMonday: true,
    language: 'es' as const,
    defaultBoardView: 'continuous' as const,
    skinId: 'dark-github',
    dayStartHour: 7,
    dayEndHour: 22,
    defaultScheduleLayout: 'list' as const,
    notifyLocal: true,
    notifyEmail: false,
    notifyBeforeEnabled: true,
    notifyMinutesBefore: 10,
    notifyDayBefore: true,
    notifyDayBeforeTime: '20:00',
    notifyPastIncomplete: true,
    notifyPastAfterMinutes: 30,
    notifyTasks: true,
    notifyRx: true,
    timezone: tz,
    preferredCurrency: resolveDefaultCurrency({ timezone: tz, locale: 'es' }),
    financeBanks: [],
    hideCompletedTasks: false,
    completedTaskStyle: 'strikethrough',
    onboardingTourCompleted: false,
    boardFilters: {
      kinds: 'all',
      projectIds: 'all',
      urgency: 'all',
      importance: 'all',
    },
  };
}

authRouter.post('/bootstrap', async (req, res, next) => {
  try {
    const { uid, email } = req.user!;
    if (!email) {
      throw ApiError.badRequest('El token no tiene email asociado.');
    }
    const { name, timezone } = bootstrapSchema.parse(req.body ?? {});

    const { data: existing } = await getSupabaseAdmin()
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (existing) {
      res.status(200).json({
        uid,
        created: false,
        profile: mapProfile(existing),
      });
      return;
    }

    const newProfile = {
      id: uid,
      name: name ?? email.split('@')[0],
      email,
      plan: 'free' as const,
      settings: buildDefaultSettings(timezone),
    };

    const { data: inserted, error: profileError } = await getSupabaseAdmin()
      .from('profiles')
      .insert(newProfile)
      .select()
      .single();
    if (profileError) throw profileError;

    const period = currentPeriod();
    await getSupabaseAdmin().from('usage_counters').upsert(
      {
        user_id: uid,
        period,
        tasks_created: 0,
        projects_created: 0,
      },
      { onConflict: 'user_id,period' }
    );

    res.status(201).json({
      uid,
      created: true,
      profile: mapProfile(inserted),
    });
  } catch (err) {
    next(err);
  }
});

function mapProfile(row: Record<string, unknown>) {
  return {
    name: row.name as string,
    email: row.email as string,
    plan: row.plan as string,
    createdAt:
      typeof row.created_at === 'string'
        ? row.created_at
        : new Date().toISOString(),
    settings: row.settings as Record<string, unknown>,
  };
}