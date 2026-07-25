import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';

export const contactsRouter = Router();

contactsRouter.use(requireAuth);
contactsRouter.use(rateLimit({ windowMs: 60_000, max: 60 }));

const relationshipSchema = z.enum([
  'father',
  'mother',
  'son',
  'daughter',
  'brother',
  'sister',
  'partner',
  'niece',
  'nephew',
  'friend',
  'coworker',
]);

const relationPulseSchema = z.enum([
  'great',
  'good',
  'neutral',
  'need_connect',
  'strained',
  'bad',
]);

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const t = item.trim().replace(/^[#@]+/, '');
    if (!t || t.length > 40) continue;
    const key = t.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, 12);
}

const createSchema = z
  .object({
    kind: z.enum(['person', 'pet']),
    name: z.string().min(1).max(80).trim(),
    tags: z.array(z.string()).max(12).optional(),
    relationship: relationshipSchema.nullable().optional(),
    relationPulse: relationPulseSchema.nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'pet' && val.relationship) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Las mascotas no tienen relación familiar',
        path: ['relationship'],
      });
    }
  });

const updateSchema = z
  .object({
    kind: z.enum(['person', 'pet']).optional(),
    name: z.string().min(1).max(80).trim().optional(),
    tags: z.array(z.string()).max(12).optional(),
    relationship: relationshipSchema.nullable().optional(),
    relationPulse: relationPulseSchema.nullable().optional(),
    order: z.number().int().nonnegative().optional(),
  })
  .refine(p => Object.keys(p).length > 0, { message: 'patch vacio' });

contactsRouter.post('/', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);
    const tags = normalizeTags(body.tags);
    // Si no hay tags, usa primera palabra del nombre
    const finalTags =
      tags.length > 0
        ? tags
        : [body.name.trim().split(/\s+/)[0]].filter(Boolean).map(t => t.slice(0, 40));

    const relationship =
      body.kind === 'person' ? (body.relationship ?? null) : null;
    const relationPulse = body.relationPulse ?? null;

    const { count, error: countErr } = await getSupabaseAdmin()
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid);
    if (countErr) throw countErr;
    const order = count ?? 0;

    const id = generateId();
    const row: Record<string, unknown> = {
      id,
      user_id: uid,
      kind: body.kind,
      name: body.name,
      tags: finalTags,
      relationship,
      order,
    };
    // Solo enviar si hay valor: columnas nuevas pueden faltar si no se corrió el SQL
    if (relationPulse != null) {
      row.relation_pulse = relationPulse;
    }

    const { error } = await getSupabaseAdmin().from('contacts').insert(row);
    if (error) {
      // Mensaje más claro si falta la tabla o la columna
      const msg = error.message ?? '';
      if (/relation_pulse|column/i.test(msg)) {
        throw ApiError.badRequest(
          'Falta la columna relation_pulse en contacts. Ejecuta el SQL de Círculo en Supabase.',
          { supabase: msg }
        );
      }
      if (/does not exist|relation .*contacts/i.test(msg)) {
        throw ApiError.badRequest(
          'Falta la tabla contacts. Ejecuta el SQL de Círculo en Supabase.',
          { supabase: msg }
        );
      }
      throw error;
    }

    res.status(201).json({
      id,
      kind: body.kind,
      name: body.name,
      tags: finalTags,
      relationship,
      relationPulse,
      order,
    });
  } catch (err) {
    next(err);
  }
});

contactsRouter.patch('/:contactId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { contactId } = req.params;
    const patch = updateSchema.parse(req.body);

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('contacts')
      .select('id, kind')
      .eq('id', contactId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Contact not found');

    const nextKind = patch.kind ?? (existing.kind as 'person' | 'pet');
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.kind !== undefined) update.kind = patch.kind;
    if (patch.order !== undefined) update.order = patch.order;
    if (patch.tags !== undefined) {
      const tags = normalizeTags(patch.tags);
      update.tags =
        tags.length > 0
          ? tags
          : [(patch.name ?? '').trim().split(/\s+/)[0]].filter(Boolean);
    }
    if (patch.relationship !== undefined || patch.kind === 'pet') {
      update.relationship = nextKind === 'pet' ? null : (patch.relationship ?? null);
    }
    if (nextKind === 'pet') update.relationship = null;
    if (patch.relationPulse !== undefined) {
      update.relation_pulse = patch.relationPulse;
    }

    if (Object.keys(update).length === 0) {
      throw ApiError.badRequest('Nada que actualizar');
    }

    const { error } = await getSupabaseAdmin()
      .from('contacts')
      .update(update)
      .eq('id', contactId)
      .eq('user_id', uid);
    if (error) throw error;

    res.json({ id: contactId, ...update });
  } catch (err) {
    next(err);
  }
});

contactsRouter.delete('/:contactId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { contactId } = req.params;

    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Contact not found');

    const { error } = await getSupabaseAdmin()
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', uid);
    if (error) throw error;

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
