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
  addDaysToDayId,
  getWeekIdFromDayId,
  inclusiveDurationDays,
  materializeOccurrenceRanges,
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
const urgencySchema = z.enum(['urgent', 'not_urgent']);
const importanceSchema = z.enum(['important', 'not_important']);

const createSchema = taskLocation.extend({
  title: z.string().min(1).max(280).trim(),
  projectId: z.string().nullable().optional(),
  priority: prioritySchema.optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  eventId: z.string().min(1).max(80).optional(),
  endDayId: z.string().refine(isValidDayId, 'endDayId formato YYYY-MM-DD').optional(),
  recurrenceFrequency: recurrenceFrequencySchema.optional(),
  recurrenceInterval: z.number().int().min(1).max(365).optional(),
  urgency: urgencySchema.nullable().optional(),
  importance: importanceSchema.nullable().optional(),
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
    endDayId: z.string().refine(isValidDayId, 'endDayId formato YYYY-MM-DD').optional(),
    recurrenceFrequency: recurrenceFrequencySchema.optional(),
    recurrenceInterval: z.number().int().min(1).max(365).optional(),
    urgency: urgencySchema.nullable().optional(),
    importance: importanceSchema.nullable().optional(),
  })
  .refine(p => Object.keys(p).length > 0, { message: 'patch vacio' });

function toClientTask(
  row: Record<string, unknown>,
  overrides?: { weekId?: string; dayId?: string }
) {
  const frequency = (row.recurrence_frequency as RecurrenceFrequency | undefined) ?? 'none';
  const interval = typeof row.recurrence_interval === 'number' ? row.recurrence_interval : 1;
  const dayId = overrides?.dayId ?? (row.day_id as string);
  const endDayId =
    (row.end_day_id as string | undefined) ??
    (row.endDayId as string | undefined) ??
    dayId;
  return {
    id: row.id as string,
    weekId: overrides?.weekId ?? (row.week_id as string),
    dayId,
    endDayId,
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
    urgency: (row.urgency as string | null | undefined) ?? null,
    importance: (row.importance as string | null | undefined) ?? null,
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
      endDayId: rawEndDayId,
      recurrenceFrequency,
      recurrenceInterval,
      urgency,
      importance,
    } = createSchema.parse(req.body);

    const endDayId = rawEndDayId ?? dayId;
    if (endDayId < dayId) {
      throw ApiError.badRequest('endDayId debe ser >= dayId');
    }

    const recurrence = normalizeRecurrence(recurrenceFrequency, recurrenceInterval);
    const isMultiDay = endDayId > dayId;
    if (isMultiDay && recurrence.frequency !== 'none' && recurrence.frequency !== 'monthly') {
      throw ApiError.badRequest(
        'Las tareas de varios días solo admiten repetición none o monthly'
      );
    }

    const occurrenceRanges = materializeOccurrenceRanges(
      dayId,
      endDayId,
      recurrence.frequency,
      recurrence.interval
    );

    const plan = await readProfilePlan(uid);
    const limits = getLimits(plan);
    if (Number.isFinite(limits.maxTasksPerMonth)) {
      const usage = await readUsage(uid, monthFromDay(dayId));
      const tasksThisMonth = usage.tasks_created ?? 0;
      if (tasksThisMonth + occurrenceRanges.length > limits.maxTasksPerMonth) {
        throw ApiError.planLimit(
          `Tu plan permite hasta ${limits.maxTasksPerMonth} tareas por mes.`,
          {
            plan,
            limit: limits.maxTasksPerMonth,
            current: tasksThisMonth,
            requested: occurrenceRanges.length,
          }
        );
      }
    }

    const now = new Date().toISOString();
    const seriesId = generateId();
    const rows: Record<string, unknown>[] = [];

    // order por día: contamos tareas existentes en cada día de la serie
    const orderByDay = new Map<string, number>();
    for (const range of occurrenceRanges) {
      if (orderByDay.has(range.dayId)) continue;
      const { count } = await getSupabaseAdmin()
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('day_id', range.dayId);
      orderByDay.set(range.dayId, count ?? 0);
    }

    for (const range of occurrenceRanges) {
      const occWeekId = range.dayId === dayId ? weekId : getWeekIdFromDayId(range.dayId);
      const order = orderByDay.get(range.dayId) ?? 0;
      orderByDay.set(range.dayId, order + 1);
      const taskId = generateId();
      rows.push({
        id: taskId,
        user_id: uid,
        week_id: occWeekId,
        day_id: range.dayId,
        end_day_id: range.endDayId,
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
        urgency: urgency ?? null,
        importance: importance ?? null,
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

    if (patch.endDayId !== undefined) {
      const startDay = (existing.day_id as string) ?? dayId;
      if (patch.endDayId < startDay) {
        throw ApiError.badRequest('endDayId debe ser >= dayId');
      }
      const existingEnd =
        (existing.end_day_id as string | undefined) ?? startDay;
      const willBeMulti = patch.endDayId > startDay;
      const frequency =
        (patch.recurrenceFrequency as RecurrenceFrequency | undefined) ??
        ((existing.recurrence_frequency as RecurrenceFrequency | undefined) ?? 'none');
      if (willBeMulti && frequency !== 'none' && frequency !== 'monthly') {
        throw ApiError.badRequest(
          'Las tareas de varios días solo admiten repetición none o monthly'
        );
      }
      // no-op guard for type use of existingEnd
      void existingEnd;
    }

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
    if (patch.endDayId !== undefined) update.end_day_id = patch.endDayId;
    if (patch.recurrenceFrequency !== undefined) {
      update.recurrence_frequency = patch.recurrenceFrequency;
    }
    if (patch.recurrenceInterval !== undefined) {
      update.recurrence_interval = patch.recurrenceInterval;
    }
    if (patch.urgency !== undefined) update.urgency = patch.urgency;
    if (patch.importance !== undefined) update.importance = patch.importance;
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

    const oldStart = (fromTask.day_id as string) ?? dayId;
    const oldEnd = (fromTask.end_day_id as string | undefined) ?? oldStart;
    const duration = inclusiveDurationDays(oldStart, oldEnd);
    const newEndDayId = addDaysToDayId(toDayId, duration);

    const now = new Date().toISOString();
    const { error: insertError } = await getSupabaseAdmin().from('tasks').insert({
      ...fromTask,
      week_id: toWeekId,
      day_id: toDayId,
      end_day_id: newEndDayId,
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

    res.json({
      id: taskId,
      weekId: toWeekId,
      dayId: toDayId,
      endDayId: newEndDayId,
      movedFrom: dayId,
    });
  } catch (err) {
    next(err);
  }
});

function monthFromDay(dayId: string): string {
  return dayId.slice(0, 7);
}
