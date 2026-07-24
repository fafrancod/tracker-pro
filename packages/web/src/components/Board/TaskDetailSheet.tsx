import { useEffect, useState, useMemo, type KeyboardEvent } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Trash2,
  Copy,
  ArrowRight,
  Calendar,
  Tag as TagIcon,
  X,
  CheckCircle2,
} from 'lucide-react';
import {
  SideSheet,
  SideSheetContent,
  SideSheetDescription,
  SideSheetHeader,
  SideSheetTitle,
} from '@/components/ui/side-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@core/store';
import { useTasks } from '@core/hooks/useTasks';
import { useProjects } from '@core/hooks/useProjects';
import { useWeek } from '@core/hooks/useWeek';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';
import type { Priority } from '@core/types';

const PRIORITIES: { value: Priority; key: 'task_priority_low' | 'task_priority_medium' | 'task_priority_high'; color: string }[] = [
  { value: 'low', key: 'task_priority_low', color: 'text-text-muted' },
  { value: 'medium', key: 'task_priority_medium', color: 'text-accent-teal' },
  { value: 'high', key: 'task_priority_high', color: 'text-accent-red' },
];

export function TaskDetailSheet() {
  const { locale, shortDateFormat, weekdayFormat, t } = useT();
  const { showToast } = useToast();
  const { projects } = useProjects();
  const detail = useStore(s => s.detailTask);
  const setDetailTask = useStore(s => s.setDetailTask);

  const open = detail !== null;

  return (
    <SideSheet open={open} onOpenChange={(o) => !o && setDetailTask(null)}>
      <SideSheetContent>
        {detail && (
          <TaskDetailInner
            weekId={detail.weekId}
            dayId={detail.dayId}
            taskId={detail.taskId}
            locale={locale}
            shortDateFormat={shortDateFormat}
            weekdayFormat={weekdayFormat}
            projects={projects}
            onClose={() => setDetailTask(null)}
            t={t}
            showToast={showToast}
          />
        )}
      </SideSheetContent>
    </SideSheet>
  );
}

interface InnerProps {
  weekId: string;
  dayId: string;
  taskId: string;
  locale: Awaited<ReturnType<typeof useT>>['locale'];
  shortDateFormat: string;
  weekdayFormat: string;
  projects: ReturnType<typeof useProjects>['projects'];
  onClose: () => void;
  t: (key: Parameters<ReturnType<typeof useT>['t']>[0]) => string;
  showToast: ReturnType<typeof useToast>['showToast'];
}

function TaskDetailInner({
  weekId,
  dayId,
  taskId,
  locale,
  shortDateFormat,
  weekdayFormat,
  projects,
  onClose,
  t,
  showToast,
}: InnerProps) {
  const { tasks, editTask, removeTask, moveTaskToDay, addTask } = useTasks(weekId, dayId);
  const { days, nextWeekId } = useWeek({ locale, weekdayFormat, shortDateFormat });

  const task = useMemo(() => tasks.find(t => t.id === taskId) ?? null, [tasks, taskId]);

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes);
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        Esta tarea ya no existe.
      </div>
    );
  }

  const project = projects.find(p => p.id === task.projectId);

  async function handleTitleBlur() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task!.title) {
      await editTask(task!.id, { title: trimmed });
    } else if (!trimmed) {
      setTitle(task!.title);
    }
  }

  async function handleNotesBlur() {
    if (notes !== task!.notes) {
      await editTask(task!.id, { notes });
    }
  }

  async function handleTagKeydown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = tagInput.trim().replace(/,$/, '');
      if (!value) return;
      if (task!.tags.includes(value)) {
        setTagInput('');
        return;
      }
      await editTask(task!.id, { tags: [...task!.tags, value] });
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && task!.tags.length > 0) {
      const next = task!.tags.slice(0, -1);
      await editTask(task!.id, { tags: next });
    }
  }

  async function removeTag(tag: string) {
    await editTask(task!.id, { tags: task!.tags.filter(t => t !== tag) });
  }

  async function handleDuplicate() {
    await addTask({
      title: task!.title,
      projectId: task!.projectId,
      priority: task!.priority,
      notes: task!.notes,
      tags: task!.tags,
      recurrenceFrequency: task!.recurrence.frequency,
      recurrenceInterval: task!.recurrence.interval,
    });
    showToast('Tarea duplicada.', 'success');
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${task!.title}"?`)) return;
    await removeTask(task!.id);
    showToast('Tarea eliminada.', 'info');
    onClose();
  }

  async function handleMoveDay(targetDate: Date) {
    await moveTaskToDay(task!, targetDate);
    showToast('Tarea movida.', 'success');
    onClose();
  }

  async function handleMoveNextWeek() {
    const [yearStr, weekStr] = nextWeekId.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);
    const jan4 = new Date(year, 0, 4);
    const start = new Date(jan4);
    start.setDate(jan4.getDate() + (week - 1) * 7);
    await moveTaskToDay(task!, start);
    showToast('Movida a la próxima semana.', 'success');
    onClose();
  }

  return (
    <>
      <SideSheetHeader>
        <SideSheetTitle>Detalle de tarea</SideSheetTitle>
        <SideSheetDescription>
          {project ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
              {project.icon} {project.name}
            </span>
          ) : (
            'Sin proyecto'
          )}
          {' · '}
          {format(parseISO(`${dayId}T00:00:00`), `EEEE, ${shortDateFormat}`, { locale })}
          {task.endDayId && task.endDayId > dayId && (
            <>
              {' – '}
              {format(parseISO(`${task.endDayId}T00:00:00`), shortDateFormat, { locale })}
            </>
          )}
        </SideSheetDescription>
      </SideSheetHeader>

      <div className="-mx-2 flex-1 overflow-y-auto px-2">
        {/* Title + completed */}
        <div className="mb-4 flex items-start gap-3">
          <button
            onClick={() => editTask(task.id, { completed: !task.completed })}
            className={cn(
              'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
              task.completed
                ? 'border-accent-green bg-accent-green/20 text-accent-green'
                : 'border-border hover:border-accent-green'
            )}
            aria-label={task.completed ? 'Desmarcar' : 'Completar'}
          >
            {task.completed && <CheckCircle2 className="h-3 w-3" />}
          </button>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder={t('task_title_placeholder')}
            className={cn(
              'h-9 border-none bg-transparent px-0 text-base font-medium focus-visible:ring-0',
              task.completed && 'text-text-muted line-through'
            )}
          />
        </div>

        {task.completed && task.completedAt && (
          <p className="mb-3 text-[11px] text-text-muted">
            ✓ Completada {format(parseISO(task.completedAt), `EEE ${shortDateFormat} · HH:mm`, { locale })}
          </p>
        )}

        {/* Date range */}
        <Field label={t('task_date_range')}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('task_start_date')}</span>
              <input
                type="date"
                value={dayId}
                readOnly
                className="rounded border border-border bg-background px-2 py-1 text-xs text-text-primary opacity-80"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('task_end_date')}</span>
              <input
                type="date"
                value={task.endDayId || dayId}
                min={dayId}
                onChange={e => {
                  const next = e.target.value || dayId;
                  if (next >= dayId) void editTask(task.id, { endDayId: next });
                }}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
        </Field>

        {/* Priority */}
        <Field label="Prioridad">
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => editTask(task.id, { priority: p.value })}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  task.priority === p.value
                    ? `bg-surface ${p.color}`
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t(p.key)}
              </button>
            ))}
          </div>
        </Field>

        {/* Project */}
        <Field label="Proyecto">
          <select
            value={task.projectId ?? ''}
            onChange={e => editTask(task.id, { projectId: e.target.value || null })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">{t('task_no_project')}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
        </Field>

        {/* Tags */}
        <Field
          label={
            <span className="inline-flex items-center gap-1">
              <TagIcon className="h-3 w-3" />
              Tags
            </span>
          }
        >
          <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-2">
            {task.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1 text-[11px]">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label={`Eliminar ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeydown}
              placeholder={task.tags.length === 0 ? 'Enter o , para agregar…' : ''}
              className="flex-1 min-w-[80px] bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </Field>

        {/* Notes */}
        <Field label={t('task_notes')}>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={8}
            placeholder="Notas, ideas, links… (se guarda al perder foco)"
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {notes && (
            <p className="mt-1 text-[10px] text-text-muted">
              {notes.split('\n').length} líneas · {notes.length} caracteres
            </p>
          )}
        </Field>

        {/* Move actions */}
        <Field
          label={
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {t('task_move_to')}
            </span>
          }
        >
          <div className="grid grid-cols-3 gap-1">
            {days.map(d => (
              <button
                key={d.dayId}
                type="button"
                onClick={() => handleMoveDay(d.date)}
                disabled={d.dayId === dayId}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-[11px] transition-colors',
                  d.dayId === dayId
                    ? 'border-border bg-background text-text-muted opacity-50 cursor-not-allowed'
                    : 'border-border bg-background text-text-primary hover:border-accent-teal/40'
                )}
              >
                {d.label.slice(0, 3)}
                <span className="ml-1 text-text-muted">{d.dateLabel}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleMoveNextWeek}
              className="col-span-3 mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-text-primary hover:border-accent-teal/40"
            >
              {t('task_move_next_week')}
            </button>
          </div>
        </Field>

        {/* History */}
        {task.movedFrom && (
          <p className="mt-3 rounded-md border border-border bg-background p-2 text-[10px] text-text-muted">
            ↩ Movida desde <code className="text-text-primary">{task.movedFrom}</code>
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-2 flex gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={handleDuplicate} className="flex-1 gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          {t('task_duplicate')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          className="flex-1 gap-1.5 border-accent-red/40 text-accent-red hover:bg-accent-red/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('action_delete')}
        </Button>
        <Button size="sm" onClick={onClose} className="gap-1.5">
          OK
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="mt-2 text-[10px] text-text-muted">
        Última actualización:{' '}
        {format(parseISO(task.updatedAt), `EEE ${shortDateFormat} HH:mm`, { locale })}
      </p>
    </>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</p>
      {children}
    </div>
  );
}
