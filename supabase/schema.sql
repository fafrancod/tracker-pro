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
  -- Subcategorías [{id, name, order}] del proyecto grande.
  categories jsonb not null default '[]'::jsonb,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_order_idx on public.projects (user_id, "order");

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_id text,
  day_id text,
  -- Inclusive end of multi-day span; equals day_id for single-day tasks.
  -- Null together with day_id/week_id = tarea sin fecha (backlog).
  end_day_id text,
  title text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  project_id text references public.projects (id) on delete set null,
  -- Subcategoría (id dentro de projects.categories); null = solo proyecto.
  project_category_id text,
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
  kind text not null default 'task'
    check (kind in (
      'task', 'reminder', 'rx_human', 'rx_pet',
      'possible_event', 'event', 'habit_good', 'habit_quit'
    )),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Optional time-of-day schedule (local HH:mm, 24h). Null = sin horario.
  start_time text check (start_time is null or start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time text check (end_time is null or end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  -- Recetario: snapshot de la toma (amount/unit/phases). null en tareas normales.
  rx_meta jsonb,
  -- Círculo: personas/mascotas involucradas (ids de contacts).
  involved_contact_ids text[] not null default '{}',
  -- Evento: lugar y hora de salida prevista (notificaciones).
  location text,
  departure_time text check (
    departure_time is null or departure_time ~ '^[0-2][0-9]:[0-5][0-9]$'
  ),
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
      add constraint tasks_kind_check
      check (kind in ('task', 'reminder', 'rx_human', 'rx_pet', 'possible_event', 'event'));
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

-- Expand kind check for existing DBs (+ rx_* + possible_event + event + habits)
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

-- Hábitos (buenos / a dejar): ampliar constraint en DBs ya migradas
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

alter table public.tasks add column if not exists involved_contact_ids text[] not null default '{}';
alter table public.tasks add column if not exists location text;
alter table public.tasks add column if not exists departure_time text;
create index if not exists tasks_user_involved_contacts_idx
  on public.tasks using gin (involved_contact_ids);

-- Horarios opcionales (HH:mm)
alter table public.tasks add column if not exists start_time text;
alter table public.tasks add column if not exists end_time text;
alter table public.tasks add column if not exists rx_meta jsonb;

-- Checklist de pasos (tarea / recordatorio / evento / posible)
alter table public.tasks add column if not exists steps jsonb not null default '[]'::jsonb;

-- Imágenes adjuntas (data URLs JPEG comprimidos en cliente; máx. 4 en app)
alter table public.tasks add column if not exists images jsonb not null default '[]'::jsonb;

-- Subcategorías de proyecto
alter table public.projects add column if not exists categories jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists project_category_id text;
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

-- Entregas de notificaciones (dedupe email / canales servidor)
create table if not exists public.notification_deliveries (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id text not null,
  channel text not null check (channel in ('email')),
  fire_key text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent'
    check (status in ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now()
);

create unique index if not exists notification_deliveries_user_fire_key_idx
  on public.notification_deliveries (user_id, fire_key);

create index if not exists notification_deliveries_user_sent_idx
  on public.notification_deliveries (user_id, sent_at desc);

-- Preferencias de notificaciones en perfiles existentes (merge jsonb)
update public.profiles
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'notifyLocal', true,
  'notifyEmail', false,
  'notifyBeforeEnabled', true,
  'notifyMinutesBefore', 10,
  'notifyDayBefore', true,
  'notifyDayBeforeTime', '20:00',
  'notifyPastIncomplete', true,
  'notifyPastAfterMinutes', 30,
  'notifyTasks', true,
  'notifyRx', true,
  'timezone', coalesce(settings->>'timezone', 'UTC')
)
where settings is null
   or not (settings ? 'notifyEmail')
   or not (settings ? 'notifyDayBefore')
   or not (settings ? 'notifyPastIncomplete');

-- RLS: lecturas del dueño; escrituras sensibles vía API (service role)
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.analytics enable row level security;
alter table public.notification_deliveries enable row level security;
-- Estas tablas se usan exclusivamente desde la API con service_role.
-- Sin RLS quedarían expuestas por los grants por defecto de PostgREST.
alter table public.usage_counters enable row level security;
alter table public.usage_events enable row level security;
alter table public.error_logs enable row level security;

revoke all privileges on table public.usage_counters from anon, authenticated;
revoke all privileges on table public.usage_events from anon, authenticated;
revoke all privileges on table public.error_logs from anon, authenticated;

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

-- ——— Círculo: personas y mascotas (menciones @tag en tareas) ———
create table if not exists public.contacts (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('person', 'pet')),
  name text not null,
  tags text[] not null default '{}',
  relationship text check (
    relationship is null
    or relationship in (
      'father', 'mother', 'son', 'daughter',
      'brother', 'sister', 'partner',
      'niece', 'nephew', 'friend', 'coworker'
    )
  ),
  -- Percepción personal del vínculo
  relation_pulse text check (
    relation_pulse is null
    or relation_pulse in (
      'great', 'good', 'neutral', 'need_connect', 'strained', 'bad'
    )
  ),
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  check (kind = 'person' or relationship is null)
);

-- Migración idempotente: relation_pulse
alter table public.contacts add column if not exists relation_pulse text;

create index if not exists contacts_user_order_idx on public.contacts (user_id, "order");

alter table public.contacts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contacts' and policyname = 'contacts_select_own'
  ) then
    create policy "contacts_select_own" on public.contacts
      for select using (auth.uid() = user_id);
  end if;
end $$;
-- Finances: gastos/ingresos recurrentes, esperados y espec�ficos
create table if not exists public.finance_entries (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'EUR',
  flow text not null check (flow in ('expense', 'income')),
  kind text not null check (kind in ('recurring', 'expected', 'specific')),
  -- recurring: monthly | weekly
  frequency text check (frequency is null or frequency in ('monthly', 'weekly')),
  -- day of month 1-31 for monthly; 0-6 (Sun-Sat) for weekly
  recurrence_day int check (recurrence_day is null or (recurrence_day >= 0 and recurrence_day <= 31)),
  -- expected / specific date
  entry_date text check (entry_date is null or entry_date ~ '^\d{4}-\d{2}-\d{2}$'),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_entries_user_idx on public.finance_entries (user_id, flow, kind);
create index if not exists finance_entries_user_date_idx on public.finance_entries (user_id, entry_date);
-- Datos financieros legacy: solo la API puede acceder usando service_role.
alter table public.finance_entries enable row level security;
revoke all privileges on table public.finance_entries from anon, authenticated;

-- Libro de movimientos (calendario de dinero). payload en claro hasta la bóveda.
create table if not exists public.finance_rules (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  flow text not null check (flow in ('expense', 'income', 'investment')),
  currency text not null default 'EUR',
  frequency text not null check (frequency in ('monthly', 'weekly')),
  recurrence_day int not null check (recurrence_day >= 0 and recurrence_day <= 31),
  start_day_id text not null check (start_day_id ~ '^\d{4}-\d{2}-\d{2}$'),
  payload jsonb not null default '{}'::jsonb,
  payload_enc text,
  enc_v text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_rules_user_idx
  on public.finance_rules (user_id, active, start_day_id);

create table if not exists public.finance_movements (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_id text not null check (day_id ~ '^\d{4}-\d{2}-\d{2}$'),
  flow text not null check (flow in ('expense', 'income', 'investment')),
  status text not null default 'planned'
    check (status in ('planned', 'confirmed', 'skipped')),
  currency text not null default 'EUR',
  payload jsonb not null default '{}'::jsonb,
  payload_enc text,
  enc_v text,
  rule_id text references public.finance_rules (id) on delete set null,
  source_task_id text,
  account_id text,
  card_account_id text,
  goal_id text,
  credit_id text,
  installment_group_id text,
  installment_index int,
  installment_total int,
  client_mutation_id text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_movements_user_day_idx
  on public.finance_movements (user_id, day_id)
  where deleted_at is null;
create unique index if not exists finance_movements_user_mutation_idx
  on public.finance_movements (user_id, client_mutation_id)
  where client_mutation_id is not null;

create table if not exists public.finance_credits (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency text not null default 'EUR',
  kind text not null default 'consumer',
  due_day int not null check (due_day >= 1 and due_day <= 31),
  start_day_id text not null check (start_day_id ~ '^\d{4}-\d{2}-\d{2}$'),
  term_months int not null check (term_months >= 1 and term_months <= 480),
  payload jsonb not null default '{}'::jsonb,
  payload_enc text,
  enc_v text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_credits_user_idx
  on public.finance_credits (user_id)
  where archived_at is null;
alter table public.finance_credits enable row level security;

create table if not exists public.finance_goals (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency text not null default 'EUR',
  target_day_id text check (target_day_id is null or target_day_id ~ '^\d{4}-\d{2}-\d{2}$'),
  linked_account_id text,
  payload jsonb not null default '{}'::jsonb,
  payload_enc text,
  enc_v text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_goals_user_idx
  on public.finance_goals (user_id)
  where archived_at is null;
alter table public.finance_goals enable row level security;

create table if not exists public.finance_accounts (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('cash', 'debit', 'credit', 'brokerage', 'other')),
  currency text not null default 'EUR',
  payload jsonb not null default '{}'::jsonb,
  payload_enc text,
  enc_v text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_accounts_user_idx
  on public.finance_accounts (user_id)
  where archived_at is null;
alter table public.finance_accounts enable row level security;

create table if not exists public.finance_categories (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_key text not null default 'other',
  color text,
  currency text not null default 'EUR',
  payload jsonb not null default '{}'::jsonb,
  payload_enc text,
  enc_v text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_categories_user_idx
  on public.finance_categories (user_id)
  where archived_at is null;
alter table public.finance_categories enable row level security;

create table if not exists public.finance_vault (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  scheme text,
  kdf_salt text,
  kdf_params jsonb,
  wrapped_dek text,
  recovery_wrapped_dek text,
  account_wrapped_dek text,
  enc_v text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_rules enable row level security;
alter table public.finance_movements enable row level security;
alter table public.finance_vault enable row level security;

-- Finanzas en calendario (task kinds + meta)
alter table public.tasks add column if not exists finance_meta jsonb;
alter table public.tasks add column if not exists finance_movement_id text;
do $$
begin
  alter table public.tasks drop constraint if exists tasks_kind_check;
exception when undefined_object then null;
end $$;
do $$
begin
  alter table public.tasks
    add constraint tasks_kind_check
    check (kind in (
      'task', 'reminder', 'rx_human', 'rx_pet',
      'possible_event', 'event', 'habit_good', 'habit_quit',
      'finance_income', 'finance_expense'
    ));
exception when duplicate_object then null;
end $$;

-- Ancla de recurrencia mensual (�ltimo d�a / d�a h�bil Chile)
alter table public.tasks add column if not exists recurrence_anchor text;
do $$
begin
  alter table public.tasks drop constraint if exists tasks_recurrence_anchor_check;
exception when undefined_object then null;
end $$;
do $$
begin
  alter table public.tasks
    add constraint tasks_recurrence_anchor_check
    check (
      recurrence_anchor is null
      or recurrence_anchor in (
        'day_of_month', 'last_day', 'first_business', 'last_business'
      )
    );
exception when duplicate_object then null;
end $$;

-- ——— Admin: presencia + tamaño por usuario ———
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists last_path text;
alter table public.profiles add column if not exists last_app_version text;
alter table public.profiles add column if not exists last_platform text;

create index if not exists profiles_last_seen_idx
  on public.profiles (last_seen_at desc);

create or replace function public.admin_user_stats()
returns table (
  user_id uuid,
  tasks_count bigint,
  projects_count bigint,
  contacts_count bigint,
  finance_count bigint,
  tasks_bytes bigint,
  projects_bytes bigint,
  contacts_bytes bigint,
  finance_bytes bigint,
  deliveries_bytes bigint,
  profile_bytes bigint,
  total_bytes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(t.cnt, 0),
    coalesce(pr.cnt, 0),
    coalesce(c.cnt, 0),
    coalesce(f.cnt, 0),
    coalesce(t.bytes, 0),
    coalesce(pr.bytes, 0),
    coalesce(c.bytes, 0),
    coalesce(f.bytes, 0),
    coalesce(d.bytes, 0),
    coalesce(pg_column_size(p.*), 0)::bigint,
    coalesce(t.bytes, 0)
      + coalesce(pr.bytes, 0)
      + coalesce(c.bytes, 0)
      + coalesce(f.bytes, 0)
      + coalesce(d.bytes, 0)
      + coalesce(pg_column_size(p.*), 0)::bigint
  from public.profiles p
  left join (
    select user_id,
           count(*)::bigint as cnt,
           coalesce(sum(pg_column_size(x.*)), 0)::bigint as bytes
    from public.tasks x
    group by user_id
  ) t on t.user_id = p.id
  left join (
    select user_id,
           count(*)::bigint as cnt,
           coalesce(sum(pg_column_size(x.*)), 0)::bigint as bytes
    from public.projects x
    group by user_id
  ) pr on pr.user_id = p.id
  left join (
    select user_id,
           count(*)::bigint as cnt,
           coalesce(sum(pg_column_size(x.*)), 0)::bigint as bytes
    from public.contacts x
    group by user_id
  ) c on c.user_id = p.id
  left join (
    select user_id,
           count(*)::bigint as cnt,
           coalesce(sum(pg_column_size(x.*)), 0)::bigint as bytes
    from public.finance_entries x
    group by user_id
  ) f on f.user_id = p.id
  left join (
    select user_id,
           coalesce(sum(pg_column_size(x.*)), 0)::bigint as bytes
    from public.notification_deliveries x
    group by user_id
  ) d on d.user_id = p.id;
$$;

revoke all on function public.admin_user_stats() from public;
revoke all on function public.admin_user_stats() from anon, authenticated;
grant execute on function public.admin_user_stats() to service_role;

-- Hábitos: plan (días ISO 1=lun … 7=dom). NULL = clásico; [] = fechas concretas.
-- CHECK sin subconsulta (PG 0A000): <@ = contenido en 1..7. [] <@ {1..7} es TRUE.
alter table public.tasks add column if not exists recurrence_weekdays int[];
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_recurrence_weekdays_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_recurrence_weekdays_check
      check (
        recurrence_weekdays is null
        or (
          cardinality(recurrence_weekdays) <= 7
          and recurrence_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::int[]
        )
      );
  end if;
end $$;

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

-- Tareas sin fecha (backlog de proyecto): day_id / week_id / end_day_id nulos.
alter table public.tasks alter column day_id drop not null;
alter table public.tasks alter column week_id drop not null;
alter table public.tasks alter column end_day_id drop not null;
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'tasks_end_day_id_gte_day_id'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks drop constraint tasks_end_day_id_gte_day_id;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_dated_or_inbox'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_dated_or_inbox check (
        (
          day_id is null
          and end_day_id is null
          and week_id is null
        )
        or (
          day_id is not null
          and end_day_id is not null
          and week_id is not null
          and end_day_id >= day_id
        )
      );
  end if;
end $$;

create index if not exists tasks_user_inbox_idx
  on public.tasks (user_id, project_id)
  where day_id is null;

-- Ideas / notas de texto enriquecido
create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '',
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  excerpt text not null default '',
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);

alter table public.notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_select_own'
  ) then
    create policy "notes_select_own" on public.notes
      for select using (auth.uid() = user_id);
  end if;
end $$;
