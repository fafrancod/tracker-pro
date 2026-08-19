import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { TASK_COLOR_PRESETS } from '@/components/Board/AddTaskForm';

export interface GanttCategoryEditValue {
  projectId: string;
  categoryId: string;
  name: string;
  urgencyColor: string | null;
  importanceColor: string | null;
}

interface GanttCategoryDialogProps {
  open: boolean;
  value: GanttCategoryEditValue | null;
  onOpenChange: (open: boolean) => void;
  onSave: (value: GanttCategoryEditValue) => Promise<void>;
}

function ColorRow({
  label,
  value,
  onChange,
  noneLabel,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  noneLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          title={noneLabel}
          onClick={() => onChange(null)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed text-[10px] text-text-muted',
            value === null
              ? 'border-accent-teal ring-2 ring-accent-teal/30'
              : 'border-border hover:border-text-muted'
          )}
        >
          —
        </button>
        {TASK_COLOR_PRESETS.map(c => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            className={cn(
              'h-8 w-8 rounded-full border-2 border-transparent transition-transform hover:scale-110',
              value === c && 'ring-2 ring-white/80 ring-offset-2 ring-offset-surface scale-110'
            )}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

export function GanttCategoryDialog({
  open,
  value,
  onOpenChange,
  onSave,
}: GanttCategoryDialogProps) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [urgencyColor, setUrgencyColor] = useState<string | null>(null);
  const [importanceColor, setImportanceColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !value) return;
    setName(value.name);
    setUrgencyColor(value.urgencyColor);
    setImportanceColor(value.importanceColor);
  }, [open, value]);

  async function handleSave() {
    if (!value || !name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...value,
        name: name.trim(),
        urgencyColor,
        importanceColor,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('gantt_category_edit_title')}</DialogTitle>
          <DialogDescription>{t('gantt_category_edit_desc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-text-muted">
              {t('gantt_rename_subproject')}
            </span>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
              autoFocus
            />
          </label>
          <ColorRow
            label={t('gantt_category_urgency_color')}
            value={urgencyColor}
            onChange={setUrgencyColor}
            noneLabel={t('task_color_auto')}
          />
          <ColorRow
            label={t('gantt_category_importance_color')}
            value={importanceColor}
            onChange={setImportanceColor}
            noneLabel={t('task_color_auto')}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('action_cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
          >
            {t('action_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
