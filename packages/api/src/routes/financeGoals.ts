import { Router } from 'express';
import { z } from 'zod';
import { normalizeMovementCurrency, parseGoalPayload } from '@daily-tracker/core';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';
import { isValidDayId } from '../lib/period.js';
import {
  decryptAccountPayload,
  encryptAccountPayload,
  inferVaultScheme,
  newAccountDek,
  unwrapAccountDek,
  wrapAccountDek,
} from '../lib/financeEnvelope.js';

export const financeGoalsRouter = Router();

financeGoalsRouter.use(requireAuth);
financeGoalsRouter.use(rateLimit({ windowMs: 60_000, max: 60 }));

const daySchema = z.string().refine(isValidDayId, 'targetDayId formato YYYY-MM-DD');

const createSchema = z.object({
  id: z.string().min(8).max(80).optional(),
  currency: z.string().min(1).max(8).optional(),
  name: z.string().min(1).max(80).trim(),
  targetAmount: z.number().positive().max(1_000_000_000),
  notes: z.string().max(2000).optional(),
  targetDayId: daySchema.nullable().optional(),
  linkedAccountId: z.string().min(1).max(80).nullable().optional(),
});

const updateSchema = z.object({
  currency: z.string().min(1).max(8).optional(),
  name: z.string().min(1).max(80).trim().optional(),
  targetAmount: z.number().positive().max(1_000_000_000).optional(),
  notes: z.string().max(2000).optional(),
  targetDayId: daySchema.nullable().optional(),
  linkedAccountId: z.string().min(1).max(80).nullable().optional(),
  archived: z.boolean().optional(),
});

async function loadVaultRow(uid: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('finance_vault')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? null;
}

async function ensureAccountDek(uid: string): Promise<Buffer> {
  const existing = await loadVaultRow(uid);
  if (inferVaultScheme(existing) === 'private') {
    throw ApiError.badRequest(
      'La bóveda privada está activa: no se pueden guardar objetivos en claro'
    );
  }
  if (
    existing &&
    typeof existing.account_wrapped_dek === 'string' &&
    existing.account_wrapped_dek
  ) {
    return unwrapAccountDek(uid, existing.account_wrapped_dek);
  }
  const dek = newAccountDek();
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from('finance_vault').upsert(
    {
      user_id: uid,
      scheme: 'account',
      account_wrapped_dek: wrapAccountDek(uid, dek),
      enc_v: '2',
      created_at: existing?.created_at ?? now,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
  return dek;
}

function mapGoal(
  row: Record<string, unknown>,
  opened?: { name: string; targetAmount: number; notes: string } | null
) {
  const clientSealed =
    !opened &&
    typeof row.payload_enc === 'string' &&
    row.payload_enc.length > 0;
  const payload = opened
    ? opened
    : clientSealed
      ? { name: '', targetAmount: 0, notes: '' }
      : parseGoalPayload(row.payload);
  return {
    id: row.id as string,
    currency: normalizeMovementCurrency(row.currency as string),
    targetDayId: (row.target_day_id as string | null) ?? null,
    linkedAccountId: (row.linked_account_id as string | null) ?? null,
    name: payload.name,
    targetAmount: payload.targetAmount,
    notes: payload.notes,
    archived: Boolean(row.archived_at),
    sealed: clientSealed,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function openGoal(uid: string, dek: Buffer | null, row: Record<string, unknown>) {
  if (!dek || typeof row.payload_enc !== 'string' || !row.payload_enc) return null;
  try {
    return decryptAccountPayload<{
      name: string;
      targetAmount: number;
      notes: string;
    }>(uid, dek, 'finance_goals', String(row.id), row.payload_enc);
  } catch {
    return null;
  }
}

async function accountDekIfAny(uid: string): Promise<Buffer | null> {
  const row = await loadVaultRow(uid);
  if (inferVaultScheme(row) !== 'account') return null;
  const wrapped =
    typeof row?.account_wrapped_dek === 'string' ? row.account_wrapped_dek : '';
  if (!wrapped) return null;
  try {
    return unwrapAccountDek(uid, wrapped);
  } catch {
    return null;
  }
}

financeGoalsRouter.get('/goals', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { data, error } = await getSupabaseAdmin()
      .from('finance_goals')
      .select('*')
      .eq('user_id', uid)
      .is('archived_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const dek = await accountDekIfAny(uid);
    res.json({
      goals: (data ?? []).map(r => {
        const row = r as Record<string, unknown>;
        return mapGoal(row, openGoal(uid, dek, row));
      }),
    });
  } catch (err) {
    next(err);
  }
});

financeGoalsRouter.post('/goals', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);
    const dek = await ensureAccountDek(uid);
    const id = body.id ?? generateId();
    const now = new Date().toISOString();
    const inner = parseGoalPayload({
      name: body.name,
      targetAmount: body.targetAmount,
      notes: body.notes ?? '',
    });
    if (!inner.name) throw ApiError.badRequest('El nombre del objetivo es obligatorio');
    const row = {
      id,
      user_id: uid,
      currency: normalizeMovementCurrency(body.currency),
      target_day_id: body.targetDayId ?? null,
      linked_account_id: body.linkedAccountId ?? null,
      payload: {},
      payload_enc: encryptAccountPayload(uid, dek, 'finance_goals', id, inner),
      enc_v: '2',
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await getSupabaseAdmin().from('finance_goals').insert(row);
    if (error) throw error;
    res.status(201).json(mapGoal(row, inner));
  } catch (err) {
    next(err);
  }
});

financeGoalsRouter.patch('/goals/:goalId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { goalId } = req.params;
    const patch = updateSchema.parse(req.body);
    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('finance_goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Objetivo no encontrado');

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };
    if (patch.currency !== undefined) {
      update.currency = normalizeMovementCurrency(patch.currency);
    }
    if (patch.targetDayId !== undefined) update.target_day_id = patch.targetDayId;
    if (patch.linkedAccountId !== undefined) {
      update.linked_account_id = patch.linkedAccountId;
    }
    if (patch.archived === true) update.archived_at = now;
    if (patch.archived === false) update.archived_at = null;

    const touchesSecret =
      patch.name !== undefined ||
      patch.targetAmount !== undefined ||
      patch.notes !== undefined;
    let opened = parseGoalPayload(existing.payload);
    if (touchesSecret) {
      const dek = await ensureAccountDek(uid);
      const prev = openGoal(uid, dek, existing as Record<string, unknown>) ?? opened;
      opened = parseGoalPayload({
        name: patch.name ?? prev.name,
        targetAmount: patch.targetAmount ?? prev.targetAmount,
        notes: patch.notes ?? prev.notes,
      });
      update.payload = {};
      update.payload_enc = encryptAccountPayload(
        uid,
        dek,
        'finance_goals',
        goalId,
        opened
      );
      update.enc_v = '2';
    }

    const { error } = await getSupabaseAdmin()
      .from('finance_goals')
      .update(update)
      .eq('id', goalId)
      .eq('user_id', uid);
    if (error) throw error;
    const dek = await accountDekIfAny(uid);
    res.json(
      mapGoal(
        { ...existing, ...update, id: goalId },
        touchesSecret ? opened : openGoal(uid, dek, { ...existing, ...update, id: goalId })
      )
    );
  } catch (err) {
    next(err);
  }
});

financeGoalsRouter.delete('/goals/:goalId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { goalId } = req.params;
    const now = new Date().toISOString();
    const { error } = await getSupabaseAdmin()
      .from('finance_goals')
      .update({ archived_at: now, updated_at: now })
      .eq('id', goalId)
      .eq('user_id', uid);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
