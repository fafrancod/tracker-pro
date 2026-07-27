import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

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
 * Select with prev/next arrows (wraps around).
 * Dropdown is Radix (not native) so menus stay themed — no OS white list.
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
        'inline-flex h-9 min-h-9 items-stretch overflow-hidden rounded-lg border border-border bg-field sm:h-8',
        className
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        className="flex w-9 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface hover:text-text-primary sm:w-7"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label={ariaLabel}
          className={cn(
            'h-full min-w-0 max-w-[140px] flex-1 rounded-none border-0 border-x border-border bg-field px-1.5 text-center text-xs shadow-none focus:ring-0 focus:ring-offset-0',
            '[&>svg]:hidden',
            selectClassName
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={() => step(1)}
        className="flex w-9 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface hover:text-text-primary sm:w-7"
        aria-label="Siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
