import { Router } from 'express';
import { z } from 'zod';
import { db, FieldValue } from '../firebaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';
import { isValidDayId, isValidWeekId } from '../lib/period.js';
import { bumpUsage, readProfilePlan } from '../lib/usage.js';
import { getLimits } from '../lib/planLimits.js';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);
tasksRouter.use(rateLimit({ windowMs: 60_000, max: 120 }));

const taskLocation = z.object({
  weekId: z.string().refine(isValidWeekId, 'weekId formato YYYY-Www'),
  dayId: z.string().refine(isValidDayId, 'dayId formato YYYY-MM-DD'),
});

const prioritySchema = z.enum(['low', 'medium', 'high']);

const createSchema = taskLocation.extend({
  title: z.string().min(1).max(280).trim(),
  projectId: z.string().nullable().optional(),
  priority: prioritySchema.optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  eventId: z.string().min(1).max(80).optional(),
});

const updateSchema = z
  .object({
    title: z.string().min(1).max(280).trim().optional(),
    completed: z.boolean().optional(),
    projectId: z.string().nullable().optional(),
    priority: prioritySchema.optional(),
    notes: z.string().max(4000).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    order: z.number().int().nonnegative().optional(),
    movedFrom: z.string().nullable().optional(),
  })
  .refine(p => Object.keys(p).length > 0, { message: 'patch vacio' });

function taskPath(uid: string, weekId: string, dayId: string, taskId: string) {
  return `users/${uid}/weeks/${weekId}/days/${dayId}/tasks/${taskId}`;
}

tasksRouter.post('/', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { weekId, dayId, title, projectId, priority, notes, tags, eventId } =
      createSchema.parse(req.body);

    const plan = await readProfilePlan(uid);
    const limits = getLimits(plan);
    if (Number.isFinite(limits.maxTasksPerMonth)) {
      const usageSnap = await db.doc(`users/${uid}/usage/${monthFromDay(dayId)}`).get();
      const tasksThisMonth = (usageSnap.get('tasksCreated') as number | undefined) ?? 0;
      if (tasksThisMonth >= limits.maxTasksPerMonth) {
        throw ApiError.planLimit(
          `Tu plan permite hasta ${limits.maxTasksPerMonth} tareas por mes.`,
          { plan, limit: limits.maxTasksPerMonth, current: tasksThisMonth }
        );
      }
    }

    const taskId = generateId();
    const colRef = db.collection(`users/${uid}/weeks/${weekId}/days/${dayId}/tasks`);
    const orderSnap = await colRef.count().get();

    const taskDoc = {
      title,
      completed: false,
      completedAt: null,
      projectId: projectId ?? null,
      priority: priority ?? 'medium',
      notes: notes ?? '',
      order: orderSnap.data().count,
      tags: tags ?? [],
      movedFrom: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await colRef.doc(taskId).set(taskDoc);
    await bumpUsage(uid, { tasksCreated: 1 }, eventId);

    res.status(201).json({ id: taskId, weekId, dayId, ...taskDoc, createdAt: null, updatedAt: null });
  } catch (err) {
    next(err);
  }
});

tasksRouter.patch('/:weekId/:dayId/:taskId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { weekId, dayId, taskId } = req.params;
    if (!isValidWeekId(weekId) || !isValidDayId(dayId)) {
      throw ApiError.badRequest('weekId/dayId con formato invalido');
    }
    const patch = updateSchema.parse(req.body);

    const ref = db.doc(taskPath(uid, weekId, dayId, taskId));
    const snap = await ref.get();
    if (!snap.exists) throw ApiError.notFound('Task not found');

    const update: Record<string, unknown> = {
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (patch.completed === true) {
      update.completedAt = FieldValue.serverTimestamp();
    } else if (patch.completed === false) {
      update.completedAt = null;
    }

    await ref.update(update);
    res.json({ id: taskId, weekId, dayId, ...patch });
  } catch (err) {
    next(err);
  }
});

tasksRouter.delete('/:weekId/:dayId/:taskId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { weekId, dayId, taskId } = req.params;
    if (!isValidWeekId(weekId) || !isValidDayId(dayId)) {
      throw ApiError.badRequest('weekId/dayId con formato invalido');
    }
    const ref = db.doc(taskPath(uid, weekId, dayId, taskId));
    const snap = await ref.get();
    if (!snap.exists) throw ApiError.notFound('Task not found');
    await ref.delete();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

const moveSchema = z.object({
  toWeekId: z.string().refine(isValidWeekId),
  toDayId: z.string().refine(isValidDayId),
});

tasksRouter.post('/:weekId/:dayId/:taskId/move', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { weekId, dayId, taskId } = req.params;
    if (!isValidWeekId(weekId) || !isValidDayId(dayId)) {
      throw ApiError.badRequest('weekId/dayId con formato invalido');
    }
    const { toWeekId, toDayId } = moveSchema.parse(req.body);

    const fromRef = db.doc(taskPath(uid, weekId, dayId, taskId));
    const snap = await fromRef.get();
    if (!snap.exists) throw ApiError.notFound('Task not found');

    const data = snap.data()!;
    const toRef = db.doc(taskPath(uid, toWeekId, toDayId, taskId));
    await db.runTransaction(async tx => {
      tx.set(toRef, {
        ...data,
        movedFrom: dayId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.delete(fromRef);
    });

    res.json({ id: taskId, weekId: toWeekId, dayId: toDayId, movedFrom: dayId });
  } catch (err) {
    next(err);
  }
});

function monthFromDay(dayId: string): string {
  // dayId: YYYY-MM-DD → YYYY-MM
  return dayId.slice(0, 7);
}
