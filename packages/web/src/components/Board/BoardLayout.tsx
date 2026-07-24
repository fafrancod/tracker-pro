import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, List, Clock } from 'lucide-react';
import { format } from 'date-fns';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useWeek } from '@core/hooks/useWeek';
import { useStore } from '@core/store';
import { taskHistory } from '@core/history/taskHistory';
import { Button } from '@/components/ui/button';
import { DayColumn } from './DayColumn';
import { TaskCard } from './TaskCard';
import { ScheduleGrid } from './ScheduleGrid';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { useProjects } from '@core/hooks/useProjects';
import type { BoardTaskFilters, ScheduleLayout, Task } from '@core/types';
import { cn } from '@/lib/utils';

interface DragData {
  task: Task;
  weekId: string;
  dayId: string;
}

interface BoardLayoutProps {
  filter?: BoardTaskFilters;
  dayStartHour?: number;
  dayEndHour?: number;
  layout?: ScheduleLayout;
  onLayoutChange?: (layout: ScheduleLayout) => void;
}

export function BoardLayout({
  filter,
  dayStartHour = 7,
  dayEndHour = 22,
  layout = 'list',
  onLayoutChange,
}: BoardLayoutProps) {
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { currentWeekId, weekStart, days, isCurrentWeek, goNextWeek, goPrevWeek, goToday, todayDayId } =
    useWeek({ locale, weekdayFormat, shortDateFormat });
  const { projects } = useProjects();
  const { showToast } = useToast();
  const setDetailTask = useStore(s => s.setDetailTask);

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  // Touch: delay+tolerance so scroll/tap still work; mouse: small distance.
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const weekLabel = `${format(weekStart, shortDateFormat, { locale })} – ${format(days[6].date, `${shortDateFormat}, yyyy`, { locale })}`;

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (data) setActiveDrag(data);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const data = activeDrag;
    setActiveDrag(null);
    if (!event.over || !data) return;
    const dst = event.over.data.current as { weekId: string; dayId: string } | undefined;
    if (!dst) return;
    if (dst.weekId === data.weekId && dst.dayId === data.dayId) return;

    try {
      await taskHistory.move(
        data.weekId,
        data.dayId,
        data.task,
        dst.weekId,
        dst.dayId
      );
    } catch (err) {
      showToast('No pudimos mover la tarea.', 'error');
      console.error(err);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5 md:px-3">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={goPrevWeek} className="h-7 w-7" aria-label={t('board_prev_week')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goNextWeek} className="h-7 w-7" aria-label={t('board_next_week')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-text-primary">{weekLabel}</span>
          <span className="hidden text-xs text-text-muted sm:inline">{currentWeekId}</span>
        </div>

        {!isCurrentWeek && (
          <Button variant="outline" size="sm" onClick={goToday} className="ml-1 h-7 gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            {t('action_today')}
          </Button>
        )}

        {onLayoutChange && (
          <div className="ml-auto inline-flex rounded-md border border-border bg-surface p-0.5">
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
        )}
      </header>

      {layout === 'schedule' ? (
        <ScheduleGrid
          days={days.map(day => ({
            weekId: currentWeekId,
            dayId: day.dayId,
            label: day.label,
            dateLabel: day.dateLabel,
            isToday: day.dayId === todayDayId,
          }))}
          dayStartHour={dayStartHour}
          dayEndHour={dayEndHour}
          filter={filter}
          onOpenTask={loc => setDetailTask(loc)}
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid min-h-0 flex-1 grid-cols-7 gap-1 p-1.5 md:gap-1.5 md:p-2">
            {days.map(day => (
              <DayColumn
                key={day.dayId}
                weekId={currentWeekId}
                dayId={day.dayId}
                label={day.label}
                dateLabel={day.dateLabel}
                isToday={day.dayId === todayDayId}
                filter={filter}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDrag ? (
              <div className="w-[160px] cursor-grabbing">
                <TaskCard
                  task={activeDrag.task}
                  projects={projects}
                  weekDays={days}
                  nextWeekId={currentWeekId}
                  dense
                  onToggle={() => undefined}
                  onEdit={() => undefined}
                  onMove={() => undefined}
                  onMoveNextWeek={() => undefined}
                  onDuplicate={() => undefined}
                  onDelete={() => undefined}
                  isDragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
