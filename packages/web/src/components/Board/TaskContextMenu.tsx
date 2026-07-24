import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Circle, Pencil, Trash2 } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import type { Task } from '@core/types';

export interface TaskContextMenuState {
  x: number;
  y: number;
  task: Task;
  weekId: string;
  dayId: string;
}

interface TaskContextMenuProps {
  menu: TaskContextMenuState | null;
  onClose: () => void;
  onToggleComplete: (menu: TaskContextMenuState) => void;
  onEdit: (menu: TaskContextMenuState) => void;
  onDelete?: (menu: TaskContextMenuState) => void;
}

export function TaskContextMenu({
  menu,
  onClose,
  onToggleComplete,
  onEdit,
  onDelete,
}: TaskContextMenuProps) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;

    function handlePointer(e: PointerEvent | MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleScroll() {
      onClose();
    }

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menu, onClose]);

  useEffect(() => {
    if (!menu || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [menu]);

  if (!menu || typeof document === 'undefined') return null;

  const completed = menu.task.completed;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className={cn(
        'fixed z-[100] min-w-[200px] rounded-md border border-border bg-surface py-1 shadow-lg'
      )}
      style={{ left: menu.x, top: menu.y }}
    >
      <button
        type="button"
        role="menuitem"
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-background active:bg-background"
        onClick={() => {
          onToggleComplete(menu);
          onClose();
        }}
      >
        {completed ? (
          <Circle className="h-4 w-4 text-text-muted" />
        ) : (
          <Check className="h-4 w-4 text-accent-green" />
        )}
        {completed ? t('task_ctx_mark_pending') : t('task_ctx_mark_complete')}
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-background active:bg-background"
        onClick={() => {
          onEdit(menu);
          onClose();
        }}
      >
        <Pencil className="h-4 w-4 text-text-muted" />
        {t('task_ctx_edit')}
      </button>
      {onDelete && (
        <button
          type="button"
          role="menuitem"
          className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-accent-red hover:bg-background active:bg-background"
          onClick={() => {
            onDelete(menu);
            onClose();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('task_ctx_delete')}
        </button>
      )}
    </div>,
    document.body
  );
}

/** Helper: open context menu from a mouse event without the browser menu. */
export function openTaskContextMenu(
  e: React.MouseEvent,
  task: Task,
  weekId: string,
  dayId: string,
  setMenu: (m: TaskContextMenuState) => void
): void {
  e.preventDefault();
  e.stopPropagation();
  setMenu({ x: e.clientX, y: e.clientY, task, weekId, dayId });
}
