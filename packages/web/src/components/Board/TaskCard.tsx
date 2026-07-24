import { useState, useRef, useEffect } from 'react';
import { GripVertical, MoreHorizontal, Pencil, Check, ChevronDown, ChevronUp, Maximize2, Repeat } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  TaskContextMenu,
  type TaskContextMenuState,
} from './TaskContextMenu';
import type { Task, Project, Priority } from '@core/types';

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: 'green' | 'teal' | 'red' }> = {
  low: { label: 'Low', variant: 'green' },
  medium: { label: 'Med', variant: 'teal' },
  high: { label: 'High', variant: 'red' },
};

interface TaskCardProps {
  task: Task;
  projects: Project[];
  weekDays: { date: Date; dayId: string; label: string; dateLabel: string }[];
  nextWeekId: string;
  /** Start day of the span (for range label). */
  startDayId?: string;
  /** Location for context menu / detail (start bucket). */
  locationWeekId?: string;
  locationDayId?: string;
  onToggle: () => void;
  onEdit: (payload: { title?: string; notes?: string; priority?: Priority; completed?: boolean }) => void;
  onMove: (toDate: Date) => void;
  onMoveNextWeek: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenDetail?: () => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  /** Compact layout for week columns (less lateral padding). */
  dense?: boolean;
}

export function TaskCard({
  task,
  projects,
  weekDays,
  startDayId,
  locationWeekId,
  locationDayId,
  onToggle,
  onEdit,
  onMove,
  onMoveNextWeek,
  onDuplicate,
  onDelete,
  onOpenDetail,
  dragHandleProps,
  isDragging,
  dense = false,
}: TaskCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(task.notes);
  const [ctxMenu, setCtxMenu] = useState<TaskContextMenuState | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const project = projects.find(p => p.id === task.projectId);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingNotes) notesRef.current?.focus();
  }, [editingNotes]);

  function commitTitle() {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title) onEdit({ title: trimmed });
    else setTitleValue(task.title);
    setEditingTitle(false);
  }

  function commitNotes() {
    if (notesValue !== task.notes) onEdit({ notes: notesValue });
    setEditingNotes(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({
          x: e.clientX,
          y: e.clientY,
          task,
          weekId: locationWeekId ?? '',
          dayId: locationDayId ?? startDayId ?? '',
        });
      }}
      className={cn(
        'group relative rounded-md border border-border bg-surface transition-shadow',
        dense ? 'p-1' : 'p-2.5',
        isDragging && 'shadow-lg ring-1 ring-accent-teal/50',
        task.completed && 'opacity-60'
      )}
      style={
        task.color
          ? { borderLeftWidth: dense ? 2 : 3, borderLeftColor: task.color }
          : project
            ? { borderLeftWidth: dense ? 2 : 3, borderLeftColor: project.color }
            : undefined
      }
    >
      <div className={cn('flex items-start', dense ? 'gap-1' : 'gap-2')}>
        {/* Drag handle — absolute in dense mode to reclaim horizontal space */}
        <button
          {...dragHandleProps}
          className={cn(
            'cursor-grab touch-none text-text-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing',
            dense
              ? 'absolute left-0 top-0.5 z-10 -ml-0.5 rounded bg-surface/90 p-0'
              : 'mt-0.5'
          )}
          tabIndex={-1}
        >
          <GripVertical className={dense ? 'h-3 w-3' : 'h-4 w-4'} />
        </button>

        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={cn(
            'shrink-0 items-center justify-center rounded-full border transition-colors',
            dense ? 'mt-0.5 flex h-3.5 w-3.5' : 'mt-0.5 flex h-4 w-4',
            task.completed
              ? 'border-accent-green bg-accent-green/20 text-accent-green'
              : 'border-border hover:border-accent-green'
          )}
        >
          {task.completed && <Check className={dense ? 'h-2 w-2' : 'h-2.5 w-2.5'} />}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') { setTitleValue(task.title); setEditingTitle(false); }
              }}
              className={cn(
                'w-full bg-transparent text-text-primary outline-none',
                dense ? 'text-xs' : 'text-sm'
              )}
            />
          ) : (
            <span
              onClick={() => onOpenDetail?.()}
              onDoubleClick={e => {
                e.stopPropagation();
                // Doble clic: abrir ficha de detalle (edición completa).
                onOpenDetail?.();
              }}
              title="Clic: ver detalle · Doble clic: editar"
              className={cn(
                'block cursor-pointer select-none leading-snug',
                dense ? 'text-xs' : 'text-sm',
                task.completed ? 'text-text-muted line-through' : 'text-text-primary hover:text-accent-teal'
              )}
            >
              {task.title}
            </span>
          )}

          {/* Meta row */}
          <div className={cn('flex flex-wrap items-center', dense ? 'mt-0.5 gap-0.5' : 'mt-1.5 gap-1.5')}>
            {task.startTime && (
              <span className="inline-flex items-center rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-text-muted ring-1 ring-border">
                {task.endTime ? `${task.startTime}–${task.endTime}` : task.startTime}
              </span>
            )}
            {startDayId && task.endDayId && task.endDayId > startDayId && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-text-muted ring-1 ring-border">
                {format(parseISO(`${startDayId}T00:00:00`), 'd MMM')}
                {' – '}
                {format(parseISO(`${task.endDayId}T00:00:00`), 'd MMM')}
              </span>
            )}
            {task.kind === 'reminder' && (
              <span className="inline-flex items-center rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                🔔
              </span>
            )}
            {task.recurrence.frequency !== 'none' && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-accent-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-teal"
                title={
                  task.recurrence.interval > 1
                    ? `↻ cada ${task.recurrence.interval}`
                    : task.recurrence.frequency
                }
              >
                <Repeat className="h-2.5 w-2.5" />
                {task.recurrence.frequency === 'daily'
                  ? 'D'
                  : task.recurrence.frequency === 'weekly'
                    ? 'S'
                    : task.recurrence.frequency === 'monthly'
                      ? 'M'
                      : 'A'}
                {task.recurrence.interval > 1 ? `×${task.recurrence.interval}` : ''}
              </span>
            )}
            {project && (
              <span
                className={cn(
                  'inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full font-medium',
                  dense
                    ? 'gap-0.5 px-1 py-0 text-[9px]'
                    : 'gap-1 px-2 py-0.5 text-xs'
                )}
                style={{ backgroundColor: project.color + '33', color: project.color }}
                title={project.name}
              >
                <span aria-hidden>{project.icon}</span>
                {!dense && <span className="truncate">{project.name}</span>}
              </span>
            )}
            {!dense && (
              <Badge variant={PRIORITY_CONFIG[task.priority].variant} className="px-1.5 py-0 text-[10px]">
                {PRIORITY_CONFIG[task.priority].label}
              </Badge>
            )}
            {!dense && task.movedFrom && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-text-muted">
                ↩ {task.movedFrom}
              </Badge>
            )}
            {!dense &&
              task.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
          </div>

          {/* Notes toggle — hidden in dense week columns unless expanded */}
          {!dense && (task.notes || notesOpen) && (
            <button
              onClick={() => setNotesOpen(v => !v)}
              className="mt-1 flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
            >
              {notesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Notes
            </button>
          )}
          {!dense && notesOpen && (
            <div className="mt-1.5">
              {editingNotes ? (
                <textarea
                  ref={notesRef}
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  onBlur={commitNotes}
                  rows={3}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-text-primary outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <p
                  onDoubleClick={() => setEditingNotes(true)}
                  className="cursor-text whitespace-pre-wrap text-xs text-text-muted"
                >
                  {task.notes || <span className="italic">Double-click to add notes…</span>}
                </p>
              )}
            </div>
          )}
          {!dense && !task.notes && !notesOpen && (
            <button
              onClick={() => { setNotesOpen(true); setEditingNotes(true); }}
              className="mt-1 text-[11px] text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary"
            >
              + notes
            </button>
          )}
        </div>

        {/* Actions */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100',
            dense && 'absolute right-0.5 top-0.5'
          )}
        >
          {onOpenDetail && (
            <button
              onClick={onOpenDetail}
              className="rounded p-0.5 text-text-muted hover:bg-border hover:text-text-primary"
              title="Abrir detalle"
              aria-label="Abrir detalle"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => setEditingTitle(true)}
            className="rounded p-0.5 text-text-muted hover:bg-border hover:text-text-primary"
            title="Editar inline"
            aria-label="Editar inline"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded p-0.5 text-text-muted hover:bg-border hover:text-text-primary">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <div className="px-2 py-1 text-xs font-semibold text-text-muted">Move to</div>
              {weekDays.map(day => (
                <DropdownMenuItem key={day.dayId} onClick={() => onMove(day.date)} className="text-xs">
                  {day.label} {day.dateLabel}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={onMoveNextWeek} className="text-xs">
                Next week →
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDuplicate} className="text-xs">
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-xs text-accent-red focus:text-accent-red"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Completed timestamp */}
      {task.completed && task.completedAt && (
        <p className="mt-1 text-right text-[10px] text-text-muted">
          ✓ {format(parseISO(task.completedAt), 'HH:mm')}
        </p>
      )}

      <TaskContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onToggleComplete={() => onToggle()}
        onEdit={() => onOpenDetail?.()}
        onDelete={() => onDelete()}
      />
    </motion.div>
  );
}
