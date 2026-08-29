import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  FolderKanban,
  GanttChart,
  PanelLeftOpen,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TaskDetailSheet } from '@/components/Board';
import { useProjects } from '@core/hooks/useProjects';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import { ProjectFormDialog, type ProjectFormValue } from '@/components/Projects/ProjectFormDialog';
import type { Project, ProjectCategory, Task, TaskKind } from '@core/types';
import { ApiClientError } from '@core/lib/api';
import {
  appendProjectCategory,
  MAX_PROJECT_CATEGORIES,
  renameProjectCategory,
} from '@core/lib/projectCategories';
import {
  createTask,
  fetchAllTasks,
  mergeLocatedRowsIntoStore,
  type LocatedTaskRow,
} from '@core/services/taskService';
import { formatRecurrenceLabel, getWeekIdFromDayId, isRecurring } from '@core/lib/recurrence';
import {
  collapseProjectTaskSeries,
  type ProjectListTask,
} from '@core/lib/projectTaskList';
import { INBOX_DAY_ID, INBOX_WEEK_ID, isCalendarDayId } from '@core/lib/inbox';
import { useStore } from '@core/store';
import { isDemoMode } from '@core/lib/demoMode';
import { cn } from '@/lib/utils';

const LIST_KINDS: TaskKind[] = ['task', 'reminder', 'event', 'possible_event'];

function collectProjectTasks(
  tasksByDay: Record<string, Record<string, Task[]>>,
  projectId: string
): LocatedTaskRow[] {
  const out: LocatedTaskRow[] = [];
  const seen = new Set<string>();
  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [dayId, tasks] of Object.entries(days)) {
      for (const task of tasks) {
        if (seen.has(task.id) || task.projectId !== projectId) continue;
        seen.add(task.id);
        out.push({ ...task, weekId, dayId });
      }
    }
  }
  return out;
}

export function ProjectsPage() {
  const { projects, addProject, editProject, removeProject } = useProjects();
  const { showToast } = useToast();
  const { t } = useT();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(() => {
    try {
      return localStorage.getItem('dt.projectsListCollapsed') === '1';
    } catch {
      return false;
    }
  });

  const selected =
    projects.find(p => p.id === selectedId) ?? projects[0] ?? null;

  useEffect(() => {
    if (selected && selectedId !== selected.id) setSelectedId(selected.id);
  }, [selected, selectedId]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setDialogOpen(true);
  }

  async function handleSubmit(value: ProjectFormValue) {
    try {
      if (editing) {
        await editProject(editing.id, value);
        showToast('Proyecto actualizado.', 'success');
      } else {
        await addProject(value);
        showToast('Proyecto creado.', 'success');
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'plan_limit_reached') {
        showToast(err.message, 'error');
      } else {
        showToast('No pudimos guardar el proyecto.', 'error');
      }
      throw err;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeProject(deleteTarget.id);
      showToast('Proyecto eliminado.', 'info');
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
        setMobileDetail(false);
      }
      setDeleteTarget(null);
    } catch {
      showToast('No pudimos eliminar el proyecto.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Layout
      title={t('nav_projects')}
      primaryAction={{ label: t('project_new_title'), onClick: openCreate }}
      onFabClick={openCreate}
      showFab
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {projects.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-muted">
              <FolderKanban className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">
              {t('project_empty_title')}
            </h2>
            <p className="max-w-sm text-xs text-text-muted">{t('project_empty_hint')}</p>
            <Button onClick={openCreate} size="sm" className="mt-1">
              {t('project_empty_cta')}
            </Button>
          </div>
        ) : (
          <>
            <aside
              className={cn(
                'hidden h-full shrink-0 flex-col border-border md:flex md:border-r',
                listCollapsed ? 'w-10' : 'w-72'
              )}
            >
              {listCollapsed ? (
                <button
                  type="button"
                  onClick={() => {
                    setListCollapsed(false);
                    try {
                      localStorage.setItem('dt.projectsListCollapsed', '0');
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="flex h-full w-full flex-col items-center pt-2 text-text-muted hover:bg-surface hover:text-text-primary"
                  aria-label={t('nav_expand')}
                  title={t('nav_expand')}
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              ) : (
                <>
                  <div className="flex justify-end p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setListCollapsed(true);
                        try {
                          localStorage.setItem('dt.projectsListCollapsed', '1');
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="rounded-md p-1 text-text-muted hover:bg-background hover:text-text-primary"
                      aria-label={t('nav_collapse')}
                      title={t('nav_collapse')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="space-y-0.5 p-2 md:p-3">
                {projects.map(p => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(p.id);
                        setMobileDetail(true);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                        selected?.id === p.id
                          ? 'bg-accent-teal/10 text-text-primary'
                          : 'text-text-muted hover:bg-surface hover:text-text-primary'
                      )}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm"
                        style={{ backgroundColor: p.color + '22' }}
                      >
                        {p.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-primary">
                          {p.name}
                        </span>
                        <span className="block truncate text-[11px] text-text-muted">
                          {(p.categories?.length ?? 0) === 0
                            ? t('project_no_subprojects_short')
                            : t('project_categories_count').replace(
                                '{n}',
                                String(p.categories.length)
                              )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
                </>
              )}
            </aside>
            <aside
              className={cn(
                'w-full overflow-y-auto border-border md:hidden',
                mobileDetail ? 'hidden' : 'block'
              )}
            >
              <ul className="space-y-0.5 p-2">
                {projects.map(p => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(p.id);
                        setMobileDetail(true);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                        selected?.id === p.id
                          ? 'bg-accent-teal/10 text-text-primary'
                          : 'text-text-muted hover:bg-surface hover:text-text-primary'
                      )}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm"
                        style={{ backgroundColor: p.color + '22' }}
                      >
                        {p.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-primary">
                          {p.name}
                        </span>
                        <span className="block truncate text-[11px] text-text-muted">
                          {(p.categories?.length ?? 0) === 0
                            ? t('project_no_subprojects_short')
                            : t('project_categories_count').replace(
                                '{n}',
                                String(p.categories.length)
                              )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            {selected ? (
              <ProjectWorkspace
                project={selected}
                showBack={mobileDetail}
                onBack={() => setMobileDetail(false)}
                onEdit={() => openEdit(selected)}
                onDelete={() => setDeleteTarget(selected)}
                onSaveCategories={async categories => {
                  try {
                    await editProject(selected.id, { categories });
                  } catch {
                    showToast(t('gantt_rename_error'), 'error');
                  }
                }}
              />
            ) : null}
          </>
        )}
      </div>

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title={t('project_delete_title')}
        description={t('project_delete_confirm').replace(
          '{name}',
          deleteTarget?.name ?? ''
        )}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />
      <TaskDetailSheet />
    </Layout>
  );
}

function ProjectWorkspace({
  project,
  showBack,
  onBack,
  onEdit,
  onDelete,
  onSaveCategories,
}: {
  project: Project;
  showBack: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveCategories: (categories: ProjectCategory[]) => Promise<void>;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const uid = useStore(s => s.uid);
  const setDetailTask = useStore(s => s.setDetailTask);
  const tasksByDay = useStore(s => s.tasksByDay);
  const [rows, setRows] = useState<LocatedTaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!uid || isDemoMode()) {
        setRows(collectProjectTasks(tasksByDay, project.id));
        return;
      }
      const all = await fetchAllTasks(uid, { projectId: project.id });
      mergeLocatedRowsIntoStore(all);
      setRows(all.filter(r => LIST_KINDS.includes(r.kind)));
    } catch {
      showToast(t('project_tasks_load_error'), 'error');
      setRows(collectProjectTasks(tasksByDay, project.id));
    } finally {
      setLoading(false);
    }
  }, [uid, project.id, showToast, t, tasksByDay]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const cats = project.categories ?? [];
    const byCat = new Map<string | null, LocatedTaskRow[]>();
    byCat.set(null, []);
    for (const c of cats) byCat.set(c.id, []);
    for (const row of rows) {
      const key =
        row.projectCategoryId && byCat.has(row.projectCategoryId)
          ? row.projectCategoryId
          : null;
      byCat.get(key)!.push(row);
    }
    const collapsed = new Map<string | null, ProjectListTask[]>();
    for (const [key, list] of byCat) {
      const next = collapseProjectTaskSeries(list);
      next.sort((a, b) => {
        const ac = a.completed === b.completed ? 0 : a.completed ? 1 : -1;
        if (ac !== 0) return ac;
        const ad = isCalendarDayId(a.dayId) ? a.dayId : '9999';
        const bd = isCalendarDayId(b.dayId) ? b.dayId : '9999';
        return ad.localeCompare(bd) || a.title.localeCompare(b.title);
      });
      collapsed.set(key, next);
    }
    return { cats, byCat: collapsed };
  }, [project.categories, rows]);

  async function handleAddTask(categoryId: string | null, title: string, dayId: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const undated = !isCalendarDayId(dayId);
    try {
      const result = await createTask(
        undated ? INBOX_WEEK_ID : getWeekIdFromDayId(dayId),
        undated ? INBOX_DAY_ID : dayId,
        {
          title: trimmed,
          projectId: project.id,
          projectCategoryId: categoryId,
          undated,
          startDayId: undated ? undefined : dayId,
          kind: 'task',
        }
      );
      mergeLocatedRowsIntoStore(result.instances);
      await load();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'plan_limit_reached') {
        showToast(err.message, 'error');
      } else {
        showToast(t('project_task_add_error'), 'error');
      }
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5 md:px-4">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface md:hidden"
            aria-label={t('notes_back')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base"
          style={{ backgroundColor: project.color + '22' }}
        >
          {project.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-text-primary">{project.name}</h2>
          <p className="truncate text-[11px] text-text-muted">
            {t('project_workspace_hint')}
          </p>
        </div>
        <Link
          to={`/gantt/${project.id}`}
          className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-accent-teal"
          aria-label={t('gantt_open_project')}
        >
          <GanttChart className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
          aria-label={t('project_edit_title')}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-accent-red"
          aria-label={t('project_delete_title')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        {loading ? (
          <p className="text-xs text-text-muted">{t('project_tasks_loading')}</p>
        ) : null}

        {grouped.cats.map(cat => (
          <TaskGroup
            key={cat.id}
            title={cat.name}
            color={cat.urgencyColor ?? cat.importanceColor ?? project.color}
            tasks={grouped.byCat.get(cat.id) ?? []}
            onOpen={row =>
              setDetailTask({ weekId: row.weekId, dayId: row.dayId, taskId: row.id })
            }
            onAdd={(title, dayId) => handleAddTask(cat.id, title, dayId)}
          />
        ))}

        <TaskGroup
          title={t('project_ungrouped_tasks')}
          color={project.color}
          tasks={grouped.byCat.get(null) ?? []}
          onOpen={row =>
            setDetailTask({ weekId: row.weekId, dayId: row.dayId, taskId: row.id })
          }
          onAdd={(title, dayId) => handleAddTask(null, title, dayId)}
        />

        <ProjectSubprojects project={project} onSave={onSaveCategories} />
      </div>
    </section>
  );
}

function TaskGroup({
  title,
  color,
  tasks,
  onOpen,
  onAdd,
}: {
  title: string;
  color: string;
  tasks: ProjectListTask[];
  onOpen: (row: LocatedTaskRow) => void;
  onAdd: (title: string, dayId: string) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState('');
  const [dayId, setDayId] = useState('');
  const recurrenceLabels = {
    none: t('task_repeat_none'),
    daily: t('task_repeat_daily'),
    weekly: t('task_repeat_weekly'),
    monthly: t('task_repeat_monthly'),
    yearly: t('task_repeat_yearly'),
    every: (n: number, unit: string) => `${t('task_repeat_every')} ${n} · ${unit}`,
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {title}
        </h3>
        <span className="text-[11px] text-text-muted">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-text-muted">{t('project_no_tasks')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {tasks.map(row => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-background"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                    row.completed
                      ? 'border-accent-teal bg-accent-teal/20 text-accent-teal'
                      : 'border-border text-transparent'
                  )}
                >
                  <Check className="h-3 w-3" />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    row.completed
                      ? 'text-text-muted line-through'
                      : 'text-text-primary'
                  )}
                >
                  {row.title}
                </span>
                {isRecurring(row.recurrence) ? (
                  <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-teal/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-teal">
                      <Repeat className="h-3 w-3" />
                      {t('project_recurring')}
                    </span>
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
                      {formatRecurrenceLabel(row.recurrence, recurrenceLabels)}
                    </span>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-text-muted">
                    <CalendarDays className="h-3 w-3" />
                    {isCalendarDayId(row.dayId) ? row.dayId : t('project_undated')}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-1.5 border-t border-border p-2 sm:flex-row sm:items-center"
        onSubmit={e => {
          e.preventDefault();
          if (!draft.trim()) return;
          onAdd(draft, dayId);
          setDraft('');
        }}
      >
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={t('project_task_ph')}
          className="h-8 flex-1 text-sm"
        />
        <Input
          type="date"
          value={dayId}
          onChange={e => setDayId(e.target.value)}
          className="h-8 w-full text-xs sm:w-36"
          aria-label={t('project_task_date_optional')}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-8 px-2"
          disabled={!draft.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

function ProjectSubprojects({
  project,
  onSave,
}: {
  project: Project;
  onSave: (categories: ProjectCategory[]) => Promise<void>;
}) {
  const { t } = useT();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const cats = project.categories ?? [];

  async function commitRename(id: string) {
    const raw = drafts[id];
    if (raw === undefined) return;
    const next = renameProjectCategory(cats, id, raw);
    setDrafts(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (!next || next === cats) return;
    await onSave(next);
  }

  async function addOne() {
    const added = appendProjectCategory(cats, newName);
    if (!added) return;
    setNewName('');
    await onSave(added.categories);
  }

  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {t('project_subprojects')}
      </p>
      {cats.length === 0 ? (
        <p className="mb-2 text-[11px] text-text-muted">{t('project_no_subprojects')}</p>
      ) : (
        <ul className="mb-2 space-y-1">
          {cats.map(c => (
            <li key={c.id} className="flex items-center gap-1">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: c.urgencyColor ?? c.importanceColor ?? project.color,
                }}
              />
              <Input
                value={drafts[c.id] ?? c.name}
                onChange={e =>
                  setDrafts(prev => ({ ...prev, [c.id]: e.target.value }))
                }
                onBlur={() => void commitRename(c.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                maxLength={40}
                className="h-8 flex-1 text-sm"
                aria-label={t('gantt_rename_subproject')}
              />
            </li>
          ))}
        </ul>
      )}
      {cats.length < MAX_PROJECT_CATEGORIES && (
        <div className="flex gap-1.5">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addOne();
              }
            }}
            placeholder={t('project_category_ph')}
            maxLength={40}
            className="h-8 flex-1 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            disabled={!newName.trim()}
            onClick={() => void addOne()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
