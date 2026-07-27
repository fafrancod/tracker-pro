import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <div
        data-chrome="glass"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform border-r border-border bg-surface shadow-xl transition-transform md:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menú principal"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-text-muted hover:bg-background hover:text-text-primary"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
        <Sidebar variant="drawer" onNavigate={onClose} />
      </div>
    </>
  );
}
