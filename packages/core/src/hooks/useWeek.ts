import { useCallback } from 'react';
import { addWeeks, subWeeks, startOfISOWeek, addDays, format } from 'date-fns';
import type { Locale } from 'date-fns/locale';
import { useStore } from '../store';
import { getWeekId, getDayId } from '../services/taskService';
import { todayCivilDate, todayDayId } from '../lib/civilDate';

function parsWeekId(weekId: string): Date {
  const [yearStr, weekStr] = weekId.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  // Get first day of week 1
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = startOfISOWeek(jan4);
  return addDays(startOfWeek1, (week - 1) * 7);
}

export interface UseWeekOptions {
  locale?: Locale;
  weekdayFormat?: string;
  shortDateFormat?: string;
  /** IANA zone for «today» (calendar + goToday). */
  timezone?: string | null;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function useWeek(opts: UseWeekOptions = {}) {
  const currentWeekId = useStore(s => s.currentWeekId);
  const setCurrentWeek = useStore(s => s.setCurrentWeek);
  const setSelectedDay = useStore(s => s.setSelectedDay);

  const weekStart = parsWeekId(currentWeekId);
  const { locale, weekdayFormat = 'EEE', shortDateFormat = 'MMM d', timezone } =
    opts;

  // Mon–Sun array
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      date: d,
      dayId: getDayId(d),
      label: capitalize(format(d, weekdayFormat, { locale })),
      dateLabel: capitalize(format(d, shortDateFormat, { locale })),
    };
  });

  const goNextWeek = useCallback(() => {
    const next = addWeeks(weekStart, 1);
    setCurrentWeek(getWeekId(next));
  }, [weekStart, setCurrentWeek]);

  const goPrevWeek = useCallback(() => {
    const prev = subWeeks(weekStart, 1);
    setCurrentWeek(getWeekId(prev));
  }, [weekStart, setCurrentWeek]);

  const goToday = useCallback(() => {
    const civil = todayCivilDate(timezone);
    setCurrentWeek(getWeekId(civil));
    setSelectedDay(getDayId(civil));
  }, [setCurrentWeek, setSelectedDay, timezone]);

  const nextWeekId = getWeekId(addWeeks(weekStart, 1));
  const todayId = todayDayId(timezone);
  const isCurrentWeek = currentWeekId === getWeekId(todayCivilDate(timezone));

  return {
    currentWeekId,
    weekStart,
    days,
    nextWeekId,
    todayDayId: todayId,
    isCurrentWeek,
    goNextWeek,
    goPrevWeek,
    goToday,
  };
}
