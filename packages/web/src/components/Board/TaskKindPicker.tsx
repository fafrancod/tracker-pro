import { useEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  Bell,
  MapPin,
  CalendarHeart,
  Leaf,
  Ban,
  TrendingUp,
  TrendingDown,
  Pill,
  PawPrint,
  ChevronDown,
} from 'lucide-react';
import type { TaskKind } from '@core/types';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import {
  tintEventActive,
  tintHabitActive,
  tintPossibleActive,
} from '@/lib/tintClasses';

export interface TaskKindOption {
  value: TaskKind;
  label: string;
  icon: typeof CheckSquare;
  activeClass: string;
}

interface TaskKindPickerProps {
  value: TaskKind;
  onChange: (kind: TaskKind) => void;
  /** If set, only these kinds (in order). */
  options?: TaskKindOption[];
  className?: string;
  compact?: boolean;
  /** Start expanded (e.g. create modal). */
  defaultOpen?: boolean;
}

export function defaultKindOptions(
  t: (k: string) => string
): TaskKindOption[] {
  return [
    {
      value: 'task',
      label: t('task_kind_task'),
      icon: CheckSquare,
      activeClass: 'border-accent-teal/50 bg-accent-teal/15 text-accent-teal',
    },
    {
      value: 'reminder',
      label: t('task_kind_reminder'),
      icon: Bell,
      activeClass:
        'border-amber-600/50 bg-amber-500/15 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100',
    },
    {
      value: 'event',
      label: t('task_kind_event'),
      icon: MapPin,
      activeClass: tintEventActive,
    },
    {
      value: 'possible_event',
      label: t('task_kind_possible_event'),
      icon: CalendarHeart,
      activeClass: tintPossibleActive,
    },
    {
      value: 'habit_good',
      label: t('task_kind_habit_good'),
      icon: Leaf,
      activeClass: tintHabitActive,
    },
    {
      value: 'habit_quit',
      label: t('task_kind_habit_quit'),
      icon: Ban,
      activeClass:
        'border-red-600/50 bg-red-500/15 text-red-800 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-200',
    },
    {
      value: 'finance_income',
      label: t('task_kind_finance_income'),
      icon: TrendingUp,
      activeClass: tintHabitActive,
    },
    {
      value: 'finance_expense',
      label: t('task_kind_finance_expense'),
      icon: TrendingDown,
      activeClass:
        'border-red-600/50 bg-red-500/15 text-red-800 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-200',
    },
    {
      value: 'rx_human',
      label: t('task_kind_rx_human'),
      icon: Pill,
      activeClass:
        'border-violet-600/50 bg-violet-500/15 text-violet-800 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-200',
    },
    {
      value: 'rx_pet',
      label: t('task_kind_rx_pet'),
      icon: PawPrint,
      activeClass: 'border-pink-500/50 bg-pink-500/15 text-pink-200',
    },
  ];
}

/**
 * Collapsible kind picker: closed = chip with icon; open = grid of icon buttons.
 */
export function TaskKindPicker({
  value,
  onChange,
  options: optionsProp,
  className,
  compact = false,
  defaultOpen = false,
}: TaskKindPickerProps) {
  const { t } = useT();
  const options = optionsProp ?? defaultKindOptions(k => t(k as Parameters<typeof t>[0]));
  const selected =
    options.find(o => o.value === value) ?? options[0] ?? null;
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);

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

  if (!selected) return null;
  const SelectedIcon = selected.icon;

  return (
    <div ref={rootRef} className={cn('space-y-2', className)}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-haspopup="listbox"
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border px-3 transition-colors',
            compact ? 'h-9 text-xs' : 'h-11 text-sm',
            selected.activeClass,
            'hover:opacity-95'
          )}
        >
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg bg-field',
              compact ? 'h-7 w-7' : 'h-8 w-8'
            )}
          >
            <SelectedIcon className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          </span>
          <span className="min-w-0 flex-1 text-left font-semibold">
            {selected.label}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </button>
      ) : (
        <div
          role="listbox"
          aria-label={t('task_kind_convert')}
          className={cn(
            'grid gap-2 rounded-xl border border-border bg-field p-2',
            compact
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
          )}
        >
          {options.map(opt => {
            const Icon = opt.icon;
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-all',
                  active
                    ? cn('shadow-sm ring-1 font-semibold', opt.activeClass)
                    : 'border-border bg-surface font-medium text-text-muted hover:border-border hover:bg-background hover:text-text-primary',
                  compact && 'min-h-[2.75rem] py-1.5'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', compact && 'h-3.5 w-3.5')} />
                <span
                  className={cn(
                    'w-full whitespace-normal break-words text-[11px] leading-tight',
                    compact && 'text-[10px]'
                  )}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
