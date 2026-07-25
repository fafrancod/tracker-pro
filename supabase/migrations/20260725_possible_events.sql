-- Eventos posibles: nuevo kind + contactos involucrados del Círculo.
-- Ejecutar en Supabase SQL Editor.

-- 1) Columna de contactos involucrados
alter table public.tasks
  add column if not exists involved_contact_ids text[] not null default '{}';

-- 2) Ampliar check de kind (incluye possible_event)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'tasks_kind_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks drop constraint tasks_kind_check;
  end if;

  alter table public.tasks
    add constraint tasks_kind_check
    check (kind in ('task', 'reminder', 'rx_human', 'rx_pet', 'possible_event'));
exception
  when duplicate_object then null;
end $$;

create index if not exists tasks_user_involved_contacts_idx
  on public.tasks using gin (involved_contact_ids);
