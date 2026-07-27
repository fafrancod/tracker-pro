import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { useSettings } from '@/contexts/SettingsContext';
import { capitalize } from '@/lib/i18n';

export interface DateRangeFieldProps {
  startDayId: string;
  endDayId: string;
  onChange: (next: { startDayId: string; endDayId: string }) => void;
  /** When true, only end is editable (e.g. some locked contexts). */
  startReadOnly?: boolean;
  endReadOnly?: boolean;
  className?: string;
  /** Compact padding for week column form. */
  compact?: boolean;
  /** Show dual-thumb drag strip to set the range visually. */
  showDragStrip?: boolean;
}

function isDayId(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function clampDayId(dayId: string, min?: string, max?: string): string {
  let d = dayId;
  if (min && d < min) d = min;
  if (max && d > max) d = max;
  return d;
}

/**
 * Editable desde/hasta with weekday labels + mini calendar chips.
 * Dates are always inclusive (start ≤ end).
 */
export function DateRangeField({
  startDayId,
  endDayId,
  onChange,
  startReadOnly = false,
  endReadOnly = false,
  className,
  compact = false,
  showDragStrip = true,
}: DateRangeFieldProps) {
  const { t, locale, shortDateFormat } = useT();
  const { settings } = useSettings();
  const weekStartsOn = settings.weekStartsOnMonday ? 1 : 0;

  const safeStart = isDayId(startDayId)
    ? startDayId
    : format(new Date(), 'yyyy-MM-dd');
  const safeEnd =
    isDayId(endDayId) && endDayId >= safeStart ? endDayId : safeStart;

  const [pickerCursor, setPickerCursor] = useState(() =>
    startOfWeek(parseISO(`${safeStart}T00:00:00`), { weekStartsOn })
  );
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);

  // Keep cursor near selected range when it jumps far.
  useEffect(() => {
    const target = parseISO(`${safeStart}T00:00:00`);
    setPickerCursor(prev => {
      const curEnd = addDays(prev, 20);
      if (target < prev || target > curEnd) {
        return startOfWeek(target, { weekStartsOn });
      }
      return prev;
    });
  }, [safeStart, weekStartsOn]);

  const chipDays = useMemo(() => {
    // 3 weeks of chips for clearer weekday + day-month selection
    return Array.from({ length: 21 }, (_, i) => addDays(pickerCursor, i));
  }, [pickerCursor]);

  const strip = useMemo(() => {
    const start = parseISO(`${safeStart}T00:00:00`);
    const end = parseISO(`${safeEnd}T00:00:00`);
    const windowStart = addDays(start, -10);
    const windowEnd = addDays(end, 10);
    const days = Math.max(
      21,
      differenceInCalendarDays(windowEnd, windowStart) + 1
    );
    return {
      origin: windowStart,
      days,
    };
  }, [safeStart, safeEnd]);

  const startOffset = Math.max(
    0,
    Math.min(
      strip.days - 1,
      differenceInCalendarDays(parseISO(`${safeStart}T00:00:00`), strip.origin)
    )
  );
  const endOffset = Math.max(
    startOffset,
    Math.min(
      strip.days - 1,
      differenceInCalendarDays(parseISO(`${safeEnd}T00:00:00`), strip.origin)
    )
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const dayFromClientX = useCallback(
    (clientX: number): string => {
      const el = trackRef.current;
      if (!el) return safeStart;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const idx = Math.round(ratio * (strip.days - 1));
      return format(addDays(strip.origin, idx), 'yyyy-MM-dd');
    },
    [safeStart, strip.days, strip.origin]
  );

  function setStart(next: string) {
    if (!isDayId(next) || startReadOnly) return;
    const end = safeEnd < next ? next : safeEnd;
    onChange({ startDayId: next, endDayId: end });
  }

  function setEnd(next: string) {
    if (!isDayId(next) || endReadOnly) return;
    const end = next < safeStart ? safeStart : next;
    onChange({ startDayId: safeStart, endDayId: end });
  }

  function pickDay(dayId: string) {
    if (picking === 'end' || endReadOnly) {
      setEnd(dayId);
      setPicking(null);
      return;
    }
    if (picking === 'start' || startReadOnly) {
      setStart(dayId);
      setPicking(picking === 'start' ? 'end' : null);
      return;
    }
    // Default: if click before start → set start; else set end (or start if single)
    if (dayId < safeStart || (safeStart === safeEnd && dayId === safeStart)) {
      setStart(dayId);
    } else if (dayId >= safeStart) {
      setEnd(dayId);
    }
  }

  function onPointerDown(which: 'start' | 'end', e: React.PointerEvent) {
    if (which === 'start' && startReadOnly) return;
    if (which === 'end' && endReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(which);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const day = dayFromClientX(e.clientX);
    if (dragging === 'start') {
      const end = day > safeEnd ? day : safeEnd;
      onChange({ startDayId: day, endDayId: end });
    } else {
      const end = day < safeStart ? safeStart : day;
      onChange({ startDayId: safeStart, endDayId: end });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setDragging(null);
  }

  const leftPct = (startOffset / Math.max(1, strip.days - 1)) * 100;
  const widthPct =
    ((endOffset - startOffset) / Math.max(1, strip.days - 1)) * 100;

  function formatChipLabel(d: Date): { weekday: string; dayMonth: string } {
    return {
      weekday: capitalize(format(d, 'EEE', { locale })),
      dayMonth: format(d, shortDateFormat.includes('M') ? 'd MMM' : 'd MMM', {
        locale,
      }),
    };
  }

  function formatSelected(dayId: string): string {
    const d = parseISO(`${dayId}T00:00:00`);
    return capitalize(
      format(d, `EEE ${shortDateFormat.includes('yyyy') ? shortDateFormat : 'd MMM'}`, {
        locale,
      })
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-background/50',
        compact ? 'space-y-2 px-2 py-1.5' : 'space-y-2.5 px-3 py-3',
        className
      )}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-text-muted">
          <span className="inline-flex items-center gap-1 font-medium uppercase tracking-wide">
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            {t('task_start_date')}
          </span>
          <button
            type="button"
            disabled={startReadOnly}
            onClick={() => setPicking(p => (p === 'start' ? null : 'start'))}
            className={cn(
              'rounded-lg border border-border bg-background px-2 py-1.5 text-left text-xs font-medium text-text-primary',
              picking === 'start' && 'ring-1 ring-accent-teal',
              startReadOnly && 'opacity-80'
            )}
          >
            {formatSelected(safeStart)}
          </button>
          <input
            type="date"
            value={safeStart}
            readOnly={startReadOnly}
            onChange={e => setStart(e.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-text-muted">
          <span className="inline-flex items-center gap-1 font-medium uppercase tracking-wide">
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            {t('task_end_date')}
          </span>
          <button
            type="button"
            disabled={endReadOnly}
            onClick={() => setPicking(p => (p === 'end' ? null : 'end'))}
            className={cn(
              'rounded-lg border border-border bg-background px-2 py-1.5 text-left text-xs font-medium text-text-primary',
              picking === 'end' && 'ring-1 ring-accent-teal',
              endReadOnly && 'opacity-80'
            )}
          >
            {formatSelected(safeEnd)}
          </button>
          <input
            type="date"
            value={safeEnd}
            min={safeStart}
            readOnly={endReadOnly}
            onChange={e => setEnd(e.target.value || safeStart)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        </label>
      </div>

      {/* Weekday + day-month chips (3 weeks) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-text-muted">
            {picking === 'start'
              ? t('task_date_pick_start')
              : picking === 'end'
                ? t('task_date_pick_end')
                : t('task_date_pick_range')}
          </p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rounded p-1 text-text-muted hover:bg-background hover:text-text-primary"
              onClick={() => setPickerCursor(c => addDays(c, -7))}
              aria-label={t('board_prev_week')}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-text-muted hover:bg-background hover:text-text-primary"
              onClick={() => setPickerCursor(c => addDays(c, 7))}
              aria-label={t('board_next_week')}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {chipDays.map(d => {
            const dayId = format(d, 'yyyy-MM-dd');
            const { weekday, dayMonth } = formatChipLabel(d);
            const inRange = dayId >= safeStart && dayId <= safeEnd;
            const isEdge = dayId === safeStart || dayId === safeEnd;
            return (
              <button
                key={dayId}
                type="button"
                onClick={() => pickDay(dayId)}
                title={formatSelected(dayId)}
                className={cn(
                  'flex flex-col items-center rounded-md border px-0.5 py-1 transition-colors',
                  isEdge
                    ? 'border-accent-teal bg-accent-teal/20 text-accent-teal'
                    : inRange
                      ? 'border-accent-teal/30 bg-accent-teal/10 text-text-primary'
                      : 'border-border/60 bg-background text-text-muted hover:border-border hover:text-text-primary'
                )}
              >
                <span className="text-[9px] font-semibold uppercase leading-none">
                  {weekday}
                </span>
                <span className="mt-0.5 text-[10px] tabular-nums leading-tight">
                  {dayMonth}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {showDragStrip && !startReadOnly && !endReadOnly && (
        <div className="space-y-1">
          <p className="text-[10px] text-text-muted">
            {t('task_date_range_drag_hint')}
          </p>
          <div
            ref={trackRef}
            className="relative h-8 select-none rounded-lg bg-border/40 px-1"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-accent-teal/50"
              style={{
                left: `calc(${leftPct}% )`,
                width: `max(8px, ${widthPct}%)`,
              }}
            />
            <button
              type="button"
              aria-label={t('task_start_date')}
              className={cn(
                'absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-accent-teal bg-background shadow',
                dragging === 'start' && 'scale-110 ring-2 ring-accent-teal/40'
              )}
              style={{ left: `${leftPct}%` }}
              onPointerDown={e => onPointerDown('start', e)}
            />
            <button
              type="button"
              aria-label={t('task_end_date')}
              className={cn(
                'absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-accent-teal bg-background shadow',
                dragging === 'end' && 'scale-110 ring-2 ring-accent-teal/40'
              )}
              style={{ left: `${leftPct + widthPct}%` }}
              onPointerDown={e => onPointerDown('end', e)}
            />
          </div>
          <p className="text-center text-[10px] tabular-nums text-text-muted">
            {formatSelected(safeStart)}
            {safeEnd > safeStart ? ` → ${formatSelected(safeEnd)}` : ''}
            {safeEnd > safeStart
              ? ` · ${
                  differenceInCalendarDays(
                    parseISO(`${safeEnd}T00:00:00`),
                    parseISO(`${safeStart}T00:00:00`)
                  ) + 1
                } d`
              : ''}
          </p>
        </div>
      )}
    </div>
  );
}

/** Utility re-export for board resize math. */
export function clampDayRange(
  startDayId: string,
  endDayId: string
): { startDayId: string; endDayId: string } {
  const s = isDayId(startDayId) ? startDayId : format(new Date(), 'yyyy-MM-dd');
  const e = isDayId(endDayId) ? endDayId : s;
  if (e < s) return { startDayId: e, endDayId: s };
  return { startDayId: s, endDayId: e };
}

export { clampDayId };
