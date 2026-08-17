import { Router } from 'express';
import { z } from 'zod';
import {
  FINANCE_RANGE_MAX_DAYS,
  buildFinancePayload,
  inclusiveDaySpan,
  normalizeFinanceFlow,
  normalizeFinanceStatus,
  normalizeMovementCurrency,
  parseFinancePayload,
} from '@daily-tracker/core';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';
import { isValidDayId } from '../lib/period.js';

export const financeMovementsRouter = Router();

financeMovementsRouter.use(requireAuth);
financeMovementsRouter.use(rateLimit({ windowMs: 60_000, max: 90 }));

const dayIdSchema = z.string().refine(isValidDayId, 'dayId formato YYYY-MM-DD');
const flowSchema = z.enum(['expense', 'income', 'investment']);
const statusSchema = z.enum(['planned', 'confirmed', 'skipped']);
const certaintySchema = z.enum(['fixed', 'potential']);
const frequencySchema = z.enum(['monthly', 'weekly']);

const recurrenceSchema = z.object({
  frequency: frequencySchema,
  recurrenceDay: z.number().int().min(0).max(31),
});

const createSchema = z.object({
  dayId: dayIdSchema,
  flow: flowSchema,
  status: statusSchema.optional(),
  currency: z.string().min(1).max(8).optional(),
  title: z.string().min(1).max(160).trim(),
  amount: z.number().nonnegative().max(1_000_000_000),
  notes: z.string().max(2000).optional(),
  certainty: certaintySchema.optional(),
  clientMutationId: z.string().min(1).max(80).optional(),
  recurrence: recurrenceSchema.nullable().optional(),
});

const updateSchema = z
  .object({
    dayId: dayIdSchema.optional(),
    flow: flowSchema.optional(),
    status: statusSchema.optional(),
    currency: z.string().min(1).max(8).optional(),
    title: z.string().min(1).max(160).trim().optional(),
    amount: z.number().nonnegative().max(1_000_000_000).optional(),
    notes: z.string().max(2000).optional(),
    certainty: certaintySchema.optional(),
    updatedAt: z.string().min(1).max(40).optional(),
  })
  .refine(p => Object.keys(p).some(k => k !== 'updatedAt'), {
    message: 'patch vacio',
  });

const rangeSchema = z.object({
  from: dayIdSchema,
  to: dayIdSchema,
});

function mapMovement(row: Record<string, unknown>) {
  const payload = parseFinancePayload(row.payload);
  return {
    id: row.id as string,
    dayId: row.day_id as string,
    flow: normalizeFinanceFlow(row.flow),
    status: normalizeFinanceStatus(row.status),
    currency: normalizeMovementCurrency(row.currency as string),
    title: payload.title,
    amount: payload.amount,
    notes: payload.notes,
    certainty: payload.certainty,
    ruleId: (row.rule_id as string | null) ?? null,
    sourceTaskId: (row.source_task_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRule(row: Record<string, unknown>) {
  const payload = parseFinancePayload(row.payload);
  return {
    id: row.id as string,
    flow: normalizeFinanceFlow(row.flow),
    currency: normalizeMovementCurrency(row.currency as string),
    frequency: row.frequency === 'weekly' ? 'weekly' : 'monthly',
    recurrenceDay:
      typeof row.recurrence_day === 'number' ? row.recurrence_day : 1,
    startDayId: (row.start_day_id as string) ?? (row.day_id as string) ?? '',
    title: payload.title,
    amount: payload.amount,
    notes: payload.notes,
    certainty: payload.certainty,
    active: row.active !== false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

financeMovementsRouter.get('/movements', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const parsed = rangeSchema.safeParse({
      from: req.query.from,
      to: req.query.to,
    });
    if (!parsed.success) {
      throw ApiError.badRequest('from y to son obligatorios (YYYY-MM-DD)');
    }
    const { from, to } = parsed.data;
    if (to < from) {
      throw ApiError.badRequest('to debe ser >= from');
    }
    const span = inclusiveDaySpan(from, to);
    if (span < 1 || span > FINANCE_RANGE_MAX_DAYS) {
      throw ApiError.badRequest(
        `El rango no puede superar ${FINANCE_RANGE_MAX_DAYS} días`
      );
    }

    const [movRes, ruleRes] = await Promise.all([
      getSupabaseAdmin()
        .from('finance_movements')
        .select('*')
        .eq('user_id', uid)
        .gte('day_id', from)
        .lte('day_id', to)
        .is('deleted_at', null)
        .order('day_id', { ascending: true }),
      getSupabaseAdmin()
        .from('finance_rules')
        .select('*')
        .eq('user_id', uid)
        .eq('active', true)
        .lte('start_day_id', to)
        .order('start_day_id', { ascending: true }),
    ]);
    if (movRes.error) throw movRes.error;
    if (ruleRes.error) throw ruleRes.error;

    res.json({
      movements: (movRes.data ?? []).map(r =>
        mapMovement(r as Record<string, unknown>)
      ),
      rules: (ruleRes.data ?? []).map(r => mapRule(r as Record<string, unknown>)),
    });
  } catch (err) {
    next(err);
  }
});

financeMovementsRouter.post('/movements', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);
    const now = new Date().toISOString();
    const currency = normalizeMovementCurrency(body.currency);
    const payload = buildFinancePayload({
      title: body.title,
      amount: body.amount,
      notes: body.notes,
      certainty: body.certainty,
    });
    let ruleId: string | null = null;

    if (body.recurrence) {
      ruleId = generateId();
      const ruleRow = {
        id: ruleId,
        user_id: uid,
        flow: body.flow,
        currency,
        frequency: body.recurrence.frequency,
        recurrence_day: body.recurrence.recurrenceDay,
        start_day_id: body.dayId,
        payload,
        active: true,
        created_at: now,
        updated_at: now,
      };
      const { error: ruleErr } = await getSupabaseAdmin()
        .from('finance_rules')
        .insert(ruleRow);
      if (ruleErr) throw ruleErr;
    }

    const id = generateId();
    const row = {
      id,
      user_id: uid,
      day_id: body.dayId,
      flow: body.flow,
      status: body.status ?? 'planned',
      currency,
      payload,
      payload_enc: null,
      enc_v: null,
      rule_id: ruleId,
      source_task_id: null,
      client_mutation_id: body.clientMutationId ?? null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await getSupabaseAdmin()
      .from('finance_movements')
      .insert(row);
    if (error) throw error;
    res.status(201).json(mapMovement(row));
  } catch (err) {
    next(err);
  }
});

financeMovementsRouter.patch('/movements/:movementId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { movementId } = req.params;
    const patch = updateSchema.parse(req.body);
    const now = new Date().toISOString();

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('finance_movements')
      .select('*')
      .eq('id', movementId)
      .eq('user_id', uid)
      .is('deleted_at', null)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Movimiento no encontrado');

    if (
      patch.updatedAt &&
      existing.updated_at &&
      patch.updatedAt < (existing.updated_at as string)
    ) {
      throw ApiError.conflict('El movimiento cambió en otro dispositivo');
    }

    const prevPayload = parseFinancePayload(existing.payload);
    const nextPayload = buildFinancePayload({
      title: patch.title,
      amount: patch.amount,
      notes: patch.notes,
      certainty: patch.certainty,
      existing: prevPayload,
    });
    const update: Record<string, unknown> = {
      payload: nextPayload,
      updated_at: now,
    };
    if (patch.dayId !== undefined) update.day_id = patch.dayId;
    if (patch.flow !== undefined) update.flow = patch.flow;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.currency !== undefined) {
      update.currency = normalizeMovementCurrency(patch.currency);
    }

    const { error } = await getSupabaseAdmin()
      .from('finance_movements')
      .update(update)
      .eq('id', movementId)
      .eq('user_id', uid);
    if (error) throw error;

    res.json(
      mapMovement({
        ...existing,
        ...update,
        id: movementId,
      })
    );
  } catch (err) {
    next(err);
  }
});

financeMovementsRouter.delete('/movements/:movementId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { movementId } = req.params;
    const { error } = await getSupabaseAdmin()
      .from('finance_movements')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', movementId)
      .eq('user_id', uid);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
