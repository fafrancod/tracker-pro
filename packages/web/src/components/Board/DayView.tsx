import { useMemo, useState } from 'react';
import {
  ArrowDownAZ,
  ArrowUpDown,
  Calendar,
  CalendarHeart,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  List,
  MapPin,
  Pill,
  Star,
} from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { useStore } from '@core/store';
import { useTasks } from '@core/hooks/useTasks';
import { useProjects } from '@core/hooks/useProjects';
import { useWeek } from '@core/hooks/useWeek';
import { getDayId, getWeekId } from '@core/services/taskService';
import { collectTasksCovering, type LocatedTask } from '@core/lib/taskPresence';
import {
  taskMatchesFilters,
  type BoardTaskFilters,
  type Importance,
  type ScheduleLayout,
  type TaskKind,
  type Urgency,
} from '@core/types';
import { Button } from '@/components/ui/button';
import {
  MobileSheet,
  MobileSheetContent,
  MobileSheetDescription,
  MobileSheetHeader,
  MobileSheetTitle,
} from '@/components/ui/mobile-sheet';

import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import { tintEventBorder, tintPossibleBorder } from '@/lib/tintClasses';
import { ScheduleGrid } from './ScheduleGrid';
import { TaskCard } from './TaskCard';
import { AddTaskForm } from './AddTaskForm';
import { ProgressRing } from './ProgressRing';
import { emptyMessageKeyForCategory } from '@/lib/boardEmpty';

const SLOT_KIND_OPTIONS: Array<{
  kind: TaskKind;
  labelKey:
    | 'task_kind_task'
    | 'task_kind_event'
    | 'task_kind_possible_event'
    | 'task_kind_rx_human';
  icon: typeof CheckSquare;
  className: string;
}> = [
  {
    kind: 'task',
    labelKey: 'task_kind_task',
    icon: CheckSquare,
    className: 'border-accent-teal/30 bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20',
  },
  {
    kind: 'event',
    labelKey: 'task_kind_event',
    icon: MapPin,
    className: tintEventBorder,
  },
  {
    kind: 'possible_event',
    labelKey: 'task_kind_possible_event',
    icon: CalendarHeart,
    className: tintPossibleBorder,
  },
  {
    kind: 'rx_human',
    labelKey: 'task_kind_rx_human',
    icon: Pill,
    className:
      'border-violet-600/35 bg-violet-500/10 text-violet-800 hover:bg-violet-500/20 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20',
  },
];

/** Criterios de orden en vista día → lista. */
export type DayListSortKey = 'time' | 'name' | 'importance' | 'urgency';

interface DayViewProps {
  filter?: BoardTaskFilters;
  dayStartHour: number;
  dayEndHour: number;
  layout: ScheduleLayout;
  onLayoutChange: (layout: ScheduleLayout) => void;
  onAddRequest?: () => void;
}

function urgencyRank(u: Urgency | null | undefined): number {
  if (u === 'urgent') return 0;
  if (u === 'not_urgent') return 1;
  return 2; // sin clasificar al final
}

function importanceRank(i: Importance | null | undefined): number {
  if (i === 'important') return 0;
  if (i === 'not_important') return 1;
  return 2;
}

function timeKey(t: string | null | undefined): string {
  // Sin hora al final del día (ZZZ)
  if (!t || !/^\d{2}:\d{2}/.test(t)) return '99:99';
  return t.slice(0, 5);
}

function compareLocated(
  a: LocatedTask,
  b: LocatedTask,
  keys: DayListSortKey[],
  dir: 'asc' | 'desc'
): number {
  const mul = dir === 'asc' ? 1 : -1;
  for (const key of keys) {
    let cmp = 0;
    switch (key) {
      case 'time':
        cmp = timeKey(a.startTime).localeCompare(timeKey(b.startTime));
        break;
      case 'name':
        cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        break;
      case 'importance':
        cmp = importanceRank(a.importance) - importanceRank(b.importance);
        break;
      case 'urgency':
        cmp = urgencyRank(a.urgency) - urgencyRank(b.urgency);
        break;
    }
    if (cmp !== 0) return cmp * mul;
  }
  // Desempate estable: título, luego id
  const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  if (byTitle !== 0) return byTitle;
  return a.id.localeCompare(b.id);
}

export function DayView({
  filter,
  dayStartHour,
  dayEndHour,
  layout,
  onLayoutChange,
}: DayViewProps) {
  const { locale, weekdayFormat, shortDateFormat, t } = useT();
  const { projects } = useProjects();
  const selectedDayId = useStore(s => s.selectedDayId);
  const setSelectedDay = useStore(s => s.setSelectedDay);
  const setCurrentWeek = useStore(s => s.setCurrentWeek);
  const setDetailTask = useStore(s => s.setDetailTask);
  const tasksByDay = useStore(s => s.tasksByDay);

  /** Orden multi-criterio: el primero es el principal; se pueden acumular. */
  const [sortKeys, setSortKeys] = useState<DayListSortKey[]>(['time']);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  /** Doble clic en hueco: primero elige tipo, luego abre el formulario. */
  const [slotKindPicker, setSlotKindPicker] = useState<string | null>(null);
  const [slotCreate, setSlotCreate] = useState<{
    startTime: string;
    kind: TaskKind;
  } | null>(null);

  const { todayDayId, days: weekDays, nextWeekId } = useWeek({
    locale,
    weekdayFormat,
    shortDateFormat,
  });

  const dayId = selectedDayId ?? todayDayId ?? getDayId(new Date());
  const weekId = getWeekId(parseISO(`${dayId}T12:00:00`));
  const { addTask, editTask, removeTask, moveTaskToDay } = useTasks(weekId, dayId);

  const dayDate = parseISO(`${dayId}T12:00:00`);
  const label = format(dayDate, weekdayFormat, { locale });
  const dateLabel = format(dayDate, shortDateFormat, { locale });
  const isToday = dayId === todayDayId;

  const located = useMemo(() => {
    const rows = collectTasksCovering(tasksByDay, dayId);
    return filter ? rows.filter(r => taskMatchesFilters(r, filter)) : rows;
  }, [tasksByDay, dayId, filter]);

  const sortedLocated = useMemo(() => {
    const keys = sortKeys.length > 0 ? sortKeys : (['time'] as DayListSortKey[]);
    return [...located].sort((a, b) => {
      // Orden por horario (default): más temprano → más tarde, sin sesgo de completadas.
      // Otros criterios: completadas al final.
      if (keys[0] !== 'time' && a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return compareLocated(a, b, keys, sortDir);
    });
  }, [located, sortKeys, sortDir]);

  const completedCount = located.filter(t => t.completed).length;
  const progress =
    located.length > 0 ? Math.round((completedCount / located.length) * 100) : 0;

  function toggleSortKey(key: DayListSortKey) {
    setSortKeys(prev => {
      if (prev.includes(key)) {
        // Quitar si hay más de uno; si es el único, lo dejamos
        if (prev.length === 1) return prev;
        return prev.filter(k => k !== key);
      }
      // Añadir al final (prioridad menor que los anteriores)
      return [...prev, key];
    });
  }

  function setPrimarySort(key: DayListSortKey) {
    setSortKeys(prev => {
      if (prev[0] === key) {
        // Clic de nuevo en el principal → alternar dirección
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      // Poner como principal y conservar el resto detrás
      return [key, ...prev.filter(k => k !== key)];
    });
  }

  function goDay(delta: number) {
    const next = addDays(dayDate, delta);
    const nextDayId = getDayId(next);
    setSelectedDay(nextDayId);
    setCurrentWeek(getWeekId(next));
  }

  function goToday() {
    const id = getDayId(new Date());
    setSelectedDay(id);
    setCurrentWeek(getWeekId(new Date()));
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2 py-1.5 md:px-3">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => goDay(-1)}
            aria-label={t('board_prev_day')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => goDay(1)}
            aria-label={t('board_next_day')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'truncate text-sm font-semibold',
              isToday ? 'text-accent-teal' : 'text-text-primary'
            )}
          >
            {label}
            <span className="ml-2 font-normal text-text-muted">{dateLabel}</span>
          </div>
        </div>

        <ProgressRing
          progress={progress}
          completed={completedCount}
          total={located.length}
          size={32}
        />

        {!isToday && (
          <Button variant="outline" size="sm" onClick={goToday} className="h-7 gap-1 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            {t('board_go_today')}
          </Button>
        )}

        <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
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
      </header>

      {layout === 'schedule' ? (
        <ScheduleGrid
          days={[
            {
              weekId,
              dayId,
              label,
              dateLabel,
              isToday,
            },
          ]}
          dayStartHour={dayStartHour}
          dayEndHour={dayEndHour}
          filter={filter}
          compact
          onOpenTask={loc => setDetailTask(loc)}
          onToggleTask={({ weekId: w, dayId: d, task }) => {
            void editTask(task.id, { completed: !task.completed });
            void w;
            void d;
          }}
          onEmptyDoubleClick={({ startTime }) => {
            setSlotCreate(null);
            setSlotKindPicker(startTime);
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Barra de ordenación (solo lista) */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-surface/40 px-2 py-1.5 md:px-3">
            <span className="mr-0.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
              <ArrowUpDown className="h-3 w-3" />
              {t('day_sort_label')}
            </span>
            {(
              [
                { key: 'time' as const, icon: Clock, label: t('day_sort_time') },
                { key: 'name' as const, icon: ArrowDownAZ, label: t('day_sort_name') },
                { key: 'importance' as const, icon: Star, label: t('day_sort_importance') },
                { key: 'urgency' as const, icon: Flame, label: t('day_sort_urgency') },
              ] as const
            ).map(opt => {
              const activeIdx = sortKeys.indexOf(opt.key);
              const active = activeIdx >= 0;
              const isPrimary = activeIdx === 0;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  type="button"
                  title={
                    isPrimary
                      ? t('day_sort_primary_hint')
                      : active
                        ? t('day_sort_secondary_hint')
                        : t('day_sort_add_hint')
                  }
                  onClick={e => {
                    if (e.shiftKey || e.metaKey || e.ctrlKey) {
                      toggleSortKey(opt.key);
                    } else {
                      setPrimarySort(opt.key);
                    }
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                    active
                      ? isPrimary
                        ? 'border-accent-teal/40 bg-accent-teal/15 text-accent-teal'
                        : 'border-border bg-background text-text-primary'
                      : 'border-transparent text-text-muted hover:border-border hover:text-text-primary'
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  {opt.label}
                  {active && (
                    <span className="tabular-nums text-[10px] opacity-70">
                      {activeIdx + 1}
                      {isPrimary ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </span>
                  )}
                </button>
              );
            })}
            <p className="w-full text-[10px] text-text-muted sm:ml-auto sm:w-auto">
              {t('day_sort_help')}
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 md:p-3">
            {sortedLocated.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">
                {t(emptyMessageKeyForCategory(filter?.category))}
              </p>
            ) : (
              sortedLocated.map(loc => (
                <TaskCard
                  key={loc.id}
                  task={loc}
                  projects={projects}
                  weekDays={weekDays}
                  nextWeekId={nextWeekId}
                  startDayId={loc.startDayId}
                  locationWeekId={loc.weekId}
                  locationDayId={loc.startDayId}
                  onToggle={() => void editTask(loc.id, { completed: !loc.completed })}
                  onEdit={payload => void editTask(loc.id, payload)}
                  onConfirmAsEvent={
                    loc.kind === 'possible_event'
                      ? () =>
                          void editTask(loc.id, {
                            kind: 'event',
                            color: loc.color ?? '#58a6ff',
                            projectId: null,
                            urgency: null,
                            importance: null,
                          })
                      : undefined
                  }
                  onMove={toDate => void moveTaskToDay(loc, toDate)}
                  onMoveNextWeek={() => undefined}
                  onDuplicate={() =>
                    void addTask({
                      title: loc.title,
                      projectId: loc.projectId,
                      priority: loc.priority,
                      notes: loc.notes,
                      tags: loc.tags,
                      startTime: loc.startTime,
                      endTime: loc.endTime,
                      kind: loc.kind,
                      color: loc.color,
                    })
                  }
                  onDelete={() => void removeTask(loc.id)}
                  onOpenDetail={() =>
                    setDetailTask({
                      weekId: loc.weekId,
                      dayId: loc.startDayId,
                      taskId: loc.id,
                    })
                  }
                />
              ))
            )}
          </div>
          <div className="shrink-0 border-t border-border p-2">
            <AddTaskForm
              projects={projects}
              startDayId={dayId}
              onAdd={async payload => {
                void addTask(payload);
              }}
            />
          </div>
        </div>
      )}

      {/* Elegir tipo al crear desde hueco del horario */}
      <MobileSheet
        open={Boolean(slotKindPicker)}
        onOpenChange={open => {
          if (!open) setSlotKindPicker(null);
        }}
      >
        <MobileSheetContent className="sm:max-w-md">
          <MobileSheetHeader>
            <MobileSheetTitle>
              {slotKindPicker
                ? t('schedule_create_at').replace('{time}', slotKindPicker)
                : t('schedule_create_pick')}
            </MobileSheetTitle>
            <MobileSheetDescription>{t('schedule_create_pick')}</MobileSheetDescription>
          </MobileSheetHeader>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SLOT_KIND_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.kind}
                  type="button"
                  onClick={() => {
                    if (!slotKindPicker) return;
                    setSlotCreate({ startTime: slotKindPicker, kind: opt.kind });
                    setSlotKindPicker(null);
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors',
                    opt.className
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </MobileSheetContent>
      </MobileSheet>

      {/* Formulario de creación con hora pre-rellenada */}
      <MobileSheet
        open={Boolean(slotCreate)}
        onOpenChange={open => {
          if (!open) setSlotCreate(null);
        }}
      >
        <MobileSheetContent className="sm:max-w-xl sm:p-8 max-h-[92vh]">
          <MobileSheetHeader className="pr-8">
            <MobileSheetTitle className="text-lg">
              {slotCreate
                ? t('schedule_create_at').replace('{time}', slotCreate.startTime)
                : t('task_create_title')}
            </MobileSheetTitle>
            <MobileSheetDescription>
              {label}, {dateLabel}.
            </MobileSheetDescription>
          </MobileSheetHeader>
          {slotCreate && (
            <AddTaskForm
              key={`${dayId}-${slotCreate.startTime}-${slotCreate.kind}`}
              projects={projects}
              startOpen
              variant="modal"
              startDayId={dayId}
              initialKind={slotCreate.kind}
              initialStartTime={slotCreate.startTime}
              onCancel={() => setSlotCreate(null)}
              onAdd={async payload => {
                setSlotCreate(null);
                // Toast lo da AddTaskForm (Fase 4.1); aquí solo persiste.
                await addTask(payload);
              }}
            />
          )}
        </MobileSheetContent>
      </MobileSheet>
    </div>
  );
}
