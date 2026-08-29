import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import type { CreateNotePayload, Note, UpdateNotePayload } from '../types';
import {
  createNote,
  deleteNote,
  subscribeNotes,
  updateNote,
} from '../services/noteService';
import { isBrowserOnline } from '../lib/network';

export function useNotes() {
  const uid = useStore(s => s.uid);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!isBrowserOnline()) {
      setLoading(false);
      return;
    }
    return subscribeNotes(uid, next => {
      setNotes(next);
      setLoading(false);
    });
  }, [uid]);

  const addNote = useCallback(async (payload: CreateNotePayload) => {
    const created = await createNote(payload);
    setNotes(prev => [created, ...prev.filter(n => n.id !== created.id)]);
    return created;
  }, []);

  const editNote = useCallback(async (noteId: string, payload: UpdateNotePayload) => {
    setNotes(prev =>
      prev.map(n =>
        n.id === noteId
          ? {
              ...n,
              title: payload.title !== undefined ? payload.title : n.title,
              content: payload.content ?? n.content,
              links: payload.links !== undefined ? payload.links : n.links,
              updatedAt: new Date().toISOString(),
            }
          : n
      )
    );
    const updated = await updateNote(noteId, payload);
    setNotes(prev =>
      prev.map(n => {
        if (n.id !== noteId) return n;
        return {
          ...updated,
          title: payload.title !== undefined ? n.title : updated.title,
          content: payload.content != null ? n.content : updated.content,
        };
      })
    );
    return updated;
  }, []);

  const removeNote = useCallback(async (noteId: string) => {
    await deleteNote(noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }, []);

  return { notes, loading, addNote, editNote, removeNote };
}
