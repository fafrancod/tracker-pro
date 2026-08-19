import { useMemo, useState } from 'react';
import { Check, ChevronDown, FolderKanban } from 'lucide-react';
import type { Project } from '@core/types';
import { BOARD_NO_PROJECT, toggleProjectKey } from '@core/lib/boardFilters';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface GanttProjectPickerProps {
  projects: Project[];
  selected: string[] | 'all';
  onChange: (next: string[] | 'all') => void;
}

export function GanttProjectPicker({
  projects,
  selected,
  onChange,
}: GanttProjectPickerProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const allKeys = useMemo(
    () => [BOARD_NO_PROJECT, ...projects.map(p => p.id)],
    [projects]
  );
  const selectedIds = selected !== 'all' ? selected : null;
  const allOn = !selectedIds;

  function isOn(key: string): boolean {
    return allOn || Boolean(selectedIds?.includes(key));
  }

  function onToggle(key: string) {
    onChange(toggleProjectKey(selected, key, allKeys));
  }

  const triggerLabel = (() => {
    if (allOn) return t('board_filter_all_projects');
    if (selectedIds.length === 1) {
      const id = selectedIds[0];
      if (id === BOARD_NO_PROJECT) return t('gantt_no_project');
      const p = projects.find(x => x.id === id);
      return p ? `${p.icon} ${p.name}` : t('gantt_no_project');
    }
    if (selectedIds.length === 0) return t('eisenhower_deselect_all');
    return t('board_filter_projects_n').replace(
      '{n}',
      String(selectedIds.length)
    );
  })();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('gantt_scope')}
          className={cn(
            'inline-flex h-9 min-w-[12.5rem] max-w-full items-center gap-2 rounded-xl border bg-field px-2.5 text-left text-sm shadow-sm transition-colors',
            'hover:border-accent-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/30',
            allOn
              ? 'border-border text-text-primary'
              : 'border-accent-teal/40 text-text-primary'
          )}
        >
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              allOn ? 'bg-background text-text-muted' : 'bg-accent-teal/15 text-accent-teal'
            )}
          >
            <FolderKanban className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
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
            {t('gantt_filter_all')}
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-text-muted hover:bg-background hover:text-text-primary"
          >
            {t('eisenhower_deselect_all')}
          </button>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto py-1">
          <ProjectCheckRow
            checked={isOn(BOARD_NO_PROJECT)}
            label={t('gantt_no_project')}
            muted
            onToggle={() => onToggle(BOARD_NO_PROJECT)}
          />
          {projects.map(p => (
            <ProjectCheckRow
              key={p.id}
              checked={isOn(p.id)}
              label={`${p.icon} ${p.name}`}
              color={p.color}
              onToggle={() => onToggle(p.id)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectCheckRow({
  checked,
  label,
  color,
  muted,
  onToggle,
}: {
  checked: boolean;
  label: string;
  color?: string;
  muted?: boolean;
  onToggle: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={e => {
        e.preventDefault();
        onToggle();
      }}
      className="cursor-pointer rounded-lg px-2 py-2"
    >
      <span
        className={cn(
          'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border',
          checked
            ? 'border-accent-teal bg-accent-teal text-white'
            : 'border-border bg-field'
        )}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      {color ? (
        <span
          className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className={cn('min-w-0 truncate', muted && 'text-text-muted')}>
        {label}
      </span>
    </DropdownMenuItem>
  );
}
