import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Download,
  ExternalLink,
  FileStack,
  FileText,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { TaskDetailSheet } from '@/components/Board';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import {
  fetchAllTasks,
  mergeLocatedRowsIntoStore,
  type LocatedTaskRow,
} from '@core/services/taskService';
import { isDemoMode } from '@core/lib/demoMode';
import {
  parseTaskAttachment,
  type TaskAttachmentKind,
  type TaskAttachmentMeta,
} from '@core/lib/taskImages';
import type { Task, TaskKind } from '@core/types';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';
import { downloadDataUrl } from '@/lib/attachmentFiles';
import type { TKey } from '@/lib/i18n';

const NO_PROJECT = '__none__';
const ALL = '__all__';

const KIND_KEYS: Array<{ value: TaskKind; labelKey: TKey }> = [
  { value: 'task', labelKey: 'task_kind_task' },
  { value: 'reminder', labelKey: 'task_kind_reminder' },
  { value: 'event', labelKey: 'task_kind_event' },
  { value: 'possible_event', labelKey: 'task_kind_possible_event' },
  { value: 'habit_good', labelKey: 'task_kind_habit_good' },
  { value: 'habit_quit', labelKey: 'task_kind_habit_quit' },
  { value: 'rx_human', labelKey: 'task_kind_rx_human' },
  { value: 'rx_pet', labelKey: 'task_kind_rx_pet' },
  { value: 'finance_income', labelKey: 'task_kind_finance_income' },
  { value: 'finance_expense', labelKey: 'task_kind_finance_expense' },
];

interface DocumentItem {
  key: string;
  task: LocatedTaskRow;
  index: number;
  meta: TaskAttachmentMeta;
}

function collectFromStore(
  tasksByDay: Record<string, Record<string, Task[]>>
): LocatedTaskRow[] {
  const out: LocatedTaskRow[] = [];
  const seen = new Set<string>();
  for (const [weekId, days] of Object.entries(tasksByDay)) {
    for (const [dayId, tasks] of Object.entries(days)) {
      for (const task of tasks) {
        if (seen.has(task.id)) continue;
        if ((task.images?.length ?? 0) === 0) continue;
        seen.add(task.id);
        out.push({ ...task, weekId, dayId });
      }
    }
  }
  return out;
}

const selectClass =
  'h-9 rounded-md border border-border bg-field px-2.5 text-xs text-text-primary outline-none focus:border-accent-teal/50 focus:ring-2 focus:ring-accent-teal/20';

export function DocumentsPage() {
  const { t, locale, shortDateFormat } = useT();
  const { showToast } = useToast();
  const { projects } = useProjects();
  const uid = useStore(s => s.uid);
  const setDetailTask = useStore(s => s.setDetailTask);

  const [rows, setRows] = useState<LocatedTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [projectKey, setProjectKey] = useState(ALL);
  const [kindKey, setKindKey] = useState(ALL);
  const [typeKey, setTypeKey] = useState<'all' | TaskAttachmentKind>('all');
  const [preview, setPreview] = useState<DocumentItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!uid || isDemoMode()) {
        setRows(collectFromStore(useStore.getState().tasksByDay));
        return;
      }
      const all = await fetchAllTasks(uid);
      const withFiles = all.filter(r => (r.images?.length ?? 0) > 0);
      mergeLocatedRowsIntoStore(withFiles);
      setRows(withFiles);
    } catch {
      showToast(t('docs_load_error'), 'error');
      setRows(collectFromStore(useStore.getState().tasksByDay));
    } finally {
      setLoading(false);
    }
  }, [uid, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => {
    const list: DocumentItem[] = [];
    for (const task of rows) {
      (task.images ?? []).forEach((src, index) => {
        const meta = parseTaskAttachment(src);
        if (!meta) return;
        list.push({
          key: `${task.id}:${index}`,
          task,
          index,
          meta,
        });
      });
    }
    list.sort((a, b) => {
      const day = b.task.dayId.localeCompare(a.task.dayId);
      if (day !== 0) return day;
      return a.meta.name.localeCompare(b.meta.name);
    });
    return list;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(item => {
      const start = item.task.dayId;
      const end =
        item.task.endDayId && item.task.endDayId >= start
          ? item.task.endDayId
          : start;
      if (fromDay && end < fromDay) return false;
      if (toDay && start > toDay) return false;
      if (projectKey === NO_PROJECT && item.task.projectId) return false;
      if (
        projectKey !== ALL &&
        projectKey !== NO_PROJECT &&
        item.task.projectId !== projectKey
      ) {
        return false;
      }
      if (kindKey !== ALL && item.task.kind !== kindKey) return false;
      if (typeKey !== 'all' && item.meta.kind !== typeKey) return false;
      if (q) {
        const projectName =
          projects.find(p => p.id === item.task.projectId)?.name ?? '';
        const hay = `${item.meta.name} ${item.task.title} ${projectName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, fromDay, toDay, projectKey, kindKey, typeKey, projects]);

  const projectById = useMemo(
    () => new Map(projects.map(p => [p.id, p])),
    [projects]
  );

  function formatDay(dayId: string): string {
    try {
      return format(parseISO(dayId), shortDateFormat, { locale });
    } catch {
      return dayId;
    }
  }

  function kindLabel(kind: TaskKind): string {
    const found = KIND_KEYS.find(k => k.value === kind);
    return found ? t(found.labelKey) : kind;
  }

  function openTask(item: DocumentItem) {
    setPreview(null);
    setDetailTask({
      weekId: item.task.weekId,
      dayId: item.task.dayId,
      taskId: item.task.id,
    });
  }

  const hasFilters =
    Boolean(search.trim()) ||
    Boolean(fromDay) ||
    Boolean(toDay) ||
    projectKey !== ALL ||
    kindKey !== ALL ||
    typeKey !== 'all';

  function clearFilters() {
    setSearch('');
    setFromDay('');
    setToDay('');
    setProjectKey(ALL);
    setKindKey(ALL);
    setTypeKey('all');
  }

  return (
    <Layout title={t('docs_title')} showFab={false}>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
        <p className="text-xs text-text-muted">{t('docs_subtitle')}</p>

        <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="relative sm:col-span-2 lg:col-span-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('docs_search')}
              className="h-9 pl-8 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {t('docs_filter_from')}
            </span>
            <input
              type="date"
              value={fromDay}
              onChange={e => setFromDay(e.target.value)}
              className={selectClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {t('docs_filter_to')}
            </span>
            <input
              type="date"
              value={toDay}
              onChange={e => setToDay(e.target.value)}
              className={selectClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {t('docs_filter_project')}
            </span>
            <select
              value={projectKey}
              onChange={e => setProjectKey(e.target.value)}
              className={selectClass}
            >
              <option value={ALL}>{t('docs_filter_all_projects')}</option>
              <option value={NO_PROJECT}>{t('docs_no_project')}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.icon ? `${p.icon} ` : ''}
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {t('docs_filter_kind')}
            </span>
            <select
              value={kindKey}
              onChange={e => setKindKey(e.target.value)}
              className={selectClass}
            >
              <option value={ALL}>{t('docs_filter_all_kinds')}</option>
              {KIND_KEYS.map(k => (
                <option key={k.value} value={k.value}>
                  {t(k.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {t('docs_filter_type')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'docs_type_all'],
                  ['image', 'docs_type_image'],
                  ['pdf', 'docs_type_pdf'],
                ] as const
              ).map(([value, key]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTypeKey(value)}
                  className={cn(
                    'rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                    typeKey === value
                      ? 'border-accent-teal/50 bg-accent-teal/10 text-accent-teal'
                      : 'border-border bg-background text-text-muted hover:border-accent-teal/30'
                  )}
                >
                  {t(key)}
                </button>
              ))}
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[11px] text-text-muted hover:border-accent-red/40 hover:text-text-primary"
                >
                  {t('docs_clear_filters')}
                </button>
              )}
            </div>
          </label>
        </div>

        <p className="text-[11px] text-text-muted">
          {t('docs_count').replace('{n}', String(filtered.length))}
        </p>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text-muted">
              <FileStack className="h-5 w-5" />
            </div>
            <p className="text-sm text-text-muted">
              {items.length === 0 ? t('docs_empty') : t('docs_empty_filtered')}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map(item => {
              const project = item.task.projectId
                ? projectById.get(item.task.projectId)
                : undefined;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => setPreview(item)}
                    className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-background text-left transition-colors hover:border-accent-teal/40"
                  >
                    <div className="relative aspect-[4/3] bg-surface">
                      {item.meta.kind === 'pdf' ? (
                        <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-accent-red/5 text-accent-red">
                          <FileText className="h-8 w-8" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide">
                            PDF
                          </span>
                        </span>
                      ) : (
                        <img
                          src={item.meta.dataUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 p-2.5">
                      <p className="truncate text-xs font-medium text-text-primary">
                        {item.meta.name}
                      </p>
                      <p className="truncate text-[11px] text-text-muted">
                        {item.task.title}
                      </p>
                      <p className="mt-auto pt-1 text-[10px] text-text-muted">
                        {formatDay(item.task.dayId)}
                        {' · '}
                        {kindLabel(item.task.kind)}
                        {project ? ` · ${project.name}` : ''}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {preview.meta.name}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {preview.task.title}
                  {' · '}
                  {formatDay(preview.task.dayId)}
                  {' · '}
                  {kindLabel(preview.task.kind)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
                onClick={() => setPreview(null)}
                aria-label={t('action_close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-background">
              {preview.meta.kind === 'pdf' ? (
                <iframe
                  src={preview.meta.dataUrl}
                  title={preview.meta.name}
                  className="h-[62vh] w-full bg-white"
                />
              ) : (
                <img
                  src={preview.meta.dataUrl}
                  alt={preview.meta.name}
                  className="mx-auto max-h-[62vh] w-full object-contain"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:border-accent-teal/40"
                onClick={() =>
                  downloadDataUrl(preview.meta.dataUrl, preview.meta.name)
                }
              >
                <Download className="h-3.5 w-3.5" />
                {t('docs_download')}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:border-accent-teal/40"
                onClick={() =>
                  window.open(preview.meta.dataUrl, '_blank', 'noopener')
                }
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('docs_open_tab')}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-accent-teal/40 bg-accent-teal/10 px-2.5 py-1.5 text-xs font-medium text-accent-teal"
                onClick={() => openTask(preview)}
              >
                {t('docs_open_task')}
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskDetailSheet />
    </Layout>
  );
}
