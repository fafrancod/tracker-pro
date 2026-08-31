import { Router } from 'express';
import { z } from 'zod';
import { parseMerchantPayload } from '@daily-tracker/core';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';
import {
  decryptAccountPayload,
  encryptAccountPayload,
  inferVaultScheme,
  isFinanceSchemaError,
  newAccountDek,
  unwrapAccountDek,
  wrapAccountDek,
} from '../lib/financeEnvelope.js';

export const financeMerchantsRouter = Router();

financeMerchantsRouter.use(requireAuth);
financeMerchantsRouter.use(rateLimit({ windowMs: 60_000, max: 60 }));

const createSchema = z.object({
  id: z.string().min(8).max(80).optional(),
  name: z.string().min(1).max(80).trim(),
  notes: z.string().max(2000).optional(),
  color: z.string().max(16).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  notes: z.string().max(2000).optional(),
  color: z.string().max(16).optional(),
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
  if (
    inferVaultScheme(existing) !== 'private' &&
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
      kdf_salt: null,
      kdf_params: null,
      wrapped_dek: null,
      recovery_wrapped_dek: null,
      enc_v: '2',
      created_at: existing?.created_at ?? now,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
  return dek;
}

function openMerchant(
  uid: string,
  dek: Buffer | null,
  row: Record<string, unknown>
) {
  if (!dek) return null;
  const blob =
    typeof row.payload_enc === 'string' && row.payload_enc ? row.payload_enc : null;
  if (!blob) return null;
  try {
    return parseMerchantPayload(
      decryptAccountPayload(uid, dek, 'finance_merchants', String(row.id), blob)
    );
  } catch {
    return null;
  }
}

function mapMerchant(
  row: Record<string, unknown>,
  opened?: ReturnType<typeof parseMerchantPayload> | null
) {
  const clientSealed =
    !opened &&
    typeof row.payload_enc === 'string' &&
    row.payload_enc.length > 0;
  const payload = opened
    ? opened
    : clientSealed
      ? parseMerchantPayload({})
      : parseMerchantPayload(row.payload);
  return {
    id: row.id as string,
    color: typeof row.color === 'string' && row.color ? row.color : '#0ea5e9',
    name: payload.name,
    notes: payload.notes,
    archived: Boolean(row.archived_at),
    sealed: clientSealed,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

financeMerchantsRouter.get('/merchants', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { data, error } = await getSupabaseAdmin()
      .from('finance_merchants')
      .select('*')
      .eq('user_id', uid)
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      if (isFinanceSchemaError(error)) {
        throw ApiError.badRequest(
          'Falta SQL de finanzas en Supabase (tabla finance_merchants). Pega el script de comercios y recarga.'
        );
      }
      throw error;
    }
    const existing = await loadVaultRow(uid);
    let dek: Buffer | null = null;
    if (
      inferVaultScheme(existing) !== 'private' &&
      existing &&
      typeof existing.account_wrapped_dek === 'string'
    ) {
      dek = unwrapAccountDek(uid, existing.account_wrapped_dek);
    }
    res.json({
      merchants: (data ?? []).map(r => {
        const row = r as Record<string, unknown>;
        return mapMerchant(row, openMerchant(uid, dek, row));
      }),
    });
  } catch (err) {
    next(err);
  }
});

financeMerchantsRouter.post('/merchants', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);
    const dek = await ensureAccountDek(uid);
    const id = body.id ?? generateId();
    const now = new Date().toISOString();
    const inner = parseMerchantPayload({
      name: body.name,
      notes: body.notes ?? '',
    });
    if (!inner.name) throw ApiError.badRequest('El nombre del comercio es obligatorio');
    const row = {
      id,
      user_id: uid,
      color: body.color || '#0ea5e9',
      payload: {},
      payload_enc: encryptAccountPayload(uid, dek, 'finance_merchants', id, inner),
      enc_v: '2',
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await getSupabaseAdmin().from('finance_merchants').insert(row);
    if (error) {
      if (isFinanceSchemaError(error)) {
        throw ApiError.badRequest(
          'Falta SQL de finanzas en Supabase (tabla finance_merchants). Pega el script de comercios y recarga.'
        );
      }
      throw error;
    }
    res.status(201).json(mapMerchant(row, inner));
  } catch (err) {
    next(err);
  }
});

financeMerchantsRouter.patch('/merchants/:merchantId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { merchantId } = req.params;
    const patch = updateSchema.parse(req.body);
    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('finance_merchants')
      .select('*')
      .eq('id', merchantId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Comercio no encontrado');

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };
    if (patch.color !== undefined) update.color = patch.color;
    if (patch.archived === true) update.archived_at = now;
    if (patch.archived === false) update.archived_at = null;

    const touchesSecret = patch.name !== undefined || patch.notes !== undefined;
    const dek = await ensureAccountDek(uid);
    let opened =
      openMerchant(uid, dek, existing as Record<string, unknown>) ??
      parseMerchantPayload(existing.payload);
    if (touchesSecret) {
      opened = parseMerchantPayload({
        name: patch.name ?? opened.name,
        notes: patch.notes ?? opened.notes,
      });
      update.payload = {};
      update.payload_enc = encryptAccountPayload(
        uid,
        dek,
        'finance_merchants',
        merchantId,
        opened
      );
      update.enc_v = '2';
    }
    const { error } = await getSupabaseAdmin()
      .from('finance_merchants')
      .update(update)
      .eq('id', merchantId)
      .eq('user_id', uid);
    if (error) throw error;
    res.json(
      mapMerchant(
        { ...(existing as Record<string, unknown>), ...update, id: merchantId },
        opened
      )
    );
  } catch (err) {
    next(err);
  }
});

financeMerchantsRouter.delete('/merchants/:merchantId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { merchantId } = req.params;
    const now = new Date().toISOString();
    const { error } = await getSupabaseAdmin()
      .from('finance_merchants')
      .update({ archived_at: now, updated_at: now })
      .eq('id', merchantId)
      .eq('user_id', uid);
    if (error) throw error;
    res.json({ id: merchantId, archived: true });
  } catch (err) {
    next(err);
  }
});
