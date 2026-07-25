import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CycleSelectOption {
  value: string;
  label: string;
}

interface CycleSelectProps {
  value: string;
  options: CycleSelectOption[];
  onChange: (value: string) => void;
  /** Accessible name for the control group */
  'aria-label'?: string;
  className?: string;
  selectClassName?: string;
}

/**
 * Select with prev/next arrows to cycle options (wraps around).
 */
export function CycleSelect({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  className,
  selectClassName,
}: CycleSelectProps) {
  const index = Math.max(
    0,
    options.findIndex(o => o.value === value)
  );

  function step(delta: number) {
    if (options.length === 0) return;
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
  }

  return (
    <div
      className={cn(
        'inline-flex h-9 min-h-9 items-stretch overflow-hidden rounded-md border border-border bg-surface sm:h-8',
        className
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        className="flex w-9 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-background hover:text-text-primary sm:w-7"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={cn(
          // Fondo sólido (no transparent): el dropdown nativo hereda color legible
          // junto con color-scheme del skin (applySkin) + option styles en index.css
          'h-full min-w-0 max-w-[130px] flex-1 cursor-pointer appearance-none border-0 border-x border-border bg-surface px-1.5 text-center text-xs text-text-primary focus:outline-none focus:ring-0',
          selectClassName
        )}
      >
        {options.map(o => (
          <option
            key={o.value}
            value={o.value}
            className="bg-surface text-text-primary"
          >
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => step(1)}
        className="flex w-9 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-background hover:text-text-primary sm:w-7"
        aria-label="Siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
