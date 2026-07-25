import { useMemo, type MouseEvent } from 'react';
import { useStore } from '@core/store';
import { collectTasksCovering } from '@core/lib/taskPresence';
import {
  formatHourLabel,
  formatMinutes,
  hasSchedule,
  hourLabels,
  layoutInGridForDay,
  normalizeHourRange,
} from '@core/lib/schedule';
import { taskMatchesFilters, type BoardTaskFilters, type Task } from '@core/types';
import { useProjects } from '@core/hooks/useProjects';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';

const HOUR_HEIGHT = 48;
const SNAP_MINUTES = 15;

export interface ScheduleDayCol {
  weekId: string;
  dayId: string;
  label: string;
  dateLabel: string;
  isToday?: boolean;
}

export interface ScheduleEmptySlot {
  weekId: string;
  dayId: string;
  startTime: string;
}

interface ScheduleGridProps {
  days: ScheduleDayCol[];
  dayStartHour: number;
  dayEndHour: number;
  filter?: BoardTaskFilters;
  onOpenTask?: (loc: { weekId: string; dayId: string; taskId: string }) => void;
  onToggleTask?: (loc: {
    weekId: string;
    dayId: string;
    task: Task;
  }) => void;
  /** Doble clic en hueco vacío de la grilla horaria (snap 15 min). */
  onEmptyDoubleClick?: (slot: ScheduleEmptySlot) => void;
  /** Single-day mode uses wider blocks. */
  compact?: boolean;
}

function snapYToStartTime(
  clientY: number,
  columnTop: number,
  rangeStartHour: number,
  rangeEndHour: number
): string {
  const y = Math.max(0, clientY - columnTop);
  const rawMinutes = rangeStartHour * 60 + (y / HOUR_HEIGHT) * 60;
  const snapped = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  const minM = rangeStartHour * 60;
  const maxM = Math.max(minM, rangeEndHour * 60 - SNAP_MINUTES);
  const clamped = Math.min(maxM, Math.max(minM, snapped));
  return formatMinutes(clamped);
}

export function ScheduleGrid({
  days,
  dayStartHour,
  dayEndHour,
  filter,
  onOpenTask,
  onToggleTask,
  onEmptyDoubleClick,
  compact = false,
}: ScheduleGridProps) {
  const { t } = useT();
  const { projects } = useProjects();
  const tasksByDay = useStore(s => s.tasksByDay);
  const range = useMemo(
    () => normalizeHourRange(dayStartHour, dayEndHour),
    [dayStartHour, dayEndHour]
  );
  const hours = useMemo(() => hourLabels(range), [range]);
  const gridHeight = hours.length * HOUR_HEIGHT;

  function handleColumnDoubleClick(
    e: MouseEvent<HTMLDivElement>,
    day: ScheduleDayCol
  ) {
    if (!onEmptyDoubleClick) return;
    // Clic en una tarea: el botón ya hace stopPropagation en su propio double-click.
    const target = e.target as HTMLElement | null;
    if (target?.closest('button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const startTime = snapYToStartTime(
      e.clientY,
      rect.top,
      range.startHour,
      range.endHour
    );
    onEmptyDoubleClick({
      weekId: day.weekId,
      dayId: day.dayId,
      startTime,
    });
  }

  const columns = useMemo(() => {
    return days.map(day => {
      const covering = collectTasksCovering(tasksByDay, day.dayId);
      const filtered = covering.filter(loc =>
        filter ? taskMatchesFilters(loc, filter) : true
      );
      const timed = filtered.filter(loc => hasSchedule(loc.startTime));
      const unscheduled = filtered.filter(loc => !hasSchedule(loc.startTime));
      return { day, timed, unscheduled };
    });
  }, [days, tasksByDay, filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* All-day / unscheduled strip */}
      <div className="shrink-0 border-b border-border bg-surface/50">
        <div className="flex">
          <div className="w-12 shrink-0 border-r border-border px-1 py-1 text-[9px] font-medium uppercase tracking-wide text-text-muted sm:w-14">
            {t('schedule_all_day')}
          </div>
          <div
            className="grid min-w-0 flex-1"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {columns.map(({ day, unscheduled }) => (
              <div
                key={`all-${day.dayId}`}
                className={cn(
                  'min-h-[40px] border-r border-border p-0.5 last:border-r-0',
                  day.isToday && 'bg-accent-teal/5'
                )}
              >
                <div className="flex flex-col gap-0.5">
                  {unscheduled.map(loc => {
                    const project = projects.find(p => p.id === loc.projectId);
                    const color = loc.color ?? project?.color ?? undefined;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() =>
                          onOpenTask?.({
                            weekId: loc.weekId,
                            dayId: loc.startDayId,
                            taskId: loc.id,
                          })
                        }
                        className={cn(
                          'truncate rounded px-1 py-0.5 text-left text-[10px] font-medium',
                          loc.completed && 'line-through opacity-60'
                        )}
                        style={{
                          backgroundColor: color ? `${color}22` : undefined,
                          borderLeft: color ? `2px solid ${color}` : undefined,
                        }}
                        title={loc.title}
                      >
                        {loc.title}
                      </button>
                    );
                  })}
                  {unscheduled.length === 0 && (
                    <span className="px-1 py-1 text-[9px] text-text-muted/60">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day headers (when multi-day) */}
      {days.length > 1 && (
        <div className="flex shrink-0 border-b border-border bg-surface">
          <div className="w-12 shrink-0 border-r border-border sm:w-14" />
          <div
            className="grid min-w-0 flex-1"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map(day => (
              <div
                key={`h-${day.dayId}`}
                className={cn(
                  'border-r border-border px-1 py-1.5 text-center last:border-r-0',
                  day.isToday && 'bg-accent-teal/10'
                )}
              >
                <div
                  className={cn(
                    'truncate text-xs font-semibold',
                    day.isToday ? 'text-accent-teal' : 'text-text-primary'
                  )}
                >
                  {day.label}
                </div>
                <div className="truncate text-[10px] text-text-muted">{day.dateLabel}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timed grid */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex" style={{ minHeight: gridHeight }}>
          <div className="w-12 shrink-0 border-r border-border sm:w-14">
            {hours.map(h => (
              <div
                key={h}
                className="relative border-b border-border/60 text-[9px] text-text-muted"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-1">{formatHourLabel(h)}</span>
              </div>
            ))}
          </div>
          <div
            className="grid min-w-0 flex-1"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {columns.map(({ day, timed }) => (
              <div
                key={`g-${day.dayId}`}
                className={cn(
                  'relative border-r border-border last:border-r-0',
                  day.isToday && 'bg-accent-teal/[0.03]',
                  onEmptyDoubleClick && 'cursor-cell'
                )}
                style={{ height: gridHeight }}
                onDoubleClick={e => handleColumnDoubleClick(e, day)}
                title={
                  onEmptyDoubleClick ? t('schedule_slot_dblclick_hint') : undefined
                }
              >
                {hours.map(h => (
                  <div
                    key={h}
                    className="pointer-events-none border-b border-border/40"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}
                {timed.map(loc => {
                  const layout = layoutInGridForDay(
                    loc.startTime,
                    loc.endTime,
                    range,
                    HOUR_HEIGHT,
                    day.dayId,
                    loc.startDayId,
                    loc.endDayId || loc.startDayId
                  );
                  if (!layout) return null;
                  const project = projects.find(p => p.id === loc.projectId);
                  const color = loc.color ?? project?.color ?? 'var(--color-accent-teal)';
                  const timeLabel = loc.endTime
                    ? `${loc.startTime}–${loc.endTime}`
                    : loc.startTime ?? '';
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() =>
                        onOpenTask?.({
                          weekId: loc.weekId,
                          dayId: loc.startDayId,
                          taskId: loc.id,
                        })
                      }
                      onDoubleClick={e => {
                        e.stopPropagation();
                        onToggleTask?.({
                          weekId: loc.weekId,
                          dayId: loc.startDayId,
                          task: loc,
                        });
                      }}
                      className={cn(
                        'absolute left-0.5 right-0.5 z-[1] overflow-hidden rounded border border-black/10 px-1 py-0.5 text-left shadow-sm transition-opacity hover:z-[2] hover:brightness-110',
                        loc.kind === 'possible_event' && !loc.completed && 'opacity-60',
                        loc.completed && 'opacity-55 line-through',
                        compact ? 'text-[11px]' : 'text-[10px]'
                      )}
                      style={{
                        top: layout.top,
                        height: layout.height,
                        backgroundColor: `${color}33`,
                        borderLeft: `3px solid ${color}`,
                      }}
                      title={`${loc.title} (${timeLabel})`}
                    >
                      <div className="truncate font-semibold text-text-primary">{loc.title}</div>
                      <div className="truncate text-[9px] text-text-muted">{timeLabel}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
