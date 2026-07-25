-- Círculo: personas y mascotas (menciones @tag en tareas/recetarios)
-- Ejecutar en Supabase SQL Editor si la tabla aún no existe.

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
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  check (kind = 'person' or relationship is null)
);

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
