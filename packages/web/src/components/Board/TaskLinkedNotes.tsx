import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Plus, X } from 'lucide-react';
import { useNotes } from '@core/hooks/useNotes';
import {
  emptyNoteDoc,
  noteLinkForTask,
  notesLinkedToTask,
} from '@core/lib/notes';
import type { Task } from '@core/types';
import { Input } from '@/components/ui/input';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { useStore } from '@core/store';

export function TaskLinkedNotes({ task }: { task: Task }) {
  const { t } = useT();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const setDetailTask = useStore(s => s.setDetailTask);
  const { notes, addNote, editNote } = useNotes();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const linked = useMemo(
    () => notesLinkedToTask(notes, task.id),
    [notes, task.id]
  );
  const linkedIds = useMemo(() => new Set(linked.map(n => n.id)), [linked]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter(n => !linkedIds.has(n.id))
      .filter(n => {
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.excerpt.toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [notes, linkedIds, query]);

  function openNote(noteId: string) {
    setDetailTask(null);
    navigate(`/ideas?note=${encodeURIComponent(noteId)}`);
  }

  async function connect(noteId: string) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const link = noteLinkForTask(task);
    if (note.links.some(l => l.type === link.type && l.id === link.id)) return;
    try {
      await editNote(note.id, { links: [...note.links, link] });
      setQuery('');
      setMenuOpen(false);
    } catch {
      showToast(t('notes_save_error'), 'error');
    }
  }

  async function disconnect(noteId: string) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    try {
      await editNote(note.id, {
        links: note.links.filter(
          l => !((l.type === 'task' || l.type === 'event') && l.id === task.id)
        ),
      });
    } catch {
      showToast(t('notes_save_error'), 'error');
    }
  }

  async function createLinked() {
    setCreating(true);
    try {
      const created = await addNote({
        title: t('notes_untitled'),
        content: emptyNoteDoc(),
        links: [noteLinkForTask(task)],
      });
      openNote(created.id);
    } catch {
      showToast(t('notes_save_error'), 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {linked.map(note => (
          <span
            key={note.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-primary"
          >
            <Lightbulb className="h-3 w-3 shrink-0 text-accent-teal" />
            <button
              type="button"
              onClick={() => openNote(note.id)}
              className="min-w-0 truncate hover:underline"
              title={t('task_linked_ideas_open')}
            >
              {note.title.trim() || t('notes_untitled')}
            </button>
            <button
              type="button"
              onClick={() => void disconnect(note.id)}
              className="text-text-muted hover:text-text-primary"
              aria-label={t('task_linked_ideas_untag')}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {linked.length === 0 ? (
        <p className="mt-1 text-[11px] text-text-muted">
          {t('task_linked_ideas_empty')}
        </p>
      ) : null}
      <div className="relative mt-2">
        <Input
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setMenuOpen(true);
          }}
          onFocus={() => setMenuOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setMenuOpen(false), 150);
          }}
          placeholder={t('task_linked_ideas_search')}
          className="h-8 text-xs"
        />
        {menuOpen ? (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
            {options.length === 0 ? (
              <li className="px-2 py-2 text-xs text-text-muted">
                {t('task_linked_ideas_none')}
              </li>
            ) : (
              options.map(note => (
                <li key={note.id}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => void connect(note.id)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-background"
                  >
                    <Lightbulb className="h-3 w-3 shrink-0 text-accent-teal" />
                    <span className="truncate text-text-primary">
                      {note.title.trim() || t('notes_untitled')}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      <button
        type="button"
        disabled={creating}
        onClick={() => void createLinked()}
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent-teal hover:underline disabled:opacity-50"
      >
        <Plus className="h-3 w-3" />
        {t('task_linked_ideas_new')}
      </button>
    </div>
  );
}
