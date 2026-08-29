-- Tareas sin fecha (backlog de proyecto) + tabla de ideas/notas.
-- Ejecutar en el SQL Editor de Supabase si el schema.sql completo ya se aplicó.

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
