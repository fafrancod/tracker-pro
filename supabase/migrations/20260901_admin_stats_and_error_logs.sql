-- Ola 1 Meteora Pro.
-- Pegar en el SQL editor de Supabase ANTES de fiarse de Atenas Analytics / Fallos.
-- Aditivo: no reescribe tablas de finanzas. Idempotente (re-ejecutar si el DROP
-- ya corrió y el CREATE FUNCTION falló por falta de notification_deliveries).
--
-- Prod puede no tener notification_deliveries: vive en schema.sql pero nunca
-- tuvo migración propia. El worker de email la necesita igual.

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

alter table public.notification_deliveries enable row level security;
revoke all privileges on table public.notification_deliveries from anon, authenticated;

create index if not exists error_logs_created_at_idx
  on public.error_logs (created_at desc);

-- Firma nueva (notes_count / notes_bytes): hay que DROP. finance_count se conserva.
drop function if exists public.admin_user_stats();

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
  total_bytes bigint,
  notes_count bigint,
  notes_bytes bigint
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
      + coalesce(n.bytes, 0)
      + coalesce(pg_column_size(p.*), 0)::bigint,
    coalesce(n.cnt, 0),
    coalesce(n.bytes, 0)
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
    from public.finance_movements x
    where x.deleted_at is null
    group by user_id
  ) f on f.user_id = p.id
  left join (
    select user_id,
           count(*)::bigint as cnt,
           coalesce(sum(pg_column_size(x.*)), 0)::bigint as bytes
    from public.notes x
    group by user_id
  ) n on n.user_id = p.id
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
