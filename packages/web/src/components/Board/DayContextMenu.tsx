import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';

export interface DayContextMenuState {
  x: number;
  y: number;
  date: Date;
}

interface DayContextMenuProps {
  menu: DayContextMenuState | null;
  onClose: () => void;
  onViewDay: (date: Date) => void;
}

export function DayContextMenu({ menu, onClose, onViewDay }: DayContextMenuProps) {
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

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className={cn(
        'fixed z-[100] min-w-[180px] rounded-md border border-border bg-surface py-1 shadow-lg'
      )}
      style={{ left: menu.x, top: menu.y }}
    >
      <button
        type="button"
        role="menuitem"
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-background active:bg-background"
        onClick={() => {
          onViewDay(menu.date);
          onClose();
        }}
      >
        <CalendarDays className="h-4 w-4 text-accent-teal" />
        {t('board_ctx_view_day')}
      </button>
    </div>,
    document.body
  );
}

/** Abre el menú contextual de celda de día (mes / continuo). */
export function openDayContextMenu(
  e: React.MouseEvent,
  date: Date,
  setMenu: (m: DayContextMenuState) => void
): void {
  e.preventDefault();
  e.stopPropagation();
  setMenu({ x: e.clientX, y: e.clientY, date });
}
