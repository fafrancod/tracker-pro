import type { ReactNode } from 'react';
import { Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlan } from '@core/hooks/usePlan';

interface ProGateProps {
  children: ReactNode;
  /** Si pasás un nombre de feature, aparece en el upgrade prompt. */
  feature?: string;
  /** Permite override manual; util en mocks. */
  forceLocked?: boolean;
}

/**
 * Renderiza `children` si el usuario es Pro, sino muestra un upgrade prompt.
 * Patron: <ProGate feature="Analytics">…</ProGate>.
 */
export function ProGate({ children, feature, forceLocked }: ProGateProps) {
  const { isPro } = usePlan();
  if (isPro && !forceLocked) return <>{children}</>;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-teal/10 text-accent-teal">
        <Lock className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-text-primary">
        {feature ? `${feature} es parte de Pro` : 'Esta sección es Pro'}
      </h2>
      <p className="max-w-sm text-sm text-text-muted">
        Pasate a Pro para desbloquearlo, ver semanas pasadas, analytics y export CSV.
      </p>
      <Button className="mt-1 gap-1.5">
        <Sparkles className="h-4 w-4" />
        Probar Pro
      </Button>
      <p className="text-[11px] text-text-muted">El checkout llega en una próxima sesión.</p>
    </div>
  );
}
