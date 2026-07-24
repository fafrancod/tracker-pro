-- Daily Tracker — esquema inicial (PostgreSQL / Supabase)
-- Ejecuta este SQL en el SQL Editor de tu proyecto Supabase.

-- Perfiles (1:1 con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  settings jsonb not null default jsonb_build_object(
    'autoRollIncomplete', false,
    'defaultProjectId', null,
    'weekStartsOnMonday', true,
    'language', 'es',
    'defaultBoardView', 'continuous'
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color text not null,
  icon text not null,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_order_idx on public.projects (user_id, "order");

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_id text not null,
  day_id text not null,
  -- Inclusive end of multi-day span; equals day_id for single-day tasks.
  end_day_id text not null,
  title text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  project_id text references public.projects (id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  notes text not null default '',
  "order" int not null default 0,
  tags text[] not null default '{}',
  moved_from text,
  series_id text,
  recurrence_frequency text not null default 'none'
    check (recurrence_frequency in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  recurrence_interval int not null default 1 check (recurrence_interval >= 1 and recurrence_interval <= 365),
  urgency text check (urgency is null or urgency in ('urgent', 'not_urgent')),
  importance text check (importance is null or importance in ('important', 'not_important')),
  kind text not null default 'task' check (kind in ('task', 'reminder')),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_day_id >= day_id)
);

create index if not exists tasks_user_week_day_idx on public.tasks (user_id, week_id, day_id, "order");
create index if not exists tasks_user_day_range_idx on public.tasks (user_id, day_id);
create index if not exists tasks_user_series_idx on public.tasks (user_id, series_id);
create index if not exists tasks_user_span_idx on public.tasks (user_id, day_id, end_day_id);

-- Migración idempotente si la tabla ya existía sin columnas de recurrencia
alter table public.tasks add column if not exists series_id text;
alter table public.tasks add column if not exists recurrence_frequency text not null default 'none';
alter table public.tasks add column if not exists recurrence_interval int not null default 1;

-- Migración idempotente: multi-day span (end_day_id)
alter table public.tasks add column if not exists end_day_id text;
update public.tasks set end_day_id = day_id where end_day_id is null;
alter table public.tasks alter column end_day_id set not null;
-- check constraint may already exist on fresh creates; use DO block for idempotency
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
create index if not exists tasks_user_span_idx on public.tasks (user_id, day_id, end_day_id);

-- Migración idempotente: Eisenhower (urgency / importance)
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

-- Preferencia defaultBoardView en perfiles existentes (merge jsonb)
update public.profiles
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('defaultBoardView', 'continuous')
where settings is null
   or not (settings ? 'defaultBoardView');

-- Migración: yearly recurrence + kind + color
alter table public.tasks add column if not exists kind text;
alter table public.tasks add column if not exists color text;
update public.tasks set kind = 'task' where kind is null;
alter table public.tasks alter column kind set default 'task';
alter table public.tasks alter column kind set not null;

do $$
begin
  -- Expand recurrence_frequency check to include yearly
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
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_kind_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_kind_check check (kind in ('task', 'reminder'));
  end if;
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

create table if not exists public.usage_counters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  period text not null,
  tasks_created int not null default 0,
  projects_created int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

create table if not exists public.usage_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id text not null,
  period text not null,
  counters jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table if not exists public.analytics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_id text not null,
  completions_by_day jsonb not null default '{}',
  completions_by_project jsonb not null default '{}',
  streak_count int not null default 0,
  primary key (user_id, week_id)
);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  uid uuid,
  severity text not null,
  operation text not null,
  message text not null,
  stack text,
  meta jsonb,
  user_agent text,
  ip text,
  version text,
  channel text,
  build_id text,
  created_at timestamptz not null default now()
);

-- RLS: lecturas del dueño; escrituras sensibles vía API (service role)
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.analytics enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);

create policy "analytics_select_own" on public.analytics
  for select using (auth.uid() = user_id);