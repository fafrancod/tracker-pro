-- Puente vida ↔ dinero: la tarea apunta al movimiento (dueño: source_task_id).
alter table public.tasks
  add column if not exists finance_movement_id text;
