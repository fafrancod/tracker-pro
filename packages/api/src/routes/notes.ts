import { Router } from 'express';
import { z } from 'zod';
import {
  excerptFromNoteContent,
  mapNote,
  MAX_LINKS,
  MAX_TITLE,
  normalizeNoteContent,
  normalizeNoteLinks,
  normalizeNoteTitle,
} from '@daily-tracker/core';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../errors.js';
import { generateId } from '../lib/ids.js';

export const notesRouter = Router();

notesRouter.use(requireAuth);
notesRouter.use(rateLimit({ windowMs: 60_000, max: 80 }));

const linkSchema = z.object({
  type: z.enum(['project', 'subproject', 'task', 'event']),
  id: z.string().min(1).max(80),
  projectId: z.string().min(1).max(80).nullable().optional(),
  label: z.string().max(80).nullable().optional(),
});

const createSchema = z.object({
  title: z.string().max(MAX_TITLE).optional(),
  content: z.unknown().optional(),
  links: z.array(linkSchema).max(MAX_LINKS).optional(),
});

const updateSchema = z
  .object({
    title: z.string().max(MAX_TITLE).optional(),
    content: z.unknown().optional(),
    links: z.array(linkSchema).max(MAX_LINKS).optional(),
  })
  .refine(p => Object.keys(p).length > 0, { message: 'patch vacio' });

const MAX_CONTENT_CHARS = 400_000;

function assertContentSize(content: unknown) {
  try {
    const size = JSON.stringify(content ?? {}).length;
    if (size > MAX_CONTENT_CHARS) {
      throw ApiError.badRequest('El contenido de la idea es demasiado grande');
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest('Contenido de idea inválido');
  }
}

notesRouter.get('/', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { data, error } = await getSupabaseAdmin()
      .from('notes')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json({
      notes: (data ?? []).map(row => mapNote(row.id as string, row)),
    });
  } catch (err) {
    next(err);
  }
});

notesRouter.post('/', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const body = createSchema.parse(req.body);
    const content = normalizeNoteContent(body.content);
    assertContentSize(content);
    const excerpt = excerptFromNoteContent(content);
    const title = normalizeNoteTitle(body.title, excerpt);
    const links = normalizeNoteLinks(body.links);
    const now = new Date().toISOString();
    const id = generateId();
    const row = {
      id,
      user_id: uid,
      title,
      content,
      excerpt,
      links,
      created_at: now,
      updated_at: now,
    };
    const { error } = await getSupabaseAdmin().from('notes').insert(row);
    if (error) throw error;
    res.status(201).json(mapNote(id, row));
  } catch (err) {
    next(err);
  }
});

notesRouter.patch('/:noteId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { noteId } = req.params;
    const patch = updateSchema.parse(req.body);
    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Idea no encontrada');

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.content !== undefined) {
      const content = normalizeNoteContent(patch.content);
      assertContentSize(content);
      update.content = content;
      update.excerpt = excerptFromNoteContent(content);
    }
    if (patch.title !== undefined) {
      const excerpt =
        typeof update.excerpt === 'string'
          ? update.excerpt
          : ((existing.excerpt as string) ?? '');
      update.title = normalizeNoteTitle(patch.title, excerpt);
    }
    if (patch.links !== undefined) {
      update.links = normalizeNoteLinks(patch.links);
    }

    const { error } = await getSupabaseAdmin()
      .from('notes')
      .update(update)
      .eq('id', noteId)
      .eq('user_id', uid);
    if (error) throw error;

    res.json(mapNote(noteId, { ...existing, ...update }));
  } catch (err) {
    next(err);
  }
});

notesRouter.delete('/:noteId', async (req, res, next) => {
  try {
    const uid = req.user!.uid;
    const { noteId } = req.params;
    const { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('notes')
      .select('id')
      .eq('id', noteId)
      .eq('user_id', uid)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw ApiError.notFound('Idea no encontrada');

    const { error } = await getSupabaseAdmin()
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', uid);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
