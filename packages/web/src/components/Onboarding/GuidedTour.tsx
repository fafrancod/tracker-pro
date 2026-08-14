import { useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GuidedTourProps {
  title: string;
  body: string;
  progress: string;
  target: string | null;
  isFirst: boolean;
  isLast: boolean;
  nextLabel: string;
  backLabel: string;
  skipLabel: string;
  doneLabel: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readTargetRect(target: string | null): SpotlightRect | null {
  if (!target || typeof document === 'undefined') return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function GuidedTour({
  title,
  body,
  progress,
  target,
  isFirst,
  isLast,
  nextLabel,
  backLabel,
  skipLabel,
  doneLabel,
  onNext,
  onBack,
  onSkip,
}: GuidedTourProps) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    let tries = 0;

    const measure = () => {
      if (cancelled) return;
      const next = readTargetRect(target);
      if (next) {
        const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
        el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        setRect(readTargetRect(target));
        return;
      }
      setRect(null);
      if (target && tries < 16) {
        tries += 1;
        window.setTimeout(measure, 80);
      }
    };

    measure();
    const onWin = () => setRect(readTargetRect(target));
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSkip]);

  const pad = 8;
  const spot = rect
    ? {
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: Math.min(window.innerWidth - 16, rect.width + pad * 2),
        height: Math.min(window.innerHeight - 16, rect.height + pad * 2),
      }
    : null;

  const placeBelow = !spot || spot.top + spot.height + 220 < window.innerHeight;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <button
        type="button"
        aria-label={skipLabel}
        className={cn('absolute inset-0', !spot && 'bg-black/55')}
        onClick={onSkip}
      />
      {spot && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-accent-teal/80"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
          }}
        />
      )}

      <div
        className={cn(
          'absolute z-[91] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-field p-4 text-text-primary shadow-2xl',
          !spot && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
        )}
        style={
          spot
            ? {
                top: placeBelow
                  ? Math.min(spot.top + spot.height + 12, window.innerHeight - 220)
                  : Math.max(12, spot.top - 208),
                left: Math.min(
                  Math.max(12, spot.left),
                  window.innerWidth - 12 - Math.min(352, window.innerWidth - 24)
                ),
              }
            : undefined
        }
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {progress}
        </p>
        <h2 id="tour-title" className="mt-1 text-base font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-text-muted hover:text-text-primary"
          >
            {skipLabel}
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <Button type="button" variant="ghost" size="sm" onClick={onBack}>
                {backLabel}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="rounded-xl bg-accent-teal text-background hover:bg-accent-teal/90"
              onClick={onNext}
            >
              {isLast ? doneLabel : nextLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
