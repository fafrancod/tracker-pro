import { useState } from 'react';
import { CalendarDays, CalendarRange } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { BoardLayout, AddTaskForm, MonthView, TaskDetailSheet } from '@/components/Board';
import {
  MobileSheet,
  MobileSheetContent,
  MobileSheetDescription,
  MobileSheetHeader,
  MobileSheetTitle,
} from '@/components/ui/mobile-sheet';
import { useTasks } from '@core/hooks/useTasks';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import { useWeek } from '@core/hooks/useWeek';
import { getDayId, getWeekId } from '@core/services/taskService';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';

type BoardView = 'week' | 'month';

export function BoardPage() {
  const [fabOpen, setFabOpen] = useState(false);
  const [view, setView] = useState<BoardView>('week');
  const { projects } = useProjects();
  const { showToast } = useToast();
  const { locale, weekdayFormat, shortDateFormat, t } = useT();

  const selectedDayId = useStore(s => s.selectedDayId);
  const setCurrentWeek = useStore(s => s.setCurrentWeek);
  const setSelectedDay = useStore(s => s.setSelectedDay);
  const { currentWeekId, todayDayId, days, isCurrentWeek } = useWeek({
    locale,
    weekdayFormat,
    shortDateFormat,
  });

  const fallbackDayId = isCurrentWeek ? (todayDayId ?? days[0].dayId) : days[0].dayId;
  const targetDayId =
    selectedDayId && days.some(d => d.dayId === selectedDayId) ? selectedDayId : fallbackDayId;
  const { addTask } = useTasks(currentWeekId, targetDayId);
  const targetDay = days.find(d => d.dayId === targetDayId);

  function handlePickDay(date: Date) {
    // Empty-day create: prefill start, open FAB sheet, stay on current view.
    setCurrentWeek(getWeekId(date));
    setSelectedDay(getDayId(date));
    setFabOpen(true);
  }

  return (
    <Layout
      title={t('nav_tasks')}
      primaryAction={{ label: t('action_add_task'), onClick: () => setFabOpen(true) }}
    >
      {/* Toggle Semana / Mes */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-2">
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
          <button
            type="button"
            onClick={() => setView('week')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
              view === 'week'
                ? 'bg-accent-teal/15 text-accent-teal'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {t('board_week_view')}
          </button>
          <button
            type="button"
            onClick={() => setView('month')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
              view === 'month'
                ? 'bg-accent-teal/15 text-accent-teal'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            {t('board_month_view')}
          </button>
        </div>
      </div>

      {view === 'week' ? <BoardLayout /> : <MonthView onPickDay={handlePickDay} />}

      <TaskDetailSheet />

      <MobileSheet open={fabOpen} onOpenChange={setFabOpen}>
        <MobileSheetContent>
          <MobileSheetHeader>
            <MobileSheetTitle>{t('action_add_task')}</MobileSheetTitle>
            <MobileSheetDescription>
              {targetDay
                ? `${targetDay.label}, ${targetDay.dateLabel}.`
                : t('settings_default_project')}
            </MobileSheetDescription>
          </MobileSheetHeader>

          <AddTaskForm
            projects={projects}
            startOpen
            startDayId={targetDayId}
            onAdd={async payload => {
              await addTask(payload);
              showToast('OK', 'success');
              setFabOpen(false);
            }}
          />
        </MobileSheetContent>
      </MobileSheet>
    </Layout>
  );
}
