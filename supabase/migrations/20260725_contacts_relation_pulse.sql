-- Percepción del vínculo (buena / mala / falta conectar…) en contacts.
-- Ejecutar en Supabase SQL Editor si la columna aún no existe.

alter table public.contacts
  add column if not exists relation_pulse text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contacts_relation_pulse_check'
      and conrelid = 'public.contacts'::regclass
  ) then
    alter table public.contacts
      add constraint contacts_relation_pulse_check
      check (
        relation_pulse is null
        or relation_pulse in (
          'great', 'good', 'neutral', 'need_connect', 'strained', 'bad'
        )
      );
  end if;
end $$;
