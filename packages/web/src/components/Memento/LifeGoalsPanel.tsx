import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Calendar,
  ImagePlus,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
  Mountain,
  Eye,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import { compressImageToDataUrl, newLifeGoalId } from '@/lib/imageCompress';
import { weekIndexForTargetDate } from '@/lib/mementoMori';
import { cn } from '@/lib/utils';
import type { LifeGoal, LifeGoalKind } from '@core/types';

const GOAL_COLORS = [
  '#a371f7',
  '#db61a2',
  '#e3b341',
  '#39c5cf',
  '#f85149',
  '#3fb950',
  '#58a6ff',
  '#d29922',
] as const;

const KIND_OPTIONS: Array<{
  value: LifeGoalKind;
  icon: typeof Target;
  labelKey:
    | 'life_goal_kind_goal'
    | 'life_goal_kind_manifestation'
    | 'life_goal_kind_milestone'
    | 'life_goal_kind_vision';
}> = [
  { value: 'goal', icon: Target, labelKey: 'life_goal_kind_goal' },
  { value: 'manifestation', icon: Sparkles, labelKey: 'life_goal_kind_manifestation' },
  { value: 'milestone', icon: Mountain, labelKey: 'life_goal_kind_milestone' },
  { value: 'vision', icon: Eye, labelKey: 'life_goal_kind_vision' },
];

interface Draft {
  id?: string;
  title: string;
  description: string;
  targetDate: string;
  kind: LifeGoalKind;
  imageDataUrl: string | null;
  color: string;
}

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  targetDate: '',
  kind: 'goal',
  imageDataUrl: null,
  color: GOAL_COLORS[0],
});

export function LifeGoalsPanel() {
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const goals = useMemo(() => {
    const list = Array.isArray(settings.lifeGoals) ? settings.lifeGoals : [];
    return [...list].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  }, [settings.lifeGoals]);

  function openCreate() {
    setDraft({
      ...emptyDraft(),
      color: GOAL_COLORS[goals.length % GOAL_COLORS.length],
    });
    setEditing(true);
  }

  function openEdit(goal: LifeGoal) {
    setDraft({
      id: goal.id,
      title: goal.title,
      description: goal.description ?? '',
      targetDate: goal.targetDate,
      kind: goal.kind ?? 'goal',
      imageDataUrl: goal.imageDataUrl ?? null,
      color: goal.color && /^#[0-9A-Fa-f]{6}$/.test(goal.color) ? goal.color : GOAL_COLORS[0],
    });
    setEditing(true);
  }

  function closeForm() {
    setEditing(false);
    setDraft(emptyDraft());
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    setCompressing(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setDraft(d => ({ ...d, imageDataUrl: dataUrl }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('life_goal_image_error'), 'error');
    } finally {
      setCompressing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function persistGoals(next: LifeGoal[]) {
    setSaving(true);
    try {
      await updateSettings({ lifeGoals: next });
      showToast(t('life_goal_saved'), 'success');
      closeForm();
    } catch {
      showToast(t('life_goal_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      showToast(t('life_goal_title_required'), 'error');
      return;
    }
    if (!draft.targetDate) {
      showToast(t('life_goal_date_required'), 'error');
      return;
    }
    if (settings.birthDate) {
      const idx = weekIndexForTargetDate(
        settings.birthDate,
        draft.targetDate,
        settings.expectedLifespanYears
      );
      if (idx === null) {
        showToast(t('life_goal_date_out_of_map'), 'error');
        return;
      }
    }

    const now = new Date().toISOString();
    const existing = Array.isArray(settings.lifeGoals) ? settings.lifeGoals : [];

    if (draft.id) {
      const next = existing.map(g =>
        g.id === draft.id
          ? {
              ...g,
              title,
              description: draft.description.trim(),
              targetDate: draft.targetDate,
              kind: draft.kind,
              imageDataUrl: draft.imageDataUrl,
              color: draft.color,
              updatedAt: now,
            }
          : g
      );
      await persistGoals(next);
      return;
    }

    if (existing.length >= 24) {
      showToast(t('life_goal_limit'), 'error');
      return;
    }

    const created: LifeGoal = {
      id: newLifeGoalId(),
      title,
      description: draft.description.trim(),
      targetDate: draft.targetDate,
      kind: draft.kind,
      imageDataUrl: draft.imageDataUrl,
      color: draft.color,
      createdAt: now,
      updatedAt: now,
    };
    await persistGoals([...existing, created]);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('life_goal_delete_confirm'))) return;
    const existing = Array.isArray(settings.lifeGoals) ? settings.lifeGoals : [];
    await persistGoals(existing.filter(g => g.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <Star className="h-4 w-4 text-amber-400" />
            {t('life_goals_title')}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-text-muted">{t('life_goals_subtitle')}</p>
        </div>
        {!editing && (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            {t('life_goal_add')}
          </Button>
        )}
      </div>

      {editing && (
        <form
          onSubmit={e => void handleSubmit(e)}
          className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-background shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">
              {draft.id ? t('life_goal_edit') : t('life_goal_new')}
            </p>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md p-1 text-text-muted hover:bg-background hover:text-text-primary"
              aria-label={t('action_close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-[200px_1fr]">
            {/* Photo */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                {t('life_goal_photo')}
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={compressing}
                className={cn(
                  'group relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-background transition-colors',
                  'hover:border-accent-teal/50 hover:bg-accent-teal/5'
                )}
              >
                {draft.imageDataUrl ? (
                  <>
                    <img
                      src={draft.imageDataUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1.5 text-center text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {t('life_goal_change_photo')}
                    </span>
                  </>
                ) : (
                  <span className="flex flex-col items-center gap-2 px-3 text-center text-text-muted">
                    <ImagePlus className="h-8 w-8 opacity-70" />
                    <span className="text-xs">
                      {compressing ? t('life_goal_compressing') : t('life_goal_add_photo')}
                    </span>
                  </span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => void onPickImage(e.target.files?.[0] ?? null)}
              />
              {draft.imageDataUrl && (
                <button
                  type="button"
                  className="text-[11px] text-accent-red hover:underline"
                  onClick={() => setDraft(d => ({ ...d, imageDataUrl: null }))}
                >
                  {t('life_goal_remove_photo')}
                </button>
              )}
            </div>

            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  {t('life_goal_title_label')}
                </span>
                <Input
                  value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder={t('life_goal_title_placeholder')}
                  className="h-11 rounded-xl text-base"
                  maxLength={120}
                  autoFocus
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  {t('life_goal_manifestation')}
                </span>
                <Textarea
                  value={draft.description}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder={t('life_goal_manifestation_placeholder')}
                  className="min-h-[88px] rounded-xl text-sm"
                  maxLength={2000}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    <Calendar className="h-3 w-3" />
                    {t('life_goal_date')}
                  </span>
                  <Input
                    type="date"
                    value={draft.targetDate}
                    onChange={e => setDraft(d => ({ ...d, targetDate: e.target.value }))}
                    className="h-10 rounded-xl"
                  />
                </label>

                <div className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    {t('life_goal_color')}
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {GOAL_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => setDraft(d => ({ ...d, color: c }))}
                        className={cn(
                          'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                          draft.color === c
                            ? 'border-white ring-2 ring-accent-teal scale-110'
                            : 'border-transparent'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  {t('life_goal_kind')}
                </span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {KIND_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const active = draft.kind === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDraft(d => ({ ...d, kind: opt.value }))}
                        className={cn(
                          'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors',
                          active
                            ? 'border-accent-teal/50 bg-accent-teal/15 text-accent-teal'
                            : 'border-border bg-background text-text-muted hover:text-text-primary'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {t(opt.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" size="sm" disabled={saving || compressing}>
                  {saving ? t('life_goal_saving') : t('action_save')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={closeForm}>
                  {t('action_cancel')}
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {goals.length === 0 && !editing ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-amber-400/80" />
          <p className="text-sm font-medium text-text-primary">{t('life_goals_empty')}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">{t('life_goals_empty_hint')}</p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            {t('life_goal_add')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => openEdit(goal)}
              onDelete={() => void handleDelete(goal.id)}
              kindLabel={t(
                KIND_OPTIONS.find(k => k.value === goal.kind)?.labelKey ?? 'life_goal_kind_goal'
              )}
              editLabel={t('action_edit')}
              deleteLabel={t('action_delete')}
              offMapLabel={
                settings.birthDate &&
                weekIndexForTargetDate(
                  settings.birthDate,
                  goal.targetDate,
                  settings.expectedLifespanYears
                ) === null
                  ? t('life_goal_off_map')
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  kindLabel,
  editLabel,
  deleteLabel,
  offMapLabel,
}: {
  goal: LifeGoal;
  onEdit: () => void;
  onDelete: () => void;
  kindLabel: string;
  editLabel: string;
  deleteLabel: string;
  offMapLabel: string | null;
}) {
  const color = goal.color && /^#[0-9A-Fa-f]{6}$/.test(goal.color) ? goal.color : '#a371f7';
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-36 w-full overflow-hidden bg-background">
        {goal.imageDataUrl ? (
          <img src={goal.imageDataUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${color}33, transparent 70%)`,
            }}
          >
            <Sparkles className="h-10 w-10 opacity-40" style={{ color }} />
          </div>
        )}
        <div
          className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow"
          style={{ backgroundColor: color }}
        >
          {kindLabel}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="text-sm font-semibold leading-snug text-text-primary">{goal.title}</h3>
        {goal.description ? (
          <p className="line-clamp-3 text-xs leading-relaxed text-text-muted">{goal.description}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-1.5 pt-1 text-[11px] text-text-muted">
          <Calendar className="h-3 w-3 shrink-0" />
          <time dateTime={goal.targetDate}>{goal.targetDate}</time>
          {offMapLabel ? (
            <span className="ml-auto text-[10px] text-amber-500">{offMapLabel}</span>
          ) : null}
        </div>
        <div className="flex gap-1.5 border-t border-border pt-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <Button type="button" size="sm" variant="outline" className="h-7 flex-1 gap-1 text-[11px]" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
            {editLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px] text-accent-red hover:text-accent-red"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
            {deleteLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}
