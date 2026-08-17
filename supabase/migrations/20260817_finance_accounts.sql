-- Fase 4: cuentas / tarjetas. Tipo y moneda en claro; nombre/institución/cupo cifrados.
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

alter table public.finance_movements
  add column if not exists account_id text;
alter table public.finance_movements
  add column if not exists card_account_id text;
