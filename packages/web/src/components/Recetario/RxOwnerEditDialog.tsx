import { useEffect, useState } from 'react';
import { PawPrint, User } from 'lucide-react';
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
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import type { RxTreatmentProgress } from '@core/lib/rx';

export interface RxOwnerEditResult {
  kind: 'rx_human' | 'rx_pet';
  subject: string;
}

interface RxOwnerEditDialogProps {
  open: boolean;
  treatment: RxTreatmentProgress | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (result: RxOwnerEditResult) => void;
}

export function RxOwnerEditDialog({
  open,
  treatment,
  saving,
  onOpenChange,
  onSave,
}: RxOwnerEditDialogProps) {
  const { t } = useT();
  const [kind, setKind] = useState<'rx_human' | 'rx_pet'>('rx_human');
  const [subject, setSubject] = useState('');

  useEffect(() => {
    if (!treatment || !open) return;
    setKind(treatment.kind);
    setSubject(treatment.subject ?? '');
  }, [treatment, open]);

  if (!treatment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rx_edit_owner_title')}</DialogTitle>
          <DialogDescription>
            {t('rx_edit_owner_desc').replace('{title}', treatment.title)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-muted">
              {t('rx_edit_owner_kind')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('rx_human')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors',
                  kind === 'rx_human'
                    ? 'border-accent-teal bg-accent-teal/15 text-accent-teal'
                    : 'border-border text-text-muted hover:bg-background'
                )}
              >
                <User className="h-3.5 w-3.5" />
                {t('task_kind_rx_human')}
              </button>
              <button
                type="button"
                onClick={() => setKind('rx_pet')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors',
                  kind === 'rx_pet'
                    ? 'border-accent-pink bg-accent-pink/15 text-accent-pink'
                    : 'border-border text-text-muted hover:bg-background'
                )}
              >
                <PawPrint className="h-3.5 w-3.5" />
                {t('task_kind_rx_pet')}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {kind === 'rx_pet' ? t('rx_pet_name') : t('rx_patient_name')}
            </label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={
                kind === 'rx_pet' ? t('rx_pet_placeholder') : t('rx_patient_placeholder')
              }
              maxLength={120}
              autoFocus
            />
            <p className="mt-1 text-[11px] text-text-muted">{t('rx_edit_owner_hint')}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t('action_cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() =>
              onSave({
                kind,
                subject: subject.trim(),
              })
            }
          >
            {saving ? t('life_goal_saving') : t('action_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
