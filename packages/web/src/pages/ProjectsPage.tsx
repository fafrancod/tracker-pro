import { useState } from 'react';
import { FolderKanban, Pencil, Trash2, Lock } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjects } from '@core/hooks/useProjects';
import { usePlan } from '@core/hooks/usePlan';
import { useToast } from '@/contexts/ToastContext';
import { ProjectFormDialog, type ProjectFormValue } from '@/components/Projects/ProjectFormDialog';
import type { Project } from '@core/types';
import { ApiClientError } from '@core/lib/api';

export function ProjectsPage() {
  const { projects, addProject, editProject, removeProject } = useProjects();
  const { isPro, limits, plan } = usePlan();
  const { showToast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const limitReached = !isPro && projects.length >= limits.maxProjects;

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

  async function handleDelete(project: Project) {
    if (!confirm(`¿Eliminar "${project.name}"? Las tareas asociadas quedan sin proyecto.`)) return;
    try {
      await removeProject(project.id);
      showToast('Proyecto eliminado.', 'info');
    } catch {
      showToast('No pudimos eliminar el proyecto.', 'error');
    }
  }

  return (
    <Layout
      title="Proyectos"
      primaryAction={
        limitReached
          ? undefined
          : { label: 'Nuevo proyecto', onClick: openCreate }
      }
      onFabClick={limitReached ? undefined : openCreate}
      showFab={!limitReached}
    >
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Plan banner */}
        <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant={isPro ? 'teal' : 'secondary'}>{plan === 'pro' ? 'Pro' : 'Free'}</Badge>
            <span className="text-sm text-text-muted">
              {isPro
                ? 'Proyectos ilimitados.'
                : `${projects.length} de ${limits.maxProjects} proyectos usados.`}
            </span>
          </div>
          {limitReached && (
            <Badge variant="red" className="gap-1">
              <Lock className="h-3 w-3" /> Límite alcanzado
            </Badge>
          )}
        </div>

        {/* List */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-muted">
              <FolderKanban className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">Aún no tenés proyectos</h2>
            <p className="max-w-sm text-xs text-text-muted">
              Creá tu primer proyecto para agrupar tareas y ver progreso por contexto.
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
                  <p className="text-[11px]" style={{ color: p.color }}>
                    {p.color}
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
                    onClick={() => handleDelete(p)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-accent-red"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </Layout>
  );
}
