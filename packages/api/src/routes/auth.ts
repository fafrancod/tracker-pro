import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { currentPeriod } from '../lib/period.js';
import { ApiError } from '../errors.js';

export const authRouter = Router();

authRouter.use(requireAuth);
authRouter.use(rateLimit({ windowMs: 60_000, max: 20 }));

const bootstrapSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

const DEFAULT_SETTINGS = {
  autoRollIncomplete: false,
  defaultProjectId: null,
  weekStartsOnMonday: true,
  language: 'es' as const,
  defaultBoardView: 'continuous' as const,
  skinId: 'dark-github',
  dayStartHour: 7,
  dayEndHour: 22,
  defaultScheduleLayout: 'list' as const,
};

authRouter.post('/bootstrap', async (req, res, next) => {
  try {
    const { uid, email } = req.user!;
    if (!email) {
      throw ApiError.badRequest('El token no tiene email asociado.');
    }
    const { name } = bootstrapSchema.parse(req.body ?? {});

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
      settings: DEFAULT_SETTINGS,
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