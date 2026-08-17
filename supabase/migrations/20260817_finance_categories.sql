-- Categorías y presupuestos mensuales (nombre/cupo cifrados; grupo y color en claro).
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

notify pgrst, 'reload schema';
