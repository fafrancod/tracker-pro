-- Fase 6: objetivos. Deadline y cuenta-sobre en claro; nombre/meta en payload_enc.
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

alter table public.finance_movements
  add column if not exists goal_id text;
