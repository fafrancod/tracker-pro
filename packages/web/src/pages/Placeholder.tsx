import { Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description?: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text-muted">
        <Construction className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <p className="max-w-sm text-sm text-text-muted">
        {description ?? 'Esta sección está planificada en la próxima sesión.'}
      </p>
    </div>
  );
}
