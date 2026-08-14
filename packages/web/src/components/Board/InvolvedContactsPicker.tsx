import { useMemo, useState } from 'react';
import type { Contact, PersonRelationship } from '@core/types';
import { contactHandles } from '@core/lib/tags';
import { useT } from '@/hooks/useT';
import type { TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const FAMILY_RELS: PersonRelationship[] = [
  'father',
  'mother',
  'son',
  'daughter',
  'brother',
  'sister',
  'niece',
  'nephew',
];

export type InvolvedFilter =
  | 'all'
  | 'family'
  | 'partner'
  | 'friend'
  | 'work'
  | 'pet'
  | 'other';

const FILTERS: Array<{ id: InvolvedFilter; labelKey: TKey }> = [
  { id: 'all', labelKey: 'involved_filter_all' },
  { id: 'family', labelKey: 'involved_filter_family' },
  { id: 'partner', labelKey: 'involved_filter_partner' },
  { id: 'friend', labelKey: 'involved_filter_friend' },
  { id: 'work', labelKey: 'involved_filter_work' },
  { id: 'pet', labelKey: 'involved_filter_pet' },
  { id: 'other', labelKey: 'involved_filter_other' },
];

export function contactMatchesInvolvedFilter(
  contact: Contact,
  filter: InvolvedFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'pet') return contact.kind === 'pet';
  if (contact.kind === 'pet') return false;
  if (filter === 'family') {
    return (
      contact.relationship != null && FAMILY_RELS.includes(contact.relationship)
    );
  }
  if (filter === 'partner') return contact.relationship === 'partner';
  if (filter === 'friend') return contact.relationship === 'friend';
  if (filter === 'work') return contact.relationship === 'coworker';
  if (filter === 'other') return contact.relationship == null;
  return true;
}

function relationshipLabelKey(
  contact: Contact
): TKey | null {
  if (contact.kind === 'pet') return 'circle_kind_pet';
  if (!contact.relationship) return null;
  return `circle_rel_${contact.relationship}` as TKey;
}

interface InvolvedContactsPickerProps {
  contacts: Contact[];
  selectedIds: string[];
  onToggle: (contactId: string) => void;
  /** Estilo activo del checkbox / fila. */
  accent?: 'event' | 'possible';
  className?: string;
}

export function InvolvedContactsPicker({
  contacts,
  selectedIds,
  onToggle,
  accent = 'event',
  className,
}: InvolvedContactsPickerProps) {
  const { t } = useT();
  const [filter, setFilter] = useState<InvolvedFilter>('all');

  const counts = useMemo(() => {
    const map = new Map<InvolvedFilter, number>();
    for (const f of FILTERS) {
      map.set(
        f.id,
        contacts.filter(c => contactMatchesInvolvedFilter(c, f.id)).length
      );
    }
    return map;
  }, [contacts]);

  const visibleFilters = FILTERS.filter(f => {
    if (f.id === 'all') return true;
    return (counts.get(f.id) ?? 0) > 0;
  });

  const filtered = useMemo(
    () => contacts.filter(c => contactMatchesInvolvedFilter(c, filter)),
    [contacts, filter]
  );

  const activeRow =
    accent === 'event' ? 'bg-sky-500/15 text-text-primary' : 'bg-fuchsia-500/15 text-text-primary';
  const accentCheck = accent === 'event' ? 'accent-sky-500' : 'accent-fuchsia-500';

  if (contacts.length === 0) {
    return <p className="text-[11px] text-text-muted">{t('circle_empty')}</p>;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label={t('involved_filter_label')}
      >
        {visibleFilters.map(f => {
          const active = filter === f.id;
          const n = counts.get(f.id) ?? 0;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                active
                  ? accent === 'event'
                    ? 'border-sky-600/40 bg-sky-500/15 text-sky-800 dark:border-sky-500/40 dark:text-sky-100'
                    : 'border-fuchsia-600/40 bg-fuchsia-500/15 text-fuchsia-800 dark:border-fuchsia-500/40 dark:text-fuchsia-100'
                  : 'border-border bg-field text-text-muted hover:text-text-primary'
              )}
            >
              {t(f.labelKey)}
              {f.id !== 'all' && (
                <span className="ml-1 tabular-nums opacity-70">{n}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-field p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-text-muted">
            {t('involved_filter_empty')}
          </p>
        ) : (
          filtered.map(c => {
            const active = selectedIds.includes(c.id);
            const relKey = relationshipLabelKey(c);
            return (
              <label
                key={c.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                  active ? activeRow : 'text-text-muted hover:bg-background'
                )}
              >
                <input
                  type="checkbox"
                  className={cn('h-3.5 w-3.5 shrink-0', accentCheck)}
                  checked={active}
                  onChange={() => onToggle(c.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text-primary">
                    {c.kind === 'pet' ? '🐾' : '👤'} {c.name}
                  </span>
                  <span className="block truncate text-[10px] text-text-muted">
                    {relKey ? t(relKey) : t('involved_filter_other')}
                    {contactHandles(c).length > 0
                      ? ` · ${contactHandles(c)
                          .map(h => `@${h}`)
                          .join(' ')}`
                      : ''}
                  </span>
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
