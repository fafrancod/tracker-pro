-- Hábitos: plan diario de pomodoros (serie) + conteo del día (instancia)
alter table public.tasks add column if not exists pomodoro_target int not null default 0;
alter table public.tasks add column if not exists pomodoro_done int not null default 0;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_pomodoro_target_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_pomodoro_target_check
      check (pomodoro_target >= 0 and pomodoro_target <= 24);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_pomodoro_done_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_pomodoro_done_check
      check (pomodoro_done >= 0 and pomodoro_done <= 24);
  end if;
end $$;
