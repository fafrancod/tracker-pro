import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useStore } from '@core/store';
import { fetchTasksInRange, getDayId } from '@core/services/taskService';
import { isDemoMode } from '@core/lib/demoMode';
import { mergeDayTaskLists } from '@core/lib/mergeDayTasks';
import type { BoardTaskFilters, Task } from '@core/types';
import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import { capitalize } from '@/lib/i18n';
import { MonthView } from './MonthView';

interface ContinuousMonthsViewProps {
  onPickDay: (date: Date) => void;
  onViewDay?: (date: Date) => void;
  filter?: BoardTaskFilters;
  /** Increment to reset range and scroll to the current month. */
  focusTodayNonce?: number;
}

/** Inclusive month offsets relative to "today" month. Start: current-2 .. current+2 */
const INITIAL_PAST = 2;
const INITIAL_FUTURE = 2;
const LOAD_CHUNK = 2;
const EDGE_PX = 160;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function ContinuousMonthsView({
  onPickDay,
  onViewDay,
  filter,
  focusTodayNonce = 0,
}: ContinuousMonthsViewProps) {
  const { settings } = useSettings();
  const { locale } = useT();
  const weekStartsOn = settings.weekStartsOnMonday ? 1 : 0;
  const uid = useStore(s => s.uid);
  const setDayTasks = useStore(s => s.setDayTasks);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  // Anchor once per mount so offsets stay stable while scrolling.
  const todayMonth = useMemo(() => startOfMonth(new Date()), []);

  const [fromOffset, setFromOffset] = useState(-INITIAL_PAST);
  const [toOffset, setToOffset] = useState(INITIAL_FUTURE);

  const dayHeaders = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) =>
      capitalize(format(addDays(start, i), 'EEE', { locale }))
    );
  }, [weekStartsOn, locale]);

  const scrollToCurrentMonth = useCallback(() => {
    const key = monthKey(startOfMonth(new Date()));
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const el = scroller.querySelector(
        `[data-month-key="${key}"]`
      ) as HTMLElement | null;
      if (!el) return;
      // Scroll solo dentro del contenedor (no usa scrollIntoView del viewport,
      // que a veces metía el mes bajo la barra de filtros del board).
      const elTop = el.getBoundingClientRect().top;
      const scrollerTop = scroller.getBoundingClientRect().top;
      const next = scroller.scrollTop + (elTop - scrollerTop);
      scroller.scrollTo({ top: Math.max(0, next), behavior: 'smooth' });
    });
  }, []);

  // On first paint, land on the current month (not the oldest preloaded).
  useEffect(() => {
    scrollToCurrentMonth();
  }, [scrollToCurrentMonth]);

  // Parent «Ir al mes de hoy» / change view.
  useEffect(() => {
    if (!focusTodayNonce) return;
    setFromOffset(-INITIAL_PAST);
    setToOffset(INITIAL_FUTURE);
    // Wait for DOM after offset reset
    requestAnimationFrame(() => scrollToCurrentMonth());
  }, [focusTodayNonce, scrollToCurrentMonth]);

  const months = useMemo(() => {
    const list: Date[] = [];
    for (let o = fromOffset; o <= toOffset; o++) {
      list.push(addMonths(todayMonth, o));
    }
    return list;
  }, [fromOffset, toOffset, todayMonth]);

  const rangeBounds = useMemo(() => {
    const first = months[0];
    const last = months[months.length - 1];
    const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn });
    const gridEnd = endOfWeek(endOfMonth(last), { weekStartsOn });
    return { fromDayId: getDayId(gridStart), toDayId: getDayId(gridEnd) };
  }, [months, weekStartsOn]);

  // Fetch all tasks covering the continuous visible range once per bounds change.
  useEffect(() => {
    if (!uid || isDemoMode()) return;
    let cancelled = false;
    void fetchTasksInRange(uid, rangeBounds.fromDayId, rangeBounds.toDayId).then(rows => {
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
    });
    return () => {
      cancelled = true;
    };
  }, [uid, rangeBounds.fromDayId, rangeBounds.toDayId, setDayTasks]);

  const prepend = useCallback(() => {
    if (loadingMore.current) return;
    loadingMore.current = true;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setFromOffset(o => o - LOAD_CHUNK);
    // Preserve scroll position after prepending
    requestAnimationFrame(() => {
      if (el) {
        const delta = el.scrollHeight - prevHeight;
        el.scrollTop += delta;
      }
      loadingMore.current = false;
    });
  }, []);

  const append = useCallback(() => {
    if (loadingMore.current) return;
    loadingMore.current = true;
    setToOffset(o => o + LOAD_CHUNK);
    requestAnimationFrame(() => {
      loadingMore.current = false;
    });
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || loadingMore.current) return;
    if (el.scrollTop < EDGE_PX) {
      prepend();
    } else if (el.scrollHeight - el.scrollTop - el.clientHeight < EDGE_PX) {
      append();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/*
        Franja fija de días de la semana: queda SIEMPRE bajo los combobox del board
        y por encima del scroll de meses (no se tapa al desplazar).
      */}
      <div className="z-10 shrink-0 border-b border-border bg-background px-2 pb-1.5 pt-2 md:px-4">
        <div className="grid grid-cols-7 gap-1">
          {dayHeaders.map(h => (
            <div
              key={h}
              className="text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted"
            >
              {h}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {months.map(m => (
          <div
            key={monthKey(m)}
            data-month-key={monthKey(m)}
            className="border-b border-border last:border-b-0"
          >
            <MonthView
              onPickDay={onPickDay}
              onViewDay={onViewDay}
              mode="continuous"
              monthDate={m}
              hideChrome
              hideDayHeaders
              filter={filter}
              skipFetch
            />
          </div>
        ))}
      </div>
    </div>
  );
}
