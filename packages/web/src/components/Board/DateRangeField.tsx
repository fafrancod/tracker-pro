import { useCallback, useMemo, useRef, useState } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
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
  /** @deprecated Kept for API compat; strip is always shown as the center range. */
  showDragStrip?: boolean;
}

function isDayId(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Rango de fechas: cuadrados inicio/fin (día semana + día-mes) a los lados
 * del tramo central arrastrable. Sin calendario extra encima.
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

  const safeStart = isDayId(startDayId)
    ? startDayId
    : format(new Date(), 'yyyy-MM-dd');
  const safeEnd =
    isDayId(endDayId) && endDayId >= safeStart ? endDayId : safeStart;

  const spanDays =
    differenceInCalendarDays(
      parseISO(`${safeEnd}T00:00:00`),
      parseISO(`${safeStart}T00:00:00`)
    ) + 1;

  // Strip window around the range for thumb positions
  const strip = useMemo(() => {
    const start = parseISO(`${safeStart}T00:00:00`);
    const end = parseISO(`${safeEnd}T00:00:00`);
    const pad = Math.max(7, Math.ceil(spanDays / 2) + 3);
    const windowStart = addDays(start, -pad);
    const windowEnd = addDays(end, pad);
    const days = Math.max(
      14,
      differenceInCalendarDays(windowEnd, windowStart) + 1
    );
    return { origin: windowStart, days };
  }, [safeStart, safeEnd, spanDays]);

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

  function nudgeStart(delta: number) {
    if (startReadOnly) return;
    const next = format(
      addDays(parseISO(`${safeStart}T00:00:00`), delta),
      'yyyy-MM-dd'
    );
    setStart(next);
  }

  function nudgeEnd(delta: number) {
    if (endReadOnly) return;
    const next = format(
      addDays(parseISO(`${safeEnd}T00:00:00`), delta),
      'yyyy-MM-dd'
    );
    setEnd(next);
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

  function dayParts(dayId: string): { weekday: string; dayMonth: string } {
    const d = parseISO(`${dayId}T00:00:00`);
    return {
      weekday: capitalize(format(d, 'EEE', { locale })),
      dayMonth: format(d, 'd MMM', { locale }),
    };
  }

  const startParts = dayParts(safeStart);
  const endParts = dayParts(safeEnd);

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-background/40',
        compact ? 'px-2 py-2' : 'px-3 py-3',
        className
      )}
    >
      {/* [inicio] ─── rango ─── [fin] */}
      <div className="flex items-center gap-2">
        <DaySquare
          label={t('task_start_date')}
          weekday={startParts.weekday}
          dayMonth={startParts.dayMonth}
          readOnly={startReadOnly}
          active={dragging === 'start'}
          value={safeStart}
          onDateChange={setStart}
          onNudge={nudgeStart}
          compact={compact}
        />

        <div className="min-w-0 flex-1 space-y-1">
          <div
            ref={trackRef}
            className={cn(
              'relative select-none rounded-full bg-border/50',
              compact ? 'h-7' : 'h-9'
            )}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* filled range between ends */}
            <div
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-accent-teal/55"
              style={{
                left: `calc(${leftPct}%)`,
                width: `max(10px, ${widthPct}%)`,
              }}
            />
            {/* start thumb */}
            {!startReadOnly && (
              <button
                type="button"
                aria-label={t('task_start_date')}
                className={cn(
                  'absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-md border-2 border-accent-teal bg-background shadow',
                  compact ? 'h-5 w-3' : 'h-6 w-3.5',
                  dragging === 'start' && 'scale-110 ring-2 ring-accent-teal/40'
                )}
                style={{ left: `${leftPct}%` }}
                onPointerDown={e => onPointerDown('start', e)}
              />
            )}
            {/* end thumb */}
            {!endReadOnly && (
              <button
                type="button"
                aria-label={t('task_end_date')}
                className={cn(
                  'absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-md border-2 border-accent-teal bg-background shadow',
                  compact ? 'h-5 w-3' : 'h-6 w-3.5',
                  dragging === 'end' && 'scale-110 ring-2 ring-accent-teal/40'
                )}
                style={{ left: `${leftPct + widthPct}%` }}
                onPointerDown={e => onPointerDown('end', e)}
              />
            )}
          </div>
          <p className="text-center text-[10px] tabular-nums text-text-muted">
            {spanDays > 1
              ? `${spanDays} d`
              : t('task_end_date') === t('task_start_date')
                ? '1 d'
                : '1 d'}
          </p>
        </div>

        <DaySquare
          label={t('task_end_date')}
          weekday={endParts.weekday}
          dayMonth={endParts.dayMonth}
          readOnly={endReadOnly}
          active={dragging === 'end'}
          value={safeEnd}
          min={safeStart}
          onDateChange={setEnd}
          onNudge={nudgeEnd}
          compact={compact}
        />
      </div>
    </div>
  );
}

function DaySquare({
  label,
  weekday,
  dayMonth,
  readOnly,
  active,
  value,
  min,
  onDateChange,
  onNudge,
  compact,
}: {
  label: string;
  weekday: string;
  dayMonth: string;
  readOnly: boolean;
  active: boolean;
  value: string;
  min?: string;
  onDateChange: (dayId: string) => void;
  onNudge: (delta: number) => void;
  compact: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        'relative flex shrink-0 flex-col items-center rounded-xl border bg-background shadow-sm',
        compact ? 'w-[4.5rem] px-1 py-1.5' : 'w-[5.25rem] px-1.5 py-2',
        active
          ? 'border-accent-teal ring-1 ring-accent-teal/40'
          : 'border-border'
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </span>
      {!readOnly && (
        <div className="mt-0.5 flex w-full items-center justify-between gap-0.5">
          <button
            type="button"
            className="rounded p-0.5 text-text-muted hover:bg-surface hover:text-text-primary"
            onClick={() => onNudge(-1)}
            aria-label="−1"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-text-muted hover:bg-surface hover:text-text-primary"
            onClick={() => onNudge(1)}
            aria-label="+1"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={readOnly}
        onClick={() => {
          if (readOnly) return;
          // Native date picker for exact day (hidden input)
          inputRef.current?.showPicker?.();
          inputRef.current?.focus();
          inputRef.current?.click();
        }}
        className={cn(
          'mt-0.5 flex w-full flex-col items-center rounded-lg px-0.5 py-0.5 text-center',
          !readOnly && 'hover:bg-surface/80'
        )}
        title={value}
      >
        <span
          className={cn(
            'font-bold uppercase leading-none text-text-primary',
            compact ? 'text-[11px]' : 'text-xs'
          )}
        >
          {weekday}
        </span>
        <span
          className={cn(
            'mt-0.5 tabular-nums leading-tight text-text-muted',
            compact ? 'text-[10px]' : 'text-[11px]'
          )}
        >
          {dayMonth}
        </span>
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        readOnly={readOnly}
        onChange={e => {
          const v = e.target.value;
          if (v) onDateChange(v);
        }}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-hidden
      />
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

export function clampDayId(dayId: string, min?: string, max?: string): string {
  let d = dayId;
  if (min && d < min) d = min;
  if (max && d > max) d = max;
  return d;
}
