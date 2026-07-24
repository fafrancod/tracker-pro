import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useWeek } from '@core/hooks/useWeek';
import { taskHistory } from '@core/history/taskHistory';
import { Button } from '@/components/ui/button';
import { DayColumn } from './DayColumn';
import { TaskCard } from './TaskCard';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { useProjects } from '@core/hooks/useProjects';
import type { BoardTaskFilters, Task } from '@core/types';

interface DragData {
  task: Task;
  weekId: string;
  dayId: string;
}

interface BoardLayoutProps {
  filter?: BoardTaskFilters;
}

export function BoardLayout({ filter }: BoardLayoutProps) {
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { currentWeekId, weekStart, days, isCurrentWeek, goNextWeek, goPrevWeek, goToday, todayDayId } =
    useWeek({ locale, weekdayFormat, shortDateFormat });
  const { projects } = useProjects();
  const { showToast } = useToast();

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  // Distancia mínima evita drags accidentales por click corto.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
      </header>

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
    </div>
  );
}
