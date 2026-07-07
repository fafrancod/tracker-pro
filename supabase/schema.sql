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
    'language', 'es'
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
  title text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  project_id text references public.projects (id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  notes text not null default '',
  "order" int not null default 0,
  tags text[] not null default '{}',
  moved_from text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_week_day_idx on public.tasks (user_id, week_id, day_id, "order");

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