import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  GalleryVertical,
  Redo2,
  Undo2,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import {
  BoardLayout,
  AddTaskForm,
  MonthView,
  ContinuousMonthsView,
  TaskDetailSheet,
} from '@/components/Board';
import {
  MobileSheet,
  MobileSheetContent,
  MobileSheetDescription,
  MobileSheetHeader,
  MobileSheetTitle,
} from '@/components/ui/mobile-sheet';
import { useTasks } from '@core/hooks/useTasks';
import { useTaskHistory } from '@core/hooks/useTaskHistory';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import { useWeek } from '@core/hooks/useWeek';
import { getDayId, getWeekId } from '@core/services/taskService';
import type {
  BoardTaskFilters,
  BoardViewMode,
  Importance,
  Urgency,
} from '@core/types';
import { useToast } from '@/contexts/ToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function BoardPage() {
  const [fabOpen, setFabOpen] = useState(false);
  const { settings } = useSettings();
  const [view, setView] = useState<BoardViewMode>(
    () => settings.defaultBoardView ?? 'continuous'
  );
  const [filters, setFilters] = useState<BoardTaskFilters>({
    projectId: 'all',
    urgency: 'all',
    importance: 'all',
  });

  const { projects } = useProjects();
  const { showToast } = useToast();
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { canUndo, canRedo, undo, redo } = useTaskHistory();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        void undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        void redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

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
    setCurrentWeek(getWeekId(date));
    setSelectedDay(getDayId(date));
    setFabOpen(true);
  }

  const selectClass =
    'h-7 max-w-[140px] rounded-md border border-border bg-surface px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring';

  return (
    <Layout
      title={t('nav_tasks')}
      primaryAction={{ label: t('action_add_task'), onClick: () => setFabOpen(true) }}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2">
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
          <button
            type="button"
            onClick={() => setView('continuous')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
              view === 'continuous'
                ? 'bg-accent-teal/15 text-accent-teal'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <GalleryVertical className="h-3.5 w-3.5" />
            {t('board_continuous_view')}
          </button>
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
          <button
            type="button"
            title={`${t('action_undo')} (Ctrl+Z)`}
            disabled={!canUndo}
            onClick={() => void undo()}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors',
              canUndo
                ? 'hover:bg-background hover:text-text-primary'
                : 'cursor-not-allowed opacity-40'
            )}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={`${t('action_redo')} (Ctrl+Y)`}
            disabled={!canRedo}
            onClick={() => void redo()}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors',
              canRedo
                ? 'hover:bg-background hover:text-text-primary'
                : 'cursor-not-allowed opacity-40'
            )}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="sr-only md:not-sr-only">{t('board_filter_project')}</span>
            <select
              className={selectClass}
              value={filters.projectId === 'all' || !filters.projectId ? 'all' : filters.projectId}
              onChange={e =>
                setFilters(f => ({
                  ...f,
                  projectId: e.target.value === 'all' ? 'all' : e.target.value,
                }))
              }
            >
              <option value="all">{t('board_filter_all')}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="sr-only md:not-sr-only">{t('board_filter_urgency')}</span>
            <select
              className={selectClass}
              value={filters.urgency ?? 'all'}
              onChange={e =>
                setFilters(f => ({
                  ...f,
                  urgency: e.target.value as Urgency | 'all',
                }))
              }
            >
              <option value="all">{t('board_filter_all')}</option>
              <option value="urgent">{t('urgency_urgent')}</option>
              <option value="not_urgent">{t('urgency_not_urgent')}</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="sr-only md:not-sr-only">{t('board_filter_importance')}</span>
            <select
              className={selectClass}
              value={filters.importance ?? 'all'}
              onChange={e =>
                setFilters(f => ({
                  ...f,
                  importance: e.target.value as Importance | 'all',
                }))
              }
            >
              <option value="all">{t('board_filter_all')}</option>
              <option value="important">{t('importance_important')}</option>
              <option value="not_important">{t('importance_not_important')}</option>
            </select>
          </label>
        </div>
      </div>

      {view === 'week' && <BoardLayout filter={filters} />}
      {view === 'month' && <MonthView onPickDay={handlePickDay} filter={filters} />}
      {view === 'continuous' && (
        <ContinuousMonthsView onPickDay={handlePickDay} filter={filters} />
      )}

      <TaskDetailSheet />

      <MobileSheet open={fabOpen} onOpenChange={setFabOpen}>
        <MobileSheetContent className="sm:max-w-xl sm:p-8 max-h-[92vh]">
          <MobileSheetHeader className="pr-8">
            <MobileSheetTitle className="text-lg">{t('task_create_title')}</MobileSheetTitle>
            <MobileSheetDescription>
              {targetDay
                ? `${targetDay.label}, ${targetDay.dateLabel}.`
                : t('settings_default_project')}
            </MobileSheetDescription>
          </MobileSheetHeader>

          <AddTaskForm
            projects={projects}
            startOpen
            variant="modal"
            startDayId={targetDayId}
            onCancel={() => setFabOpen(false)}
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
