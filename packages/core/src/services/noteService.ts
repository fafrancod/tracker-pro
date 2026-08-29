import { getSupabase } from '../supabase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { subscribeTable } from '../lib/realtime';
import type { CreateNotePayload, Note, NoteContent, UpdateNotePayload } from '../types';
import { emptyNoteDoc, mapNote } from '../lib/notes';

export type NotesUnsubscribe = () => void;

const demoNotes = new Map<string, Note>();

export async function fetchNotes(uid: string): Promise<Note[]> {
  if (isDemoMode()) {
    return Array.from(demoNotes.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }
  const { data, error } = await getSupabase()
    .from('notes')
    .select('*')
    .eq('user_id', uid)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => mapNote(row.id as string, row));
}

export function subscribeNotes(uid: string, cb: (notes: Note[]) => void): NotesUnsubscribe {
  if (isDemoMode()) {
    void fetchNotes(uid).then(cb);
    return () => undefined;
  }
  void fetchNotes(uid).then(cb);
  return subscribeTable({
    topic: `notes:${uid}`,
    table: 'notes',
    filter: `user_id=eq.${uid}`,
    onChange: () => {
      void fetchNotes(uid).then(cb);
    },
  });
}

export async function createNote(payload: CreateNotePayload): Promise<Note> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const note: Note = mapNote(`demo-${now}`, {
      title: payload.title ?? '',
      content: payload.content ?? emptyNoteDoc(),
      links: payload.links ?? [],
      created_at: now,
      updated_at: now,
    });
    demoNotes.set(note.id, note);
    return note;
  }
  return api.post<Note>('/api/notes', {
    title: payload.title ?? '',
    content: payload.content ?? emptyNoteDoc(),
    links: payload.links ?? [],
  });
}

export async function updateNote(noteId: string, payload: UpdateNotePayload): Promise<Note> {
  if (isDemoMode()) {
    const prev = demoNotes.get(noteId);
    if (!prev) throw new Error('Idea no encontrada');
    const next: Note = {
      ...prev,
      title: payload.title !== undefined ? payload.title : prev.title,
      content: (payload.content as NoteContent | undefined) ?? prev.content,
      links: payload.links ?? prev.links,
      updatedAt: new Date().toISOString(),
    };
    demoNotes.set(noteId, next);
    return next;
  }
  return api.patch<Note>(`/api/notes/${encodeURIComponent(noteId)}`, payload);
}

export async function deleteNote(noteId: string): Promise<void> {
  if (isDemoMode()) {
    demoNotes.delete(noteId);
    return;
  }
  await api.del<void>(`/api/notes/${encodeURIComponent(noteId)}`);
}
