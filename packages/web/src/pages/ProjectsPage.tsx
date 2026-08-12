import { useState } from 'react';
import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useProjects } from '@core/hooks/useProjects';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import { ProjectFormDialog, type ProjectFormValue } from '@/components/Projects/ProjectFormDialog';
import type { Project } from '@core/types';
import { ApiClientError } from '@core/lib/api';

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
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(p => (
              <li
                key={p.id}
                className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-accent-teal/40"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base"
                  style={{ backgroundColor: p.color + '22' }}
                >
                  {p.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{p.name}</p>
                  <p className="truncate text-[11px] text-text-muted">
                    {(p.categories?.length ?? 0) > 0
                      ? t('project_categories_count').replace(
                          '{n}',
                          String(p.categories.length)
                        ) +
                        ': ' +
                        p.categories.map(c => c.name).join(' · ')
                      : p.color}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
                    aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-accent-red"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
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
