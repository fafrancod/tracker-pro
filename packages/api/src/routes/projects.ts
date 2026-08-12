import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';
import { countProjects, readProfilePlan } from '../lib/usage.js';
import { getLimits } from '../lib/planLimits.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);
projectsRouter.use(rateLimit({ windowMs: 60_000, max: 60 }));

const MAX_PROJECT_CATEGORIES = 20;

function normalizeCategories(
  raw: unknown
): Array<{ id: string; name: string; order: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ id: string; name: string; order: number }> = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 40) : '';
    if (!name) continue;
    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    let id =
      typeof o.id === 'string' && o.id.trim()
        ? o.id.trim().slice(0, 80)
        : generateId();
    if (seenIds.has(id)) id = generateId();
    seenIds.add(id);
    out.push({
      id,
      name,
      order: typeof o.order === 'number' ? o.order : out.length,
    });
    if (out.length >= MAX_PROJECT_CATEGORIES) break;
  }
  return out
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((c, i) => ({ ...c, order: i }));
}

const createSchema = z.object({
  name: z.string().min(1).max(60).trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/i, 'Color debe ser hex #RRGGBB'),
  icon: z.string().min(1).max(8),
  categories: z.array(z.unknown()).max(MAX_PROJECT_CATEGORIES).optional(),
});

const updateSchema = z
  .object({
    name: z.string().min(1).max(60).trim().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/i).optional(),
    icon: z.string().min(1).max(8).optional(),
    order: z.number().int().nonnegative().optional(),
    categories: z.array(z.unknown()).max(MAX_PROJECT_CATEGORIES).optional(),
  })
  .refine(p => Object.keys(p).length > 0, { message: 'patch vacio' });

projectsRouter.post('/', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);

    const plan = await readProfilePlan(uid);
    const limits = getLimits(plan);
    const existing = await countProjects(uid);
    if (existing >= limits.maxProjects) {
      throw ApiError.planLimit(
        `Tu plan permite hasta ${limits.maxProjects} proyectos.`,
        { plan, limit: limits.maxProjects, current: existing }
      );
    }

    const projectId = generateId();
    const categories = normalizeCategories(body.categories);
    const { error } = await getSupabaseAdmin().from('projects').insert({
      id: projectId,
      user_id: uid,
      name: body.name,
      color: body.color,
      icon: body.icon,
      categories,
      order: existing,
    });
    if (error) throw error;

    res.status(201).json({
      id: projectId,
      name: body.name,
      color: body.color,
      icon: body.icon,
      categories,
      order: existing,
    });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch('/:projectId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { projectId } = req.params;
    const patch = updateSchema.parse(req.body);

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Project not found');

    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.color !== undefined) update.color = patch.color;
    if (patch.icon !== undefined) update.icon = patch.icon;
    if (patch.order !== undefined) update.order = patch.order;
    if (patch.categories !== undefined) {
      update.categories = normalizeCategories(patch.categories);
    }

    const { error } = await getSupabaseAdmin()
      .from('projects')
      .update(update)
      .eq('id', projectId)
      .eq('user_id', uid);
    if (error) throw error;

    res.json({ id: projectId, ...update });
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:projectId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { projectId } = req.params;

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Project not found');

    const { error } = await getSupabaseAdmin()
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', uid);
    if (error) throw error;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});