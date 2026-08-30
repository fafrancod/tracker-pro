import { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical, MoreHorizontal, Pencil, Check, ChevronDown, ChevronUp, Maximize2, Repeat } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  TaskContextMenu,
  type TaskContextMenuState,
} from './TaskContextMenu';
import type { Task, Project, Priority, UpdateTaskPayload } from '@core/types';
import { formatDose, isRxKind } from '@core/lib/rx';
import { isHabitGood, isHabitKind, isHabitQuit, normalizePomodoroCount } from '@core/lib/habits';
import { HabitPomodoroSection } from './HabitPomodoroSection';
import { isFinanceKind } from '@core/lib/financeKinds';
import { isBoardCreditTaskId } from '@core/lib/finance/boardCredits';
import { isPdfAttachment, parseTaskAttachment } from '@core/lib/taskImages';
import { useT } from '@/hooks/useT';
import { tintEvent, tintHabit, tintPossible } from '@/lib/tintClasses';
import { rescheduleTaskSpan } from './rescheduleSpan';

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: 'green' | 'teal' | 'red' }> = {
  low: { label: 'Low', variant: 'green' },
  medium: { label: 'Med', variant: 'teal' },
  high: { label: 'High', variant: 'red' },
};

interface TaskCardProps {
  task: Task;
  projects: Project[];
  weekDays: { date: Date; dayId: string; label: string; dateLabel: string }[];
  nextWeekId: string;
  /** Start day of the span (for range label). */
  startDayId?: string;
  /** Location for context menu / detail (start bucket). */
  locationWeekId?: string;
  locationDayId?: string;
  onToggle: () => void;
  onEdit: (payload: UpdateTaskPayload) => void;
  /** @deprecated Fechas se cambian con inicio/fin o arrastre en el tablero. */
  onMove?: (toDate: Date) => void;
  /** @deprecated */
  onMoveNextWeek?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenDetail?: () => void;
  /** Convierte evento posible → evento real. */
  onConfirmAsEvent?: () => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  /** Compact layout for week columns (less lateral padding). */
  dense?: boolean;
}

export function TaskCard({
  task,
  projects,
  weekDays: _weekDays,
  startDayId,
  locationWeekId,
  locationDayId,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenDetail,
  onConfirmAsEvent,
  dragHandleProps,
  isDragging,
  dense = false,
}: TaskCardProps) {
  const { t } = useT();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(task.notes);
  const [ctxMenu, setCtxMenu] = useState<TaskContextMenuState | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);

  const project = projects.find(p => p.id === task.projectId);
  const projectCategory =
    project?.categories?.find(c => c.id === task.projectCategoryId) ?? null;
  const isHabit = isHabitKind(task.kind);
  const habitGood = isHabitGood(task.kind);
  const habitQuit = isHabitQuit(task.kind);
  const isCreditInstallment = isBoardCreditTaskId(task.id);

  const openMenuAt = useCallback(
    (x: number, y: number) => {
      setCtxMenu({
        x,
        y,
        task,
        weekId: locationWeekId ?? '',
        dayId: locationDayId ?? startDayId ?? '',
      });
    },
    [task, locationWeekId, locationDayId, startDayId]
  );

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressOrigin.current = null;
  }

  function onTouchStartMenu(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    longPressOrigin.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      const origin = longPressOrigin.current;
      if (!origin) return;
      // Haptic-ish: prevent synthetic click after long-press
      openMenuAt(origin.x, origin.y);
      longPressTimer.current = null;
    }, 480);
  }

  function onTouchMoveMenu(e: React.TouchEvent) {
    const origin = longPressOrigin.current;
    const touch = e.touches[0];
    if (!origin || !touch) return;
    const dx = Math.abs(touch.clientX - origin.x);
    const dy = Math.abs(touch.clientY - origin.y);
    if (dx > 10 || dy > 10) clearLongPress();
  }

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingNotes) notesRef.current?.focus();
  }, [editingNotes]);

  function commitTitle() {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title) onEdit({ title: trimmed });
    else setTitleValue(task.title);
    setEditingTitle(false);
  }

  function commitNotes() {
    if (notesValue !== task.notes) onEdit({ notes: notesValue });
    setEditingNotes(false);
  }

  const spanStart = startDayId ?? locationDayId;
  const spanEnd = task.endDayId || spanStart;
  const isMultiDay = Boolean(spanStart && spanEnd && spanEnd > spanStart);
  /** Ignore tiny edge-handle wiggles so clicks/double-clicks still work. */
  const EDGE_DRAG_THRESHOLD_PX = 12;
  const edgeResizeRef = useRef<{
    mode: 'start' | 'end';
    originX: number;
    start: string;
    end: string;
    active: boolean;
    pointerId: number;
    target: HTMLElement;
  } | null>(null);

  function onEdgePointerDown(mode: 'start' | 'end', e: React.PointerEvent) {
    if (!isMultiDay || !spanStart || !locationWeekId) return;
    // No preventDefault until the press becomes a real drag (dblclick-friendly).
    e.stopPropagation();
    edgeResizeRef.current = {
      mode,
      originX: e.clientX,
      start: spanStart,
      end: spanEnd!,
      active: false,
      pointerId: e.pointerId,
      target: e.currentTarget as HTMLElement,
    };
  }

  function onEdgePointerMove(e: React.PointerEvent) {
    const st = edgeResizeRef.current;
    if (!st || e.pointerId !== st.pointerId) return;
    if (st.active) return;
    if (Math.abs(e.clientX - st.originX) < EDGE_DRAG_THRESHOLD_PX) return;
    st.active = true;
    try {
      st.target.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  async function onEdgePointerUp(e: React.PointerEvent) {
    const st = edgeResizeRef.current;
    edgeResizeRef.current = null;
    if (!st || !spanStart || !locationWeekId) return;
    if (st.active) {
      try {
        st.target.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    // Never crossed threshold → leave click/dblclick alone.
    if (!st.active) return;
    const deltaDays = Math.round((e.clientX - st.originX) / 36);
    if (deltaDays === 0) return;
    let nextStart = st.start;
    let nextEnd = st.end;
    if (st.mode === 'start') {
      nextStart = format(
        addDays(parseISO(`${st.start}T00:00:00`), deltaDays),
        'yyyy-MM-dd'
      );
      if (nextStart > nextEnd) nextStart = nextEnd;
    } else {
      nextEnd = format(
        addDays(parseISO(`${st.end}T00:00:00`), deltaDays),
        'yyyy-MM-dd'
      );
      if (nextEnd < nextStart) nextEnd = nextStart;
    }
    try {
      await rescheduleTaskSpan({
        task,
        startWeekId: locationWeekId,
        startDayId: spanStart,
        nextStartDayId: nextStart,
        nextEndDayId: nextEnd,
      });
    } catch {
      /* taskHistory rolls back on hard failure */
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={onTouchStartMenu}
      onTouchMove={onTouchMoveMenu}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
      className={cn(
        'group relative rounded-md border border-border bg-surface transition-shadow touch-manipulation',
        dense ? 'p-1.5' : 'p-2.5',
        isDragging && 'shadow-lg ring-1 ring-accent-teal/50',
        // Eventos posibles: aspecto “tentativo”
        task.kind === 'possible_event' && !task.completed && 'opacity-60',
        task.completed && 'opacity-60'
      )}
      style={
        task.color
          ? {
              borderLeftWidth: dense ? 2 : 3,
              borderLeftColor: task.color,
            }
          : project
            ? { borderLeftWidth: dense ? 2 : 3, borderLeftColor: project.color }
            : undefined
      }
    >
      {/* Extremos multi-día: arrastrar horizontalmente (~36px = 1 día) */}
      {isMultiDay && locationWeekId && (
        <>
          <span
            role="separator"
            aria-label={t('task_start_date')}
            title={t('task_date_range_drag_hint')}
            className="absolute bottom-0 left-0 top-0 z-20 w-1.5 cursor-ew-resize rounded-l bg-accent-teal/0 transition-colors group-hover:bg-accent-teal/35"
            onPointerDown={e => onEdgePointerDown('start', e)}
            onPointerMove={onEdgePointerMove}
            onPointerUp={e => void onEdgePointerUp(e)}
            onPointerCancel={e => void onEdgePointerUp(e)}
          />
          <span
            role="separator"
            aria-label={t('task_end_date')}
            title={t('task_date_range_drag_hint')}
            className="absolute bottom-0 right-0 top-0 z-20 w-1.5 cursor-ew-resize rounded-r bg-accent-teal/0 transition-colors group-hover:bg-accent-teal/35"
            onPointerDown={e => onEdgePointerDown('end', e)}
            onPointerMove={onEdgePointerMove}
            onPointerUp={e => void onEdgePointerUp(e)}
            onPointerCancel={e => void onEdgePointerUp(e)}
          />
        </>
      )}
      <div className={cn('flex items-start', dense ? 'gap-1 pr-5' : 'gap-2')}>
        {/*
          Checkbox SIEMPRE a la izquierda del título (también en semana dense).
          Antes el grip iba absolute left-0 z-10 y tapaba el check en columnas estrechas.
        */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            'relative z-[2] flex shrink-0 items-center justify-center border transition-colors',
            dense ? 'mt-0.5 h-4 w-4' : isHabit ? 'mt-0.5 h-6 w-6' : 'mt-0.5 h-5 w-5',
            isHabit ? 'rounded-md' : 'rounded-full',
            task.completed
              ? habitQuit
                ? 'border-red-500/70 bg-red-500/20 text-red-200'
                : 'border-accent-green bg-accent-green/20 text-accent-green'
              : habitGood
                ? 'border-emerald-500/50 hover:border-emerald-400'
                : habitQuit
                  ? 'border-red-500/50 hover:border-red-400'
                  : 'border-border bg-background hover:border-accent-green'
          )}
          aria-label={
            isHabit
              ? task.completed
                ? t('habit_done')
                : t('habit_not_done')
              : task.completed
                ? 'Desmarcar'
                : 'Completar'
          }
          title={
            isHabit
              ? task.completed
                ? t('habit_done')
                : t('habit_not_done')
              : task.completed
                ? 'Desmarcar'
                : 'Completar'
          }
        >
          {task.completed && (
            <Check
              className={cn(dense ? 'h-2.5 w-2.5' : isHabit ? 'h-3.5 w-3.5' : 'h-3 w-3')}
              strokeWidth={3}
            />
          )}
        </button>

        {/* Grip: en día (no dense) junto al check; en semana dense → esquina inferior derecha */}
        {!dense && !isCreditInstallment && (
          <button
            type="button"
            {...dragHandleProps}
            className="mt-0.5 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center touch-none text-text-muted opacity-40 transition-opacity active:cursor-grabbing group-hover:opacity-100"
            tabIndex={-1}
            aria-label="Arrastrar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') { setTitleValue(task.title); setEditingTitle(false); }
              }}
              className={cn(
                'w-full bg-transparent text-text-primary outline-none',
                dense ? 'text-xs' : 'text-sm'
              )}
            />
          ) : (
            <span
              onClick={() => onOpenDetail?.()}
              onDoubleClick={e => {
                e.stopPropagation();
                // Doble clic: abrir ficha de detalle (edición completa).
                onOpenDetail?.();
              }}
              title="Clic: ver detalle · Doble clic: editar"
              className={cn(
                'block cursor-pointer select-none leading-snug',
                dense ? 'text-xs' : 'text-sm',
                task.completed
                  ? 'task-completed-title text-text-muted line-through'
                  : 'text-text-primary hover:text-accent-teal'
              )}
            >
              {task.title}
            </span>
          )}

          {/* Meta row */}
          <div className={cn('flex flex-wrap items-center', dense ? 'mt-0.5 gap-0.5' : 'mt-1.5 gap-1.5')}>
            {task.startTime && (
              <span className="inline-flex items-center rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-text-muted ring-1 ring-border">
                {task.endTime ? `${task.startTime}–${task.endTime}` : task.startTime}
              </span>
            )}
            {isHabit && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  habitGood
                    ? tintHabit
                    : 'bg-red-500/15 text-red-800 dark:bg-red-500/15 dark:text-red-200'
                )}
              >
                {habitGood ? `✓ ${t('habit_badge_good')}` : `⊘ ${t('habit_badge_quit')}`}
              </span>
            )}
            {(task.steps?.length ?? 0) > 0 && (
              <span className="inline-flex items-center rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-text-muted ring-1 ring-border">
                {t('task_steps_progress')
                  .replace(
                    '{done}',
                    String(task.steps.filter(s => s.completed).length)
                  )
                  .replace('{total}', String(task.steps.length))}
              </span>
            )}
            {(task.images?.length ?? 0) > 0 && (
              <span className="inline-flex items-center rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-text-muted ring-1 ring-border">
                {task.images.some(src => isPdfAttachment(src)) ? '📎' : '🖼'}{' '}
                {task.images.length}
              </span>
            )}
            {isFinanceKind(task.kind) && task.finance && !task.financeMovementId && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  task.kind === 'finance_income'
                    ? 'bg-accent-green/15 text-accent-green'
                    : 'bg-accent-red/15 text-accent-red'
                )}
              >
                {task.kind === 'finance_income' ? '+' : '−'}
                {task.finance.amount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
                {task.finance.currency}
                {task.finance.certainty === 'potential' ? ' · ~' : ''}
              </span>
            )}
            {task.financeMovementId && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  task.linkedFinance
                    ? task.linkedFinance.flow === 'income'
                      ? 'bg-accent-green/15 text-accent-green'
                      : task.linkedFinance.flow === 'investment'
                        ? 'bg-accent-teal/15 text-accent-teal'
                        : 'bg-accent-red/15 text-accent-red'
                    : 'bg-background text-text-muted ring-1 ring-border'
                )}
                title={
                  task.linkedFinance
                    ? undefined
                    : t('task_money_pill_locked')
                }
              >
                {task.linkedFinance
                  ? `${task.linkedFinance.flow === 'income' ? '+' : task.linkedFinance.flow === 'investment' ? '↗' : '−'}${task.linkedFinance.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${task.linkedFinance.currency}${task.linkedFinance.status === 'planned' ? ' · …' : ''}`
                  : t('task_money_pill')}
              </span>
            )}
            {isRxKind(task.kind) && task.rx && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  task.kind === 'rx_pet'
                    ? 'bg-amber-500/15 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200'
                    : 'bg-violet-500/15 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200'
                )}
                title={task.rx.subject ?? undefined}
              >
                {task.kind === 'rx_pet' ? '🐾' : '💊'} {formatDose(task.rx.amount, task.rx.unit)}
                {task.rx.subject ? ` · ${task.rx.subject}` : ''}
              </span>
            )}
            {startDayId && task.endDayId && task.endDayId > startDayId && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-text-muted ring-1 ring-border">
                {format(parseISO(`${startDayId}T00:00:00`), 'd MMM')}
                {' – '}
                {format(parseISO(`${task.endDayId}T00:00:00`), 'd MMM')}
              </span>
            )}
            {task.kind === 'reminder' && (
              <span className="inline-flex items-center rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-300">
                🔔
              </span>
            )}
            {task.kind === 'possible_event' && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  tintPossible
                )}
              >
                ✨{' '}
                {(task.involvedContactIds?.length ?? 0) > 0
                  ? `${task.involvedContactIds.length}`
                  : 'Posible'}
              </span>
            )}
            {task.kind === 'event' && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  tintEvent
                )}
              >
                📍
                {task.location
                  ? ` ${task.location.length > 16 ? `${task.location.slice(0, 16)}…` : task.location}`
                  : ' Evento'}
                {task.departureTime ? ` · 🚗 ${task.departureTime.slice(0, 5)}` : ''}
              </span>
            )}
            {task.kind !== 'event' &&
              task.location &&
              (task.kind === 'task' ||
                task.kind === 'reminder' ||
                task.kind === 'possible_event') && (
                <span
                  className="inline-flex max-w-[9rem] items-center gap-0.5 truncate rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
                  title={task.location}
                >
                  📍{' '}
                  {task.location.length > 16
                    ? `${task.location.slice(0, 16)}…`
                    : task.location}
                </span>
              )}
            {task.recurrence.frequency !== 'none' && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-accent-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-teal"
                title={
                  task.recurrence.interval > 1
                    ? `↻ cada ${task.recurrence.interval}`
                    : task.recurrence.frequency
                }
              >
                <Repeat className="h-2.5 w-2.5" />
                {task.recurrence.frequency === 'daily'
                  ? 'D'
                  : task.recurrence.frequency === 'weekly'
                    ? 'S'
                    : task.recurrence.frequency === 'monthly'
                      ? 'M'
                      : 'A'}
                {task.recurrence.interval > 1 ? `×${task.recurrence.interval}` : ''}
              </span>
            )}
            {project && (
              <span
                className={cn(
                  'inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full font-medium',
                  dense
                    ? 'gap-0.5 px-1 py-0 text-[9px]'
                    : 'gap-1 px-2 py-0.5 text-xs'
                )}
                style={{ backgroundColor: project.color + '33', color: project.color }}
                title={
                  projectCategory
                    ? `${project.name} · ${projectCategory.name}`
                    : project.name
                }
              >
                <span aria-hidden>{project.icon}</span>
                {!dense && (
                  <span className="truncate">
                    {project.name}
                    {projectCategory ? ` · ${projectCategory.name}` : ''}
                  </span>
                )}
              </span>
            )}
            {!dense && (
              <Badge variant={PRIORITY_CONFIG[task.priority].variant} className="px-1.5 py-0 text-[10px]">
                {PRIORITY_CONFIG[task.priority].label}
              </Badge>
            )}
            {!dense && task.movedFrom && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-text-muted">
                ↩ {task.movedFrom}
              </Badge>
            )}
            {!dense &&
              task.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
          </div>

          {/* Notes toggle — hidden in dense week columns unless expanded */}
          {isHabit && (
            <HabitPomodoroSection
              target={normalizePomodoroCount(task.pomodoroTarget)}
              done={normalizePomodoroCount(task.pomodoroDone)}
              dense={dense}
              onTargetChange={next =>
                onEdit({ pomodoroTarget: next, applyTo: 'series' })
              }
              onDoneChange={next => onEdit({ pomodoroDone: next })}
            />
          )}

          {!dense && (task.notes || notesOpen) && (
            <button
              onClick={() => setNotesOpen(v => !v)}
              className="mt-1 flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
            >
              {notesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Notes
            </button>
          )}
          {!dense && notesOpen && (
            <div className="mt-1.5">
              {editingNotes ? (
                <textarea
                  ref={notesRef}
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  onBlur={commitNotes}
                  rows={3}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-text-primary outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <p
                  onDoubleClick={() => setEditingNotes(true)}
                  className="cursor-text whitespace-pre-wrap text-xs text-text-muted"
                >
                  {task.notes || <span className="italic">Double-click to add notes…</span>}
                </p>
              )}
            </div>
          )}
          {!dense && !task.notes && !notesOpen && (
            <button
              onClick={() => { setNotesOpen(true); setEditingNotes(true); }}
              className="mt-1 text-[11px] text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary"
            >
              + notes
            </button>
          )}

          {!dense && (task.images?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.images.slice(0, 4).map((src, i) => {
                const meta = parseTaskAttachment(src);
                const isPdf = isPdfAttachment(src);
                return (
                  <button
                    key={`${task.id}-img-${i}`}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onOpenDetail?.();
                    }}
                    className="h-10 w-10 overflow-hidden rounded border border-border bg-background"
                    title={meta?.name ?? t('task_images_preview')}
                  >
                    {isPdf ? (
                      <span className="flex h-full w-full items-center justify-center bg-accent-red/10 text-[9px] font-semibold text-accent-red">
                        PDF
                      </span>
                    ) : (
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {dense && !isCreditInstallment && (
          <button
            type="button"
            {...dragHandleProps}
            className="absolute bottom-0.5 right-0.5 z-[1] flex h-5 w-5 cursor-grab items-center justify-center rounded touch-none text-text-muted opacity-40 transition-opacity active:cursor-grabbing group-hover:opacity-100"
            tabIndex={-1}
            aria-label="Arrastrar"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}

        {/* Actions — visible on touch devices (hover alone is useless) */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-0.5 opacity-90 transition-opacity group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
            dense && 'absolute right-0.5 top-0.5'
          )}
        >
          {onOpenDetail && (
            <button
              type="button"
              onClick={onOpenDetail}
              className="flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-border hover:text-text-primary"
              title="Abrir detalle"
              aria-label="Abrir detalle"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          {!isCreditInstallment && (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="hidden h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-border hover:text-text-primary sm:flex"
            title="Editar inline"
            aria-label="Editar inline"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          )}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              openMenuAt(rect.left, rect.bottom + 4);
            }}
            className="flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-border hover:text-text-primary sm:hidden"
            aria-label="Más opciones"
            title="Más opciones"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {!isCreditInstallment && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hidden h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-border hover:text-text-primary sm:flex"
                aria-label="Más opciones"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onDuplicate} className="text-xs">
                {t('task_duplicate')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-xs text-accent-red focus:text-accent-red"
              >
                {t('action_delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>

      {/* Completed timestamp */}
      {task.completed && task.completedAt && (
        <p className="mt-1 text-right text-[10px] text-text-muted">
          ✓ {format(parseISO(task.completedAt), 'HH:mm')}
        </p>
      )}

      <TaskContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onToggleComplete={() => onToggle()}
        onEdit={() => onOpenDetail?.()}
        onDelete={isCreditInstallment ? undefined : () => onDelete()}
        onConfirmAsEvent={
          onConfirmAsEvent
            ? () => onConfirmAsEvent()
            : undefined
        }
      />
    </motion.div>
  );
}
