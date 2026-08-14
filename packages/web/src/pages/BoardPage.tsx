import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  GalleryVertical,
  Redo2,
  Undo2,
  Sun,
  LayoutGrid,
  FolderKanban,
  CalendarHeart,
  MapPin,
  Leaf,
  Wallet,
  Flag,
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
  BoardCategoryFilter,
  BoardTaskFilters,
  BoardViewMode,
  Importance,
  ScheduleLayout,
  Urgency,
} from '@core/types';

import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import {
  tintEvent,
  tintHabit,
  tintHoliday,
  tintPossible,
} from '@/lib/tintClasses';
import { cn } from '@/lib/utils';
import { CycleSelect } from '@/components/ui/cycle-select';
import { useOnboardingTour } from '@/contexts/OnboardingTourContext';

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
  const [filters, setFilters] = useState<BoardTaskFilters>({
    projectId: 'all',
    urgency: 'all',
    importance: 'all',
    category: 'all',
  });
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
  });

  const snapToPresent = useCallback(() => {
    const now = new Date();
    setCurrentWeek(getWeekId(now));
    setSelectedDay(getDayId(now));
    setFocusTodayNonce(n => n + 1);
  }, [setCurrentWeek, setSelectedDay]);

  useEffect(() => {
    if (!tourActive || !tourStep) return;
    if (tourStep.view && view !== tourStep.view) {
      setView(tourStep.view);
      snapToPresent();
    }
    setFabOpen(Boolean(tourStep.openCreate));
  }, [tourActive, tourStep, view, snapToPresent]);

  // Al abrir la pestaña de tareas: día/semana actuales.
  useEffect(() => {
    snapToPresent();
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

  const category = filters.category === 'rx' ? 'all' : (filters.category ?? 'all');
  /** Filtros efectivos del board (sin pestaña recetario + hide completed). */
  const boardFilter: BoardTaskFilters = {
    ...filters,
    category,
    hideCompleted,
  };
  const isProjectsCategory = category === 'projects';
  const isPossibleCategory = category === 'possible';
  const isEventsCategory = category === 'events';
  const isHabitsCategory = category === 'habits';

  const categoryTabs: Array<{
    value: BoardCategoryFilter;
    label: string;
    icon: typeof LayoutGrid;
  }> = [
    { value: 'all', label: t('board_filter_category_all'), icon: LayoutGrid },
    {
      value: 'projects',
      label: t('board_filter_category_projects'),
      icon: FolderKanban,
    },
    {
      value: 'events',
      label: t('board_filter_category_events'),
      icon: MapPin,
    },
    {
      value: 'possible',
      label: t('board_filter_category_possible'),
      icon: CalendarHeart,
    },
    {
      value: 'habits',
      label: t('board_filter_category_habits'),
      icon: Leaf,
    },
    {
      value: 'finances',
      label: t('board_filter_category_finances'),
      icon: Wallet,
    },
    {
      value: 'holidays',
      label: t('board_filter_category_holidays'),
      icon: Flag,
    },
  ];

  const projectOptions = [
    { value: 'all', label: t('board_filter_all') },
    ...projects.map(p => ({ value: p.id, label: `${p.icon} ${p.name}` })),
  ];
  const urgencyOptions = [
    { value: 'all', label: t('board_filter_all') },
    { value: 'urgent', label: t('urgency_urgent') },
    { value: 'not_urgent', label: t('urgency_not_urgent') },
  ];
  const importanceOptions = [
    { value: 'all', label: t('board_filter_all') },
    { value: 'important', label: t('importance_important') },
    { value: 'not_important', label: t('importance_not_important') },
  ];

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

      {/* Fila 2: categorías (Todo / Proyectos / Eventos / …) — recetario vive en /recetario */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface/60 px-2 py-2 md:flex-row md:items-center md:px-3">
        <div
          className="inline-flex w-full rounded-lg border border-border bg-background p-0.5 sm:w-auto"
          role="tablist"
          aria-label={t('board_filter_category')}
        >
          {categoryTabs.map(tab => {
            const Icon = tab.icon;
            const active = category === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  setFilters(f => ({
                    ...f,
                    category: tab.value,
                    // Eventos / posibles / hábitos no usan proyecto ni Eisenhower
                    ...(tab.value === 'possible' ||
                    tab.value === 'events' ||
                    tab.value === 'habits'
                      ? { projectId: 'all', urgency: 'all', importance: 'all' }
                      : {}),
                  }))
                }
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:flex-none sm:py-1.5',
                  active
                    ? tab.value === 'possible'
                      ? tintPossible
                      : tab.value === 'events'
                        ? tintEvent
                        : tab.value === 'habits'
                          ? tintHabit
                          : tab.value === 'holidays'
                            ? tintHoliday
                            : tab.value === 'projects'
                              ? 'bg-accent-teal/15 text-accent-teal'
                              : 'bg-accent-teal/15 text-accent-teal'
                    : 'text-text-muted hover:bg-surface hover:text-text-primary'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {isPossibleCategory && (
          <p className="text-[11px] text-text-muted md:ml-auto">
            {t('board_category_possible_hint')}
          </p>
        )}
        {isEventsCategory && (
          <p className="text-[11px] text-text-muted md:ml-auto">
            {t('board_category_events_hint')}
          </p>
        )}
        {isHabitsCategory && (
          <p className="text-[11px] text-text-muted md:ml-auto">
            {t('board_category_habits_hint')}
          </p>
        )}

        {/* Filtros secundarios: solo donde aplican */}
        {!isPossibleCategory && !isEventsCategory && !isHabitsCategory && (
          <div className="flex flex-wrap items-center gap-1.5 md:ml-auto">
            {(isProjectsCategory || category === 'all') && (
              <div className="flex items-center gap-1">
                <span className="hidden text-[10px] text-text-muted sm:inline">
                  {t('board_filter_project')}
                </span>
                <CycleSelect
                  aria-label={t('board_filter_project')}
                  value={
                    filters.projectId === 'all' || !filters.projectId
                      ? 'all'
                      : filters.projectId
                  }
                  options={projectOptions}
                  onChange={v =>
                    setFilters(f => ({
                      ...f,
                      projectId: v === 'all' ? 'all' : v,
                    }))
                  }
                />
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="hidden text-[10px] text-text-muted sm:inline">
                {t('board_filter_urgency')}
              </span>
              <CycleSelect
                aria-label={t('board_filter_urgency')}
                value={filters.urgency ?? 'all'}
                options={urgencyOptions}
                onChange={v =>
                  setFilters(f => ({
                    ...f,
                    urgency: v as Urgency | 'all',
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="hidden text-[10px] text-text-muted sm:inline">
                {t('board_filter_importance')}
              </span>
              <CycleSelect
                aria-label={t('board_filter_importance')}
                value={filters.importance ?? 'all'}
                options={importanceOptions}
                onChange={v =>
                  setFilters(f => ({
                    ...f,
                    importance: v as Importance | 'all',
                  }))
                }
              />
            </div>
          </div>
        )}
      </div>

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
            initialKind={
              isEventsCategory
                ? 'event'
                : isPossibleCategory
                  ? 'possible_event'
                  : isHabitsCategory
                    ? 'habit_good'
                    : 'task'
            }
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
