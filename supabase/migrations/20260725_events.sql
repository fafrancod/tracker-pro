-- Eventos confirmados: kind event + lugar + hora de salida prevista.
-- Ejecutar en Supabase SQL Editor.

alter table public.tasks
  add column if not exists location text;

alter table public.tasks
  add column if not exists departure_time text;

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
    check (
      kind in (
        'task',
        'reminder',
        'rx_human',
        'rx_pet',
        'possible_event',
        'event'
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_departure_time_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_departure_time_check
      check (
        departure_time is null
        or departure_time ~ '^[0-2][0-9]:[0-5][0-9]$'
      );
  end if;
end $$;
