import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { CalendarDays, Loader2, PawPrint, Pencil, Trash2, Users } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useContacts } from '@core/hooks/useContacts';
import { contactHandles, taskMatchesContact } from '@core/lib/tags';
import { getDayId, fetchTasksInRange, type LocatedTaskRow } from '@core/services/taskService';
import { isDemoMode } from '@core/lib/demoMode';
import { useStore } from '@core/store';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import {
  ContactFormDialog,
  RELATION_PULSES,
  type ContactFormValue,
} from '@/components/Circle/ContactFormDialog';
import { TaskDetailSheet } from '@/components/Board';
import type { Contact, ContactKind, RelationPulse, Task } from '@core/types';
import { ApiClientError } from '@core/lib/api';
import { cn } from '@/lib/utils';
import type { TKey } from '@/lib/i18n';

type Filter = 'all' | ContactKind;

const COMMITMENT_HORIZON_DAYS = 90;

function pulseBadgeClass(pulse: RelationPulse | null): string {
  switch (pulse) {
    case 'great':
      return 'bg-accent-green/15 text-accent-green ring-accent-green/30';
    case 'good':
      return 'bg-accent-teal/15 text-accent-teal ring-accent-teal/30';
    case 'neutral':
      return 'bg-background text-text-muted ring-border';
    case 'need_connect':
      return 'bg-amber-500/15 text-amber-200 ring-amber-500/30';
    case 'strained':
      return 'bg-orange-500/15 text-orange-200 ring-orange-500/30';
    case 'bad':
      return 'bg-accent-red/15 text-accent-red ring-accent-red/30';
    default:
      return 'bg-background text-text-muted ring-border';
  }
}

function collectStoreTasks(
  tasksByDay: Record<string, Record<string, Task[]>>,
  fromDayId: string,
  toDayId: string
): LocatedTaskRow[] {
  const out: LocatedTaskRow[] = [];
  const seen = new Set<string>();
  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [dayId, list] of Object.entries(days)) {
      for (const task of list) {
        if (seen.has(task.id)) continue;
        const end = task.endDayId || dayId;
        if (dayId > toDayId || end < fromDayId) continue;
        seen.add(task.id);
        out.push({ ...task, weekId, dayId });
      }
    }
  }
  return out;
}

export function CirclePage() {
  const { t, locale, shortDateFormat } = useT();
  const { contacts, addContact, editContact, removeContact } = useContacts();
  const { showToast } = useToast();
  const uid = useStore(s => s.uid);
  const tasksByDay = useStore(s => s.tasksByDay);
  const setDetailTask = useStore(s => s.setDetailTask);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  /** Fuerza remount del formulario en cada apertura (evita estado residual). */
  const [formKey, setFormKey] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [commitmentsFor, setCommitmentsFor] = useState<Contact | null>(null);
  const [commitments, setCommitments] = useState<LocatedTaskRow[]>([]);
  const [loadingCommitments, setLoadingCommitments] = useState(false);

  const filtered = useMemo(() => {
    if (filter === 'all') return contacts;
    return contacts.filter(c => c.kind === filter);
  }, [contacts, filter]);

  const loadCommitments = useCallback(
    async (contact: Contact) => {
      setLoadingCommitments(true);
      setCommitments([]);
      const today = getDayId(new Date());
      const to = getDayId(addDays(new Date(), COMMITMENT_HORIZON_DAYS));
      try {
        let rows: LocatedTaskRow[] = [];
        if (uid && !isDemoMode()) {
          rows = await fetchTasksInRange(uid, today, to);
        } else {
          rows = collectStoreTasks(tasksByDay, today, to);
        }
        // También fusiona lo ya en store (tareas recientes / offline)
        const fromStore = collectStoreTasks(tasksByDay, today, to);
        const byId = new Map<string, LocatedTaskRow>();
        for (const r of [...rows, ...fromStore]) byId.set(r.id, r);

        const matched = Array.from(byId.values())
          .filter(r => !r.completed && taskMatchesContact(r, contact))
          .sort((a, b) => {
            const da = a.dayId.localeCompare(b.dayId);
            if (da !== 0) return da;
            return (a.startTime ?? '').localeCompare(b.startTime ?? '');
          });
        setCommitments(matched);
      } catch {
        showToast(t('circle_commitments_error'), 'error');
        setCommitments([]);
      } finally {
        setLoadingCommitments(false);
      }
    },
    [uid, tasksByDay, showToast, t]
  );

  useEffect(() => {
    if (!commitmentsFor) return;
    void loadCommitments(commitmentsFor);
  }, [commitmentsFor, loadCommitments]);

  function openCreate() {
    setEditing(null);
    setFormKey(k => k + 1);
    setDialogOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setFormKey(k => k + 1);
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
          : err instanceof Error
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

  async function handlePulseChange(contact: Contact, pulse: RelationPulse | '') {
    try {
      await editContact(contact.id, { relationPulse: pulse || null });
    } catch {
      showToast(t('circle_save_error'), 'error');
    }
  }

  function formatDay(dayId: string): string {
    try {
      return format(parseISO(`${dayId}T12:00:00`), shortDateFormat, { locale });
    } catch {
      return dayId;
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
                  className="group flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-accent-teal/40"
                >
                  <div className="flex items-start gap-3">
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
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
                  </div>

                  {c.kind === 'person' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] text-text-muted">
                        <span className="shrink-0">{t('circle_pulse')}</span>
                        <select
                          value={c.relationPulse ?? ''}
                          onChange={e =>
                            void handlePulseChange(
                              c,
                              (e.target.value || '') as RelationPulse | ''
                            )
                          }
                          className={cn(
                            'h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 text-[11px] font-medium ring-1',
                            pulseBadgeClass(c.relationPulse)
                          )}
                        >
                          <option value="">{t('circle_pulse_none')}</option>
                          {RELATION_PULSES.map(p => (
                            <option key={p} value={p}>
                              {t(`circle_pulse_${p}` as TKey)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setCommitmentsFor(c)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-text-primary transition-colors hover:border-accent-teal/40 hover:bg-accent-teal/10"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-accent-teal" />
                    {t('circle_view_commitments')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ContactFormDialog
        key={formKey}
        open={dialogOpen}
        onOpenChange={open => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        initial={editing}
        onSubmit={handleSubmit}
      />

      <Dialog
        open={commitmentsFor !== null}
        onOpenChange={o => {
          if (!o) setCommitmentsFor(null);
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('circle_commitments_title').replace(
                '{name}',
                commitmentsFor?.name ?? ''
              )}
            </DialogTitle>
            <DialogDescription>
              {t('circle_commitments_desc').replace(
                '{days}',
                String(COMMITMENT_HORIZON_DAYS)
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingCommitments ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('status_checking')}
              </div>
            ) : commitments.length === 0 ? (
              <p className="py-8 text-center text-xs text-text-muted">
                {t('circle_commitments_empty')}
              </p>
            ) : (
              <ul className="space-y-1.5 pb-2">
                {commitments.map(row => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailTask({
                          weekId: row.weekId,
                          dayId: row.dayId,
                          taskId: row.id,
                        });
                        setCommitmentsFor(null);
                      }}
                      className="flex w-full flex-col gap-0.5 rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:border-accent-teal/40"
                    >
                      <span className="text-xs font-medium text-text-primary">
                        {row.title}
                      </span>
                      <span className="text-[10px] tabular-nums text-text-muted">
                        {formatDay(row.dayId)}
                        {row.endDayId && row.endDayId !== row.dayId
                          ? ` – ${formatDay(row.endDayId)}`
                          : ''}
                        {row.startTime
                          ? ` · ${row.startTime.slice(0, 5)}${
                              row.endTime ? `–${row.endTime.slice(0, 5)}` : ''
                            }`
                          : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TaskDetailSheet />
    </Layout>
  );
}
