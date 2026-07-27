import { useCallback, useMemo, useRef, useState } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';

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
 * Editable desde/hasta with calendar affordance + optional dual-handle strip.
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
  const { t } = useT();
  const safeStart = isDayId(startDayId) ? startDayId : format(new Date(), 'yyyy-MM-dd');
  const safeEnd =
    isDayId(endDayId) && endDayId >= safeStart ? endDayId : safeStart;

  const strip = useMemo(() => {
    // ~14 days before start and after end, min 21 days window
    const start = parseISO(`${safeStart}T00:00:00`);
    const end = parseISO(`${safeEnd}T00:00:00`);
    const windowStart = addDays(start, -14);
    const windowEnd = addDays(end, 14);
    const days = Math.max(
      21,
      differenceInCalendarDays(windowEnd, windowStart) + 1
    );
    return {
      origin: windowStart,
      days,
      originId: format(windowStart, 'yyyy-MM-dd'),
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
      // Keep end fixed when possible
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
          <div className="relative">
            <input
              type="date"
              value={safeStart}
              readOnly={startReadOnly}
              onChange={e => setStart(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-border bg-background py-1.5 pl-2 pr-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring',
                startReadOnly && 'opacity-80'
              )}
              aria-label={t('task_start_date')}
            />
          </div>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] text-text-muted">
          <span className="inline-flex items-center gap-1 font-medium uppercase tracking-wide">
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            {t('task_end_date')}
          </span>
          <input
            type="date"
            value={safeEnd}
            min={safeStart}
            readOnly={endReadOnly}
            onChange={e => setEnd(e.target.value || safeStart)}
            className={cn(
              'w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring',
              endReadOnly && 'opacity-80'
            )}
            aria-label={t('task_end_date')}
          />
        </label>
      </div>

      {showDragStrip && !startReadOnly && !endReadOnly && (
        <div className="space-y-1">
          <p className="text-[10px] text-text-muted">{t('task_date_range_drag_hint')}</p>
          <div
            ref={trackRef}
            className="relative h-8 select-none rounded-lg bg-border/40 px-1"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* filled range */}
            <div
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-accent-teal/50"
              style={{
                left: `calc(${leftPct}% )`,
                width: `max(8px, ${widthPct}%)`,
              }}
            />
            {/* start thumb */}
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
            {/* end thumb */}
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
            {safeStart}
            {safeEnd > safeStart ? ` → ${safeEnd}` : ''}
            {safeEnd > safeStart
              ? ` · ${differenceInCalendarDays(parseISO(`${safeEnd}T00:00:00`), parseISO(`${safeStart}T00:00:00`)) + 1} d`
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
