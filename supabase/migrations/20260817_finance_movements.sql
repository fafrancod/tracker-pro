-- Libro de movimientos + reglas + columnas de bóveda (aún sin cifrar).
-- Sin datos que migrar desde finance_entries.

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

alter table public.finance_rules enable row level security;
alter table public.finance_movements enable row level security;
alter table public.finance_vault enable row level security;
