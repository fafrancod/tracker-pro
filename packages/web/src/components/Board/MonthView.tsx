import { useMemo, useState } from 'react';
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
import { getDayId, getWeekId } from '@core/services/taskService';
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

  const today = new Date();
  const [cursor, setCursor] = useState<Date>(startOfMonth(today));

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

  // Generar todas las celdas del calendario
  const cells = useMemo(() => {
    const result: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      result.push(d);
      d = addDays(d, 1);
    }
    return result;
  }, [gridStart, gridEnd]);

  // Cabeceras de los días (Lun-Dom o Dom-Sáb según settings).
  const dayHeaders = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) =>
      capitalize(format(addDays(gridStart, i), 'EEE', { locale }))
    );
  }, [gridStart, locale]);

  // Leer todas las tareas para resolver counts por día.
  const tasksByDay = useStore(s => s.tasksByDay);

  function getDayInfo(date: Date): { total: number; completed: number; projects: Set<string> } {
    const weekId = getWeekId(date);
    const dayId = getDayId(date);
    const list = tasksByDay[weekId]?.[dayId] ?? [];
    const projects = new Set<string>();
    for (const t of list) if (t.projectId) projects.add(t.projectId);
    return {
      total: list.length,
      completed: list.filter((t: Task) => t.completed).length,
      projects,
    };
  }

  // Proyectos para colorear dots
  const allProjects = useStore(s => s.projects);

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

      {/* Grid */}
      <div className="flex flex-1 flex-col overflow-hidden p-2 md:p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 pb-2">
          {dayHeaders.map(h => (
            <div key={h} className="text-center text-[11px] font-medium text-text-muted">
              {h}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid flex-1 grid-cols-7 gap-1 overflow-y-auto">
          {cells.map(date => {
            const inMonth = isSameMonth(date, cursor);
            const isToday = isSameDay(date, today);
            const info = getDayInfo(date);
            return (
              <button
                key={date.toISOString()}
                onClick={() => onPickDay(date)}
                className={cn(
                  'group flex min-h-[80px] flex-col items-stretch gap-1 rounded-md border p-1.5 text-left transition-colors',
                  inMonth ? 'border-border bg-surface' : 'border-transparent bg-background opacity-50',
                  isToday && 'border-accent-teal/60 ring-1 ring-accent-teal/30',
                  'hover:border-accent-teal/40'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      isToday ? 'text-accent-teal' : 'text-text-primary'
                    )}
                  >
                    {format(date, 'd')}
                  </span>
                  {info.total > 0 && (
                    <Badge
                      variant={info.completed === info.total ? 'green' : 'secondary'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {info.completed}/{info.total}
                    </Badge>
                  )}
                </div>

                {/* Dots de proyectos */}
                {info.projects.size > 0 && (
                  <div className="mt-auto flex flex-wrap items-center gap-1">
                    {[...info.projects].slice(0, 5).map(projectId => {
                      const proj = allProjects.find(p => p.id === projectId);
                      if (!proj) return null;
                      return (
                        <span
                          key={projectId}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: proj.color }}
                          title={proj.name}
                        />
                      );
                    })}
                    {info.projects.size > 5 && (
                      <span className="text-[9px] text-text-muted">+{info.projects.size - 5}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
