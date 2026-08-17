import { Router } from 'express';
import { z } from 'zod';
import {
  DEFAULT_CATEGORY_COLORS,
  DEFAULT_CATEGORY_SEEDS,
  FINANCE_CATEGORIES,
  normalizeFinanceCategory,
  normalizeMovementCurrency,
  parseCategoryPayload,
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

export const financeCategoriesRouter = Router();

financeCategoriesRouter.use(requireAuth);
financeCategoriesRouter.use(rateLimit({ windowMs: 60_000, max: 60 }));

const groupSchema = z.enum(FINANCE_CATEGORIES);

const createSchema = z.object({
  id: z.string().min(8).max(80).optional(),
  name: z.string().min(1).max(80).trim(),
  groupKey: groupSchema.optional(),
  color: z.string().max(16).optional(),
  currency: z.string().min(1).max(8).optional(),
  monthlyBudget: z.number().nonnegative().max(1_000_000_000).optional(),
  necessary: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  groupKey: groupSchema.optional(),
  color: z.string().max(16).optional(),
  currency: z.string().min(1).max(8).optional(),
  monthlyBudget: z.number().nonnegative().max(1_000_000_000).optional(),
  necessary: z.boolean().optional(),
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

function openCategory(
  uid: string,
  dek: Buffer | null,
  row: Record<string, unknown>
) {
  if (!dek) return null;
  const blob =
    typeof row.payload_enc === 'string' && row.payload_enc ? row.payload_enc : null;
  if (!blob) return null;
  try {
    return parseCategoryPayload(
      decryptAccountPayload(uid, dek, 'finance_categories', String(row.id), blob)
    );
  } catch {
    return null;
  }
}

function mapCategory(
  row: Record<string, unknown>,
  opened?: ReturnType<typeof parseCategoryPayload> | null
) {
  const clientSealed =
    !opened &&
    typeof row.payload_enc === 'string' &&
    row.payload_enc.length > 0;
  const payload = opened
    ? opened
    : clientSealed
      ? parseCategoryPayload({})
      : parseCategoryPayload(row.payload);
  return {
    id: row.id as string,
    groupKey: normalizeFinanceCategory(row.group_key) ?? 'other',
    color: typeof row.color === 'string' && row.color ? row.color : '#94a3b8',
    currency: normalizeMovementCurrency(row.currency as string),
    name: payload.name,
    monthlyBudget: payload.monthlyBudget,
    necessary: payload.necessary,
    archived: Boolean(row.archived_at),
    sealed: clientSealed,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

financeCategoriesRouter.get('/categories', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { data, error } = await getSupabaseAdmin()
      .from('finance_categories')
      .select('*')
      .eq('user_id', uid)
      .is('archived_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    let rows = (data ?? []) as Record<string, unknown>[];
    const dek = await ensureAccountDek(uid);
    if (rows.length === 0) {
      const now = new Date().toISOString();
      const seeded = DEFAULT_CATEGORY_SEEDS.map(seed => {
        const id = generateId();
        const inner = parseCategoryPayload({
          name: seed.name,
          monthlyBudget: 0,
          necessary: seed.necessary,
        });
        return {
          id,
          user_id: uid,
          group_key: seed.groupKey,
          color: DEFAULT_CATEGORY_COLORS[seed.groupKey] ?? '#94a3b8',
          currency: 'CLP',
          payload: {},
          payload_enc: encryptAccountPayload(
            uid,
            dek,
            'finance_categories',
            id,
            inner
          ),
          enc_v: '2',
          archived_at: null,
          created_at: now,
          updated_at: now,
          _inner: inner,
        };
      });
      const { error: seedErr } = await getSupabaseAdmin()
        .from('finance_categories')
        .insert(seeded.map(({ _inner, ...row }) => row));
      if (!seedErr) rows = seeded;
    }
    res.json({
      categories: rows.map(row => {
        const seeded = (row as { _inner?: unknown })._inner;
        return mapCategory(
          row,
          seeded ? parseCategoryPayload(seeded) : openCategory(uid, dek, row)
        );
      }),
    });
  } catch (err) {
    next(err);
  }
});

financeCategoriesRouter.post('/categories', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);
    const dek = await ensureAccountDek(uid);
    const id = body.id ?? generateId();
    const now = new Date().toISOString();
    const groupKey = body.groupKey ?? 'other';
    const inner = parseCategoryPayload({
      name: body.name,
      monthlyBudget: body.monthlyBudget ?? 0,
      necessary: body.necessary ?? groupKey !== 'leisure',
    });
    if (!inner.name) throw ApiError.badRequest('El nombre de la categoría es obligatorio');
    const row = {
      id,
      user_id: uid,
      group_key: groupKey,
      color: body.color || DEFAULT_CATEGORY_COLORS[groupKey] || '#94a3b8',
      currency: normalizeMovementCurrency(body.currency),
      payload: {},
      payload_enc: encryptAccountPayload(uid, dek, 'finance_categories', id, inner),
      enc_v: '2',
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await getSupabaseAdmin().from('finance_categories').insert(row);
    if (error) throw error;
    res.status(201).json(mapCategory(row, inner));
  } catch (err) {
    next(err);
  }
});

financeCategoriesRouter.patch('/categories/:categoryId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { categoryId } = req.params;
    const patch = updateSchema.parse(req.body);
    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('finance_categories')
      .select('*')
      .eq('id', categoryId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Categoría no encontrada');

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };
    if (patch.groupKey !== undefined) update.group_key = patch.groupKey;
    if (patch.color !== undefined) update.color = patch.color;
    if (patch.currency !== undefined) {
      update.currency = normalizeMovementCurrency(patch.currency);
    }
    if (patch.archived === true) update.archived_at = now;
    if (patch.archived === false) update.archived_at = null;

    const touchesSecret =
      patch.name !== undefined ||
      patch.monthlyBudget !== undefined ||
      patch.necessary !== undefined;
    const dek = await ensureAccountDek(uid);
    let opened =
      openCategory(uid, dek, existing as Record<string, unknown>) ??
      parseCategoryPayload(existing.payload);
    if (touchesSecret) {
      opened = parseCategoryPayload({
        name: patch.name ?? opened.name,
        monthlyBudget: patch.monthlyBudget ?? opened.monthlyBudget,
        necessary: patch.necessary ?? opened.necessary,
      });
      update.payload = {};
      update.payload_enc = encryptAccountPayload(
        uid,
        dek,
        'finance_categories',
        categoryId,
        opened
      );
      update.enc_v = '2';
    }
    const { error } = await getSupabaseAdmin()
      .from('finance_categories')
      .update(update)
      .eq('id', categoryId)
      .eq('user_id', uid);
    if (error) throw error;
    res.json(
      mapCategory(
        { ...(existing as Record<string, unknown>), ...update, id: categoryId },
        opened
      )
    );
  } catch (err) {
    next(err);
  }
});

financeCategoriesRouter.delete('/categories/:categoryId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { categoryId } = req.params;
    const now = new Date().toISOString();
    const { error } = await getSupabaseAdmin()
      .from('finance_categories')
      .update({ archived_at: now, updated_at: now })
      .eq('id', categoryId)
      .eq('user_id', uid);
    if (error) throw error;
    res.json({ id: categoryId, archived: true });
  } catch (err) {
    next(err);
  }
});
