-- Círculo: relaciones hermano/a y pareja
-- Ejecutar en Supabase SQL Editor (idempotente vía drop/add del check).

do $$
begin
  -- Quita el check de relationship si existe (nombre puede variar)
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'contacts'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%relationship%'
  ) then
    execute (
      select 'alter table public.contacts drop constraint ' || quote_ident(c.conname)
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      where t.relname = 'contacts'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%relationship%'
      limit 1
    );
  end if;

  alter table public.contacts
    add constraint contacts_relationship_check
    check (
      relationship is null
      or relationship in (
        'father', 'mother', 'son', 'daughter',
        'brother', 'sister', 'partner',
        'niece', 'nephew', 'friend', 'coworker'
      )
    );
exception
  when duplicate_object then null;
end $$;
