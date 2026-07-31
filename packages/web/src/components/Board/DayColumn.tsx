import { useMemo } from 'react';
import { startOfISOWeek, addDays } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { useTasks } from '@core/hooks/useTasks';
import { useProjects } from '@core/hooks/useProjects';
import { useWeek } from '@core/hooks/useWeek';
import { useStore } from '@core/store';
import {
  collectTasksCovering,
  compareByStartTime,
} from '@core/lib/taskPresence';
import { taskMatchesFilters, type BoardTaskFilters } from '@core/types';
import { chileHolidayName } from '@core/lib/chileHolidays';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import { tintHoliday } from '@/lib/tintClasses';
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
  filter?: BoardTaskFilters;
}

export function DayColumn({ weekId, dayId, label, dateLabel, isToday, filter }: DayColumnProps) {
  const { tasks: allTasks, addTask, editTask, removeTask, moveTaskToDay } =
    useTasks(weekId, dayId);
  // Progreso del día ignora hideCompleted (sigue contando terminadas).
  // Lista visible: completadas al final (compareByStartTime); opcionalmente ocultas.
  const { tasks, completedCount, progress } = useMemo(() => {
    const baseFilter = filter ? { ...filter, hideCompleted: false } : undefined;
    const matching = baseFilter
      ? allTasks.filter(t => taskMatchesFilters(t, baseFilter))
      : [...allTasks];
    const done = matching.filter(t => t.completed).length;
    const list = (
      filter?.hideCompleted ? matching.filter(t => !t.completed) : matching
    ).sort(compareByStartTime);
    return {
      tasks: list,
      completedCount: done,
      progress:
        matching.length > 0 ? Math.round((done / matching.length) * 100) : 0,
    };
  }, [allTasks, filter]);
  const { projects } = useProjects();
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { days, nextWeekId } = useWeek({ locale, weekdayFormat, shortDateFormat });
  const setDetailTask = useStore(s => s.setDetailTask);
  const tasksByDay = useStore(s => s.tasksByDay);
  const holidayName = chileHolidayName(dayId);
  const holidaysOnly = filter?.category === 'holidays';
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
        'flex min-h-0 min-w-0 flex-col rounded-md border bg-background',
        isToday ? 'border-accent-teal/50' : 'border-border'
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-1 rounded-t-md px-1.5 py-1.5',
          isToday ? 'bg-accent-teal/10' : 'bg-surface'
        )}
      >
        <div className="min-w-0">
          <div
            className={cn(
              'truncate text-xs font-semibold sm:text-sm',
              isToday ? 'text-accent-teal' : 'text-text-primary'
            )}
          >
            {label}
          </div>
          <div className="truncate text-[10px] text-text-muted sm:text-xs">{dateLabel}</div>
        </div>
        <ProgressRing
          progress={progress}
          completed={completedCount}
          total={tasks.length}
          size={28}
        />
      </div>

      {/* Task list */}
      <div
        ref={setDropRef}
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1 transition-colors',
          isOver && 'rounded bg-accent-teal/5 ring-1 ring-accent-teal/30'
        )}
      >
        {holidayName && (
          <div
            className={cn(
              'rounded-md px-1.5 py-1 text-[10px] font-semibold leading-snug',
              tintHoliday
            )}
          >
            🇨🇱 {holidayName}
          </div>
        )}
        <AnimatePresence initial={false}>
          {(holidaysOnly ? [] : tasks).map(task => {
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
                      locationWeekId={dragWeekId}
                      locationDayId={dragDayId}
                      dense
                      onToggle={() => editTask(task.id, { completed: !task.completed })}
                      onEdit={payload => editTask(task.id, payload)}
                      onConfirmAsEvent={
                        task.kind === 'possible_event'
                          ? () =>
                              void editTask(task.id, {
                                kind: 'event',
                                color: task.color ?? '#58a6ff',
                                projectId: null,
                                urgency: null,
                                importance: null,
                              })
                          : undefined
                      }
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
      <div className="shrink-0 p-1 pt-0">
        <AddTaskForm
          projects={projects}
          startDayId={dayId}
          onAdd={async payload => {
            // No bloquear la columna compacta esperando la API.
            void addTask(payload);
          }}
        />
      </div>
    </div>
  );
}
