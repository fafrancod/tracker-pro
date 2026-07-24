import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';
import { isValidDayId, isValidWeekId } from '../lib/period.js';
import { bumpUsage, readProfilePlan, readUsage } from '../lib/usage.js';
import { getLimits } from '../lib/planLimits.js';
import {
  getWeekIdFromDayId,
  materializeOccurrenceDayIds,
  normalizeRecurrence,
  type RecurrenceFrequency,
} from '../lib/recurrence.js';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);
tasksRouter.use(rateLimit({ windowMs: 60_000, max: 120 }));

const taskLocation = z.object({
  weekId: z.string().refine(isValidWeekId, 'weekId formato YYYY-Www'),
  dayId: z.string().refine(isValidDayId, 'dayId formato YYYY-MM-DD'),
});

const prioritySchema = z.enum(['low', 'medium', 'high']);
const recurrenceFrequencySchema = z.enum(['none', 'daily', 'weekly', 'monthly']);

const createSchema = taskLocation.extend({
  title: z.string().min(1).max(280).trim(),
  projectId: z.string().nullable().optional(),
  priority: prioritySchema.optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  eventId: z.string().min(1).max(80).optional(),
  recurrenceFrequency: recurrenceFrequencySchema.optional(),
  recurrenceInterval: z.number().int().min(1).max(365).optional(),
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
    recurrenceFrequency: recurrenceFrequencySchema.optional(),
    recurrenceInterval: z.number().int().min(1).max(365).optional(),
  })
  .refine(p => Object.keys(p).length > 0, { message: 'patch vacio' });

function toClientTask(
  row: Record<string, unknown>,
  overrides?: { weekId?: string; dayId?: string }
) {
  const frequency = (row.recurrence_frequency as RecurrenceFrequency | undefined) ?? 'none';
  const interval = typeof row.recurrence_interval === 'number' ? row.recurrence_interval : 1;
  return {
    id: row.id as string,
    weekId: overrides?.weekId ?? (row.week_id as string),
    dayId: overrides?.dayId ?? (row.day_id as string),
    title: row.title as string,
    completed: Boolean(row.completed),
    completedAt: (row.completed_at as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    priority: (row.priority as string) ?? 'medium',
    notes: (row.notes as string) ?? '',
    order: typeof row.order === 'number' ? row.order : 0,
    tags: Array.isArray(row.tags) ? row.tags : [],
    movedFrom: (row.moved_from as string | null) ?? null,
    seriesId: (row.series_id as string | null) ?? null,
    recurrence: normalizeRecurrence(frequency, interval),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

tasksRouter.post('/', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const {
      weekId,
      dayId,
      title,
      projectId,
      priority,
      notes,
      tags,
      eventId,
      recurrenceFrequency,
      recurrenceInterval,
    } = createSchema.parse(req.body);

    const recurrence = normalizeRecurrence(recurrenceFrequency, recurrenceInterval);
    const occurrenceDays = materializeOccurrenceDayIds(
      dayId,
      recurrence.frequency,
      recurrence.interval
    );

    const plan = await readProfilePlan(uid);
    const limits = getLimits(plan);
    if (Number.isFinite(limits.maxTasksPerMonth)) {
      const usage = await readUsage(uid, monthFromDay(dayId));
      const tasksThisMonth = usage.tasks_created ?? 0;
      if (tasksThisMonth + occurrenceDays.length > limits.maxTasksPerMonth) {
        throw ApiError.planLimit(
          `Tu plan permite hasta ${limits.maxTasksPerMonth} tareas por mes.`,
          {
            plan,
            limit: limits.maxTasksPerMonth,
            current: tasksThisMonth,
            requested: occurrenceDays.length,
          }
        );
      }
    }

    const now = new Date().toISOString();
    const seriesId = generateId();
    const rows: Record<string, unknown>[] = [];

    // order por día: contamos tareas existentes en cada día de la serie
    const orderByDay = new Map<string, number>();
    for (const occDayId of occurrenceDays) {
      if (orderByDay.has(occDayId)) continue;
      const { count } = await getSupabaseAdmin()
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('day_id', occDayId);
      orderByDay.set(occDayId, count ?? 0);
    }

    for (const occDayId of occurrenceDays) {
      const occWeekId = occDayId === dayId ? weekId : getWeekIdFromDayId(occDayId);
      const order = orderByDay.get(occDayId) ?? 0;
      orderByDay.set(occDayId, order + 1);
      const taskId = generateId();
      rows.push({
        id: taskId,
        user_id: uid,
        week_id: occWeekId,
        day_id: occDayId,
        title,
        completed: false,
        completed_at: null,
        project_id: projectId ?? null,
        priority: priority ?? 'medium',
        notes: notes ?? '',
        order,
        tags: tags ?? [],
        moved_from: null,
        series_id: recurrence.frequency === 'none' ? null : seriesId,
        recurrence_frequency: recurrence.frequency,
        recurrence_interval: recurrence.interval,
        created_at: now,
        updated_at: now,
      });
    }

    const { error } = await getSupabaseAdmin().from('tasks').insert(rows);
    if (error) throw error;

    await bumpUsage(uid, { tasksCreated: rows.length }, eventId);

    const instances = rows.map(row => toClientTask(row));
    const first = instances[0];

    res.status(201).json({
      ...first,
      instances,
    });
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
    const now = new Date().toISOString();

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', uid)
      .eq('week_id', weekId)
      .eq('day_id', dayId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Task not found');

    const update: Record<string, unknown> = {
      updated_at: now,
    };
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.completed !== undefined) update.completed = patch.completed;
    if (patch.projectId !== undefined) update.project_id = patch.projectId;
    if (patch.priority !== undefined) update.priority = patch.priority;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.tags !== undefined) update.tags = patch.tags;
    if (patch.order !== undefined) update.order = patch.order;
    if (patch.movedFrom !== undefined) update.moved_from = patch.movedFrom;
    if (patch.recurrenceFrequency !== undefined) {
      update.recurrence_frequency = patch.recurrenceFrequency;
    }
    if (patch.recurrenceInterval !== undefined) {
      update.recurrence_interval = patch.recurrenceInterval;
    }
    if (patch.completed === true) update.completed_at = now;
    if (patch.completed === false) update.completed_at = null;

    const { error } = await getSupabaseAdmin()
      .from('tasks')
      .update(update)
      .eq('id', taskId)
      .eq('user_id', uid);
    if (error) throw error;

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

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .eq('user_id', uid)
      .eq('week_id', weekId)
      .eq('day_id', dayId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Task not found');

    const { error } = await getSupabaseAdmin()
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', uid);
    if (error) throw error;

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

    const { data: fromTask, error: fetchError } = await getSupabaseAdmin()
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', uid)
      .eq('week_id', weekId)
      .eq('day_id', dayId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!fromTask) throw ApiError.notFound('Task not found');

    const now = new Date().toISOString();
    const { error: insertError } = await getSupabaseAdmin().from('tasks').insert({
      ...fromTask,
      week_id: toWeekId,
      day_id: toDayId,
      moved_from: dayId,
      updated_at: now,
    });
    if (insertError) throw insertError;

    const { error: deleteError } = await getSupabaseAdmin()
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', uid)
      .eq('week_id', weekId)
      .eq('day_id', dayId);
    if (deleteError) throw deleteError;

    res.json({ id: taskId, weekId: toWeekId, dayId: toDayId, movedFrom: dayId });
  } catch (err) {
    next(err);
  }
});

function monthFromDay(dayId: string): string {
  return dayId.slice(0, 7);
}
