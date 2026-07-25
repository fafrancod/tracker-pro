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
import { useT } from '@/hooks/useT';
import { normalizeTag } from '@core/lib/tags';
import type { TKey } from '@/lib/i18n';
import type {
  Contact,
  ContactKind,
  PersonRelationship,
  RelationPulse,
} from '@core/types';

export interface ContactFormValue {
  kind: ContactKind;
  name: string;
  tags: string[];
  relationship: PersonRelationship | null;
  relationPulse: RelationPulse | null;
}

const RELATIONSHIPS: PersonRelationship[] = [
  'father',
  'mother',
  'son',
  'daughter',
  'niece',
  'nephew',
  'friend',
  'coworker',
];

export const RELATION_PULSES: RelationPulse[] = [
  'great',
  'good',
  'neutral',
  'need_connect',
  'strained',
  'bad',
];

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Contact | null;
  onSubmit: (value: ContactFormValue) => Promise<void>;
}

export function ContactFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: ContactFormDialogProps) {
  const { t } = useT();
  const isEdit = Boolean(initial);
  const [kind, setKind] = useState<ContactKind>('person');
  const [name, setName] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [relationship, setRelationship] = useState<PersonRelationship | ''>('');
  const [relationPulse, setRelationPulse] = useState<RelationPulse | ''>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? 'person');
    setName(initial?.name ?? '');
    setTagsText((initial?.tags ?? []).join(', '));
    setRelationship(initial?.relationship ?? '');
    setRelationPulse(initial?.relationPulse ?? '');
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    // Solo coma/punto y coma: permite tags multi-palabra («compañero trabajo»).
    const tags = tagsText
      .split(/[,;]+/)
      .map(normalizeTag)
      .filter(Boolean);
    try {
      setSubmitting(true);
      await onSubmit({
        kind,
        name: name.trim(),
        tags,
        relationship: kind === 'person' && relationship ? relationship : null,
        relationPulse: relationPulse || null,
      });
      onOpenChange(false);
    } catch {
      // El padre ya muestra toast; no cerramos el diálogo.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('circle_edit') : t('circle_new')}
          </DialogTitle>
          <DialogDescription>{t('circle_form_desc')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-muted">
              {t('circle_kind')}
            </span>
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setKind('person')}
                className={cn(
                  'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                  kind === 'person'
                    ? 'bg-accent-teal/15 text-accent-teal'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t('circle_kind_person')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setKind('pet');
                  setRelationship('');
                }}
                className={cn(
                  'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                  kind === 'pet'
                    ? 'bg-accent-teal/15 text-accent-teal'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t('circle_kind_pet')}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {t('circle_name')}
            </label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={
                kind === 'pet' ? t('circle_name_ph_pet') : t('circle_name_ph_person')
              }
              maxLength={80}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              {t('circle_tags')}
            </label>
            <Input
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
              placeholder={t('circle_tags_ph')}
              maxLength={120}
            />
            <p className="mt-1 text-[10px] text-text-muted">{t('circle_tags_hint')}</p>
          </div>

          {kind === 'person' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                {t('circle_relationship')}
              </label>
              <select
                value={relationship}
                onChange={e =>
                  setRelationship((e.target.value || '') as PersonRelationship | '')
                }
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t('circle_relationship_none')}</option>
                {RELATIONSHIPS.map(r => (
                  <option key={r} value={r}>
                    {t(`circle_rel_${r}` as TKey)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {kind === 'person' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                {t('circle_pulse')}
              </label>
              <select
                value={relationPulse}
                onChange={e =>
                  setRelationPulse((e.target.value || '') as RelationPulse | '')
                }
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t('circle_pulse_none')}</option>
                {RELATION_PULSES.map(p => (
                  <option key={p} value={p}>
                    {t(`circle_pulse_${p}` as TKey)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-text-muted">{t('circle_pulse_hint')}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('action_cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {isEdit ? t('action_save') : t('circle_create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
