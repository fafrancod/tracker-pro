import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, List, Clock } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { useStore } from '@core/store';
import { useTasks } from '@core/hooks/useTasks';
import { useProjects } from '@core/hooks/useProjects';
import { useWeek } from '@core/hooks/useWeek';
import { getDayId, getWeekId } from '@core/services/taskService';
import { collectTasksCovering } from '@core/lib/taskPresence';
import {
  taskMatchesFilters,
  type BoardTaskFilters,
  type ScheduleLayout,
} from '@core/types';
import { Button } from '@/components/ui/button';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import { ScheduleGrid } from './ScheduleGrid';
import { TaskCard } from './TaskCard';
import { AddTaskForm } from './AddTaskForm';
import { ProgressRing } from './ProgressRing';

interface DayViewProps {
  filter?: BoardTaskFilters;
  dayStartHour: number;
  dayEndHour: number;
  layout: ScheduleLayout;
  onLayoutChange: (layout: ScheduleLayout) => void;
  onAddRequest?: () => void;
}

export function DayView({
  filter,
  dayStartHour,
  dayEndHour,
  layout,
  onLayoutChange,
}: DayViewProps) {
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { projects } = useProjects();
  const selectedDayId = useStore(s => s.selectedDayId);
  const setSelectedDay = useStore(s => s.setSelectedDay);
  const setCurrentWeek = useStore(s => s.setCurrentWeek);
  const setDetailTask = useStore(s => s.setDetailTask);
  const tasksByDay = useStore(s => s.tasksByDay);

  const { todayDayId, days: weekDays, nextWeekId } = useWeek({
    locale,
    weekdayFormat,
    shortDateFormat,
  });

  const dayId = selectedDayId ?? todayDayId ?? getDayId(new Date());
  const weekId = getWeekId(parseISO(`${dayId}T12:00:00`));
  const { addTask, editTask, removeTask, moveTaskToDay } = useTasks(weekId, dayId);

  const dayDate = parseISO(`${dayId}T12:00:00`);
  const label = format(dayDate, weekdayFormat, { locale });
  const dateLabel = format(dayDate, shortDateFormat, { locale });
  const isToday = dayId === todayDayId;

  const located = useMemo(() => {
    const rows = collectTasksCovering(tasksByDay, dayId);
    return filter ? rows.filter(r => taskMatchesFilters(r, filter)) : rows;
  }, [tasksByDay, dayId, filter]);

  const completedCount = located.filter(t => t.completed).length;
  const progress =
    located.length > 0 ? Math.round((completedCount / located.length) * 100) : 0;

  function goDay(delta: number) {
    const next = addDays(dayDate, delta);
    const nextDayId = getDayId(next);
    setSelectedDay(nextDayId);
    setCurrentWeek(getWeekId(next));
  }

  function goToday() {
    const id = getDayId(new Date());
    setSelectedDay(id);
    setCurrentWeek(getWeekId(new Date()));
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2 py-1.5 md:px-3">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => goDay(-1)}
            aria-label={t('board_prev_day')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => goDay(1)}
            aria-label={t('board_next_day')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'truncate text-sm font-semibold',
              isToday ? 'text-accent-teal' : 'text-text-primary'
            )}
          >
            {label}
            <span className="ml-2 font-normal text-text-muted">{dateLabel}</span>
          </div>
        </div>

        <ProgressRing
          progress={progress}
          completed={completedCount}
          total={located.length}
          size={32}
        />

        {!isToday && (
          <Button variant="outline" size="sm" onClick={goToday} className="h-7 gap-1 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            {t('board_go_today')}
          </Button>
        )}

        <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
          <button
            type="button"
            onClick={() => onLayoutChange('list')}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium',
              layout === 'list'
                ? 'bg-accent-teal/15 text-accent-teal'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <List className="h-3.5 w-3.5" />
            {t('layout_list')}
          </button>
          <button
            type="button"
            onClick={() => onLayoutChange('schedule')}
            className={cn(
              'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium',
              layout === 'schedule'
                ? 'bg-accent-teal/15 text-accent-teal'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            {t('layout_schedule')}
          </button>
        </div>
      </header>

      {layout === 'schedule' ? (
        <ScheduleGrid
          days={[
            {
              weekId,
              dayId,
              label,
              dateLabel,
              isToday,
            },
          ]}
          dayStartHour={dayStartHour}
          dayEndHour={dayEndHour}
          filter={filter}
          compact
          onOpenTask={loc => setDetailTask(loc)}
          onToggleTask={({ weekId: w, dayId: d, task }) => {
            void editTask(task.id, { completed: !task.completed });
            void w;
            void d;
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 md:p-3">
            {located.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">{t('empty_no_tasks')}</p>
            ) : (
              located.map(loc => (
                <TaskCard
                  key={loc.id}
                  task={loc}
                  projects={projects}
                  weekDays={weekDays}
                  nextWeekId={nextWeekId}
                  startDayId={loc.startDayId}
                  locationWeekId={loc.weekId}
                  locationDayId={loc.startDayId}
                  onToggle={() => void editTask(loc.id, { completed: !loc.completed })}
                  onEdit={payload => void editTask(loc.id, payload)}
                  onMove={toDate => void moveTaskToDay(loc, toDate)}
                  onMoveNextWeek={() => undefined}
                  onDuplicate={() =>
                    void addTask({
                      title: loc.title,
                      projectId: loc.projectId,
                      priority: loc.priority,
                      notes: loc.notes,
                      tags: loc.tags,
                      startTime: loc.startTime,
                      endTime: loc.endTime,
                      kind: loc.kind,
                      color: loc.color,
                    })
                  }
                  onDelete={() => void removeTask(loc.id)}
                  onOpenDetail={() =>
                    setDetailTask({
                      weekId: loc.weekId,
                      dayId: loc.startDayId,
                      taskId: loc.id,
                    })
                  }
                />
              ))
            )}
          </div>
          <div className="shrink-0 border-t border-border p-2">
            <AddTaskForm
              projects={projects}
              startDayId={dayId}
              onAdd={async payload => {
                await addTask(payload);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
