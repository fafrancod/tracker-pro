import { Router } from 'express';
import { z } from 'zod';
import {
  normalizeCreditKind,
  normalizeMovementCurrency,
  parseCreditPayload,
} from '@daily-tracker/core';
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

export const financeCreditsRouter = Router();

financeCreditsRouter.use(requireAuth);
financeCreditsRouter.use(rateLimit({ windowMs: 60_000, max: 60 }));

const kindSchema = z.enum(['consumer', 'mortgage', 'auto', 'other']);
const daySchema = z.string().refine(isValidDayId, 'startDayId formato YYYY-MM-DD');

const createSchema = z.object({
  id: z.string().min(8).max(80).optional(),
  currency: z.string().min(1).max(8).optional(),
  kind: kindSchema.optional(),
  dueDay: z.number().int().min(1).max(31),
  startDayId: daySchema,
  termMonths: z.number().int().min(1).max(480),
  name: z.string().min(1).max(80).trim(),
  principal: z.number().nonnegative().max(1_000_000_000),
  monthlyInstallment: z.number().positive().max(1_000_000_000),
  notes: z.string().max(2000).optional(),
});

const updateSchema = z.object({
  currency: z.string().min(1).max(8).optional(),
  kind: kindSchema.optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  startDayId: daySchema.optional(),
  termMonths: z.number().int().min(1).max(480).optional(),
  name: z.string().min(1).max(80).trim().optional(),
  principal: z.number().nonnegative().max(1_000_000_000).optional(),
  monthlyInstallment: z.number().positive().max(1_000_000_000).optional(),
  notes: z.string().max(2000).optional(),
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
      'La bóveda privada está activa: no se pueden guardar créditos en claro'
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

function mapCredit(
  row: Record<string, unknown>,
  opened?: {
    name: string;
    principal: number;
    monthlyInstallment: number;
    notes: string;
  } | null
) {
  const clientSealed =
    !opened &&
    typeof row.payload_enc === 'string' &&
    row.payload_enc.length > 0;
  const payload = opened
    ? opened
    : clientSealed
      ? { name: '', principal: 0, monthlyInstallment: 0, notes: '' }
      : parseCreditPayload(row.payload);
  return {
    id: row.id as string,
    currency: normalizeMovementCurrency(row.currency as string),
    kind: normalizeCreditKind(row.kind),
    dueDay: typeof row.due_day === 'number' ? row.due_day : 1,
    startDayId: String(row.start_day_id ?? ''),
    termMonths: typeof row.term_months === 'number' ? row.term_months : 1,
    name: payload.name,
    principal: payload.principal,
    monthlyInstallment: payload.monthlyInstallment,
    notes: payload.notes,
    archived: Boolean(row.archived_at),
    sealed: clientSealed,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function openCredit(uid: string, dek: Buffer | null, row: Record<string, unknown>) {
  if (!dek || typeof row.payload_enc !== 'string' || !row.payload_enc) return null;
  try {
    return decryptAccountPayload<{
      name: string;
      principal: number;
      monthlyInstallment: number;
      notes: string;
    }>(uid, dek, 'finance_credits', String(row.id), row.payload_enc);
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

financeCreditsRouter.get('/credits', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { data, error } = await getSupabaseAdmin()
      .from('finance_credits')
      .select('*')
      .eq('user_id', uid)
      .is('archived_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const dek = await accountDekIfAny(uid);
    res.json({
      credits: (data ?? []).map(r => {
        const row = r as Record<string, unknown>;
        return mapCredit(row, openCredit(uid, dek, row));
      }),
    });
  } catch (err) {
    next(err);
  }
});

financeCreditsRouter.post('/credits', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);
    const dek = await ensureAccountDek(uid);
    const id = body.id ?? generateId();
    const now = new Date().toISOString();
    const inner = parseCreditPayload({
      name: body.name,
      principal: body.principal,
      monthlyInstallment: body.monthlyInstallment,
      notes: body.notes ?? '',
    });
    if (!inner.name) throw ApiError.badRequest('El nombre del crédito es obligatorio');
    const row = {
      id,
      user_id: uid,
      currency: normalizeMovementCurrency(body.currency),
      kind: body.kind ?? 'consumer',
      due_day: body.dueDay,
      start_day_id: body.startDayId,
      term_months: body.termMonths,
      payload: {},
      payload_enc: encryptAccountPayload(uid, dek, 'finance_credits', id, inner),
      enc_v: '2',
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await getSupabaseAdmin().from('finance_credits').insert(row);
    if (error) throw error;
    res.status(201).json(mapCredit(row, inner));
  } catch (err) {
    next(err);
  }
});

financeCreditsRouter.patch('/credits/:creditId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { creditId } = req.params;
    const patch = updateSchema.parse(req.body);
    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('finance_credits')
      .select('*')
      .eq('id', creditId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Crédito no encontrado');
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };
    if (patch.currency !== undefined) {
      update.currency = normalizeMovementCurrency(patch.currency);
    }
    if (patch.kind !== undefined) update.kind = patch.kind;
    if (patch.dueDay !== undefined) update.due_day = patch.dueDay;
    if (patch.startDayId !== undefined) update.start_day_id = patch.startDayId;
    if (patch.termMonths !== undefined) update.term_months = patch.termMonths;
    if (patch.archived === true) update.archived_at = now;
    if (patch.archived === false) update.archived_at = null;
    const touches =
      patch.name !== undefined ||
      patch.principal !== undefined ||
      patch.monthlyInstallment !== undefined ||
      patch.notes !== undefined;
    let opened = parseCreditPayload(existing.payload);
    if (touches) {
      const dek = await ensureAccountDek(uid);
      const prev = openCredit(uid, dek, existing as Record<string, unknown>) ?? opened;
      opened = parseCreditPayload({
        name: patch.name ?? prev.name,
        principal: patch.principal ?? prev.principal,
        monthlyInstallment: patch.monthlyInstallment ?? prev.monthlyInstallment,
        notes: patch.notes ?? prev.notes,
      });
      update.payload = {};
      update.payload_enc = encryptAccountPayload(
        uid,
        dek,
        'finance_credits',
        creditId,
        opened
      );
      update.enc_v = '2';
    }
    const { error } = await getSupabaseAdmin()
      .from('finance_credits')
      .update(update)
      .eq('id', creditId)
      .eq('user_id', uid);
    if (error) throw error;
    const dek = await accountDekIfAny(uid);
    res.json(
      mapCredit(
        { ...existing, ...update, id: creditId },
        touches ? opened : openCredit(uid, dek, { ...existing, ...update, id: creditId })
      )
    );
  } catch (err) {
    next(err);
  }
});

financeCreditsRouter.delete('/credits/:creditId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { creditId } = req.params;
    const now = new Date().toISOString();
    const { error } = await getSupabaseAdmin()
      .from('finance_credits')
      .update({ archived_at: now, updated_at: now })
      .eq('id', creditId)
      .eq('user_id', uid);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
