import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Clock3 } from 'lucide-react';
import type { Task, TaskKind } from '@core/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleSelect } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';

export type TaskSummaryStatus = 'all' | 'completed' | 'pending';

interface TaskSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tasks: Task[];
  initialStatus?: TaskSummaryStatus;
}

const TASK_KIND_KEYS: Record<TaskKind, Parameters<ReturnType<typeof useT>['t']>[0]> = {
  task: 'task_kind_task',
  reminder: 'task_kind_reminder',
  rx_human: 'task_kind_rx_human',
  rx_pet: 'task_kind_rx_pet',
  possible_event: 'task_kind_possible_event',
  event: 'task_kind_event',
  habit_good: 'task_kind_habit_good',
  habit_quit: 'task_kind_habit_quit',
  finance_income: 'task_kind_finance_income',
  finance_expense: 'task_kind_finance_expense',
};

function sortTasks(tasks: Task[]): Task[] {
  return tasks.slice().sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99') || a.title.localeCompare(b.title);
  });
}

export function TaskSummaryDialog({
  open,
  onOpenChange,
  title,
  tasks,
  initialStatus = 'all',
}: TaskSummaryDialogProps) {
  const { t } = useT();
  const [status, setStatus] = useState<TaskSummaryStatus>(initialStatus);
  const [kind, setKind] = useState<'all' | TaskKind>('all');

  useEffect(() => {
    if (!open) return;
    setStatus(initialStatus);
    setKind('all');
  }, [open, initialStatus, title]);

  const visibleTasks = useMemo(
    () =>
      sortTasks(
        tasks.filter(task => {
          if (kind !== 'all' && task.kind !== kind) return false;
          if (status === 'completed') return task.completed;
          if (status === 'pending') return !task.completed;
          return true;
        })
      ),
    [tasks, status, kind]
  );

  const pending = visibleTasks.filter(task => !task.completed);
  const completed = visibleTasks.filter(task => task.completed);
  const kindOptions = [
    { value: 'all', label: 'Todos los tipos' },
    ...Object.entries(TASK_KIND_KEYS).map(([value, key]) => ({
      value,
      label: t(key),
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-xl overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {pending.length} por hacer · {completed.length} listas
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 border-y border-border/60 py-3 sm:flex-row sm:items-center">
          <div className="flex rounded-xl bg-background/55 p-1">
            {([
              ['all', 'Todas'],
              ['pending', 'Por hacer'],
              ['completed', 'Listas'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                  status === value
                    ? 'bg-accent-teal/20 text-accent-teal shadow-sm'
                    : 'text-text-muted hover:bg-white/8 hover:text-text-primary'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1 sm:ml-auto sm:max-w-52">
            <SimpleSelect
              value={kind}
              onChange={value => setKind(value as 'all' | TaskKind)}
              options={kindOptions}
              aria-label="Filtrar por tipo de tarea"
              className="h-9"
            />
          </div>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
            No hay tareas con estos filtros.
          </div>
        ) : status === 'all' ? (
          <div className="space-y-4">
            <TaskGroup title="Por hacer" icon={<Circle className="text-accent-teal" />} tasks={pending} t={t} />
            <TaskGroup title="Listas" icon={<CheckCircle2 className="text-accent-green" />} tasks={completed} t={t} />
          </div>
        ) : (
          <TaskGroup
            title={status === 'completed' ? 'Listas' : 'Por hacer'}
            icon={
              status === 'completed' ? (
                <CheckCircle2 className="text-accent-green" />
              ) : (
                <Circle className="text-accent-teal" />
              )
            }
            tasks={visibleTasks}
            t={t}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskGroup({
  title,
  icon,
  tasks,
  t,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  t: ReturnType<typeof useT>['t'];
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-primary">
        {icon}
        <span>{title}</span>
        <span className="text-text-muted">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted">
          Sin tareas.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map(task => (
            <li
              key={task.id}
              className="flex items-center gap-2 rounded-xl border border-border/75 bg-background/45 px-3 py-2"
            >
              {task.completed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-green" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-text-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-sm font-medium text-text-primary',
                    task.completed && 'task-completed-title text-text-muted line-through'
                  )}
                >
                  {task.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
                  {task.startTime && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock3 className="h-3 w-3" />
                      {task.startTime.slice(0, 5)}
                    </span>
                  )}
                  <span>{t(TASK_KIND_KEYS[task.kind])}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
