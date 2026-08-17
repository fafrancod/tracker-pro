import { Minus, Plus, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { MAX_DAILY_POMODOROS, normalizePomodoroCount } from '@core/lib/habits';

interface StepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  dense?: boolean;
}

function Stepper({ label, value, onChange, disabled, dense }: StepperProps) {
  const { t } = useT();
  const n = normalizePomodoroCount(value);

  function bump(delta: number) {
    onChange(normalizePomodoroCount(n + delta));
  }

  return (
    <div className={cn('flex items-center gap-1.5', dense && 'gap-1')}>
      <span className={cn('text-text-muted', dense ? 'text-[9px]' : 'text-[11px]')}>
        {label}
      </span>
      <button
        type="button"
        disabled={disabled || n <= 0}
        onClick={e => {
          e.stopPropagation();
          bump(-1);
        }}
        className={cn(
          'inline-flex items-center justify-center rounded border border-border text-text-muted hover:bg-border hover:text-text-primary disabled:opacity-30',
          dense ? 'h-5 w-5' : 'h-7 w-7'
        )}
        aria-label={t('habit_pomo_minus')}
      >
        <Minus className={dense ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      </button>
      <span
        className={cn(
          'min-w-[1.25rem] text-center font-semibold tabular-nums text-text-primary',
          dense ? 'text-[10px]' : 'text-xs'
        )}
      >
        {n}
      </span>
      <button
        type="button"
        disabled={disabled || n >= MAX_DAILY_POMODOROS}
        onClick={e => {
          e.stopPropagation();
          bump(1);
        }}
        className={cn(
          'inline-flex items-center justify-center rounded border border-border text-text-muted hover:bg-border hover:text-text-primary disabled:opacity-30',
          dense ? 'h-5 w-5' : 'h-7 w-7'
        )}
        aria-label={t('habit_pomo_plus')}
      >
        <Plus className={dense ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      </button>
    </div>
  );
}

export function HabitPomodoroSection({
  target,
  done,
  onTargetChange,
  onDoneChange,
  dense = false,
  planOnly = false,
}: {
  target: number;
  done?: number;
  onTargetChange: (next: number) => void;
  onDoneChange?: (next: number) => void;
  dense?: boolean;
  planOnly?: boolean;
}) {
  const { t } = useT();
  const plan = normalizePomodoroCount(target);
  const logged = normalizePomodoroCount(done);
  const pct = plan > 0 ? Math.min(100, Math.round((logged / plan) * 100)) : 0;

  if (dense) {
    return (
      <div
        className="mt-1 flex items-center gap-0.5 text-[10px]"
        onClick={e => e.stopPropagation()}
      >
        <Timer className="h-3 w-3 shrink-0 text-accent-teal" aria-hidden />
        {onDoneChange && !planOnly ? (
          <>
            <button
              type="button"
              disabled={logged <= 0}
              onClick={e => {
                e.stopPropagation();
                onDoneChange(normalizePomodoroCount(logged - 1));
              }}
              className="inline-flex h-5 w-5 items-center justify-center rounded border border-border text-text-muted disabled:opacity-30"
              aria-label={t('habit_pomo_minus')}
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="min-w-[2rem] text-center font-semibold tabular-nums text-text-primary">
              {logged}/{plan}
            </span>
            <button
              type="button"
              disabled={logged >= MAX_DAILY_POMODOROS}
              onClick={e => {
                e.stopPropagation();
                onDoneChange(normalizePomodoroCount(logged + 1));
              }}
              className="inline-flex h-5 w-5 items-center justify-center rounded border border-border text-text-muted disabled:opacity-30"
              aria-label={t('habit_pomo_plus')}
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </>
        ) : (
          <Stepper
            label={t('habit_pomo_plan')}
            value={plan}
            onChange={onTargetChange}
            dense
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-2 rounded-md border border-border/70 bg-background/60 px-2 py-1.5"
      onClick={e => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Timer className="h-3.5 w-3.5 text-accent-teal" aria-hidden />
        <p className="text-[11px] font-semibold text-text-primary">
          {t('habit_pomo_section')}
        </p>
        {!planOnly && (
          <span className="ml-auto text-[10px] tabular-nums text-text-muted">
            {logged} / {plan}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <Stepper
          label={t('habit_pomo_plan')}
          value={plan}
          onChange={onTargetChange}
        />
        {!planOnly && onDoneChange && (
          <Stepper
            label={t('habit_pomo_done')}
            value={logged}
            onChange={onDoneChange}
          />
        )}
      </div>
      {!planOnly && plan > 0 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border/70">
          <div
            className="h-full rounded-full bg-accent-teal transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="mt-1 text-[10px] text-text-muted">{t('habit_pomo_plan_hint')}</p>
    </div>
  );
}
