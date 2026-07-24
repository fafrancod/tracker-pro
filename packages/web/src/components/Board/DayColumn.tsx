import { startOfISOWeek, addDays } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { useTasks } from '@core/hooks/useTasks';
import { useProjects } from '@core/hooks/useProjects';
import { useWeek } from '@core/hooks/useWeek';
import { useStore } from '@core/store';
import { collectTasksCovering } from '@core/lib/taskPresence';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import { ProgressRing } from './ProgressRing';
import { TaskCard } from './TaskCard';
import { AddTaskForm } from './AddTaskForm';
import { DraggableTask } from './DraggableTask';

interface DayColumnProps {
  weekId: string;
  dayId: string;
  label: string;
  dateLabel: string;
  isToday: boolean;
}

export function DayColumn({ weekId, dayId, label, dateLabel, isToday }: DayColumnProps) {
  const { tasks, addTask, editTask, removeTask, moveTaskToDay, progress, completedCount } =
    useTasks(weekId, dayId);
  const { projects } = useProjects();
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { days, nextWeekId } = useWeek({ locale, weekdayFormat, shortDateFormat });
  const setDetailTask = useStore(s => s.setDetailTask);
  const tasksByDay = useStore(s => s.tasksByDay);
  const locatedById = new Map(
    collectTasksCovering(tasksByDay, dayId).map(loc => [loc.id, loc] as const)
  );

  // Drop zone: identifica el dia en onDragEnd.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `day:${weekId}:${dayId}`,
    data: { weekId, dayId },
  });

  async function handleDuplicate(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    await addTask({
      title: task.title,
      projectId: task.projectId,
      priority: task.priority,
      notes: task.notes,
      tags: task.tags,
      recurrenceFrequency: task.recurrence.frequency,
      recurrenceInterval: task.recurrence.interval,
    });
  }

  async function handleMoveNextWeek(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const [yearStr, weekStr] = nextWeekId.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);
    const jan4 = new Date(year, 0, 4);
    const weekStart = addDays(startOfISOWeek(jan4), (week - 1) * 7);
    await moveTaskToDay(task, weekStart);
  }

  return (
    <div
      className={cn(
        'flex w-[220px] shrink-0 flex-col rounded-lg border bg-background',
        isToday ? 'border-accent-teal/40' : 'border-border'
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          'flex items-center justify-between rounded-t-lg px-3 py-2.5',
          isToday ? 'bg-accent-teal/10' : 'bg-surface'
        )}
      >
        <div>
          <div className={cn('text-sm font-semibold', isToday ? 'text-accent-teal' : 'text-text-primary')}>
            {label}
          </div>
          <div className="text-xs text-text-muted">{dateLabel}</div>
        </div>
        <ProgressRing
          progress={progress}
          completed={completedCount}
          total={tasks.length}
          size={38}
        />
      </div>

      {/* Task list */}
      <div
        ref={setDropRef}
        className={cn(
          'flex flex-1 flex-col gap-1.5 overflow-y-auto p-2 transition-colors',
          isOver && 'rounded bg-accent-teal/5 ring-1 ring-accent-teal/30'
        )}
      >
        <AnimatePresence initial={false}>
          {tasks.map(task => {
            const loc = locatedById.get(task.id);
            const isMidSpan = Boolean(loc && loc.startDayId !== dayId);
            const dragWeekId = loc?.weekId ?? weekId;
            const dragDayId = loc?.startDayId ?? dayId;
            return (
              <DraggableTask key={task.id} task={task} weekId={dragWeekId} dayId={dragDayId}>
                {({ dragHandleProps, isDragging }) => (
                  <div className={cn(isMidSpan && 'opacity-80')}>
                    {isMidSpan && (
                      <div className="mb-0.5 px-1 text-[10px] font-medium text-text-muted">
                        {t('task_continues')}
                      </div>
                    )}
                    <TaskCard
                      task={task}
                      projects={projects}
                      weekDays={days}
                      nextWeekId={nextWeekId}
                      startDayId={loc?.startDayId}
                      onToggle={() => editTask(task.id, { completed: !task.completed })}
                      onEdit={payload => editTask(task.id, payload)}
                      onMove={toDate => {
                        const found = tasks.find(t2 => t2.id === task.id);
                        if (found) moveTaskToDay(found, toDate);
                      }}
                      onMoveNextWeek={() => handleMoveNextWeek(task.id)}
                      onDuplicate={() => handleDuplicate(task.id)}
                      onDelete={() => removeTask(task.id)}
                      onOpenDetail={() =>
                        setDetailTask({
                          weekId: dragWeekId,
                          dayId: dragDayId,
                          taskId: task.id,
                        })
                      }
                      dragHandleProps={dragHandleProps}
                      isDragging={isDragging}
                    />
                  </div>
                )}
              </DraggableTask>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add task */}
      <div className="p-2 pt-0">
        <AddTaskForm
          projects={projects}
          startDayId={dayId}
          onAdd={async payload => {
            await addTask(payload);
          }}
        />
      </div>
    </div>
  );
}
