-- Reparación idempotente del mayor. Seguro de pegar otra vez.
-- Crea tablas/columnas que falten y recarga el schema cache de PostgREST.

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

create table if not exists public.finance_vault (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  kdf_salt text,
  kdf_params jsonb,
  wrapped_dek text,
  recovery_wrapped_dek text,
  enc_v text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_vault add column if not exists scheme text;
alter table public.finance_vault add column if not exists account_wrapped_dek text;

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

alter table public.finance_movements add column if not exists account_id text;
alter table public.finance_movements add column if not exists card_account_id text;
alter table public.finance_movements add column if not exists goal_id text;
alter table public.finance_movements add column if not exists credit_id text;
alter table public.finance_movements add column if not exists installment_group_id text;
alter table public.finance_movements add column if not exists installment_index int;
alter table public.finance_movements add column if not exists installment_total int;

update public.finance_vault
set scheme = 'account'
where scheme is null or scheme = 'private';

alter table public.finance_rules enable row level security;
alter table public.finance_movements enable row level security;
alter table public.finance_vault enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_goals enable row level security;
alter table public.finance_credits enable row level security;

notify pgrst, 'reload schema';
