import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  format,
  addDays,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useStore } from '@core/store';
import { getDayId, fetchTasksInRange } from '@core/services/taskService';
import { taskHistory } from '@core/history/taskHistory';
import { collectTasksCovering, type LocatedTask } from '@core/lib/taskPresence';
import { mergeDayTaskLists } from '@core/lib/mergeDayTasks';
import { isDemoMode } from '@core/lib/demoMode';
import { taskMatchesFilters, type BoardTaskFilters, type Task } from '@core/types';
import { isHabitGood, isHabitKind, isHabitQuit } from '@core/lib/habits';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/hooks/useT';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { capitalize } from '@/lib/i18n';
import { Check } from 'lucide-react';
import {
  TaskContextMenu,
  type TaskContextMenuState,
} from './TaskContextMenu';
import {
  DayContextMenu,
  openDayContextMenu,
  type DayContextMenuState,
} from './DayContextMenu';

export interface MonthViewProps {
  onPickDay: (date: Date) => void;
  /** Right-click «Ver día» → navigate to day view for that date. */
  onViewDay?: (date: Date) => void;
  mode?: 'single' | 'continuous';
  /** When mode is continuous (or embedding), which month to render. */
  monthDate?: Date;
  /** Hide month navigation chrome (used inside continuous scroll). */
  hideChrome?: boolean;
  /**
   * Oculta la fila L M X J… (vista continuo usa una franja sticky compartida
   * para que los filtros del board no la tapen).
   */
  hideDayHeaders?: boolean;
  filter?: BoardTaskFilters;
  /** Skip independent range fetch when parent already loaded the range. */
  skipFetch?: boolean;
  /** Increment to jump cursor to the current month (single mode). */
  focusTodayNonce?: number;
}

const MAX_LANES = 3;

interface BarSegment {
  task: Task;
  startDayId: string;
  startWeekId: string;
  colStart: number;
  colSpan: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  lane: number;
}

function collectAllLocated(
  tasksByDay: Record<string, Record<string, Task[]>>
): LocatedTask[] {
  const result: LocatedTask[] = [];
  const seen = new Set<string>();
  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [startDayId, tasks] of Object.entries(days)) {
      for (const task of tasks) {
        if (seen.has(task.id)) continue;
        seen.add(task.id);
        result.push({ ...task, weekId, startDayId });
      }
    }
  }
  return result;
}

function buildBarsForWeek(
  weekDates: Date[],
  located: LocatedTask[]
): { bars: BarSegment[]; overflowByCol: number[] } {
  const weekStart = getDayId(weekDates[0]);
  const weekEnd = getDayId(weekDates[6]);
  const dayIndex = new Map(weekDates.map((d, i) => [getDayId(d), i]));

  type RawSeg = Omit<BarSegment, 'lane'>;
  const raw: RawSeg[] = [];

  for (const loc of located) {
    const end = loc.endDayId || loc.startDayId;
    if (end <= loc.startDayId) continue;
    if (loc.startDayId > weekEnd || end < weekStart) continue;

    const clipStart = loc.startDayId < weekStart ? weekStart : loc.startDayId;
    const clipEnd = end > weekEnd ? weekEnd : end;
    const colStart = dayIndex.get(clipStart);
    const colEnd = dayIndex.get(clipEnd);
    if (colStart === undefined || colEnd === undefined) continue;

    raw.push({
      task: loc,
      startDayId: loc.startDayId,
      startWeekId: loc.weekId,
      colStart,
      colSpan: colEnd - colStart + 1,
      continuesLeft: loc.startDayId < weekStart,
      continuesRight: end > weekEnd,
    });
  }

  raw.sort((a, b) => {
    if (a.colStart !== b.colStart) return a.colStart - b.colStart;
    return b.colSpan - a.colSpan;
  });

  const laneEnds: number[] = [];
  const bars: BarSegment[] = [];
  const overflowByCol = Array.from({ length: 7 }, () => 0);

  for (const seg of raw) {
    let lane = laneEnds.findIndex(endCol => endCol <= seg.colStart);
    if (lane === -1) {
      if (laneEnds.length < MAX_LANES) {
        lane = laneEnds.length;
        laneEnds.push(0);
      } else {
        for (let c = seg.colStart; c < seg.colStart + seg.colSpan; c++) {
          overflowByCol[c] += 1;
        }
        continue;
      }
    }
    laneEnds[lane] = seg.colStart + seg.colSpan;
    bars.push({ ...seg, lane });
  }

  return { bars, overflowByCol };
}

export function MonthView({
  onPickDay,
  onViewDay,
  mode = 'single',
  monthDate,
  hideChrome = false,
  hideDayHeaders = false,
  filter,
  skipFetch = false,
  focusTodayNonce = 0,
}: MonthViewProps) {
  const { locale, t } = useT();
  const { settings } = useSettings();
  const weekStartsOn = settings.weekStartsOnMonday ? 1 : 0;
  const uid = useStore(s => s.uid);
  const setDayTasks = useStore(s => s.setDayTasks);
  const updateTaskById = useStore(s => s.updateTaskById);

  const setDetailTask = useStore(s => s.setDetailTask);

  const today = new Date();
  const [cursor, setCursor] = useState<Date>(() =>
    startOfMonth(monthDate ?? today)
  );
  const [loadingRange, setLoadingRange] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<TaskContextMenuState | null>(null);
  const [dayCtxMenu, setDayCtxMenu] = useState<DayContextMenuState | null>(null);

  // Sync controlled monthDate (continuous embed)
  useEffect(() => {
    if (monthDate) setCursor(startOfMonth(monthDate));
  }, [monthDate?.getTime()]);

  // Jump to current month when parent requests (go-today / open tasks)
  useEffect(() => {
    if (mode !== 'single' || !focusTodayNonce) return;
    setCursor(startOfMonth(new Date()));
  }, [focusTodayNonce, mode]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

  const cells = useMemo(() => {
    const result: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      result.push(d);
      d = addDays(d, 1);
    }
    return result;
  }, [gridStart.getTime(), gridEnd.getTime()]);

  const weekRows = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [cells]);

  const dayHeaders = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) =>
      capitalize(format(addDays(gridStart, i), 'EEE', { locale }))
    );
  }, [gridStart.getTime(), locale]);

  useEffect(() => {
    if (skipFetch || !uid || isDemoMode()) return;
    let cancelled = false;
    const fromDayId = getDayId(gridStart);
    const toDayId = getDayId(gridEnd);

    setLoadingRange(true);
    void fetchTasksInRange(uid, fromDayId, toDayId)
      .then(rows => {
        if (cancelled) return;
        const byWeekDay = new Map<string, Map<string, Task[]>>();
        for (const row of rows) {
          if (!byWeekDay.has(row.weekId)) byWeekDay.set(row.weekId, new Map());
          const days = byWeekDay.get(row.weekId)!;
          if (!days.has(row.dayId)) days.set(row.dayId, []);
          days.get(row.dayId)!.push(row);
        }
        for (const [weekId, days] of byWeekDay) {
          for (const [dayId, list] of days) {
            // Merge: un fetch en vuelo no debe borrar una tarea recién creada.
            const existing = useStore.getState().tasksByDay[weekId]?.[dayId] ?? [];
            setDayTasks(weekId, dayId, mergeDayTaskLists(existing, list));
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRange(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, gridStart.getTime(), gridEnd.getTime(), setDayTasks, skipFetch]);

  const tasksByDay = useStore(s => s.tasksByDay);
  const allProjects = useStore(s => s.projects);
  const located = useMemo(() => {
    const all = collectAllLocated(tasksByDay);
    if (!filter) return all;
    return all.filter(t => taskMatchesFilters(t, filter));
  }, [tasksByDay, filter]);

  function getSingleDayChips(date: Date): LocatedTask[] {
    const dayId = getDayId(date);
    const chips = collectTasksCovering(tasksByDay, dayId).filter(t => {
      if (filter && !taskMatchesFilters(t, filter)) return false;
      const end = t.endDayId || t.startDayId;
      return end === t.startDayId;
    });
    // Timed first (by startTime), then untimed by title.
    return chips.sort((a, b) => {
      const ta = a.startTime?.slice(0, 5) ?? '';
      const tb = b.startTime?.slice(0, 5) ?? '';
      if (ta && tb) return ta.localeCompare(tb);
      if (ta) return -1;
      if (tb) return 1;
      return a.title.localeCompare(b.title);
    });
  }

  function chipTimeLabel(task: Task): string | null {
    if (!task.startTime) return null;
    const start = task.startTime.slice(0, 5);
    if (task.endTime) return `${start}–${task.endTime.slice(0, 5)}`;
    return start;
  }

  function openDetail(weekId: string, dayId: string, taskId: string) {
    setDetailTask({ weekId, dayId, taskId });
  }

  async function handleToggleLocated(loc: {
    task: Task;
    startDayId: string;
    startWeekId: string;
  }) {
    try {
      await taskHistory.update(loc.startWeekId, loc.startDayId, loc.task.id, {
        completed: !loc.task.completed,
      });
    } catch {
      // taskHistory already rolled optimistic state on failure only for some paths;
      // best-effort revert:
      updateTaskById(loc.task.id, {
        completed: loc.task.completed,
        completedAt: loc.task.completedAt,
      });
    }
  }

  async function handleDeleteLocated(loc: {
    task: Task;
    startDayId: string;
    startWeekId: string;
  }) {
    try {
      await taskHistory.remove(loc.startWeekId, loc.startDayId, loc.task.id);
    } catch {
      // Realtime / refetch will restore if needed
    }
  }

  function openCtx(
    e: React.MouseEvent,
    task: Task,
    startWeekId: string,
    startDayId: string
  ) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      task,
      weekId: startWeekId,
      dayId: startDayId,
    });
  }

  const showChrome = !hideChrome && mode === 'single';

  return (
    <div
      className={cn(
        'flex flex-col bg-background',
        mode === 'single' ? 'h-full overflow-hidden' : 'shrink-0'
      )}
    >
      {showChrome && (
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCursor(c => addMonths(c, -1))}
              className="h-8 w-8"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCursor(c => addMonths(c, 1))}
              className="h-8 w-8"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-sm font-semibold text-text-primary">
            {capitalize(format(cursor, 'MMMM yyyy', { locale }))}
          </h2>

          {loadingRange && (
            <span className="text-[11px] text-text-muted">{t('status_checking')}</span>
          )}

          {!isSameMonth(cursor, today) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(startOfMonth(today))}
              className="ml-2 h-7 gap-1.5 text-xs"
            >
              <Calendar className="h-3.5 w-3.5" />
              {t('board_go_this_month')}
            </Button>
          )}
        </header>
      )}

      {!showChrome && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-2 py-2 md:px-4">
          <h2 className="text-sm font-semibold text-text-primary">
            {capitalize(format(cursor, 'MMMM yyyy', { locale }))}
          </h2>
          {loadingRange && (
            <span className="text-[11px] text-text-muted">{t('status_checking')}</span>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex flex-col p-2 md:p-4',
          mode === 'single' ? 'flex-1 overflow-hidden' : '',
          // En continuo, un poco más de aire bajo el título del mes.
          mode === 'continuous' && 'pt-1 md:pt-2'
        )}
      >
        {!hideDayHeaders && (
          <div className="grid grid-cols-7 gap-1 pb-2">
            {dayHeaders.map(h => (
              <div
                key={h}
                className="text-center text-[11px] font-medium text-text-muted"
              >
                {h}
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'flex flex-col gap-1',
            mode === 'single' ? 'flex-1 overflow-y-auto' : ''
          )}
        >
          {weekRows.map((weekDates, rowIdx) => {
            const { bars, overflowByCol } = buildBarsForWeek(weekDates, located);
            const laneCount = Math.max(1, ...bars.map(b => b.lane + 1), 1);

            return (
              <div key={rowIdx} className="relative grid min-h-[132px] grid-cols-7 gap-1">
                {weekDates.map((date, col) => {
                  const inMonth = isSameMonth(date, cursor);
                  const isToday = isSameDay(date, today);
                  const chips = getSingleDayChips(date);
                  const covering = collectTasksCovering(tasksByDay, getDayId(date)).filter(
                    t => !filter || taskMatchesFilters(t, filter)
                  );
                  const completed = covering.filter(task => task.completed).length;
                  const total = covering.length;
                  // Overflow only from multi-day bars that don't fit in lanes
                  const barOverflow = overflowByCol[col];

                  return (
                    <div
                      key={date.toISOString()}
                      role="button"
                      tabIndex={0}
                      onClick={() => onPickDay(date)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onPickDay(date);
                        }
                      }}
                      onContextMenu={e => {
                        if (!onViewDay) return;
                        openDayContextMenu(e, date, setDayCtxMenu);
                      }}
                      className={cn(
                        'group relative flex h-[132px] flex-col items-stretch gap-0.5 rounded-md border p-1.5 text-left transition-colors',
                        inMonth ? 'border-border bg-surface' : 'border-transparent bg-background opacity-50',
                        isToday && 'border-accent-teal/60 ring-1 ring-accent-teal/30',
                        'hover:border-accent-teal/40'
                      )}
                    >
                      <div className="flex shrink-0 items-center justify-between gap-1">
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            isToday ? 'text-accent-teal' : 'text-text-primary'
                          )}
                        >
                          {format(date, 'd')}
                        </span>
                        {total > 0 && (
                          <Badge
                            variant={completed === total ? 'green' : 'secondary'}
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {completed}/{total}
                          </Badge>
                        )}
                      </div>

                      <div
                        className="shrink-0"
                        style={{ height: `${laneCount * 18}px` }}
                        aria-hidden
                      />

                      <div
                        className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
                        onClick={e => e.stopPropagation()}
                        onWheel={e => {
                          // Keep wheel scroll inside the day cell when the list overflows.
                          const el = e.currentTarget;
                          if (el.scrollHeight > el.clientHeight) {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {chips.map(task => {
                          const project = task.projectId
                            ? allProjects.find(p => p.id === task.projectId)
                            : null;
                          const timeLabel = chipTimeLabel(task);
                          const habit = isHabitKind(task.kind);
                          return (
                            <span
                              key={task.id}
                              role="button"
                              tabIndex={0}
                              onClick={e => {
                                // Hábito: clic en la fila no crea tarea del día.
                                e.stopPropagation();
                              }}
                              onDoubleClick={e => {
                                e.stopPropagation();
                                e.preventDefault();
                                openDetail(task.weekId, task.startDayId, task.id);
                              }}
                              onContextMenu={e =>
                                openCtx(e, task, task.weekId, task.startDayId)
                              }
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  openDetail(task.weekId, task.startDayId, task.id);
                                }
                              }}
                              title={
                                timeLabel ? `${task.title} · ${timeLabel}` : task.title
                              }
                              className={cn(
                                'flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] leading-tight transition-colors',
                                task.completed
                                  ? isHabitQuit(task.kind)
                                    ? 'bg-red-500/10 text-text-muted line-through'
                                    : 'bg-accent-green/10 text-text-muted line-through'
                                  : habit && isHabitGood(task.kind)
                                    ? 'bg-emerald-500/10 text-text-primary hover:bg-emerald-500/20'
                                    : habit && isHabitQuit(task.kind)
                                      ? 'bg-red-500/10 text-text-primary hover:bg-red-500/20'
                                      : 'bg-background/80 text-text-primary hover:bg-accent-teal/15',
                                task.kind === 'possible_event' &&
                                  !task.completed &&
                                  'opacity-60',
                                task.recurrence.frequency !== 'none' &&
                                  !habit &&
                                  'ring-1 ring-accent-teal/20'
                              )}
                              style={
                                !task.completed && (task.color || project)
                                  ? {
                                      borderLeft: `2px solid ${task.color || project!.color}`,
                                    }
                                  : undefined
                              }
                            >
                              {habit ? (
                                <button
                                  type="button"
                                  className={cn(
                                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                    task.completed
                                      ? isHabitQuit(task.kind)
                                        ? 'border-red-500/70 bg-red-500/25 text-red-100'
                                        : 'border-accent-green bg-accent-green/25 text-accent-green'
                                      : isHabitGood(task.kind)
                                        ? 'border-emerald-500/60'
                                        : 'border-red-500/60'
                                  )}
                                  aria-label={
                                    task.completed ? t('habit_done') : t('habit_not_done')
                                  }
                                  onClick={e => {
                                    e.stopPropagation();
                                    void handleToggleLocated({
                                      task,
                                      startDayId: task.startDayId,
                                      startWeekId: task.weekId,
                                    });
                                  }}
                                >
                                  {task.completed && <Check className="h-2.5 w-2.5" />}
                                </button>
                              ) : null}
                              <span className="min-w-0 flex-1 truncate">
                                {!habit && task.kind === 'reminder' ? '🔔 ' : ''}
                                {!habit && task.recurrence.frequency !== 'none' ? '↻ ' : ''}
                                {habit && isHabitGood(task.kind) ? '🌱 ' : ''}
                                {habit && isHabitQuit(task.kind) ? '⊘ ' : ''}
                                {task.title}
                              </span>
                              {timeLabel && !habit && (
                                <span className="shrink-0 tabular-nums text-[9px] font-medium text-text-muted">
                                  {timeLabel}
                                </span>
                              )}
                            </span>
                          );
                        })}
                        {barOverflow > 0 && (
                          <span className="px-1 text-[9px] text-text-muted">
                            +{barOverflow}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div
                  className="pointer-events-none absolute inset-0 grid grid-cols-7 gap-1"
                  aria-hidden={false}
                >
                  {bars.map(bar => {
                    const project = bar.task.projectId
                      ? allProjects.find(p => p.id === bar.task.projectId)
                      : null;
                    const color = bar.task.color ?? project?.color ?? '#58a6ff';
                    return (
                      <button
                        key={`${bar.task.id}-${bar.colStart}-${bar.lane}`}
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                        }}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          e.preventDefault();
                          openDetail(bar.startWeekId, bar.startDayId, bar.task.id);
                        }}
                        onContextMenu={e =>
                          openCtx(e, bar.task, bar.startWeekId, bar.startDayId)
                        }
                        title={
                          bar.task.startTime
                            ? `${bar.task.title} · ${chipTimeLabel(bar.task)}`
                            : bar.task.title
                        }
                        className={cn(
                          'pointer-events-auto absolute z-10 flex items-center gap-0.5 rounded px-1.5 text-left text-[10px] font-medium leading-[16px] shadow-sm transition-opacity hover:opacity-90',
                          bar.task.completed && 'line-through opacity-60',
                          bar.task.kind === 'possible_event' &&
                            !bar.task.completed &&
                            'opacity-60',
                          bar.continuesLeft && 'rounded-l-none',
                          bar.continuesRight && 'rounded-r-none'
                        )}
                        style={{
                          top: `${22 + bar.lane * 18}px`,
                          left: `calc(${(bar.colStart / 7) * 100}% + 2px)`,
                          width: `calc(${(bar.colSpan / 7) * 100}% - 4px)`,
                          backgroundColor: bar.task.completed ? `${color}33` : `${color}cc`,
                          color: bar.task.completed ? undefined : '#0d1117',
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {bar.continuesLeft ? '‹ ' : ''}
                          {bar.task.recurrence.frequency !== 'none' ? '↻ ' : ''}
                          {bar.task.title}
                          {bar.continuesRight ? ' ›' : ''}
                        </span>
                        {bar.task.startTime && (
                          <span className="shrink-0 tabular-nums text-[9px] opacity-80">
                            {bar.task.startTime.slice(0, 5)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onToggleComplete={m => {
          void handleToggleLocated({
            task: m.task,
            startDayId: m.dayId,
            startWeekId: m.weekId,
          });
        }}
        onEdit={m => openDetail(m.weekId, m.dayId, m.task.id)}
        onDelete={m => {
          void handleDeleteLocated({
            task: m.task,
            startDayId: m.dayId,
            startWeekId: m.weekId,
          });
        }}
        onConfirmAsEvent={m => {
          if (m.task.kind !== 'possible_event') return;
          void taskHistory.update(m.weekId, m.dayId, m.task.id, {
            kind: 'event',
            color: m.task.color ?? '#58a6ff',
            projectId: null,
            urgency: null,
            importance: null,
          });
        }}
      />

      {onViewDay && (
        <DayContextMenu
          menu={dayCtxMenu}
          onClose={() => setDayCtxMenu(null)}
          onViewDay={onViewDay}
        />
      )}
    </div>
  );
}
