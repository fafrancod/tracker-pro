-- Plan de hábitos: días ISO 1=lun … 7=dom.
-- NULL = frequency/interval clásico.
-- [] = solo fechas concretas (sin expansión virtual).
-- [1,3,5] = lun/mié/vie.
--
-- CHECK sin subconsulta: PG no permite NOT EXISTS / unnest en CHECK (error 0A000).
-- <@ = “contenido en”: todos los valores deben estar en 1..7. [] <@ {1..7} es TRUE.

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
          and recurrence_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::int[]
        )
      );
  end if;
end $$;
