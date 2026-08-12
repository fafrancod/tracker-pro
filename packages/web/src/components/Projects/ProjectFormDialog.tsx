import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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
import type { Project, ProjectCategory } from '@core/types';
import {
  MAX_PROJECT_CATEGORIES,
  newProjectCategoryId,
  normalizeProjectCategories,
} from '@core/lib/projectCategories';
import { useT } from '@/hooks/useT';

const EMOJI_SUGGESTIONS = ['📁', '🚀', '🧠', '💡', '🏠', '💼', '🎯', '🛠️', '📚', '🎨', '🌱', '🔥'];

export interface ProjectFormValue {
  name: string;
  color: string;
  icon: string;
  categories: ProjectCategory[];
}

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Project | null;
  onSubmit: (value: ProjectFormValue) => Promise<void>;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: ProjectFormDialogProps) {
  const { t } = useT();
  const isEdit = Boolean(initial);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(projectColors[0]);
  const [icon, setIcon] = useState('📁');
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setColor(initial?.color ?? projectColors[0]);
      setIcon(initial?.icon ?? '📁');
      setCategories(normalizeProjectCategories(initial?.categories ?? []));
      setNewCategoryName('');
    }
  }, [open, initial]);

  function addCategory() {
    const trimmed = newCategoryName.trim().slice(0, 40);
    if (!trimmed) return;
    if (categories.length >= MAX_PROJECT_CATEGORIES) return;
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewCategoryName('');
      return;
    }
    setCategories(prev =>
      normalizeProjectCategories([
        ...prev,
        { id: newProjectCategoryId(), name: trimmed, order: prev.length },
      ])
    );
    setNewCategoryName('');
  }

  function removeCategory(id: string) {
    setCategories(prev =>
      normalizeProjectCategories(prev.filter(c => c.id !== id))
    );
  }

  function renameCategory(id: string, nextName: string) {
    setCategories(prev =>
      normalizeProjectCategories(
        prev.map(c => (c.id === id ? { ...c, name: nextName } : c))
      )
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      await onSubmit({
        name: name.trim(),
        color,
        icon,
        categories: normalizeProjectCategories(categories),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('project_edit_title') : t('project_new_title')}
          </DialogTitle>
          <DialogDescription>{t('project_form_desc')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {t('project_name_label')}
            </label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('project_name_ph')}
              maxLength={60}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {t('project_color_label')}
            </label>
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
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {t('project_icon_label')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_SUGGESTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md border text-base transition-colors',
                    icon === e
                      ? 'border-accent-teal bg-accent-teal/10'
                      : 'border-border hover:bg-surface'
                  )}
                >
                  {e}
                </button>
              ))}
              <Input
                value={icon}
                onChange={e => setIcon(e.target.value.slice(0, 4))}
                className="h-8 w-16 text-center"
                placeholder="…"
              />
            </div>
          </div>

          {/* Subcategorías */}
          <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
            <div>
              <p className="text-xs font-medium text-text-primary">
                {t('project_categories_label')}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {t('project_categories_hint')}
              </p>
            </div>

            {categories.length > 0 && (
              <ul className="space-y-1.5">
                {categories.map(cat => (
                  <li key={cat.id} className="flex items-center gap-1.5">
                    <Input
                      value={cat.name}
                      onChange={e => renameCategory(cat.id, e.target.value)}
                      maxLength={40}
                      className="h-8 flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeCategory(cat.id)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface hover:text-accent-red"
                      aria-label={t('project_category_remove')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {categories.length < MAX_PROJECT_CATEGORIES && (
              <div className="flex gap-1.5">
                <Input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCategory();
                    }
                  }}
                  placeholder={t('project_category_ph')}
                  maxLength={40}
                  className="h-8 flex-1 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 px-2"
                  onClick={addCategory}
                  disabled={!newCategoryName.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('project_category_add')}
                </Button>
              </div>
            )}
            <p className="text-[10px] text-text-muted">
              {t('project_categories_max').replace(
                '{n}',
                String(MAX_PROJECT_CATEGORIES)
              )}
            </p>
          </div>

          <div className="rounded-md border border-border bg-background p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">
              Preview
            </p>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
              style={{ backgroundColor: color + '33', color }}
            >
              {icon} {name || t('project_unnamed')}
            </span>
            {categories.length > 0 && (
              <p className="mt-1.5 text-[11px] text-text-muted">
                {categories.map(c => c.name).join(' · ')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('action_cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEdit ? (
                t('action_save')
              ) : (
                t('action_create')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
