import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { projectColors } from '@core/theme';
import type { Project } from '@core/types';

const EMOJI_SUGGESTIONS = ['📁', '🚀', '🧠', '💡', '🏠', '💼', '🎯', '🛠️', '📚', '🎨', '🌱', '🔥'];

export interface ProjectFormValue {
  name: string;
  color: string;
  icon: string;
}

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Project | null;
  onSubmit: (value: ProjectFormValue) => Promise<void>;
}

export function ProjectFormDialog({ open, onOpenChange, initial, onSubmit }: ProjectFormDialogProps) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(projectColors[0]);
  const [icon, setIcon] = useState('📁');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setColor(initial?.color ?? projectColors[0]);
      setIcon(initial?.icon ?? '📁');
    }
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      await onSubmit({ name: name.trim(), color, icon });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
          <DialogDescription>
            Los proyectos te ayudan a agrupar tareas por contexto: trabajo, estudio, hobbies.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Nombre</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Personal, Trabajo, Aprendizaje…"
              maxLength={60}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Color</label>
            <div className="flex flex-wrap gap-2">
              {projectColors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform',
                    color === c ? 'border-text-primary scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Ícono</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_SUGGESTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md border text-base transition-colors',
                    icon === e ? 'border-accent-teal bg-accent-teal/10' : 'border-border hover:bg-surface'
                  )}
                >
                  {e}
                </button>
              ))}
              <Input
                value={icon}
                onChange={e => setIcon(e.target.value.slice(0, 4))}
                className="h-8 w-16 text-center"
                placeholder="custom"
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-background p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Preview</p>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
              style={{ backgroundColor: color + '33', color }}
            >
              {icon} {name || 'Sin nombre'}
            </span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
