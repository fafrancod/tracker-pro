import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import {
  mapAdminUser,
  matchesAdminFilters,
  summarizeAdminUsers,
  type ProfileRow,
  type UserStatRow,
} from '../lib/adminStats.js';
import { ONLINE_WINDOW_MS, type AdminPlan } from '@daily-tracker/core';

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);
adminRouter.use(rateLimit({ windowMs: 60_000, max: 40 }));

const PROFILE_COLUMNS =
  'id, name, email, plan, created_at, last_seen_at, last_path, last_app_version, last_platform';

async function loadProfiles(): Promise<ProfileRow[]> {
  const admin = getSupabaseAdmin();
  const full = await admin.from('profiles').select(PROFILE_COLUMNS);
  if (!full.error && Array.isArray(full.data)) {
    return full.data as ProfileRow[];
  }

  // Sin columnas de presencia (SQL aún no aplicado).
  const basic = await admin.from('profiles').select('id, name, email, plan, created_at');
  if (basic.error) throw basic.error;
  return (basic.data ?? []) as ProfileRow[];
}

async function loadStatsByUser(): Promise<{
  byUser: Map<string, UserStatRow>;
  storageFromSql: boolean;
}> {
  const { data, error } = await getSupabaseAdmin().rpc('admin_user_stats');
  if (!error && Array.isArray(data)) {
    const byUser = new Map<string, UserStatRow>();
    for (const raw of data as UserStatRow[]) {
      if (raw?.user_id) byUser.set(String(raw.user_id), raw);
    }
    return { byUser, storageFromSql: true };
  }

  const byUser = await loadCountFallback();
  return { byUser, storageFromSql: false };
}

async function countByUser(table: string): Promise<Map<string, number>> {
  const { data, error } = await getSupabaseAdmin().from(table).select('user_id');
  const map = new Map<string, number>();
  if (error || !Array.isArray(data)) return map;
  for (const row of data as Array<{ user_id?: string }>) {
    if (!row.user_id) continue;
    map.set(row.user_id, (map.get(row.user_id) ?? 0) + 1);
  }
  return map;
}

async function loadCountFallback(): Promise<Map<string, UserStatRow>> {
  const [tasks, projects, contacts, finance] = await Promise.all([
    countByUser('tasks'),
    countByUser('projects'),
    countByUser('contacts'),
    countByUser('finance_entries'),
  ]);
  const ids = new Set<string>([
    ...tasks.keys(),
    ...projects.keys(),
    ...contacts.keys(),
    ...finance.keys(),
  ]);
  const byUser = new Map<string, UserStatRow>();
  for (const userId of ids) {
    byUser.set(userId, {
      user_id: userId,
      tasks_count: tasks.get(userId) ?? 0,
      projects_count: projects.get(userId) ?? 0,
      contacts_count: contacts.get(userId) ?? 0,
      finance_count: finance.get(userId) ?? 0,
      total_bytes: null,
    });
  }
  return byUser;
}

async function buildAdminSnapshot() {
  const nowMs = Date.now();
  const [profiles, stats] = await Promise.all([loadProfiles(), loadStatsByUser()]);
  const users = profiles.map(profile =>
    mapAdminUser(profile, stats.byUser.get(profile.id), nowMs)
  );
  users.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    const aSeen = a.lastSeenAt || '';
    const bSeen = b.lastSeenAt || '';
    if (aSeen !== bSeen) return bSeen.localeCompare(aSeen);
    return a.email.localeCompare(b.email) || a.userId.localeCompare(b.userId);
  });
  const summary = summarizeAdminUsers(users, stats.storageFromSql);
  return { users, summary, storageFromSql: stats.storageFromSql };
}

const listQuerySchema = z.object({
  search: z.string().max(120).optional(),
  plan: z.enum(['all', 'free', 'pro']).optional(),
});

adminRouter.get('/users', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      plan: typeof req.query.plan === 'string' ? req.query.plan : undefined,
    });
    const search = (query.search ?? '').trim().toLowerCase();
    const plan = query.plan ?? 'all';
    const snap = await buildAdminSnapshot();
    const filtered = snap.users.filter(row => matchesAdminFilters(row, search, plan));
    res.json({
      users: filtered,
      matched: filtered.length,
      summary: snap.summary,
      generatedAt: new Date().toISOString(),
      onlineWindowSeconds: Math.round(ONLINE_WINDOW_MS / 1000),
      storageFromSql: snap.storageFromSql,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/overview', async (_req, res, next) => {
  try {
    const snap = await buildAdminSnapshot();
    res.json({
      registered: snap.summary.registered,
      online: snap.summary.online,
      onlineWindowSeconds: Math.round(ONLINE_WINDOW_MS / 1000),
      planCounts: snap.summary.planCounts,
      platformCounts: snap.summary.platformCounts,
      totalStorageMb: snap.summary.totalStorageMb,
      totals: snap.summary.totals,
      generatedAt: new Date().toISOString(),
      storageFromSql: snap.storageFromSql,
    });
  } catch (err) {
    next(err);
  }
});

const planSchema = z.object({
  plan: z.enum(['free', 'pro']),
});

adminRouter.patch('/users/:id/plan', async (req, res, next) => {
  try {
    const userId = String(req.params.id ?? '').trim();
    if (!userId) throw ApiError.badRequest('Falta el id de usuario');
    const { plan } = planSchema.parse(req.body ?? {});
    const { data, error } = await getSupabaseAdmin()
      .from('profiles')
      .update({ plan })
      .eq('id', userId)
      .select('id, plan')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw ApiError.notFound('Usuario no encontrado');
    res.json({ userId: data.id as string, plan: data.plan as AdminPlan });
  } catch (err) {
    next(err);
  }
});
