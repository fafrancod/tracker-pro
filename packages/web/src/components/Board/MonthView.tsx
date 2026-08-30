import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  format,
  addDays,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useStore } from '@core/store';
import {
  ensureTasksRangeLoaded,
  getDayId,
  isTasksRangeFresh,
} from '@core/services/taskService';
import { taskHistory } from '@core/history/taskHistory';
import {
  collectTasksCovering,
  compareByStartTime,
  type LocatedTask,
} from '@core/lib/taskPresence';
import { isDemoMode } from '@core/lib/demoMode';
import { taskMatchesFilters, type BoardTaskFilters, type Task } from '@core/types';
import { boardShowsHolidays, boardShowsTasks } from '@core/lib/boardFilters';
import { isHabitGood, isHabitKind, isHabitQuit } from '@core/lib/habits';
import { isBoardCreditTaskId } from '@core/lib/finance/boardCredits';
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
import { rescheduleTaskSpan } from './rescheduleSpan';
import { getChileHolidaysInRange } from '@core/lib/chileHolidays';
import { tintHoliday } from '@/lib/tintClasses';
import { scheduleScrollToCalendarToday } from '@/lib/calendarToday';
import { todayCivilDate, todayDayId } from '@core/lib/civilDate';

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
/** Cell padding-top (p-1.5) + day number (h-6) + gap. Bars start below this. */
const MONTH_DAY_HEAD_PX = 32;
const MONTH_LANE_PX = 18;
const MONTH_BAR_H_PX = 16;

function inkOn(hex: string): '#0d1117' | '#f0f6fc' {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#0d1117';
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 148 ? '#0d1117' : '#f0f6fc';
}

function spanBarBox(colStart: number, colSpan: number, lane: number) {
  return {
    top: `${lane * MONTH_LANE_PX}px`,
    left: `calc(${(colStart / 7) * 100}% + 3px)`,
    width: `calc(${(colSpan / 7) * 100}% - 6px)`,
    height: MONTH_BAR_H_PX,
  };
}

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
  const updateTaskById = useStore(s => s.updateTaskById);

  const setDetailTask = useStore(s => s.setDetailTask);

  const today = todayCivilDate(settings.timezone);
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
    setCursor(startOfMonth(todayCivilDate(settings.timezone)));
    scheduleScrollToCalendarToday();
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

    // Fase 4.5: skeleton/indicador solo en el primer fetch del rango (no en toggles ni si está fresco).
    const needsNetwork = !isTasksRangeFresh(fromDayId, toDayId);
    if (needsNetwork) setLoadingRange(true);
    void ensureTasksRangeLoaded(uid, fromDayId, toDayId)
      .catch(() => {
        /* store conserva lo que haya */
      })
      .finally(() => {
        if (!cancelled) setLoadingRange(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, gridStart.getTime(), gridEnd.getTime(), skipFetch]);

  const tasksByDay = useStore(s => s.tasksByDay);
  const allProjects = useStore(s => s.projects);
  const showHolidays = boardShowsHolidays(filter);
  const holidaysOnly = !boardShowsTasks(filter);

  const located = useMemo(() => {
    if (holidaysOnly) return [];
    const all = collectAllLocated(tasksByDay);
    if (!filter) return all;
    return all.filter(t => taskMatchesFilters(t, filter));
  }, [tasksByDay, filter, holidaysOnly]);

  const holidaysByDay = useMemo(() => {
    if (!showHolidays) return new Map<string, string>();
    const from = getDayId(gridStart);
    const to = getDayId(gridEnd);
    const map = new Map<string, string>();
    for (const h of getChileHolidaysInRange(from, to)) {
      map.set(h.dayId, h.name);
    }
    return map;
  }, [showHolidays, gridStart.getTime(), gridEnd.getTime()]);

  function getSingleDayChips(date: Date): LocatedTask[] {
    const dayId = getDayId(date);
    const chips = collectTasksCovering(tasksByDay, dayId).filter(t => {
      if (filter && !taskMatchesFilters(t, filter)) return false;
      const end = t.endDayId || t.startDayId;
      return end === t.startDayId;
    });
    // Lista por celda: más temprano → más tarde; sin hora al final.
    return chips.sort(compareByStartTime);
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

  type BarDragMode = 'start' | 'end' | 'move';
  type BarDragSource = 'bar' | 'chip';
  /** Pixels of movement before a bar press becomes a drag (keeps double-click usable). */
  const BAR_DRAG_THRESHOLD_PX = 12;
  interface BarDragState {
    mode: BarDragMode;
    source: BarDragSource;
    task: Task;
    startWeekId: string;
    startDayId: string;
    endDayId: string;
    /** Day id under pointer at drag start (for move delta). */
    originPointerDayId: string;
    previewStart: string;
    previewEnd: string;
    pointerId: number;
    pointerX: number;
    pointerY: number;
  }
  /** Press that has not yet exceeded the movement threshold. */
  interface PendingBarPress {
    mode: BarDragMode;
    source: BarDragSource;
    bar: BarSegment;
    pointerId: number;
    originX: number;
    originY: number;
  }
  const [barDrag, setBarDrag] = useState<BarDragState | null>(null);
  const barDragRef = useRef<BarDragState | null>(null);
  barDragRef.current = barDrag;
  const pendingBarPressRef = useRef<PendingBarPress | null>(null);
  const calendarRootRef = useRef<HTMLDivElement>(null);
  /** After a real drag, ignore the trailing click that would open “añadir”. */
  const skipDayClickRef = useRef(false);

  function chipAsBar(loc: LocatedTask, col: number): BarSegment {
    return {
      task: loc,
      startDayId: loc.startDayId,
      startWeekId: loc.weekId,
      colStart: col,
      colSpan: 1,
      continuesLeft: false,
      continuesRight: false,
      lane: 0,
    };
  }

  /**
   * Resolve calendar day from screen point — works across week rows so you can
   * drag into the next week (next row) or previous week.
   */
  function dayIdFromPoint(clientX: number, clientY: number): string | null {
    const root = calendarRootRef.current;
    // Include sibling months in continuous view so a chip can land on another month.
    const canvas =
      root?.closest('[data-tour="calendar-canvas"]') ?? root ?? null;
    if (!canvas) return null;

    // Prefer the week row under the pointer (may be a different row than start).
    const stack = document.elementsFromPoint(clientX, clientY);
    let row: HTMLElement | null = null;
    for (const node of stack) {
      if (!(node instanceof HTMLElement)) continue;
      const hit = node.closest('[data-month-week-row]') as HTMLElement | null;
      if (hit && canvas.contains(hit)) {
        row = hit;
        break;
      }
    }

    // Fallback: nearest week row by vertical center.
    if (!row) {
      const rows = Array.from(
        canvas.querySelectorAll<HTMLElement>('[data-month-week-row]')
      );
      if (rows.length === 0) return null;
      let best: HTMLElement | null = null;
      let bestDist = Infinity;
      for (const r of rows) {
        const rect = r.getBoundingClientRect();
        const mid = (rect.top + rect.bottom) / 2;
        const dist = Math.abs(clientY - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = r;
        }
      }
      row = best;
    }
    if (!row) return null;

    const weekStart = row.dataset.weekStart;
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
    const rect = row.getBoundingClientRect();
    if (rect.width <= 0) return null;
    // Clamp X to row so vertical moves between rows keep a valid column.
    const x = Math.max(rect.left, Math.min(rect.right - 0.001, clientX));
    const rawCol = ((x - rect.left) / rect.width) * 7;
    const col = Math.max(0, Math.min(6, Math.floor(rawCol)));
    return format(addDays(parseISO(`${weekStart}T00:00:00`), col), 'yyyy-MM-dd');
  }

  function applyBarDragPoint(clientX: number, clientY: number) {
    const cur = barDragRef.current;
    if (!cur) return;
    const pointerDay = dayIdFromPoint(clientX, clientY);
    if (!pointerDay) {
      const next = { ...cur, pointerX: clientX, pointerY: clientY };
      barDragRef.current = next;
      setBarDrag(next);
      return;
    }

    let previewStart = cur.startDayId;
    let previewEnd = cur.endDayId;

    if (cur.mode === 'end') {
      previewEnd = pointerDay < cur.startDayId ? cur.startDayId : pointerDay;
    } else if (cur.mode === 'start') {
      previewStart = pointerDay > cur.endDayId ? cur.endDayId : pointerDay;
    } else {
      const delta = differenceInCalendarDays(
        parseISO(`${pointerDay}T00:00:00`),
        parseISO(`${cur.originPointerDayId}T00:00:00`)
      );
      const duration = differenceInCalendarDays(
        parseISO(`${cur.endDayId}T00:00:00`),
        parseISO(`${cur.startDayId}T00:00:00`)
      );
      previewStart = format(
        addDays(parseISO(`${cur.startDayId}T00:00:00`), delta),
        'yyyy-MM-dd'
      );
      previewEnd = format(
        addDays(parseISO(`${previewStart}T00:00:00`), duration),
        'yyyy-MM-dd'
      );
    }

    const next = {
      ...cur,
      previewStart,
      previewEnd,
      pointerX: clientX,
      pointerY: clientY,
    };
    barDragRef.current = next;
    setBarDrag(next);
  }

  function activateBarDrag(
    pending: PendingBarPress,
    clientX: number,
    clientY: number
  ) {
    const { mode, source, bar, pointerId, originX, originY } = pending;
    // Anchor move delta to the *press* day, not the threshold-crossing day.
    const originPointerDay =
      dayIdFromPoint(originX, originY) ?? bar.startDayId;
    const end = bar.task.endDayId || bar.startDayId;
    skipDayClickRef.current = true;
    const state: BarDragState = {
      mode,
      source,
      task: bar.task,
      startWeekId: bar.startWeekId,
      startDayId: bar.startDayId,
      endDayId: end,
      originPointerDayId: originPointerDay,
      previewStart: bar.startDayId,
      previewEnd: end,
      pointerId,
      pointerX: clientX,
      pointerY: clientY,
    };
    pendingBarPressRef.current = null;
    barDragRef.current = state;
    setBarDrag(state);
    // Apply current pointer so overshoot past threshold still updates preview.
    applyBarDragPoint(clientX, clientY);
  }

  /**
   * Start a *pending* press. Drag only activates after BAR_DRAG_THRESHOLD_PX
   * of movement so double-click can open the detail sheet.
   */
  function lockTextSelect() {
    document.documentElement.style.userSelect = 'none';
    document.body.style.userSelect = 'none';
    window.getSelection()?.removeAllRanges();
  }

  function unlockTextSelect() {
    document.documentElement.style.userSelect = '';
    document.body.style.userSelect = '';
  }

  function onBarPointerDown(
    e: React.PointerEvent,
    mode: BarDragMode,
    bar: BarSegment,
    source: BarDragSource = 'bar'
  ) {
    if (e.button !== 0) return;
    if (isBoardCreditTaskId(bar.task.id)) return;
    // Do not preventDefault here — that would cancel dblclick.
    e.stopPropagation();
    lockTextSelect();
    pendingBarPressRef.current = {
      mode,
      source,
      bar,
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
    };
  }

  // Pending press → activate drag past threshold (or cancel on release).
  useEffect(() => {
    function onMove(ev: PointerEvent) {
      const pending = pendingBarPressRef.current;
      if (!pending || ev.pointerId !== pending.pointerId) return;
      if (barDragRef.current) return;
      // Kill native text-selection from the first pixel, not only after threshold.
      ev.preventDefault();
      const dx = ev.clientX - pending.originX;
      const dy = ev.clientY - pending.originY;
      if (Math.hypot(dx, dy) < BAR_DRAG_THRESHOLD_PX) return;
      activateBarDrag(pending, ev.clientX, ev.clientY);
    }

    function onUp(ev: PointerEvent) {
      const pending = pendingBarPressRef.current;
      if (!pending || ev.pointerId !== pending.pointerId) return;
      // Released without crossing threshold → treat as click/dblclick, no drag.
      pendingBarPressRef.current = null;
      if (!barDragRef.current) unlockTextSelect();
    }

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Document-level listeners so the pointer can leave the original week row
  // and land on the next/previous week row while resizing or moving.
  useEffect(() => {
    if (!barDrag) return;

    function onMove(ev: PointerEvent) {
      const cur = barDragRef.current;
      if (!cur || ev.pointerId !== cur.pointerId) return;
      ev.preventDefault();
      applyBarDragPoint(ev.clientX, ev.clientY);
    }

    async function onUp(ev: PointerEvent) {
      const cur = barDragRef.current;
      if (!cur || ev.pointerId !== cur.pointerId) return;
      barDragRef.current = null;
      setBarDrag(null);
      unlockTextSelect();
      window.setTimeout(() => {
        skipDayClickRef.current = false;
      }, 0);
      if (
        cur.previewStart === cur.startDayId &&
        cur.previewEnd === cur.endDayId
      ) {
        return;
      }
      try {
        await rescheduleTaskSpan({
          task: cur.task,
          startWeekId: cur.startWeekId,
          startDayId: cur.startDayId,
          nextStartDayId: cur.previewStart,
          nextEndDayId: cur.previewEnd,
        });
      } catch {
        /* optimistic rollback handled by taskHistory */
      }
    }

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.body.style.cursor = prevCursor;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barDrag?.pointerId]);

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
        data-calendar-scroll={mode === 'single' ? 'true' : undefined}
        className={cn(
          'flex flex-col p-2 md:p-4',
          mode === 'single' ? 'flex-1 overflow-y-auto' : '',
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
          ref={calendarRootRef}
          className={cn(
            'flex flex-col gap-1',
            mode === 'single' ? 'flex-1 overflow-y-auto' : '',
            'select-none',
            barDrag && 'cursor-grabbing'
          )}
        >
          {weekRows.map((weekDates, rowIdx) => {
            const { bars, overflowByCol } = buildBarsForWeek(weekDates, located);
            const laneCount = Math.max(1, ...bars.map(b => b.lane + 1), 1);
            const weekStartId = getDayId(weekDates[0]);
            const weekEndId = getDayId(weekDates[6]);

            // Ghost segment when dragging a bar that intersects this week row
            // (incl. the next week when extending past Sunday).
            let ghost: {
              colStart: number;
              colSpan: number;
              lane: number;
              color: string;
              title: string;
            } | null = null;
            if (barDrag && barDrag.source !== 'chip') {
              const pStart = barDrag.previewStart;
              const pEnd = barDrag.previewEnd;
              if (pStart <= weekEndId && pEnd >= weekStartId) {
                const dayIndex = new Map(
                  weekDates.map((d, i) => [getDayId(d), i])
                );
                const clipStart =
                  pStart < weekStartId ? weekStartId : pStart;
                const clipEnd = pEnd > weekEndId ? weekEndId : pEnd;
                const cs = dayIndex.get(clipStart);
                const ce = dayIndex.get(clipEnd);
                if (cs !== undefined && ce !== undefined) {
                  const project = barDrag.task.projectId
                    ? allProjects.find(p => p.id === barDrag.task.projectId)
                    : null;
                  ghost = {
                    colStart: cs,
                    colSpan: ce - cs + 1,
                    lane: 0,
                    color:
                      barDrag.task.color ?? project?.color ?? '#58a6ff',
                    title: barDrag.task.title,
                  };
                }
              }
            }

            return (
              <div
                key={rowIdx}
                data-month-week-row
                data-week-start={weekStartId}
                className="relative grid min-h-[144px] grid-cols-7 gap-1"
              >
                {weekDates.map((date, col) => {
                  const inMonth = isSameMonth(date, cursor);
                  const isToday = getDayId(date) === todayDayId(settings.timezone);
                  const dayIdStr = getDayId(date);
                  const isDropTarget =
                    !!barDrag &&
                    dayIdStr >= barDrag.previewStart &&
                    dayIdStr <= barDrag.previewEnd;
                  const holidayName = holidaysByDay.get(dayIdStr) ?? null;
                  const chips = holidaysOnly ? [] : getSingleDayChips(date);
                  // Progreso del día ignora hideCompleted; chips/bars usan el filter completo.
                  const coveringForProgress = holidaysOnly
                    ? []
                    : collectTasksCovering(tasksByDay, dayIdStr).filter(t => {
                        if (!filter) return true;
                        return taskMatchesFilters(t, {
                          ...filter,
                          hideCompleted: false,
                        });
                      });
                  const completed = coveringForProgress.filter(
                    task => task.completed
                  ).length;
                  const total = coveringForProgress.length;
                  // Overflow only from multi-day bars that don't fit in lanes
                  const barOverflow = overflowByCol[col];

                  return (
                    <div
                      key={date.toISOString()}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (skipDayClickRef.current) return;
                        onPickDay(date);
                      }}
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
                      data-tour={isToday ? 'calendar-day' : undefined}
                      data-calendar-today={isToday ? 'true' : undefined}
                      className={cn(
                        'group relative flex h-[144px] select-none flex-col items-stretch gap-0.5 rounded-md border p-1.5 text-left transition-colors',
                        inMonth ? 'border-border bg-surface' : 'border-transparent bg-background opacity-50',
                        isToday && 'calendar-today-cell',
                        isDropTarget && 'border-accent-teal bg-accent-teal/15',
                        !isToday && !isDropTarget && 'hover:border-accent-teal/40'
                      )}
                    >
                      <div className="flex shrink-0 items-center justify-between gap-1">
                        <span className="flex min-w-0 items-center gap-1">
                          <span
                            className={cn(
                              'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums',
                              isToday ? 'calendar-today-num' : 'text-text-primary'
                            )}
                          >
                            {format(date, 'd')}
                          </span>
                          {isToday && (
                            <span className="truncate text-[9px] font-bold uppercase tracking-wide text-accent-teal">
                              {t('action_today')}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {total > 0 && (
                            <Badge
                              variant={completed === total ? 'green' : 'secondary'}
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {completed}/{total}
                            </Badge>
                          )}
                          {/* Affordance: añadir aunque el día esté lleno de chips */}
                          <span
                            className="flex h-4 w-4 items-center justify-center rounded text-[11px] font-bold leading-none text-text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                            aria-hidden
                            title={t('action_add_task')}
                          >
                            +
                          </span>
                        </div>
                      </div>

                      <div
                        className="shrink-0"
                        style={{ height: `${laneCount * MONTH_LANE_PX}px` }}
                        aria-hidden
                      />

                      {/*
                        No stopPropagation en el contenedor: un día con chips
                        debe seguir abriendo el alta al clicar el hueco vacío.
                        Cada chip sí detiene la propagación.
                      */}
                      <div
                        className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
                        onWheel={e => {
                          // Keep wheel scroll inside the day cell when the list overflows.
                          const el = e.currentTarget;
                          if (el.scrollHeight > el.clientHeight) {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {holidayName && (
                          <span
                            title={holidayName}
                            className={cn(
                              'truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-tight',
                              tintHoliday
                            )}
                          >
                            🇨🇱 {holidayName}
                          </span>
                        )}
                        {chips.map(task => {
                          const project = task.projectId
                            ? allProjects.find(p => p.id === task.projectId)
                            : null;
                          const timeLabel = chipTimeLabel(task);
                          const habit = isHabitKind(task.kind);
                          const draggingChip = barDrag?.task.id === task.id;
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
                              draggable={false}
                              onDragStart={e => e.preventDefault()}
                              onPointerDown={e => {
                                const target = e.target as HTMLElement | null;
                                if (target?.closest('button')) return;
                                onBarPointerDown(
                                  e,
                                  'move',
                                  chipAsBar(task, col),
                                  'chip'
                                );
                              }}
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
                                'flex select-none items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-tight transition-colors',
                                isBoardCreditTaskId(task.id)
                                  ? 'cursor-pointer'
                                  : 'cursor-grab active:cursor-grabbing',
                                task.completed
                                  ? isHabitQuit(task.kind)
                                    ? 'task-completed-title bg-red-500/10 text-text-muted line-through'
                                    : 'task-completed-title bg-accent-green/10 text-text-muted line-through'
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
                                  'ring-1 ring-accent-teal/20',
                                draggingChip && 'opacity-30'
                              )}
                              style={
                                !task.completed && (task.color || project)
                                  ? {
                                      borderLeft: `2px solid ${task.color || project!.color}`,
                                    }
                                  : undefined
                              }
                            >
                              <button
                                type="button"
                                className={cn(
                                  'flex h-4 w-4 shrink-0 items-center justify-center border transition-colors',
                                  habit ? 'rounded' : 'rounded-full',
                                  task.completed
                                    ? isHabitQuit(task.kind)
                                      ? 'border-red-500/70 bg-red-500/25 text-red-100'
                                      : 'border-accent-green bg-accent-green/25 text-accent-green'
                                    : habit && isHabitGood(task.kind)
                                      ? 'border-emerald-500/60 bg-background/80'
                                      : habit && isHabitQuit(task.kind)
                                        ? 'border-red-500/60 bg-background/80'
                                        : 'border-border bg-background/90 hover:border-accent-green'
                                )}
                                aria-label={
                                  habit
                                    ? task.completed
                                      ? t('habit_done')
                                      : t('habit_not_done')
                                    : task.completed
                                      ? 'Desmarcar'
                                      : 'Completar'
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
                                {task.completed && (
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                )}
                              </button>
                              <span className="min-w-0 flex-1 select-none truncate">
                                {!habit && task.kind === 'reminder' ? '🔔 ' : ''}
                                {!habit && task.recurrence.frequency !== 'none' ? '↻ ' : ''}
                                {habit && isHabitGood(task.kind) ? '🌱 ' : ''}
                                {habit && isHabitQuit(task.kind) ? '⊘ ' : ''}
                                {task.title}
                              </span>
                              {timeLabel && !habit && (
                                <span className="shrink-0 tabular-nums text-[10px] font-medium text-text-muted">
                                  {timeLabel}
                                </span>
                              )}
                            </span>
                          );
                        })}
                        {barDrag?.source === 'chip' &&
                          isDropTarget &&
                          dayIdStr === barDrag.previewStart &&
                          barDrag.startDayId !== barDrag.previewStart && (
                            <span
                              className="truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-text-primary ring-1 ring-accent-teal/50"
                              style={{
                                backgroundColor: `${
                                  barDrag.task.color ??
                                  allProjects.find(
                                    p => p.id === barDrag.task.projectId
                                  )?.color ??
                                  '#58a6ff'
                                }33`,
                              }}
                            >
                              {barDrag.task.title}
                            </span>
                          )}
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
                  className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-7 gap-1"
                  style={{ top: MONTH_DAY_HEAD_PX }}
                  aria-hidden={false}
                >
                  {bars.map(bar => {
                    const project = bar.task.projectId
                      ? allProjects.find(p => p.id === bar.task.projectId)
                      : null;
                    const color = bar.task.color ?? project?.color ?? '#58a6ff';
                    const draggingThis = barDrag?.task.id === bar.task.id;
                    // While dragging, the ghost segment (below) owns the live preview.
                    if (draggingThis) return null;
                    return (
                      <div
                        key={`${bar.task.id}-${bar.colStart}-${bar.lane}`}
                        title={
                          bar.task.startTime
                            ? `${bar.task.title} · ${chipTimeLabel(bar.task)}`
                            : bar.task.title
                        }
                        className={cn(
                          'pointer-events-auto absolute z-10 flex items-center gap-0.5 overflow-hidden rounded-md px-1 text-[10px] font-medium leading-none transition-opacity hover:opacity-90',
                          bar.task.completed && 'opacity-55',
                          bar.task.kind === 'possible_event' &&
                            !bar.task.completed &&
                            'opacity-60',
                          bar.continuesLeft && 'rounded-l-none',
                          bar.continuesRight && 'rounded-r-none'
                        )}
                        style={{
                          ...spanBarBox(bar.colStart, bar.colSpan, bar.lane),
                          backgroundColor: bar.task.completed
                            ? `${color}3d`
                            : `${color}a8`,
                          color: bar.task.completed
                            ? undefined
                            : inkOn(color),
                          boxShadow: `inset 0 0 0 1px ${color}66`,
                        }}
                      >
                        {/* Resize start */}
                        {!bar.continuesLeft && (
                          <span
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={t('task_start_date')}
                            className="absolute left-0 top-0 z-20 h-full w-2 cursor-ew-resize rounded-l bg-black/15 hover:bg-black/30"
                            onPointerDown={e => onBarPointerDown(e, 'start', bar)}
                          />
                        )}
                        <button
                          type="button"
                          className={cn(
                            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                            bar.task.completed
                              ? 'border-accent-green/80 bg-accent-green/40'
                              : 'border-black/30 bg-white/80 hover:border-accent-green'
                          )}
                          aria-label={
                            bar.task.completed ? 'Desmarcar' : 'Completar'
                          }
                          onClick={e => {
                            e.stopPropagation();
                            void handleToggleLocated({
                              task: bar.task,
                              startDayId: bar.startDayId,
                              startWeekId: bar.startWeekId,
                            });
                          }}
                        >
                          {bar.task.completed && (
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={cn(
                            'min-w-0 flex-1 cursor-grab select-none truncate text-left active:cursor-grabbing',
                            bar.task.completed && 'task-completed-title line-through'
                          )}
                          onClick={e => e.stopPropagation()}
                          onDoubleClick={e => {
                            e.stopPropagation();
                            e.preventDefault();
                            openDetail(
                              bar.startWeekId,
                              bar.startDayId,
                              bar.task.id
                            );
                          }}
                          onContextMenu={e =>
                            openCtx(
                              e,
                              bar.task,
                              bar.startWeekId,
                              bar.startDayId
                            )
                          }
                          onPointerDown={e => onBarPointerDown(e, 'move', bar)}
                        >
                          {bar.continuesLeft ? '‹ ' : ''}
                          {bar.task.recurrence.frequency !== 'none' ? '↻ ' : ''}
                          {bar.task.title}
                          {bar.continuesRight ? ' ›' : ''}
                          {bar.task.startTime ? (
                            <span className="ml-0.5 tabular-nums text-[9px] opacity-80">
                              {bar.task.startTime.slice(0, 5)}
                            </span>
                          ) : null}
                        </button>
                        {/* Resize end */}
                        {!bar.continuesRight && (
                          <span
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={t('task_end_date')}
                            className="absolute right-0 top-0 z-20 h-full w-2 cursor-ew-resize rounded-r bg-black/15 hover:bg-black/30"
                            onPointerDown={e => onBarPointerDown(e, 'end', bar)}
                          />
                        )}
                      </div>
                    );
                  })}
                  {/* Live ghost while dragging — visible on every week the preview covers */}
                  {ghost && (
                    <div
                      className="pointer-events-none absolute z-30 flex items-center overflow-hidden rounded-md px-1 text-[10px] font-medium leading-none ring-1 ring-white/50"
                      style={{
                        ...spanBarBox(ghost.colStart, ghost.colSpan, ghost.lane),
                        backgroundColor: `${ghost.color}b8`,
                        color: inkOn(ghost.color),
                      }}
                    >
                      <span className="truncate">{ghost.title}</span>
                    </div>
                  )}
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

      {barDrag &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[80] max-w-[200px] truncate rounded px-1.5 py-0.5 text-[10px] font-medium shadow-lg ring-1 ring-white/60"
            style={{
              left: barDrag.pointerX + 10,
              top: barDrag.pointerY + 10,
              backgroundColor: `${
                barDrag.task.color ??
                allProjects.find(p => p.id === barDrag.task.projectId)?.color ??
                '#58a6ff'
              }ee`,
              color: '#0d1117',
            }}
          >
            {barDrag.task.title}
          </div>,
          document.body
        )}
    </div>
  );
}
