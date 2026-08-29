import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

interface ResizableAsideProps {
  storageKey: string;
  maxWidth: number;
  minWidth?: number;
  collapsedWidth?: number;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  collapseLabel: string;
  expandLabel: string;
  resizeLabel: string;
  className?: string;
  children: ReactNode;
}

export function ResizableAside({
  storageKey,
  maxWidth,
  minWidth = 180,
  collapsedWidth = 40,
  collapsed,
  onCollapsedChange,
  collapseLabel,
  expandLabel,
  resizeLabel,
  className,
  children,
}: ResizableAsideProps) {
  const [width, setWidth] = useState(() =>
    Math.min(maxWidth, Math.max(minWidth, readNumber(storageKey, maxWidth)))
  );
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    writeNumber(storageKey, width);
  }, [storageKey, width]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (collapsed) return;
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startW: width };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [collapsed, width]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.min(
        maxWidth,
        Math.max(minWidth, drag.startW + (event.clientX - drag.startX))
      );
      setWidth(next);
    },
    [maxWidth, minWidth]
  );

  const onPointerUp = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  return (
    <aside
      className={cn(
        'relative hidden h-full shrink-0 flex-col border-r border-border md:flex',
        className
      )}
      style={{ width: collapsed ? collapsedWidth : width }}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          className="flex h-full w-full flex-col items-center pt-2 text-text-muted hover:bg-surface hover:text-text-primary"
          aria-label={expandLabel}
          title={expandLabel}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      ) : (
        <>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            className="absolute right-1 top-1.5 z-10 rounded-md p-1 text-text-muted hover:bg-background hover:text-text-primary"
            aria-label={collapseLabel}
            title={collapseLabel}
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={resizeLabel}
            title={resizeLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize bg-transparent hover:bg-accent-teal/40"
          />
        </>
      )}
    </aside>
  );
}
