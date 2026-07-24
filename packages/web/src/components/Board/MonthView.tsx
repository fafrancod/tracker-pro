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
import {
  getDayId,
  getWeekId,
  fetchTasksInRange,
  updateTask,
} from '@core/services/taskService';
import { isDemoMode } from '@core/lib/demoMode';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/hooks/useT';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { capitalize } from '@/lib/i18n';
import type { Task } from '@core/types';

interface MonthViewProps {
  onPickDay: (date: Date) => void;
}

export function MonthView({ onPickDay }: MonthViewProps) {
  const { locale, t } = useT();
  const { settings } = useSettings();
  const weekStartsOn = settings.weekStartsOnMonday ? 1 : 0;
  const uid = useStore(s => s.uid);
  const setDayTasks = useStore(s => s.setDayTasks);
  const updateTaskOptimistic = useStore(s => s.updateTaskOptimistic);

  const today = new Date();
  const [cursor, setCursor] = useState<Date>(startOfMonth(today));
  const [loadingRange, setLoadingRange] = useState(false);

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

  const dayHeaders = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) =>
      capitalize(format(addDays(gridStart, i), 'EEE', { locale }))
    );
  }, [gridStart.getTime(), locale]);

  // Cargar tareas del mes visible (modo real); en demo ya viven en el store.
  useEffect(() => {
    if (!uid || isDemoMode()) return;
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
            setDayTasks(weekId, dayId, list);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRange(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, gridStart.getTime(), gridEnd.getTime(), setDayTasks]);

  const tasksByDay = useStore(s => s.tasksByDay);
  const allProjects = useStore(s => s.projects);

  function getDayTasks(date: Date): Task[] {
    const weekId = getWeekId(date);
    const dayId = getDayId(date);
    return tasksByDay[weekId]?.[dayId] ?? [];
  }

  async function handleToggleTask(e: React.MouseEvent, date: Date, task: Task) {
    e.stopPropagation();
    e.preventDefault();
    const weekId = getWeekId(date);
    const dayId = getDayId(date);
    const nextCompleted = !task.completed;
    updateTaskOptimistic(weekId, dayId, task.id, {
      completed: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : null,
    });
    try {
      await updateTask(weekId, dayId, task.id, { completed: nextCompleted });
    } catch {
      updateTaskOptimistic(weekId, dayId, task.id, {
        completed: task.completed,
        completedAt: task.completedAt,
      });
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
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
            {t('action_today')}
          </Button>
        )}
      </header>

      <div className="flex flex-1 flex-col overflow-hidden p-2 md:p-4">
        <div className="grid grid-cols-7 gap-1 pb-2">
          {dayHeaders.map(h => (
            <div key={h} className="text-center text-[11px] font-medium text-text-muted">
              {h}
            </div>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-7 gap-1 overflow-y-auto auto-rows-fr">
          {cells.map(date => {
            const inMonth = isSameMonth(date, cursor);
            const isToday = isSameDay(date, today);
            const list = getDayTasks(date);
            const completed = list.filter(task => task.completed).length;
            const visible = list.slice(0, 4);
            const overflow = list.length - visible.length;

            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => onPickDay(date)}
                className={cn(
                  'group flex min-h-[96px] flex-col items-stretch gap-0.5 rounded-md border p-1.5 text-left transition-colors',
                  inMonth ? 'border-border bg-surface' : 'border-transparent bg-background opacity-50',
                  isToday && 'border-accent-teal/60 ring-1 ring-accent-teal/30',
                  'hover:border-accent-teal/40'
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      isToday ? 'text-accent-teal' : 'text-text-primary'
                    )}
                  >
                    {format(date, 'd')}
                  </span>
                  {list.length > 0 && (
                    <Badge
                      variant={completed === list.length ? 'green' : 'secondary'}
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {completed}/{list.length}
                    </Badge>
                  )}
                </div>

                <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {visible.map(task => {
                    const project = task.projectId
                      ? allProjects.find(p => p.id === task.projectId)
                      : null;
                    return (
                      <span
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={e => handleToggleTask(e, date, task)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void handleToggleTask(e as unknown as React.MouseEvent, date, task);
                          }
                        }}
                        title={
                          task.completed
                            ? t('task_uncomplete_hint')
                            : t('task_complete_hint')
                        }
                        className={cn(
                          'block truncate rounded px-1 py-0.5 text-[10px] leading-tight transition-colors',
                          task.completed
                            ? 'bg-accent-green/10 text-text-muted line-through'
                            : 'bg-background/80 text-text-primary hover:bg-accent-teal/15',
                          task.recurrence.frequency !== 'none' && 'ring-1 ring-accent-teal/20'
                        )}
                        style={
                          !task.completed && project
                            ? { borderLeft: `2px solid ${project.color}` }
                            : undefined
                        }
                      >
                        {task.recurrence.frequency !== 'none' ? '↻ ' : ''}
                        {task.title}
                      </span>
                    );
                  })}
                  {overflow > 0 && (
                    <span className="px-1 text-[9px] text-text-muted">+{overflow}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
