import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FABProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

// FAB inferior derecho — patrón de la familia Meteora.
// Acción primaria del producto: en task tracker = "Nueva tarea".
export function FAB({ onClick, label = 'Nueva tarea', className }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'fixed z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent-teal text-background shadow-lg shadow-accent-teal/25 transition-transform hover:scale-105 active:scale-95',
        // Safe area: gesture bar / home indicator on Android & iOS
        'bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1.25rem,env(safe-area-inset-right,0px))]',
        className
      )}
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
