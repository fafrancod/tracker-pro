import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  FolderKanban,
  Lightbulb,
  ListChecks,
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
import { ResizableAside } from '@/components/ui/resizable-aside';
import { NotesEditor } from '@/components/Notes/NotesEditor';
import { TaskDetailSheet } from '@/components/Board';
import { useNotes } from '@core/hooks/useNotes';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import {
  fetchAllTasks,
  mergeLocatedRowsIntoStore,
  type LocatedTaskRow,
} from '@core/services/taskService';
import { emptyNoteDoc, noteLinkTypeForKind } from '@core/lib/notes';
import { isDemoMode } from '@core/lib/demoMode';
import type { Note, NoteLink, NoteLinkType, Project } from '@core/types';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

const FOLDER_KEY = 'dt.notesFolders';
const EXPLORER_WIDTH_KEY = 'dt.notesExplorerWidth';
const EXPLORER_COLLAPSED_KEY = 'dt.notesExplorerCollapsed';
const EXPLORER_MAX_WIDTH = 320;

type FolderKey = 'inbox' | `project:${string}` | `sub:${string}:${string}`;

function folderKeyOfNote(note: Note, projects: Project[]): FolderKey {
  const sub = note.links.find(l => l.type === 'subproject');
  if (sub) {
    const projectId =
      sub.projectId ??
      projects.find(p => (p.categories ?? []).some(c => c.id === sub.id))?.id;
    if (projectId) return `sub:${projectId}:${sub.id}`;
  }
  const proj = note.links.find(l => l.type === 'project');
  if (proj) return `project:${proj.id}`;
  return 'inbox';
}

function loadExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(FOLDER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function NotesPage() {
  const { t } = useT();
  const { showToast } = useToast();
  const { notes, loading, addNote, editNote, removeNote } = useNotes();
  const { projects } = useProjects();
  const uid = useStore(s => s.uid);
  const setDetailTask = useStore(s => s.setDetailTask);
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileEditor, setMobileEditor] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [linkQuery, setLinkQuery] = useState('');
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [taskRows, setTaskRows] = useState<LocatedTaskRow[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderKey | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded);
  const [explorerCollapsed, setExplorerCollapsed] = useState(() => {
    try {
      return localStorage.getItem(EXPLORER_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = notes.find(n => n.id === selectedId) ?? null;

  useEffect(() => {
    if (!uid || isDemoMode()) return;
    void fetchAllTasks(uid)
      .then(rows => {
        setTaskRows(rows);
        mergeLocatedRowsIntoStore(rows);
      })
      .catch(() => setTaskRows([]));
  }, [uid]);

  useEffect(() => {
    const note = notes.find(n => n.id === selectedId);
    setTitleDraft(note?.title ?? '');
    // Solo al cambiar de idea: si dependemos de `notes`, el autoguardado pisa acentos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const fromUrl = searchParams.get('note');
    if (!fromUrl || notes.length === 0) return;
    if (!notes.some(n => n.id === fromUrl)) return;
    setSelectedId(fromUrl);
    setMobileEditor(true);
  }, [searchParams, notes]);

  function persistExpanded(next: Record<string, boolean>) {
    setExpanded(next);
    try {
      localStorage.setItem(FOLDER_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function toggleFolder(key: FolderKey) {
    persistExpanded({ ...expanded, [key]: expanded[key] === false });
  }

  function setExplorerCollapsedPersist(next: boolean) {
    setExplorerCollapsed(next);
    try {
      localStorage.setItem(EXPLORER_COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n => {
      if (n.title.toLowerCase().includes(q)) return true;
      if (n.excerpt.toLowerCase().includes(q)) return true;
      return n.links.some(l => (l.label ?? '').toLowerCase().includes(q));
    });
  }, [notes, search]);

  const tree = useMemo(() => {
    const byFolder = new Map<FolderKey, Note[]>();
    for (const note of filtered) {
      const key = folderKeyOfNote(note, projects);
      const list = byFolder.get(key) ?? [];
      list.push(note);
      byFolder.set(key, list);
    }
    return { byFolder };
  }, [filtered, projects]);

  const searching = search.trim().length > 0;

  function linksForActiveFolder(): NoteLink[] {
    if (!activeFolder || activeFolder === 'inbox') return [];
    if (activeFolder.startsWith('project:')) {
      const id = activeFolder.slice('project:'.length);
      const project = projects.find(p => p.id === id);
      return project
        ? [{ type: 'project', id: project.id, label: project.name }]
        : [];
    }
    const [, projectId, categoryId] = activeFolder.split(':');
    const project = projects.find(p => p.id === projectId);
    const cat = project?.categories?.find(c => c.id === categoryId);
    if (!project || !cat) return [];
    return [
      { type: 'project', id: project.id, label: project.name },
      {
        type: 'subproject',
        id: cat.id,
        projectId: project.id,
        label: cat.name,
      },
    ];
  }

  async function handleCreate() {
    try {
      const created = await addNote({
        title: t('notes_untitled'),
        content: emptyNoteDoc(),
        links: linksForActiveFolder(),
      });
      setSelectedId(created.id);
      setMobileEditor(true);
      setSearchParams({ note: created.id }, { replace: true });
    } catch {
      showToast(t('notes_save_error'), 'error');
    }
  }

  function scheduleSave(
    noteId: string,
    patch: { title?: string; content?: Note['content']; links?: NoteLink[] }
  ) {
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
        setSearchParams({}, { replace: true });
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
    const opts: Array<{
      type: NoteLinkType;
      id: string;
      projectId?: string | null;
      label: string;
    }> = [];
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
      opts.push({
        type: noteLinkTypeForKind(row.kind),
        id: row.id,
        projectId: row.projectId,
        label: row.title,
      });
    }
    const unused = selected
      ? opts.filter(o => !selected.links.some(l => l.type === o.type && l.id === o.id))
      : opts;
    if (!q) return unused.slice(0, 40);
    return unused.filter(o => o.label.toLowerCase().includes(q)).slice(0, 40);
  }, [projects, taskRows, linkQuery, selected]);

  function addLink(opt: {
    type: NoteLinkType;
    id: string;
    projectId?: string | null;
    label: string;
  }) {
    if (!selected) return;
    if (selected.links.some(l => l.type === opt.type && l.id === opt.id)) return;
    const links = [...selected.links, opt];
    void editNote(selected.id, { links }).catch(() =>
      showToast(t('notes_save_error'), 'error')
    );
    setLinkQuery('');
    setLinkMenuOpen(false);
  }

  function removeLink(link: NoteLink) {
    if (!selected) return;
    const links = selected.links.filter(
      l => !(l.type === link.type && l.id === link.id)
    );
    void editNote(selected.id, { links }).catch(() =>
      showToast(t('notes_save_error'), 'error')
    );
  }

  const linkTypeLabel: Record<NoteLinkType, string> = {
    project: t('notes_tag_project'),
    subproject: t('notes_tag_subproject'),
    task: t('notes_tag_task'),
    event: t('notes_tag_event'),
  };

  function openNote(note: Note) {
    setSelectedId(note.id);
    setMobileEditor(true);
    setSearchParams({ note: note.id }, { replace: true });
  }

  function openLinkedTask(link: NoteLink) {
    if (link.type !== 'task' && link.type !== 'event') return;
    const row = taskRows.find(r => r.id === link.id);
    if (!row) {
      showToast(t('notes_open_task_missing'), 'error');
      return;
    }
    setDetailTask({ weekId: row.weekId, dayId: row.dayId, taskId: row.id });
  }

  function renderNoteRow(note: Note) {
    const title =
      note.id === selectedId ? titleDraft || t('notes_untitled') : note.title || t('notes_untitled');
    return (
      <button
        key={note.id}
        type="button"
        onClick={() => openNote(note)}
        className={cn(
          'mb-0.5 w-full rounded-lg px-3 py-2 text-left transition-colors',
          selectedId === note.id ? 'bg-accent-teal/10' : 'hover:bg-surface'
        )}
      >
        <p className="truncate text-sm font-medium text-text-primary">{title}</p>
      </button>
    );
  }

  function folderOpen(key: FolderKey): boolean {
    if (searching) return true;
    return expanded[key] !== false;
  }

  function renderFolder(
    key: FolderKey,
    label: string,
    folderNotes: Note[],
    nested = false
  ) {
    if (searching && folderNotes.length === 0) return null;
    const open = folderOpen(key);
    return (
      <div key={key} className={nested ? 'ml-3' : undefined}>
        <button
          type="button"
          onClick={() => {
            setActiveFolder(key);
            toggleFolder(key);
          }}
          className={cn(
            'mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide',
            activeFolder === key
              ? 'bg-accent-teal/10 text-accent-teal'
              : 'text-text-muted hover:bg-surface hover:text-text-primary'
          )}
        >
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              open ? 'rotate-0' : '-rotate-90'
            )}
          />
          <FolderKanban className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate normal-case tracking-normal">
            {label}
          </span>
          <span className="tabular-nums text-[10px]">{folderNotes.length}</span>
        </button>
        {open ? (
          <div className="mb-1 pl-2">
            {folderNotes.length === 0 ? (
              <p className="px-2 py-1 text-[11px] text-text-muted">
                {t('notes_folder_empty')}
              </p>
            ) : (
              folderNotes.map(renderNoteRow)
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const inboxNotes = tree.byFolder.get('inbox') ?? [];

  const explorerBody = (
    <>
      <div className="border-b border-border p-2 pr-8">
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
      <div className="flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <p className="px-3 py-4 text-xs text-text-muted">{t('notes_loading')}</p>
        ) : notes.length === 0 && projects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <StickyNote className="h-8 w-8 text-text-muted" />
            <p className="text-sm font-medium text-text-primary">
              {t('notes_empty_title')}
            </p>
            <p className="text-xs text-text-muted">{t('notes_empty_hint')}</p>
            <Button size="sm" onClick={() => void handleCreate()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('notes_new')}
            </Button>
          </div>
        ) : (
          <>
            {projects.map(project => {
              const projectKey: FolderKey = `project:${project.id}`;
              const ownNotes = tree.byFolder.get(projectKey) ?? [];
              const cats = project.categories ?? [];
              const hasVisibleChild =
                !searching ||
                ownNotes.length > 0 ||
                cats.some(
                  c =>
                    (tree.byFolder.get(`sub:${project.id}:${c.id}`) ?? []).length >
                    0
                );
              if (searching && !hasVisibleChild) return null;
              const open = folderOpen(projectKey);
              return (
                <div key={project.id} className="mb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFolder(projectKey);
                      toggleFolder(projectKey);
                    }}
                    className={cn(
                      'mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium',
                      activeFolder === projectKey
                        ? 'bg-accent-teal/10 text-accent-teal'
                        : 'text-text-primary hover:bg-surface'
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-text-muted transition-transform',
                        open ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs"
                      style={{ backgroundColor: project.color + '22' }}
                    >
                      {project.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  </button>
                  {open ? (
                    <div className="mb-1">
                      {cats.map(cat =>
                        renderFolder(
                          `sub:${project.id}:${cat.id}`,
                          cat.name,
                          tree.byFolder.get(`sub:${project.id}:${cat.id}`) ?? [],
                          true
                        )
                      )}
                      {ownNotes.map(renderNoteRow)}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {renderFolder('inbox', t('notes_folder_inbox'), inboxNotes)}
          </>
        )}
      </div>
    </>
  );

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
            'flex w-full shrink-0 flex-col border-border md:hidden',
            mobileEditor ? 'hidden' : 'flex'
          )}
        >
          {explorerBody}
        </aside>
        <ResizableAside
          storageKey={EXPLORER_WIDTH_KEY}
          maxWidth={EXPLORER_MAX_WIDTH}
          collapsed={explorerCollapsed}
          onCollapsedChange={setExplorerCollapsedPersist}
          collapseLabel={t('notes_collapse_explorer')}
          expandLabel={t('notes_expand_explorer')}
          resizeLabel={t('notes_resize_explorer')}
        >
          {explorerBody}
        </ResizableAside>

        <section
          className={cn(
            'min-w-0 flex-1 flex-col overflow-hidden',
            mobileEditor || selected ? 'flex' : 'hidden md:flex'
          )}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <Lightbulb className="h-8 w-8 text-text-muted" />
              <p className="text-sm font-medium text-text-primary">
                {t('notes_pick_title')}
              </p>
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
                  {selected.links.map(link => {
                    const clickable = link.type === 'task' || link.type === 'event';
                    return (
                    <span
                      key={`${link.type}:${link.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-primary"
                    >
                      {link.type === 'project' || link.type === 'subproject' ? (
                        <FolderKanban className="h-3 w-3 text-accent-teal" />
                      ) : link.type === 'event' ? (
                        <CalendarDays className="h-3 w-3 text-accent-teal" />
                      ) : (
                        <ListChecks className="h-3 w-3 text-accent-teal" />
                      )}
                      {clickable ? (
                        <button
                          type="button"
                          onClick={() => openLinkedTask(link)}
                          className="max-w-[14rem] truncate hover:underline"
                          title={
                            link.type === 'event'
                              ? t('notes_open_event')
                              : t('notes_open_task')
                          }
                        >
                          {link.label || linkTypeLabel[link.type]}
                        </button>
                      ) : (
                        <span className="max-w-[14rem] truncate">
                          {link.label || linkTypeLabel[link.type]}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeLink(link)}
                        className="text-text-muted hover:text-text-primary"
                        aria-label={t('notes_untag')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                    );
                  })}
                  <div className="relative min-w-[12rem] flex-1">
                    <Input
                      value={linkQuery}
                      onChange={e => {
                        setLinkQuery(e.target.value);
                        setLinkMenuOpen(true);
                      }}
                      onFocus={() => setLinkMenuOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => setLinkMenuOpen(false), 150);
                      }}
                      placeholder={t('notes_tag_ph')}
                      className="h-8 text-xs"
                    />
                    {linkMenuOpen ? (
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
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => addLink(opt)}
                                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-background"
                              >
                                <span className="text-[10px] uppercase text-text-muted">
                                  {linkTypeLabel[opt.type]}
                                </span>
                                <span className="truncate text-text-primary">
                                  {opt.label}
                                </span>
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
                noteId={selected.id}
                content={selected.content}
                placeholder={t('notes_editor_ph')}
                onChange={content => scheduleSave(selected.id, { content })}
              />
            </>
          )}
        </section>
      </div>

      <TaskDetailSheet />

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
