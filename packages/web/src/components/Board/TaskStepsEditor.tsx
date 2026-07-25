import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { TaskStep } from '@core/types';
import { newStepId } from '@core/lib/steps';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface TaskStepsEditorProps {
  steps: TaskStep[];
  onChange: (steps: TaskStep[]) => void;
  /** Empieza desplegado si hay pasos o si se fuerza. */
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  compact?: boolean;
}

export function TaskStepsEditor({
  steps,
  onChange,
  defaultOpen = false,
  open: openControlled,
  onOpenChange,
  className,
}: TaskStepsEditorProps) {
  const { t } = useT();
  const [internalOpen, setInternalOpen] = useState(
    defaultOpen || steps.length > 0
  );
  const open = openControlled ?? internalOpen;

  function setOpen(next: boolean) {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  }

  const done = steps.filter(s => s.completed).length;

  function addStep() {
    onChange([...steps, { id: newStepId(), title: '', completed: false }]);
    setOpen(true);
  }

  function updateStep(id: string, patch: Partial<TaskStep>) {
    onChange(steps.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStep(id: string) {
    onChange(steps.filter(s => s.id !== id));
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-background/40 p-3',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
        )}
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t('task_steps_label')}
        </span>
        {steps.length > 0 && (
          <span className="tabular-nums text-[10px] text-text-muted">
            {done}/{steps.length}
          </span>
        )}
      </button>
      <p className="mt-0.5 pl-6 text-[10px] text-text-muted">{t('task_steps_hint')}</p>

      {open && (
        <div className="mt-2 space-y-1.5 pl-1">
          {steps.length === 0 && (
            <p className="px-1 py-1 text-[11px] text-text-muted">
              {t('task_steps_empty')}
            </p>
          )}
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-1.5 py-1"
            >
              <button
                type="button"
                onClick={() =>
                  updateStep(step.id, { completed: !step.completed })
                }
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                  step.completed
                    ? 'border-accent-green bg-accent-green/20 text-accent-green'
                    : 'border-border hover:border-accent-teal'
                )}
                aria-label={
                  step.completed ? t('habit_done') : t('habit_not_done')
                }
              >
                {step.completed && <Check className="h-3 w-3" />}
              </button>
              <span className="w-4 shrink-0 text-center text-[10px] text-text-muted">
                {index + 1}.
              </span>
              <Input
                value={step.title}
                onChange={e => updateStep(step.id, { title: e.target.value })}
                placeholder={t('task_steps_placeholder')}
                className={cn(
                  'h-8 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0',
                  step.completed && 'text-text-muted line-through'
                )}
              />
              <button
                type="button"
                onClick={() => removeStep(step.id)}
                className="rounded p-1 text-text-muted hover:text-accent-red"
                aria-label={t('action_delete')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addStep}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-xs font-medium text-text-muted hover:border-accent-teal/40 hover:text-accent-teal"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('task_steps_add')}
          </button>
        </div>
      )}
    </div>
  );
}
