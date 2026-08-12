-- Imágenes adjuntas a tareas (data URLs comprimidos en cliente).
alter table public.tasks add column if not exists images jsonb not null default '[]'::jsonb;
