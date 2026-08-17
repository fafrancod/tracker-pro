-- Fase 7: créditos (due_day en claro) y cuotas de compra en el movimiento.
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

alter table public.finance_movements
  add column if not exists credit_id text;
alter table public.finance_movements
  add column if not exists installment_group_id text;
alter table public.finance_movements
  add column if not exists installment_index int;
alter table public.finance_movements
  add column if not exists installment_total int;
