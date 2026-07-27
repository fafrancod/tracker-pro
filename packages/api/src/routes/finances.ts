import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';

export const financesRouter = Router();

financesRouter.use(requireAuth);
financesRouter.use(rateLimit({ windowMs: 60_000, max: 90 }));

const flowSchema = z.enum(['expense', 'income']);
const kindSchema = z.enum(['recurring', 'expected', 'specific']);
const frequencySchema = z.enum(['monthly', 'weekly']);

const createSchema = z
  .object({
    title: z.string().min(1).max(160).trim(),
    amount: z.number().nonnegative().max(1_000_000_000),
    currency: z.string().min(1).max(8).default('EUR'),
    flow: flowSchema,
    kind: kindSchema,
    frequency: frequencySchema.nullable().optional(),
    recurrenceDay: z.number().int().min(0).max(31).nullable().optional(),
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    notes: z.string().max(2000).optional(),
    active: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'recurring') {
      if (!v.frequency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Recurring requiere frequency',
          path: ['frequency'],
        });
      }
      if (v.recurrenceDay == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Recurring requiere recurrenceDay',
          path: ['recurrenceDay'],
        });
      }
    }
    if ((v.kind === 'expected' || v.kind === 'specific') && !v.entryDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expected/specific requieren entryDate',
        path: ['entryDate'],
      });
    }
  });

const updateSchema = z
  .object({
    title: z.string().min(1).max(160).trim().optional(),
    amount: z.number().nonnegative().max(1_000_000_000).optional(),
    currency: z.string().min(1).max(8).optional(),
    flow: flowSchema.optional(),
    kind: kindSchema.optional(),
    frequency: frequencySchema.nullable().optional(),
    recurrenceDay: z.number().int().min(0).max(31).nullable().optional(),
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    notes: z.string().max(2000).optional(),
    active: z.boolean().optional(),
  })
  .refine(p => Object.keys(p).length > 0, { message: 'patch vacio' });

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    title: (row.title as string) ?? '',
    amount: Number(row.amount ?? 0),
    currency: (row.currency as string) ?? 'EUR',
    flow: row.flow as 'expense' | 'income',
    kind: row.kind as 'recurring' | 'expected' | 'specific',
    frequency: (row.frequency as 'monthly' | 'weekly' | null) ?? null,
    recurrenceDay:
      typeof row.recurrence_day === 'number' ? row.recurrence_day : null,
    entryDate: (row.entry_date as string | null) ?? null,
    notes: (row.notes as string) ?? '',
    active: row.active !== false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

financesRouter.get('/', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { data, error } = await getSupabaseAdmin()
      .from('finance_entries')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json({ entries: (data ?? []).map(r => mapRow(r as Record<string, unknown>)) });
  } catch (err) {
    next(err);
  }
});

financesRouter.post('/', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);
    const id = generateId();
    const now = new Date().toISOString();
    const row = {
      id,
      user_id: uid,
      title: body.title,
      amount: body.amount,
      currency: body.currency ?? 'EUR',
      flow: body.flow,
      kind: body.kind,
      frequency: body.kind === 'recurring' ? body.frequency ?? null : null,
      recurrence_day:
        body.kind === 'recurring' ? (body.recurrenceDay ?? null) : null,
      entry_date:
        body.kind === 'recurring' ? null : (body.entryDate ?? null),
      notes: body.notes ?? '',
      active: body.active ?? true,
      created_at: now,
      updated_at: now,
    };
    const { error } = await getSupabaseAdmin().from('finance_entries').insert(row);
    if (error) throw error;
    res.status(201).json(mapRow(row));
  } catch (err) {
    next(err);
  }
});

financesRouter.patch('/:entryId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { entryId } = req.params;
    const patch = updateSchema.parse(req.body);

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('finance_entries')
      .select('id')
      .eq('id', entryId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Finance entry not found');

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.amount !== undefined) update.amount = patch.amount;
    if (patch.currency !== undefined) update.currency = patch.currency;
    if (patch.flow !== undefined) update.flow = patch.flow;
    if (patch.kind !== undefined) update.kind = patch.kind;
    if (patch.frequency !== undefined) update.frequency = patch.frequency;
    if (patch.recurrenceDay !== undefined) {
      update.recurrence_day = patch.recurrenceDay;
    }
    if (patch.entryDate !== undefined) update.entry_date = patch.entryDate;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.active !== undefined) update.active = patch.active;

    const { error } = await getSupabaseAdmin()
      .from('finance_entries')
      .update(update)
      .eq('id', entryId)
      .eq('user_id', uid);
    if (error) throw error;

    res.json({ id: entryId, ...patch });
  } catch (err) {
    next(err);
  }
});

financesRouter.delete('/:entryId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { entryId } = req.params;
    const { error } = await getSupabaseAdmin()
      .from('finance_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', uid);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
