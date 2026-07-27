import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { useSettings } from '@/contexts/SettingsContext';
import { capitalize } from '@/lib/i18n';

export interface DateRangeFieldProps {
  startDayId: string;
  endDayId: string;
  onChange: (next: { startDayId: string; endDayId: string }) => void;
  startReadOnly?: boolean;
  endReadOnly?: boolean;
  className?: string;
  compact?: boolean;
  /** @deprecated API compat */
  showDragStrip?: boolean;
}

function isDayId(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toDayId(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/**
 * Selector de fechas estilo aerolínea:
 * - Dos tarjetas Desde / Hasta
 * - Calendario emergente con resaltado de rango
 * - Modo "un solo día" limpio cuando inicio = fin
 */
export function DateRangeField({
  startDayId,
  endDayId,
  onChange,
  startReadOnly = false,
  endReadOnly = false,
  className,
  compact = false,
}: DateRangeFieldProps) {
  const { t, locale } = useT();
  const { settings } = useSettings();
  const weekStartsOn = settings.weekStartsOnMonday ? 1 : 0;

  const safeStart = isDayId(startDayId)
    ? startDayId
    : toDayId(new Date());
  const safeEnd =
    isDayId(endDayId) && endDayId >= safeStart ? endDayId : safeStart;
  const isSingleDay = safeStart === safeEnd;
  const spanDays =
    differenceInCalendarDays(
      parseISO(`${safeEnd}T00:00:00`),
      parseISO(`${safeStart}T00:00:00`)
    ) + 1;

  const [open, setOpen] = useState(false);
  /** Which field opened the panel; drives first click target. */
  const [focusField, setFocusField] = useState<'start' | 'end'>('start');
  /**
   * Airline flow: first click = start, second = end.
   * When selectingStart is true, next day click sets start (and clears end to same).
   */
  const [selectingStart, setSelectingStart] = useState(true);
  const [monthCursor, setMonthCursor] = useState(() =>
    startOfMonth(parseISO(`${safeStart}T00:00:00`))
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setMonthCursor(startOfMonth(parseISO(`${safeStart}T00:00:00`)));
    setSelectingStart(focusField === 'start');
  }, [open, focusField, safeStart]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const weekHeaders = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) =>
      capitalize(format(addDays(base, i), 'EEEEEE', { locale }))
    );
  }, [weekStartsOn, locale]);

  const monthCells = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const monthEnd = endOfMonth(monthCursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
    const cells: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      cells.push(d);
      d = addDays(d, 1);
    }
    return cells;
  }, [monthCursor, weekStartsOn]);

  function openPanel(field: 'start' | 'end') {
    if (field === 'start' && startReadOnly) return;
    if (field === 'end' && endReadOnly) return;
    setFocusField(field);
    setOpen(true);
  }

  function applySingle(dayId: string) {
    onChange({ startDayId: dayId, endDayId: dayId });
  }

  function onDayClick(dayId: string) {
    if (endReadOnly && startReadOnly) return;

    // Solo un día forzado (p. ej. hábitos): siempre single
    if (endReadOnly) {
      if (!startReadOnly) applySingle(dayId);
      return;
    }

    if (selectingStart || startReadOnly) {
      // Primera fecha: inicio (y hasta = mismo día hasta elegir fin)
      if (!startReadOnly) {
        onChange({ startDayId: dayId, endDayId: dayId });
      }
      setSelectingStart(false);
      return;
    }

    // Segunda fecha: fin de rango (o re-inicio si es anterior)
    if (dayId < safeStart) {
      onChange({ startDayId: dayId, endDayId: dayId });
      setSelectingStart(false);
      return;
    }
    onChange({ startDayId: safeStart, endDayId: dayId });
    // Tras completar el rango, siguiente clic reinicia el flujo (como aerolíneas)
    setSelectingStart(true);
  }

  function setSingleDayMode() {
    onChange({ startDayId: safeStart, endDayId: safeStart });
    setSelectingStart(true);
  }

  function formatCardDate(dayId: string): { weekday: string; main: string } {
    const d = parseISO(`${dayId}T00:00:00`);
    return {
      weekday: capitalize(format(d, 'EEEE', { locale })),
      main: capitalize(format(d, 'd MMM yyyy', { locale })),
    };
  }

  const startCard = formatCardDate(safeStart);
  const endCard = formatCardDate(safeEnd);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {/* Tarjetas estilo aerolínea */}
      <div
        className={cn(
          'grid gap-2',
          isSingleDay ? 'grid-cols-1 sm:grid-cols-[1fr_auto]' : 'grid-cols-2'
        )}
      >
        <DateCard
          label={t('task_start_date')}
          weekday={startCard.weekday}
          main={startCard.main}
          active={open && (selectingStart || focusField === 'start')}
          dimmed={false}
          compact={compact}
          onClick={() => openPanel('start')}
          disabled={startReadOnly}
        />

        {!isSingleDay && (
          <DateCard
            label={t('task_end_date')}
            weekday={endCard.weekday}
            main={endCard.main}
            active={open && !selectingStart}
            dimmed={false}
            compact={compact}
            onClick={() => openPanel('end')}
            disabled={endReadOnly}
          />
        )}

        {isSingleDay && !endReadOnly && (
          <button
            type="button"
            onClick={() => {
              openPanel('end');
              setSelectingStart(false);
            }}
            className={cn(
              'flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 px-3 text-xs font-medium text-text-muted transition-colors hover:border-accent-teal/50 hover:text-accent-teal',
              compact ? 'min-h-[3.25rem]' : 'min-h-[4.25rem]'
            )}
          >
            <CalendarDays className="h-4 w-4" />
            {t('task_date_add_end')}
          </button>
        )}
      </div>

      {/* Badge estado */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isSingleDay ? (
          <span className="inline-flex items-center rounded-full bg-accent-teal/12 px-2.5 py-0.5 text-[11px] font-semibold text-accent-teal">
            {t('task_date_single_day')}
          </span>
        ) : (
          <>
            <span className="inline-flex items-center rounded-full bg-accent-teal/12 px-2.5 py-0.5 text-[11px] font-semibold text-accent-teal">
              {t('task_date_n_days').replace('{n}', String(spanDays))}
            </span>
            {!endReadOnly && (
              <button
                type="button"
                onClick={setSingleDayMode}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted hover:border-accent-teal/40 hover:text-accent-teal"
              >
                <X className="h-3 w-3" />
                {t('task_date_make_single')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Panel calendario (popover) */}
      {open && (
        <div
          className={cn(
            'absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl shadow-black/25',
            'animate-in fade-in-0 zoom-in-95'
          )}
        >
          {/* Header mes */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <button
              type="button"
              className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
              onClick={() => setMonthCursor(m => addMonths(m, -1))}
              aria-label={t('board_prev_week')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold capitalize text-text-primary">
              {format(monthCursor, 'MMMM yyyy', { locale })}
            </p>
            <button
              type="button"
              className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
              onClick={() => setMonthCursor(m => addMonths(m, 1))}
              aria-label={t('board_next_week')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3">
            {/* Hint de flujo */}
            <p className="mb-2 text-center text-[11px] text-text-muted">
              {selectingStart
                ? t('task_date_pick_start')
                : t('task_date_pick_end')}
            </p>

            {/* Cabecera días semana */}
            <div className="mb-1 grid grid-cols-7 gap-0.5">
              {weekHeaders.map(h => (
                <div
                  key={h}
                  className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Días */}
            <div className="grid grid-cols-7 gap-0.5">
              {monthCells.map(d => {
                const dayId = toDayId(d);
                const inMonth = isSameMonth(d, monthCursor);
                const isStart = dayId === safeStart;
                const isEnd = dayId === safeEnd;
                const inRange =
                  !isSingleDay && dayId > safeStart && dayId < safeEnd;
                const isToday = isSameDay(d, new Date());
                const isEdge = isStart || isEnd;

                return (
                  <button
                    key={dayId}
                    type="button"
                    disabled={!inMonth && false}
                    onClick={() => onDayClick(dayId)}
                    className={cn(
                      'relative flex h-9 items-center justify-center text-xs font-medium transition-colors',
                      // Rango intermedio: franja continua
                      inRange && 'bg-accent-teal/15 text-text-primary',
                      isStart &&
                        !isSingleDay &&
                        'rounded-l-full bg-accent-teal/15',
                      isEnd &&
                        !isSingleDay &&
                        !isStart &&
                        'rounded-r-full bg-accent-teal/15',
                      // Un solo día / extremos: círculo sólido
                      isEdge &&
                        'z-[1] font-semibold text-white after:absolute after:inset-0.5 after:-z-[1] after:rounded-full after:bg-accent-teal',
                      !inMonth && 'opacity-35',
                      !isEdge &&
                        !inRange &&
                        inMonth &&
                        'rounded-full text-text-primary hover:bg-background',
                      isToday &&
                        !isEdge &&
                        'ring-1 ring-inset ring-accent-teal/50'
                    )}
                  >
                    <span className="relative z-[1]">{format(d, 'd')}</span>
                  </button>
                );
              })}
            </div>

            {/* Footer acciones */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <button
                type="button"
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-text-muted hover:bg-background hover:text-text-primary"
                onClick={() => {
                  const today = toDayId(new Date());
                  applySingle(today);
                  setSelectingStart(true);
                  setMonthCursor(startOfMonth(new Date()));
                }}
              >
                {t('task_date_today')}
              </button>
              <div className="flex items-center gap-2">
                {!isSingleDay && !endReadOnly && (
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-text-muted hover:bg-background hover:text-accent-teal"
                    onClick={setSingleDayMode}
                  >
                    {t('task_date_make_single')}
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-lg bg-accent-teal/15 px-3 py-1.5 text-[11px] font-semibold text-accent-teal hover:bg-accent-teal/25"
                  onClick={() => setOpen(false)}
                >
                  {t('task_date_done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DateCard({
  label,
  weekday,
  main,
  active,
  dimmed,
  compact,
  onClick,
  disabled,
}: {
  label: string;
  weekday: string;
  main: string;
  active: boolean;
  dimmed: boolean;
  compact: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col items-start rounded-2xl border px-3 text-left transition-all',
        compact ? 'min-h-[3.25rem] py-2' : 'min-h-[4.25rem] py-2.5',
        active
          ? 'border-accent-teal bg-accent-teal/10 shadow-sm ring-1 ring-accent-teal/30'
          : 'border-border bg-background hover:border-accent-teal/40 hover:bg-surface/60',
        disabled && 'cursor-default opacity-80 hover:border-border hover:bg-background',
        dimmed && 'opacity-60'
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span
        className={cn(
          'mt-0.5 font-bold leading-tight text-text-primary',
          compact ? 'text-sm' : 'text-base'
        )}
      >
        {main}
      </span>
      <span className="text-[11px] capitalize text-text-muted">{weekday}</span>
    </button>
  );
}

/** Utility re-export for board resize math. */
export function clampDayRange(
  startDayId: string,
  endDayId: string
): { startDayId: string; endDayId: string } {
  const s = isDayId(startDayId) ? startDayId : toDayId(new Date());
  const e = isDayId(endDayId) ? endDayId : s;
  if (e < s) return { startDayId: e, endDayId: s };
  return { startDayId: s, endDayId: e };
}

export function clampDayId(dayId: string, min?: string, max?: string): string {
  let d = dayId;
  if (min && d < min) d = min;
  if (max && d > max) d = max;
  return d;
}
