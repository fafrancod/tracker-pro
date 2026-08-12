-- Subcategorías dentro de cada proyecto + enlace en tareas.
alter table public.projects
  add column if not exists categories jsonb not null default '[]'::jsonb;

alter table public.tasks
  add column if not exists project_category_id text;
