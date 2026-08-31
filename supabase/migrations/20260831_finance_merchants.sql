-- Comercios: empresas/tiendas donde se hacen las compras (nombre cifrado).
create table if not exists public.finance_merchants (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  color text,
  payload jsonb not null default '{}'::jsonb,
  payload_enc text,
  enc_v text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_merchants_user_idx
  on public.finance_merchants (user_id)
  where archived_at is null;

alter table public.finance_merchants enable row level security;

notify pgrst, 'reload schema';
