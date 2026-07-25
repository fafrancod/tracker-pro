-- Hábitos en el calendario: habit_good | habit_quit
-- Ejecutar en Supabase SQL editor si la constraint aún no admite estos kinds.

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
    check (kind in (
      'task', 'reminder', 'rx_human', 'rx_pet',
      'possible_event', 'event', 'habit_good', 'habit_quit'
    ));
exception when duplicate_object then null;
end $$;
