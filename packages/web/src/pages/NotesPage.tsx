import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  FolderKanban,
  Lightbulb,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NotesEditor } from '@/components/Notes/NotesEditor';
import { useNotes } from '@core/hooks/useNotes';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import { fetchAllTasks, type LocatedTaskRow } from '@core/services/taskService';
import { emptyNoteDoc } from '@core/lib/notes';
import { isDemoMode } from '@core/lib/demoMode';
import type { Note, NoteLink, NoteLinkType } from '@core/types';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

export function NotesPage() {
  const { t } = useT();
  const { showToast } = useToast();
  const { notes, loading, addNote, editNote, removeNote } = useNotes();
  const { projects } = useProjects();
  const uid = useStore(s => s.uid);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileEditor, setMobileEditor] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [linkQuery, setLinkQuery] = useState('');
  const [taskRows, setTaskRows] = useState<LocatedTaskRow[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = notes.find(n => n.id === selectedId) ?? null;

  useEffect(() => {
    if (!uid || isDemoMode()) return;
    void fetchAllTasks(uid)
      .then(setTaskRows)
      .catch(() => setTaskRows([]));
  }, [uid]);

  useEffect(() => {
    if (selected) setTitleDraft(selected.title);
  }, [selected?.id, selected?.title]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n => {
      if (n.title.toLowerCase().includes(q)) return true;
      if (n.excerpt.toLowerCase().includes(q)) return true;
      return n.links.some(l => (l.label ?? '').toLowerCase().includes(q));
    });
  }, [notes, search]);

  async function handleCreate() {
    try {
      const created = await addNote({
        title: t('notes_untitled'),
        content: emptyNoteDoc(),
        links: [],
      });
      setSelectedId(created.id);
      setMobileEditor(true);
    } catch {
      showToast(t('notes_save_error'), 'error');
    }
  }

  function scheduleSave(noteId: string, patch: { title?: string; content?: Note['content']; links?: NoteLink[] }) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void editNote(noteId, patch).catch(() => {
        showToast(t('notes_save_error'), 'error');
      });
    }, 500);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await removeNote(deleteId);
      if (selectedId === deleteId) {
        setSelectedId(null);
        setMobileEditor(false);
      }
      setDeleteId(null);
    } catch {
      showToast(t('notes_delete_error'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const linkOptions = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    const opts: Array<{ type: NoteLinkType; id: string; projectId?: string | null; label: string }> = [];
    for (const p of projects) {
      opts.push({ type: 'project', id: p.id, label: p.name });
      for (const c of p.categories ?? []) {
        opts.push({
          type: 'subproject',
          id: c.id,
          projectId: p.id,
          label: `${p.name} · ${c.name}`,
        });
      }
    }
    for (const row of taskRows) {
      if (row.kind === 'event' || row.kind === 'possible_event') {
        opts.push({ type: 'event', id: row.id, projectId: row.projectId, label: row.title });
      } else if (row.kind === 'task' || row.kind === 'reminder') {
        opts.push({ type: 'task', id: row.id, projectId: row.projectId, label: row.title });
      }
    }
    if (!q) return opts.slice(0, 40);
    return opts.filter(o => o.label.toLowerCase().includes(q)).slice(0, 40);
  }, [projects, taskRows, linkQuery]);

  function addLink(opt: { type: NoteLinkType; id: string; projectId?: string | null; label: string }) {
    if (!selected) return;
    if (selected.links.some(l => l.type === opt.type && l.id === opt.id)) return;
    const links = [...selected.links, opt];
    void editNote(selected.id, { links }).catch(() => showToast(t('notes_save_error'), 'error'));
    setLinkQuery('');
  }

  function removeLink(link: NoteLink) {
    if (!selected) return;
    const links = selected.links.filter(l => !(l.type === link.type && l.id === link.id));
    void editNote(selected.id, { links }).catch(() => showToast(t('notes_save_error'), 'error'));
  }

  const linkTypeLabel: Record<NoteLinkType, string> = {
    project: t('notes_tag_project'),
    subproject: t('notes_tag_subproject'),
    task: t('notes_tag_task'),
    event: t('notes_tag_event'),
  };

  return (
    <Layout
      title={t('nav_ideas')}
      primaryAction={{ label: t('notes_new'), onClick: () => void handleCreate() }}
      onFabClick={() => void handleCreate()}
      showFab
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            'flex w-full shrink-0 flex-col border-border md:w-80 md:border-r',
            mobileEditor ? 'hidden md:flex' : 'flex'
          )}
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('notes_search')}
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-xs text-text-muted">{t('notes_loading')}</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <StickyNote className="h-8 w-8 text-text-muted" />
                <p className="text-sm font-medium text-text-primary">{t('notes_empty_title')}</p>
                <p className="text-xs text-text-muted">{t('notes_empty_hint')}</p>
                <Button size="sm" onClick={() => void handleCreate()}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('notes_new')}
                </Button>
              </div>
            ) : (
              <ul className="p-1.5">
                {filtered.map(note => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(note.id);
                        setMobileEditor(true);
                      }}
                      className={cn(
                        'mb-0.5 w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                        selectedId === note.id
                          ? 'bg-accent-teal/10'
                          : 'hover:bg-surface'
                      )}
                    >
                      <p className="truncate text-sm font-medium text-text-primary">
                        {note.title || t('notes_untitled')}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-text-muted">
                        {note.excerpt || t('notes_no_excerpt')}
                      </p>
                      {note.links.length > 0 ? (
                        <p className="mt-1 truncate text-[10px] text-accent-teal">
                          {note.links
                            .map(l => l.label || linkTypeLabel[l.type])
                            .slice(0, 3)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section
          className={cn(
            'min-w-0 flex-1 flex-col overflow-hidden',
            mobileEditor || selected ? 'flex' : 'hidden md:flex'
          )}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <Lightbulb className="h-8 w-8 text-text-muted" />
              <p className="text-sm font-medium text-text-primary">{t('notes_pick_title')}</p>
              <p className="max-w-sm text-xs text-text-muted">{t('notes_pick_hint')}</p>
            </div>
          ) : (
            <>
              <header className="flex flex-col gap-2 border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface md:hidden"
                    onClick={() => setMobileEditor(false)}
                  >
                    {t('notes_back')}
                  </button>
                  <Input
                    value={titleDraft}
                    onChange={e => {
                      setTitleDraft(e.target.value);
                      scheduleSave(selected.id, { title: e.target.value });
                    }}
                    placeholder={t('notes_title_ph')}
                    className="h-9 flex-1 border-0 bg-transparent px-1 text-base font-semibold shadow-none focus-visible:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setDeleteId(selected.id)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-accent-red"
                    aria-label={t('notes_delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {selected.links.map(link => (
                    <span
                      key={`${link.type}:${link.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-primary"
                    >
                      {link.type === 'project' || link.type === 'subproject' ? (
                        <FolderKanban className="h-3 w-3 text-accent-teal" />
                      ) : (
                        <CalendarDays className="h-3 w-3 text-accent-teal" />
                      )}
                      {link.label || linkTypeLabel[link.type]}
                      <button
                        type="button"
                        onClick={() => removeLink(link)}
                        className="text-text-muted hover:text-text-primary"
                        aria-label={t('notes_untag')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <div className="relative min-w-[12rem] flex-1">
                    <Input
                      value={linkQuery}
                      onChange={e => setLinkQuery(e.target.value)}
                      placeholder={t('notes_tag_ph')}
                      className="h-8 text-xs"
                    />
                    {linkQuery.trim() ? (
                      <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                        {linkOptions.length === 0 ? (
                          <li className="px-2 py-2 text-xs text-text-muted">
                            {t('notes_tag_empty')}
                          </li>
                        ) : (
                          linkOptions.map(opt => (
                            <li key={`${opt.type}:${opt.id}`}>
                              <button
                                type="button"
                                onClick={() => addLink(opt)}
                                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-background"
                              >
                                <span className="text-[10px] uppercase text-text-muted">
                                  {linkTypeLabel[opt.type]}
                                </span>
                                <span className="truncate text-text-primary">{opt.label}</span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </header>
              <NotesEditor
                key={selected.id}
                content={selected.content}
                placeholder={t('notes_editor_ph')}
                onChange={content => scheduleSave(selected.id, { content })}
              />
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={open => {
          if (!open && !deleting) setDeleteId(null);
        }}
        title={t('notes_delete_title')}
        description={t('notes_delete_confirm')}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />
    </Layout>
  );
}
