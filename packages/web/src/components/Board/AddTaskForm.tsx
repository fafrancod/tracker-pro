import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Project, CreateTaskPayload, Priority } from '@core/types';

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-text-muted' },
  { value: 'medium', label: 'Med', color: 'text-accent-teal' },
  { value: 'high', label: 'High', color: 'text-accent-red' },
];

interface AddTaskFormProps {
  projects: Project[];
  onAdd: (payload: CreateTaskPayload) => Promise<void>;
  /** Si está en true, el formulario arranca expandido y oculta el botón colapsado. */
  startOpen?: boolean;
}

export function AddTaskForm({ projects, onAdd, startOpen = false }: AddTaskFormProps) {
  const [open, setOpen] = useState(startOpen);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>('medium');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await onAdd({ title: trimmed, projectId, priority });
    setTitle('');
    setProjectId(null);
    setPriority('medium');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      setTitle('');
    }
  }

  if (!open && !startOpen) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
      >
        <Plus className="h-4 w-4" />
        Add task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task title…"
        className="h-8 border-none bg-transparent px-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <div className="flex items-center gap-2">
        {/* Project picker */}
        <select
          value={projectId ?? ''}
          onChange={e => setProjectId(e.target.value || null)}
          className="flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">No project</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>

        {/* Priority picker */}
        <div className="flex gap-1">
          {PRIORITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={cn(
                'rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                priority === opt.value
                  ? 'bg-border ' + opt.color
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-1">
          <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={!title.trim()}>
            Add
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => { setOpen(false); setTitle(''); }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </form>
  );
}
