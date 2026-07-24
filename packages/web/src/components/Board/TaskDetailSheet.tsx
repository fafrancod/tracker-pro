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
  Save,
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
import type {
  Importance,
  Priority,
  Task,
  TaskApplyTo,
  TaskKind,
  Urgency,
} from '@core/types';

const PRIORITIES: {
  value: Priority;
  key: 'task_priority_low' | 'task_priority_medium' | 'task_priority_high';
  color: string;
}[] = [
  { value: 'low', key: 'task_priority_low', color: 'text-text-muted' },
  { value: 'medium', key: 'task_priority_medium', color: 'text-accent-teal' },
  { value: 'high', key: 'task_priority_high', color: 'text-accent-red' },
];

const COLOR_SWATCHES = [
  '#58a6ff',
  '#3fb950',
  '#d29922',
  '#f85149',
  '#a371f7',
  '#db61a2',
  '#39c5cf',
  '#e3b341',
];

interface DraftState {
  title: string;
  notes: string;
  tags: string[];
  kind: TaskKind;
  priority: Priority;
  urgency: Urgency | null;
  importance: Importance | null;
  color: string | null;
  projectId: string | null;
  endDayId: string;
  startTime: string;
  endTime: string;
}

function taskToDraft(task: Task, fallbackDayId: string): DraftState {
  return {
    title: task.title,
    notes: task.notes,
    tags: [...task.tags],
    kind: task.kind,
    priority: task.priority,
    urgency: task.urgency,
    importance: task.importance,
    color: task.color,
    projectId: task.projectId,
    endDayId: task.endDayId || fallbackDayId,
    startTime: task.startTime ?? '',
    endTime: task.endTime ?? '',
  };
}

function isDirty(draft: DraftState, task: Task, dayId: string): boolean {
  const base = taskToDraft(task, dayId);
  return (
    draft.title.trim() !== base.title ||
    draft.notes !== base.notes ||
    draft.kind !== base.kind ||
    draft.priority !== base.priority ||
    draft.urgency !== base.urgency ||
    draft.importance !== base.importance ||
    draft.color !== base.color ||
    draft.projectId !== base.projectId ||
    draft.endDayId !== base.endDayId ||
    draft.startTime !== base.startTime ||
    draft.endTime !== base.endTime ||
    draft.tags.join('\0') !== base.tags.join('\0')
  );
}

export function TaskDetailSheet() {
  const { locale, shortDateFormat, weekdayFormat, t } = useT();
  const { showToast } = useToast();
  const { projects } = useProjects();
  const detail = useStore(s => s.detailTask);
  const setDetailTask = useStore(s => s.setDetailTask);

  const open = detail !== null;

  return (
    <SideSheet open={open} onOpenChange={o => !o && setDetailTask(null)}>
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

  const task = useMemo(() => tasks.find(x => x.id === taskId) ?? null, [tasks, taskId]);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setDraft(taskToDraft(task, dayId));
      setTagInput('');
    }
  }, [task?.id, dayId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task || !draft) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        Esta tarea ya no existe.
      </div>
    );
  }

  const project = projects.find(p => p.id === task.projectId);
  const dirty = isDirty(draft, task, dayId);
  const isSeries = Boolean(task.seriesId);

  function patchDraft(partial: Partial<DraftState>) {
    setDraft(prev => (prev ? { ...prev, ...partial } : prev));
  }

  async function handleSave(applyTo: TaskApplyTo) {
    if (!task || !draft) return;
    const title = draft.title.trim();
    if (!title) {
      showToast(t('task_title_required'), 'error');
      return;
    }
    setSaving(true);
    try {
      await editTask(task.id, {
        title,
        notes: draft.notes,
        tags: draft.tags,
        kind: draft.kind,
        priority: draft.priority,
        urgency: draft.urgency,
        importance: draft.importance,
        color: draft.color,
        projectId: draft.projectId,
        endDayId: draft.endDayId,
        startTime: draft.startTime || null,
        endTime: draft.endTime || null,
        applyTo: isSeries ? applyTo : 'instance',
      });
      showToast(
        applyTo === 'series' && isSeries
          ? t('task_saved_series')
          : t('task_saved_instance'),
        'success'
      );
      onClose();
    } catch {
      showToast(t('task_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleTagKeydown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = tagInput.trim().replace(/,$/, '');
      if (!value) return;
      if (draft!.tags.includes(value)) {
        setTagInput('');
        return;
      }
      patchDraft({ tags: [...draft!.tags, value] });
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && draft!.tags.length > 0) {
      patchDraft({ tags: draft!.tags.slice(0, -1) });
    }
  }

  function removeTag(tag: string) {
    patchDraft({ tags: draft!.tags.filter(x => x !== tag) });
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
      kind: task!.kind,
      color: task!.color,
      urgency: task!.urgency,
      importance: task!.importance,
    });
    showToast(t('task_duplicated'), 'success');
  }

  async function handleDelete() {
    if (!confirm(`${t('task_delete_confirm')} «${task!.title}»?`)) return;
    await removeTask(task!.id);
    showToast(t('task_deleted'), 'info');
    onClose();
  }

  async function handleMoveDay(targetDate: Date) {
    await moveTaskToDay(task!, targetDate);
    showToast(t('task_moved'), 'success');
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
    showToast(t('task_moved_next_week'), 'success');
    onClose();
  }

  return (
    <>
      <SideSheetHeader>
        <SideSheetTitle>{t('task_detail_title')}</SideSheetTitle>
        <SideSheetDescription>
          {project ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
              {project.icon} {project.name}
            </span>
          ) : (
            t('task_no_project')
          )}
          {' · '}
          {format(parseISO(`${dayId}T00:00:00`), `EEEE, ${shortDateFormat}`, { locale })}
          {task.endDayId && task.endDayId > dayId && (
            <>
              {' – '}
              {format(parseISO(`${task.endDayId}T00:00:00`), shortDateFormat, { locale })}
            </>
          )}
          {isSeries && (
            <span className="ml-1 text-accent-teal"> · {t('task_part_of_series')}</span>
          )}
        </SideSheetDescription>
      </SideSheetHeader>

      <div className="-mx-2 flex-1 overflow-y-auto px-2">
        {/* Title + completed (completed is immediate / instance-only) */}
        <div className="mb-4 flex items-start gap-3">
          <button
            type="button"
            onClick={() => editTask(task.id, { completed: !task.completed })}
            className={cn(
              'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
              task.completed
                ? 'border-accent-green bg-accent-green/20 text-accent-green'
                : 'border-border hover:border-accent-green'
            )}
            aria-label={task.completed ? t('task_uncomplete') : t('task_complete')}
          >
            {task.completed && <CheckCircle2 className="h-3 w-3" />}
          </button>
          <Input
            value={draft.title}
            onChange={e => patchDraft({ title: e.target.value })}
            placeholder={t('task_title_placeholder')}
            className={cn(
              'h-9 border-none bg-transparent px-0 text-base font-medium focus-visible:ring-0',
              task.completed && 'text-text-muted line-through'
            )}
          />
        </div>

        {task.completed && task.completedAt && (
          <p className="mb-3 text-[11px] text-text-muted">
            ✓ {t('task_completed_at')}{' '}
            {format(parseISO(task.completedAt), `EEE ${shortDateFormat} · HH:mm`, { locale })}
          </p>
        )}

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
                value={draft.endDayId || dayId}
                min={dayId}
                onChange={e => {
                  const next = e.target.value || dayId;
                  if (next >= dayId) patchDraft({ endDayId: next });
                }}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
        </Field>

        <Field label={t('task_schedule')}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('task_start_time')}</span>
              <input
                type="time"
                value={draft.startTime}
                onChange={e => patchDraft({ startTime: e.target.value })}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-text-muted">
              <span>{t('task_end_time')}</span>
              <input
                type="time"
                value={draft.endTime}
                min={draft.startTime || undefined}
                onChange={e => patchDraft({ endTime: e.target.value })}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            {(draft.startTime || draft.endTime) && (
              <button
                type="button"
                className="text-[10px] text-text-muted hover:text-text-primary"
                onClick={() => patchDraft({ startTime: '', endTime: '' })}
              >
                {t('task_clear_time')}
              </button>
            )}
          </div>
        </Field>

        <Field label={`${t('task_kind_task')} / ${t('task_kind_reminder')}`}>
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            {(['task', 'reminder'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => patchDraft({ kind: k })}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  draft.kind === k
                    ? 'bg-accent-teal/15 text-accent-teal'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {k === 'task' ? t('task_kind_task') : t('task_kind_reminder')}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('task_priority_label')}>
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => patchDraft({ priority: p.value })}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  draft.priority === p.value
                    ? `bg-surface ${p.color}`
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t(p.key)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('board_filter_urgency')}>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { v: null, label: t('board_filter_all') },
                { v: 'urgent', label: t('urgency_urgent') },
                { v: 'not_urgent', label: t('urgency_not_urgent') },
              ] as Array<{ v: Urgency | null; label: string }>
            ).map(opt => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => patchDraft({ urgency: opt.v })}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                  draft.urgency === opt.v
                    ? 'border-accent-teal/40 bg-accent-teal/15 text-accent-teal'
                    : 'border-border text-text-muted hover:text-text-primary'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('board_filter_importance')}>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { v: null, label: t('board_filter_all') },
                { v: 'important', label: t('importance_important') },
                { v: 'not_important', label: t('importance_not_important') },
              ] as Array<{ v: Importance | null; label: string }>
            ).map(opt => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => patchDraft({ importance: opt.v })}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                  draft.importance === opt.v
                    ? 'border-accent-teal/40 bg-accent-teal/15 text-accent-teal'
                    : 'border-border text-text-muted hover:text-text-primary'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('task_color')}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => patchDraft({ color: null })}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-border text-[10px] text-text-muted',
                !draft.color && 'border-accent-teal ring-1 ring-accent-teal/40'
              )}
            >
              —
            </button>
            {COLOR_SWATCHES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => patchDraft({ color: c })}
                className={cn(
                  'h-7 w-7 rounded-full border-2 border-transparent',
                  draft.color === c && 'ring-2 ring-white/70 ring-offset-1 ring-offset-surface'
                )}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>

        <Field label={t('task_project_label')}>
          <select
            value={draft.projectId ?? ''}
            onChange={e => patchDraft({ projectId: e.target.value || null })}
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

        <Field
          label={
            <span className="inline-flex items-center gap-1">
              <TagIcon className="h-3 w-3" />
              Tags
            </span>
          }
        >
          <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background p-2">
            {draft.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1 text-[11px]">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label={`${t('action_delete')} ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeydown}
              placeholder={draft.tags.length === 0 ? t('task_tags_placeholder') : ''}
              className="min-w-[80px] flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </Field>

        <Field label={t('task_notes')}>
          <textarea
            value={draft.notes}
            onChange={e => patchDraft({ notes: e.target.value })}
            rows={8}
            placeholder={t('task_notes_placeholder')}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>

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
                    ? 'cursor-not-allowed border-border bg-background text-text-muted opacity-50'
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

        {task.movedFrom && (
          <p className="mt-3 rounded-md border border-border bg-background p-2 text-[10px] text-text-muted">
            ↩ {t('task_moved_from')} <code className="text-text-primary">{task.movedFrom}</code>
          </p>
        )}
      </div>

      {/* Save scope — before secondary actions */}
      {dirty && (
        <div className="mt-2 space-y-2 border-t border-border pt-3">
          {isSeries ? (
            <>
              <p className="text-[11px] text-text-muted">{t('task_save_scope_hint')}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void handleSave('instance')}
                  className="flex-1 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {t('task_save_this')}
                </Button>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleSave('series')}
                  className="flex-1 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {t('task_save_series')}
                </Button>
              </div>
            </>
          ) : (
            <Button
              size="sm"
              disabled={saving}
              onClick={() => void handleSave('instance')}
              className="w-full gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {t('action_save')}
            </Button>
          )}
          <button
            type="button"
            className="w-full text-center text-[11px] text-text-muted hover:text-text-primary"
            onClick={() => setDraft(taskToDraft(task, dayId))}
          >
            {t('task_discard_changes')}
          </button>
        </div>
      )}

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
        <Button size="sm" onClick={onClose} className="gap-1.5" variant={dirty ? 'outline' : 'default'}>
          {dirty ? t('action_close') : 'OK'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="mt-2 text-[10px] text-text-muted">
        {t('task_last_updated')}:{' '}
        {format(parseISO(task.updatedAt), `EEE ${shortDateFormat} HH:mm`, { locale })}
      </p>
    </>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}
