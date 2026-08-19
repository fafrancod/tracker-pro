import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { toggleProjectKey } from '@core/lib/boardFilters';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ToggleSelectOption {
  value: string;
  label: string;
  color?: string;
  muted?: boolean;
}

interface ToggleSelectProps {
  ariaLabel: string;
  options: ToggleSelectOption[];
  selected: string[] | 'all';
  onChange: (next: string[] | 'all') => void;
  allLabel: string;
  noneLabel: string;
  countLabel: (n: number) => string;
  icon?: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

export function ToggleSelect({
  ariaLabel,
  options,
  selected,
  onChange,
  allLabel,
  noneLabel,
  countLabel,
  icon,
  align = 'start',
  className,
}: ToggleSelectProps) {
  const [open, setOpen] = useState(false);
  const allKeys = useMemo(() => options.map(o => o.value), [options]);
  const selectedIds = selected !== 'all' ? selected : null;
  const allOn = !selectedIds;

  function isOn(key: string): boolean {
    return allOn || Boolean(selectedIds?.includes(key));
  }

  const triggerLabel = (() => {
    if (allOn) return allLabel;
    if (selectedIds.length === 1) {
      return options.find(o => o.value === selectedIds[0])?.label ?? noneLabel;
    }
    if (selectedIds.length === 0) return noneLabel;
    return countLabel(selectedIds.length);
  })();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex h-9 min-w-[10.5rem] max-w-full items-center gap-2 rounded-xl border bg-field px-2.5 text-left text-sm shadow-sm transition-colors',
            'hover:border-accent-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/30',
            allOn
              ? 'border-border text-text-primary'
              : 'border-accent-teal/40 text-text-primary',
            className
          )}
        >
          {icon ? (
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                allOn
                  ? 'bg-background text-text-muted'
                  : 'bg-accent-teal/15 text-accent-teal'
              )}
            >
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-xs font-medium sm:text-sm">
            {triggerLabel}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={6}
        className="w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-1.5"
      >
        <div className="mb-1 flex gap-1 px-0.5">
          <button
            type="button"
            onClick={() => onChange('all')}
            className={cn(
              'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
              allOn
                ? 'bg-accent-teal/15 text-accent-teal'
                : 'text-text-muted hover:bg-background hover:text-text-primary'
            )}
          >
            {allLabel}
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-text-muted hover:bg-background hover:text-text-primary"
          >
            {noneLabel}
          </button>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto py-1">
          {options.map(opt => (
            <DropdownMenuItem
              key={opt.value}
              onSelect={e => {
                e.preventDefault();
                onChange(toggleProjectKey(selected, opt.value, allKeys));
              }}
              className="cursor-pointer rounded-lg px-2 py-2"
            >
              <span
                className={cn(
                  'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border',
                  isOn(opt.value)
                    ? 'border-accent-teal bg-accent-teal text-white'
                    : 'border-border bg-field'
                )}
              >
                {isOn(opt.value) ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : null}
              </span>
              {opt.color ? (
                <span
                  className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
              ) : null}
              <span
                className={cn('min-w-0 truncate', opt.muted && 'text-text-muted')}
              >
                {opt.label}
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
