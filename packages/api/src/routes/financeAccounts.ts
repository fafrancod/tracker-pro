import { Router } from 'express';
import { z } from 'zod';
import {
  normalizeAccountType,
  normalizeMovementCurrency,
  parseAccountPayload,
} from '@daily-tracker/core';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';
import {
  decryptAccountPayload,
  encryptAccountPayload,
  inferVaultScheme,
  newAccountDek,
  unwrapAccountDek,
  wrapAccountDek,
} from '../lib/financeEnvelope.js';

export const financeAccountsRouter = Router();

financeAccountsRouter.use(requireAuth);
financeAccountsRouter.use(rateLimit({ windowMs: 60_000, max: 60 }));

const typeSchema = z.enum(['cash', 'debit', 'credit', 'brokerage', 'other']);

const createSchema = z.object({
  id: z.string().min(8).max(80).optional(),
  type: typeSchema,
  currency: z.string().min(1).max(8).optional(),
  name: z.string().min(1).max(80).trim(),
  institution: z.string().max(80).trim().optional(),
  creditLimit: z.number().nonnegative().max(1_000_000_000).optional(),
});

const updateSchema = z.object({
  type: typeSchema.optional(),
  currency: z.string().min(1).max(8).optional(),
  name: z.string().min(1).max(80).trim().optional(),
  institution: z.string().max(80).trim().optional(),
  creditLimit: z.number().nonnegative().max(1_000_000_000).optional(),
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
      'La bóveda privada está activa: no se pueden guardar cuentas en claro'
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

function mapAccount(
  row: Record<string, unknown>,
  opened?: { name: string; institution: string; creditLimit: number } | null
) {
  const clientSealed =
    !opened &&
    typeof row.payload_enc === 'string' &&
    row.payload_enc.length > 0;
  const payload = opened
    ? opened
    : clientSealed
      ? { name: '', institution: '', creditLimit: 0 }
      : parseAccountPayload(row.payload);
  return {
    id: row.id as string,
    type: normalizeAccountType(row.type),
    currency: normalizeMovementCurrency(row.currency as string),
    name: payload.name,
    institution: payload.institution,
    creditLimit: payload.creditLimit,
    archived: Boolean(row.archived_at),
    sealed: clientSealed,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function openAccount(
  uid: string,
  dek: Buffer | null,
  row: Record<string, unknown>
) {
  if (!dek || typeof row.payload_enc !== 'string' || !row.payload_enc) return null;
  try {
    return decryptAccountPayload<{
      name: string;
      institution: string;
      creditLimit: number;
    }>(uid, dek, 'finance_accounts', String(row.id), row.payload_enc);
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

financeAccountsRouter.get('/accounts', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { data, error } = await getSupabaseAdmin()
      .from('finance_accounts')
      .select('*')
      .eq('user_id', uid)
      .is('archived_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const dek = await accountDekIfAny(uid);
    res.json({
      accounts: (data ?? []).map(r => {
        const row = r as Record<string, unknown>;
        return mapAccount(row, openAccount(uid, dek, row));
      }),
    });
  } catch (err) {
    next(err);
  }
});

financeAccountsRouter.post('/accounts', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);
    const dek = await ensureAccountDek(uid);
    const id = body.id ?? generateId();
    const now = new Date().toISOString();
    const inner = parseAccountPayload({
      name: body.name,
      institution: body.institution ?? '',
      creditLimit: body.creditLimit ?? 0,
    });
    if (!inner.name) throw ApiError.badRequest('El nombre de la cuenta es obligatorio');
    const row = {
      id,
      user_id: uid,
      type: body.type,
      currency: normalizeMovementCurrency(body.currency),
      payload: {},
      payload_enc: encryptAccountPayload(uid, dek, 'finance_accounts', id, inner),
      enc_v: '2',
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await getSupabaseAdmin().from('finance_accounts').insert(row);
    if (error) throw error;
    res.status(201).json(mapAccount(row, inner));
  } catch (err) {
    next(err);
  }
});

financeAccountsRouter.patch('/accounts/:accountId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { accountId } = req.params;
    const patch = updateSchema.parse(req.body);
    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('finance_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Cuenta no encontrada');

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.currency !== undefined) {
      update.currency = normalizeMovementCurrency(patch.currency);
    }
    if (patch.archived === true) update.archived_at = now;
    if (patch.archived === false) update.archived_at = null;

    const touchesSecret =
      patch.name !== undefined ||
      patch.institution !== undefined ||
      patch.creditLimit !== undefined;
    let opened = parseAccountPayload(existing.payload);
    if (touchesSecret) {
      const dek = await ensureAccountDek(uid);
      const prev =
        openAccount(uid, dek, existing as Record<string, unknown>) ?? opened;
      opened = parseAccountPayload({
        name: patch.name ?? prev.name,
        institution: patch.institution ?? prev.institution,
        creditLimit: patch.creditLimit ?? prev.creditLimit,
      });
      update.payload = {};
      update.payload_enc = encryptAccountPayload(
        uid,
        dek,
        'finance_accounts',
        accountId,
        opened
      );
      update.enc_v = '2';
    }

    const { error } = await getSupabaseAdmin()
      .from('finance_accounts')
      .update(update)
      .eq('id', accountId)
      .eq('user_id', uid);
    if (error) throw error;
    res.json(
      mapAccount(
        { ...existing, ...update, id: accountId },
        touchesSecret ? opened : openAccount(uid, await accountDekIfAny(uid), {
          ...existing,
          ...update,
          id: accountId,
        })
      )
    );
  } catch (err) {
    next(err);
  }
});

financeAccountsRouter.delete('/accounts/:accountId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { accountId } = req.params;
    const now = new Date().toISOString();
    const { error } = await getSupabaseAdmin()
      .from('finance_accounts')
      .update({ archived_at: now, updated_at: now })
      .eq('id', accountId)
      .eq('user_id', uid);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
