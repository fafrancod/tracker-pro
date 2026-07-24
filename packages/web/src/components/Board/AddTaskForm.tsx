import { useState, useRef, useEffect } from 'react';
import { Plus, X, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import type { Project, CreateTaskPayload, Priority, RecurrenceFrequency } from '@core/types';

const PRIORITY_OPTIONS: { value: Priority; labelKey: 'task_priority_low' | 'task_priority_medium' | 'task_priority_high'; color: string }[] = [
  { value: 'low', labelKey: 'task_priority_low', color: 'text-text-muted' },
  { value: 'medium', labelKey: 'task_priority_medium', color: 'text-accent-teal' },
  { value: 'high', labelKey: 'task_priority_high', color: 'text-accent-red' },
];

const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; labelKey: 'task_repeat_none' | 'task_repeat_daily' | 'task_repeat_weekly' | 'task_repeat_monthly' }[] = [
  { value: 'none', labelKey: 'task_repeat_none' },
  { value: 'daily', labelKey: 'task_repeat_daily' },
  { value: 'weekly', labelKey: 'task_repeat_weekly' },
  { value: 'monthly', labelKey: 'task_repeat_monthly' },
];

interface AddTaskFormProps {
  projects: Project[];
  onAdd: (payload: CreateTaskPayload) => Promise<void>;
  /** Si está en true, el formulario arranca expandido y oculta el botón colapsado. */
  startOpen?: boolean;
}

export function AddTaskForm({ projects, onAdd, startOpen = false }: AddTaskFormProps) {
  const { t } = useT();
  const [open, setOpen] = useState(startOpen);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>('medium');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await onAdd({
      title: trimmed,
      projectId,
      priority,
      recurrenceFrequency,
      recurrenceInterval: recurrenceFrequency === 'none' ? 1 : recurrenceInterval,
    });
    setTitle('');
    setProjectId(null);
    setPriority('medium');
    setRecurrenceFrequency('none');
    setRecurrenceInterval(1);
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
        {t('board_add_task')}
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
        placeholder={t('task_title_placeholder')}
        className="h-8 border-none bg-transparent px-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={projectId ?? ''}
          onChange={e => setProjectId(e.target.value || null)}
          className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">{t('task_no_project')}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>

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
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Recurrencia */}
      <div className="flex flex-wrap items-center gap-2 rounded border border-border/60 bg-background/50 px-2 py-1.5">
        <Repeat className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
        <select
          value={recurrenceFrequency}
          onChange={e => setRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
          className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={t('task_repeat')}
        >
          {RECURRENCE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>

        {recurrenceFrequency !== 'none' && (
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <span>{t('task_repeat_every')}</span>
            <input
              type="number"
              min={1}
              max={365}
              value={recurrenceInterval}
              onChange={e => setRecurrenceInterval(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
              className="w-12 rounded border border-border bg-background px-1 py-0.5 text-center text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span>
              {recurrenceFrequency === 'daily'
                ? t('task_repeat_unit_days')
                : recurrenceFrequency === 'weekly'
                  ? t('task_repeat_unit_weeks')
                  : t('task_repeat_unit_months')}
            </span>
          </label>
        )}
      </div>

      <div className="flex justify-end gap-1">
        <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={!title.trim()}>
          {t('action_add_task')}
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
    </form>
  );
}
