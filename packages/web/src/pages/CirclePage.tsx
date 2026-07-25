import { useMemo, useState } from 'react';
import { PawPrint, Pencil, Trash2, Users } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useContacts } from '@core/hooks/useContacts';
import { contactHandles } from '@core/lib/tags';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import {
  ContactFormDialog,
  type ContactFormValue,
} from '@/components/Circle/ContactFormDialog';
import type { Contact, ContactKind } from '@core/types';
import { ApiClientError } from '@core/lib/api';
import { cn } from '@/lib/utils';
import type { TKey } from '@/lib/i18n';

type Filter = 'all' | ContactKind;

export function CirclePage() {
  const { t } = useT();
  const { contacts, addContact, editContact, removeContact } = useContacts();
  const { showToast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return contacts;
    return contacts.filter(c => c.kind === filter);
  }, [contacts, filter]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setDialogOpen(true);
  }

  async function handleSubmit(value: ContactFormValue) {
    try {
      if (editing) {
        await editContact(editing.id, value);
        showToast(t('circle_updated'), 'success');
      } else {
        await addContact(value);
        showToast(t('circle_created'), 'success');
      }
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : t('circle_save_error');
      showToast(msg, 'error');
      throw err;
    }
  }

  async function handleDelete(contact: Contact) {
    if (!confirm(t('circle_delete_confirm').replace('{name}', contact.name))) return;
    try {
      await removeContact(contact.id);
      showToast(t('circle_deleted'), 'info');
    } catch {
      showToast(t('circle_delete_error'), 'error');
    }
  }

  return (
    <Layout
      title={t('circle_title')}
      primaryAction={{ label: t('circle_new'), onClick: openCreate }}
      onFabClick={openCreate}
      showFab
    >
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <p className="mb-4 max-w-2xl text-xs text-text-muted">{t('circle_subtitle')}</p>

        <div className="mb-4 inline-flex rounded-md border border-border bg-surface p-0.5">
          {(
            [
              ['all', t('circle_filter_all')],
              ['person', t('circle_kind_person')],
              ['pet', t('circle_kind_pet')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                filter === value
                  ? 'bg-accent-teal/15 text-accent-teal'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-muted">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">{t('circle_empty')}</h2>
            <p className="max-w-sm text-xs text-text-muted">{t('circle_empty_hint')}</p>
            <Button onClick={openCreate} size="sm" className="mt-1">
              {t('circle_new')}
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(c => {
              const handles = contactHandles(c);
              return (
                <li
                  key={c.id}
                  className="group flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-accent-teal/40"
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base',
                      c.kind === 'pet' ? 'bg-amber-500/15' : 'bg-accent-teal/15'
                    )}
                  >
                    {c.kind === 'pet' ? (
                      <PawPrint className="h-4 w-4 text-amber-200" />
                    ) : (
                      <Users className="h-4 w-4 text-accent-teal" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{c.name}</p>
                    <p className="text-[11px] text-text-muted">
                      {c.kind === 'person'
                        ? c.relationship
                          ? t(`circle_rel_${c.relationship}` as TKey)
                          : t('circle_kind_person')
                        : t('circle_kind_pet')}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {handles.map(h => (
                        <span
                          key={h}
                          className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-accent-teal ring-1 ring-border"
                        >
                          @{h}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
                      aria-label={t('action_edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(c)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-background hover:text-accent-red"
                      aria-label={t('action_delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </Layout>
  );
}
