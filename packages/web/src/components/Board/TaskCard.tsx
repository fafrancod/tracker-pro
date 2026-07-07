import { useState, useRef, useEffect } from 'react';
import { GripVertical, MoreHorizontal, Pencil, Check, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
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
  onToggle: () => void;
  onEdit: (payload: { title?: string; notes?: string; priority?: Priority; completed?: boolean }) => void;
  onMove: (toDate: Date) => void;
  onMoveNextWeek: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenDetail?: () => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export function TaskCard({
  task,
  projects,
  weekDays,
  onToggle,
  onEdit,
  onMove,
  onMoveNextWeek,
  onDuplicate,
  onDelete,
  onOpenDetail,
  dragHandleProps,
  isDragging,
}: TaskCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(task.notes);
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
      className={cn(
        'group relative rounded-md border border-border bg-surface p-2.5 transition-shadow',
        isDragging && 'shadow-lg ring-1 ring-accent-teal/50',
        task.completed && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...dragHandleProps}
          className="mt-0.5 cursor-grab touch-none text-text-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          tabIndex={-1}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
            task.completed
              ? 'border-accent-green bg-accent-green/20 text-accent-green'
              : 'border-border hover:border-accent-green'
          )}
        >
          {task.completed && <Check className="h-2.5 w-2.5" />}
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
              className="w-full bg-transparent text-sm text-text-primary outline-none"
            />
          ) : (
            <span
              onClick={() => onOpenDetail?.()}
              onDoubleClick={e => {
                e.stopPropagation();
                setEditingTitle(true);
              }}
              title="Click: ver detalle · Doble click: editar inline"
              className={cn(
                'block cursor-pointer select-none text-sm leading-snug',
                task.completed ? 'text-text-muted line-through' : 'text-text-primary hover:text-accent-teal'
              )}
            >
              {task.title}
            </span>
          )}

          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {project && (
              <span
                className="inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: project.color + '33', color: project.color }}
                title={project.name}
              >
                <span aria-hidden>{project.icon}</span>
                <span className="truncate">{project.name}</span>
              </span>
            )}
            <Badge variant={PRIORITY_CONFIG[task.priority].variant} className="text-[10px] px-1.5 py-0">
              {PRIORITY_CONFIG[task.priority].label}
            </Badge>
            {task.movedFrom && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-text-muted">
                ↩ {task.movedFrom}
              </Badge>
            )}
            {task.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Notes toggle */}
          {(task.notes || notesOpen) && (
            <button
              onClick={() => setNotesOpen(v => !v)}
              className="mt-1 flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
            >
              {notesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Notes
            </button>
          )}
          {notesOpen && (
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
          {!task.notes && !notesOpen && (
            <button
              onClick={() => { setNotesOpen(true); setEditingNotes(true); }}
              className="mt-1 text-[11px] text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary"
            >
              + notes
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
    </motion.div>
  );
}
