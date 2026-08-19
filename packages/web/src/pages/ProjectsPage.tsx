import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, GanttChart, Pencil, Plus, Trash2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useProjects } from '@core/hooks/useProjects';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import { ProjectFormDialog, type ProjectFormValue } from '@/components/Projects/ProjectFormDialog';
import type { Project, ProjectCategory } from '@core/types';
import { ApiClientError } from '@core/lib/api';
import {
  appendProjectCategory,
  MAX_PROJECT_CATEGORIES,
  renameProjectCategory,
} from '@core/lib/projectCategories';

export function ProjectsPage() {
  const { projects, addProject, editProject, removeProject } = useProjects();
  const { showToast } = useToast();
  const { t } = useT();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      setDeleteTarget(null);
    } catch {
      showToast('No pudimos eliminar el proyecto.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Layout
      title="Proyectos"
      primaryAction={{ label: 'Nuevo proyecto', onClick: openCreate }}
      onFabClick={openCreate}
      showFab
    >
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-3 flex justify-end">
          <Link
            to="/gantt"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary hover:border-accent-teal/40 hover:bg-accent-teal/10"
          >
            <GanttChart className="h-3.5 w-3.5 text-accent-teal" />
            {t('gantt_open_life')}
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-muted">
              <FolderKanban className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">Aún no tienes proyectos</h2>
            <p className="max-w-sm text-xs text-text-muted">
              Crea tu primer proyecto para agrupar tareas y ver progreso por contexto.
            </p>
            <Button onClick={openCreate} size="sm" className="mt-1">
              Crear primer proyecto
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(p => (
              <li
                key={p.id}
                className="flex flex-col rounded-lg border border-border bg-surface transition-colors hover:border-accent-teal/40"
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base"
                    style={{ backgroundColor: p.color + '22' }}
                  >
                    {p.icon}
                  </span>
                  <Link to={`/gantt/${p.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {p.name}
                    </p>
                    <p className="truncate text-[11px] text-text-muted">
                      {t('gantt_open_project')}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      to={`/gantt/${p.id}`}
                      className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-accent-teal"
                      aria-label={t('gantt_open_project')}
                    >
                      <GanttChart className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-accent-red"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <ProjectSubprojects
                  project={p}
                  onSave={async categories => {
                    try {
                      await editProject(p.id, { categories });
                    } catch {
                      showToast(t('gantt_rename_error'), 'error');
                    }
                  }}
                />
              </li>
            ))}
            {/* Tarjeta «+» para añadir otro proyecto (además del FAB) */}
            <li>
              <button
                type="button"
                onClick={openCreate}
                className="flex h-full min-h-[3.75rem] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/50 px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:border-accent-teal/50 hover:bg-accent-teal/10 hover:text-accent-teal"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-teal/15 text-accent-teal">
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                </span>
                Nuevo proyecto
              </button>
            </li>
          </ul>
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
    </Layout>
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
    <div className="border-t border-border px-3 py-2">
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
