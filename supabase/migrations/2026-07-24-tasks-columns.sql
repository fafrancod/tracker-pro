-- Idempotent: columnas y constraints que el API escribe al crear tareas.
-- Ejecutar en Supabase → SQL Editor si crear tareas falla con error de columna / schema cache.

-- Multi-day span
alter table public.tasks add column if not exists end_day_id text;
update public.tasks set end_day_id = day_id where end_day_id is null;
alter table public.tasks alter column end_day_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_end_day_id_gte_day_id'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_end_day_id_gte_day_id check (end_day_id >= day_id);
  end if;
end $$;

-- Eisenhower
alter table public.tasks add column if not exists urgency text;
alter table public.tasks add column if not exists importance text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_urgency_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_urgency_check
      check (urgency is null or urgency in ('urgent', 'not_urgent'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_importance_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_importance_check
      check (importance is null or importance in ('important', 'not_important'));
  end if;
end $$;

-- kind + color + yearly recurrence
alter table public.tasks add column if not exists kind text;
alter table public.tasks add column if not exists color text;
update public.tasks set kind = 'task' where kind is null;
alter table public.tasks alter column kind set default 'task';
alter table public.tasks alter column kind set not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'tasks_recurrence_frequency_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks drop constraint tasks_recurrence_frequency_check;
  end if;
exception when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_recurrence_frequency_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_recurrence_frequency_check
      check (recurrence_frequency in ('none', 'daily', 'weekly', 'monthly', 'yearly'));
  end if;
end $$;

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
    check (kind in ('task', 'reminder', 'rx_human', 'rx_pet'));
exception when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_color_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_color_check
      check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

-- Horarios + recetario
alter table public.tasks add column if not exists start_time text;
alter table public.tasks add column if not exists end_time text;
alter table public.tasks add column if not exists rx_meta jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_start_time_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_start_time_check
      check (start_time is null or start_time ~ '^[0-2][0-9]:[0-5][0-9]$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_end_time_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_end_time_check
      check (end_time is null or end_time ~ '^[0-2][0-9]:[0-5][0-9]$');
  end if;
end $$;

-- series / recurrence (por si faltan en DBs muy antiguas)
alter table public.tasks add column if not exists series_id text;
alter table public.tasks add column if not exists recurrence_frequency text not null default 'none';
alter table public.tasks add column if not exists recurrence_interval int not null default 1;

create index if not exists tasks_user_span_idx on public.tasks (user_id, day_id, end_day_id);
create index if not exists tasks_user_series_idx on public.tasks (user_id, series_id);
