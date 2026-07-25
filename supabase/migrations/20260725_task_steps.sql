-- Pasos asociados (checklist) en tareas / eventos / posibles
alter table public.tasks add column if not exists steps jsonb not null default '[]'::jsonb;
