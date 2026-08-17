-- Plan de hábitos: días ISO 1=lun … 7=dom.
-- NULL = frequency/interval clásico.
-- [] = solo fechas concretas (sin expansión virtual).
-- [1,3,5] = lun/mié/vie.

alter table public.tasks
  add column if not exists recurrence_weekdays int[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_recurrence_weekdays_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_recurrence_weekdays_check
      check (
        recurrence_weekdays is null
        or (
          cardinality(recurrence_weekdays) <= 7
          and not exists (
            select 1
            from unnest(recurrence_weekdays) as d
            where d < 1 or d > 7
          )
        )
      );
  end if;
end $$;
