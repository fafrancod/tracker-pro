import { Router } from 'express';
import { z } from 'zod';
import { db, FieldValue } from '../firebaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';
import { countProjects, readProfilePlan } from '../lib/usage.js';
import { getLimits } from '../lib/planLimits.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);
projectsRouter.use(rateLimit({ windowMs: 60_000, max: 60 }));

const createSchema = z.object({
  name: z.string().min(1).max(60).trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/i, 'Color debe ser hex #RRGGBB'),
  icon: z.string().min(1).max(8),
});

const updateSchema = z
  .object({
    name: z.string().min(1).max(60).trim().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/i).optional(),
    icon: z.string().min(1).max(8).optional(),
    order: z.number().int().nonnegative().optional(),
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
    const data = {
      ...body,
      order: existing,
      createdAt: FieldValue.serverTimestamp(),
    };
    await db.doc(`users/${uid}/projects/${projectId}`).set(data);

    res.status(201).json({ id: projectId, ...body, order: existing });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch('/:projectId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { projectId } = req.params;
    const patch = updateSchema.parse(req.body);

    const ref = db.doc(`users/${uid}/projects/${projectId}`);
    const snap = await ref.get();
    if (!snap.exists) throw ApiError.notFound('Project not found');

    await ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
    res.json({ id: projectId, ...patch });
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:projectId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { projectId } = req.params;
    const ref = db.doc(`users/${uid}/projects/${projectId}`);
    const snap = await ref.get();
    if (!snap.exists) throw ApiError.notFound('Project not found');
    await ref.delete();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
