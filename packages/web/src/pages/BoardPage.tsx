import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  GalleryVertical,
  Redo2,
  Undo2,
  Sun,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import {
  BoardLayout,
  AddTaskForm,
  MonthView,
  ContinuousMonthsView,
  TaskDetailSheet,
  DayView,
  BoardFilterBar,
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
import { todayCivilDate } from '@core/lib/civilDate';
import type {
  BoardTaskFilters,
  BoardViewMode,
  ScheduleLayout,
} from '@core/types';
import {
  DEFAULT_PERSISTED_BOARD_FILTERS,
  normalizePersistedBoardFilters,
  resolvedKindGroups,
  toPersistedBoardFilters,
} from '@core/lib/boardFilters';

import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import { useOnboardingTour } from '@/contexts/OnboardingTourContext';
import { FOCUS_TODAY_EVENT } from '@/lib/calendarToday';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function BoardPage() {
  const [fabOpen, setFabOpen] = useState(false);
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<BoardViewMode>(
    () => settings.defaultBoardView ?? 'continuous'
  );
  const [scheduleLayout, setScheduleLayout] = useState<ScheduleLayout>(
    () => settings.defaultScheduleLayout ?? 'list'
  );
  const persistedFilters = useMemo(
    () =>
      normalizePersistedBoardFilters(
        settings.boardFilters ?? DEFAULT_PERSISTED_BOARD_FILTERS
      ),
    [settings.boardFilters]
  );
  const filters: BoardTaskFilters = useMemo(
    () => ({
      projectIds: persistedFilters.projectIds,
      kinds: persistedFilters.kinds,
      urgency: persistedFilters.urgency,
      importance: persistedFilters.importance,
      category: 'all',
    }),
    [persistedFilters]
  );

  function setFilters(next: BoardTaskFilters) {
    void updateSettings({ boardFilters: toPersistedBoardFilters(next) });
  }
  /** Bumps so month/continuous re-center on the present period. */
  const [focusTodayNonce, setFocusTodayNonce] = useState(0);

  const { projects } = useProjects();
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { canUndo, canRedo, undo, redo } = useTaskHistory();

  const hideCompleted = Boolean(settings.hideCompletedTasks);
  const { active: tourActive, step: tourStep } = useOnboardingTour();

  function toggleHideCompleted() {
    void updateSettings({ hideCompletedTasks: !hideCompleted });
  }

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
    timezone: settings.timezone,
  });

  const snapToPresent = useCallback(() => {
    const civil = todayCivilDate(settings.timezone);
    setCurrentWeek(getWeekId(civil));
    setSelectedDay(getDayId(civil));
    setFocusTodayNonce(n => n + 1);
  }, [setCurrentWeek, setSelectedDay, settings.timezone]);

  useEffect(() => {
    if (!tourActive || !tourStep) return;
    if (tourStep.view && view !== tourStep.view) {
      setView(tourStep.view);
      snapToPresent();
    }
    setFabOpen(Boolean(tourStep.openCreate));
  }, [tourActive, tourStep, view, snapToPresent]);

  // Al abrir Calendario (y cada vez que se vuelve a pulsar en el menú): hoy.
  useEffect(() => {
    snapToPresent();
  }, [snapToPresent]);

  useEffect(() => {
    function onFocusToday() {
      snapToPresent();
    }
    window.addEventListener(FOCUS_TODAY_EVENT, onFocusToday);
    return () => window.removeEventListener(FOCUS_TODAY_EVENT, onFocusToday);
  }, [snapToPresent]);

  function selectView(next: BoardViewMode) {
    setView(next);
    snapToPresent();
  }

  const goPresentLabel =
    view === 'day'
      ? t('board_go_today')
      : view === 'week'
        ? t('board_go_this_week')
        : t('board_go_this_month');

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

  function handleViewDay(date: Date) {
    setCurrentWeek(getWeekId(date));
    setSelectedDay(getDayId(date));
    setView('day');
  }

  /** Filtros efectivos del board (hide completed). */
  const boardFilter: BoardTaskFilters = {
    ...filters,
    category: 'all',
    hideCompleted,
  };

  return (
    <Layout
      title={t('nav_tasks')}
      primaryAction={{ label: t('action_add_task'), onClick: () => setFabOpen(true) }}
      onFabClick={() => setFabOpen(true)}
      showFab
    >
      {/*
        Contenedor flex: las filas de filtros se quedan arriba y el calendario
        ocupa el resto (min-h-0). Evita que la grilla se solape con proyecto/urgencia.
      */}
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Fila 1: vista + undo */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-2 py-1.5 md:px-3">
        <div
          data-tour="calendar-views"
          className="inline-flex rounded-md border border-border bg-surface p-0.5"
        >
          <button
            type="button"
            onClick={() => selectView('day')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              view === 'day'
                ? 'bg-accent-teal/15 text-accent-teal'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Sun className="h-3.5 w-3.5" />
            {t('board_day_view')}
          </button>
          <button
            type="button"
            onClick={() => selectView('week')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
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
            onClick={() => selectView('month')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
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
            onClick={() => selectView('continuous')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              view === 'continuous'
                ? 'bg-accent-teal/15 text-accent-teal'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <GalleryVertical className="h-3.5 w-3.5" />
            {t('board_continuous_view')}
          </button>
        </div>

        <button
          type="button"
          onClick={snapToPresent}
          data-tour="calendar-today"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-muted transition-colors hover:bg-background hover:text-text-primary"
          title={goPresentLabel}
        >
          <Calendar className="h-3.5 w-3.5 text-accent-teal" />
          <span className="hidden sm:inline">{goPresentLabel}</span>
          <span className="sm:hidden">{t('action_today')}</span>
        </button>

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

        <button
          type="button"
          onClick={toggleHideCompleted}
          title={
            hideCompleted
              ? t('board_show_completed')
              : t('board_hide_completed')
          }
          aria-pressed={hideCompleted}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
            hideCompleted
              ? 'border-accent-teal/40 bg-accent-teal/15 text-accent-teal'
              : 'border-border bg-surface text-text-muted hover:bg-background hover:text-text-primary'
          )}
        >
          {hideCompleted ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {hideCompleted
              ? t('board_show_completed')
              : t('board_hide_completed')}
          </span>
        </button>
      </div>

      <BoardFilterBar
        filters={filters}
        projects={projects}
        onChange={setFilters}
      />

      <div
        data-tour="calendar-canvas"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {view === 'day' && (
          <DayView
            filter={boardFilter}
            dayStartHour={settings.dayStartHour ?? 7}
            dayEndHour={settings.dayEndHour ?? 22}
            layout={scheduleLayout}
            onLayoutChange={setScheduleLayout}
          />
        )}
        {view === 'week' && (
          <BoardLayout
            filter={boardFilter}
            dayStartHour={settings.dayStartHour ?? 7}
            dayEndHour={settings.dayEndHour ?? 22}
            layout={scheduleLayout}
            onLayoutChange={setScheduleLayout}
          />
        )}
        {view === 'month' && (
          <MonthView
            onPickDay={handlePickDay}
            onViewDay={handleViewDay}
            filter={boardFilter}
            focusTodayNonce={focusTodayNonce}
          />
        )}
        {view === 'continuous' && (
          <ContinuousMonthsView
            onPickDay={handlePickDay}
            onViewDay={handleViewDay}
            filter={boardFilter}
            focusTodayNonce={focusTodayNonce}
          />
        )}
      </div>

      <TaskDetailSheet />

      <MobileSheet open={fabOpen} onOpenChange={setFabOpen}>
        <MobileSheetContent className="sm:max-w-3xl xl:max-w-6xl sm:p-6 xl:p-7 max-h-[92vh]">
          <MobileSheetHeader className="pr-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <MobileSheetTitle className="text-xl tracking-tight">{t('task_create_title')}</MobileSheetTitle>
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
            initialKind={(() => {
              const groups = resolvedKindGroups(filters);
              if (groups === 'all' || groups.length !== 1) return 'task';
              if (groups[0] === 'events') return 'event';
              if (groups[0] === 'possible') return 'possible_event';
              if (groups[0] === 'habits') return 'habit_good';
              if (groups[0] === 'finances') return 'finance_expense';
              return 'task';
            })()}
            onCancel={() => setFabOpen(false)}
            onAdd={async payload => {
              // Cerrar al instante; toast lo da AddTaskForm (Fase 4.1).
              setFabOpen(false);
              await addTask(payload);
            }}
          />
        </MobileSheetContent>
      </MobileSheet>
      </div>
    </Layout>
  );
}
