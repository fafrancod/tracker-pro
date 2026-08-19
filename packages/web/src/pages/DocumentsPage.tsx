import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Download,
  ExternalLink,
  FileStack,
  FileText,
  FolderKanban,
  LayoutGrid,
  List,
  Loader2,
  Maximize2,
  Search,
  Shapes,
  X,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { ToggleSelect } from '@/components/ui/toggle-select';
import { TaskDetailSheet } from '@/components/Board';
import { useProjects } from '@core/hooks/useProjects';
import { useStore } from '@core/store';
import {
  fetchAllTasks,
  mergeLocatedRowsIntoStore,
  type LocatedTaskRow,
} from '@core/services/taskService';
import { isDemoMode } from '@core/lib/demoMode';
import { BOARD_NO_PROJECT } from '@core/lib/boardFilters';
import {
  parseTaskAttachment,
  type TaskAttachmentMeta,
} from '@core/lib/taskImages';
import type { Task, TaskKind } from '@core/types';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';
import { downloadDataUrl } from '@/lib/attachmentFiles';
import type { TKey } from '@/lib/i18n';

const VIEW_KEY = 'dt.docsView';

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

type DocsView = 'grid' | 'rows';

function readDocsView(): DocsView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'rows' ? 'rows' : 'grid';
  } catch {
    return 'grid';
  }
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

function allowsKey(selected: string[] | 'all', key: string): boolean {
  if (selected === 'all') return true;
  return selected.includes(key);
}

const dateClass =
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
  const [projectIds, setProjectIds] = useState<string[] | 'all'>('all');
  const [kinds, setKinds] = useState<string[] | 'all'>('all');
  const [types, setTypes] = useState<string[] | 'all'>('all');
  const [view, setView] = useState<DocsView>(readDocsView);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

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

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore quota / private mode */
    }
  }, [view]);

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
      const pKey = item.task.projectId ?? BOARD_NO_PROJECT;
      if (!allowsKey(projectIds, pKey)) return false;
      if (!allowsKey(kinds, item.task.kind)) return false;
      if (!allowsKey(types, item.meta.kind)) return false;
      if (q) {
        const projectName =
          projects.find(p => p.id === item.task.projectId)?.name ?? '';
        const hay = `${item.meta.name} ${item.task.title} ${projectName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, fromDay, toDay, projectIds, kinds, types, projects]);

  const selected = selectedKey
    ? filtered.find(i => i.key === selectedKey) ?? null
    : null;

  useEffect(() => {
    if (selectedKey && !filtered.some(i => i.key === selectedKey)) {
      setSelectedKey(null);
      setExpanded(false);
    }
  }, [filtered, selectedKey]);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const projectById = useMemo(
    () => new Map(projects.map(p => [p.id, p])),
    [projects]
  );

  const projectOptions = useMemo(
    () => [
      { value: BOARD_NO_PROJECT, label: t('docs_no_project'), muted: true },
      ...projects.map(p => ({
        value: p.id,
        label: `${p.icon ? `${p.icon} ` : ''}${p.name}`,
        color: p.color,
      })),
    ],
    [projects, t]
  );

  const kindOptions = useMemo(
    () => KIND_KEYS.map(k => ({ value: k.value, label: t(k.labelKey) })),
    [t]
  );

  const typeOptions = useMemo(
    () => [
      { value: 'image', label: t('docs_type_image') },
      { value: 'pdf', label: t('docs_type_pdf') },
    ],
    [t]
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
    setExpanded(false);
    setDetailTask({
      weekId: item.task.weekId,
      dayId: item.task.dayId,
      taskId: item.task.id,
    });
  }

  function selectItem(item: DocumentItem) {
    setSelectedKey(item.key);
    setExpanded(false);
  }

  function expandItem(item: DocumentItem) {
    setSelectedKey(item.key);
    setExpanded(true);
  }

  const hasFilters =
    Boolean(search.trim()) ||
    Boolean(fromDay) ||
    Boolean(toDay) ||
    projectIds !== 'all' ||
    kinds !== 'all' ||
    types !== 'all';

  function clearFilters() {
    setSearch('');
    setFromDay('');
    setToDay('');
    setProjectIds('all');
    setKinds('all');
    setTypes('all');
  }

  const countLabel = (n: number) =>
    t('docs_kinds_n').replace('{n}', String(n));
  const projectsCountLabel = (n: number) =>
    t('board_filter_projects_n').replace('{n}', String(n));

  return (
    <Layout title={t('docs_title')} showFab={false}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 space-y-3 border-b border-border bg-surface/40 px-3 py-3 md:px-4">
          <p className="text-xs text-text-muted">{t('docs_subtitle')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="relative min-w-[12rem] flex-1">
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
                className={dateClass}
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
                className={dateClass}
              />
            </label>
            <ToggleSelect
              ariaLabel={t('docs_filter_project')}
              options={projectOptions}
              selected={projectIds}
              onChange={setProjectIds}
              allLabel={t('docs_filter_all_projects')}
              noneLabel={t('eisenhower_deselect_all')}
              countLabel={projectsCountLabel}
              icon={<FolderKanban className="h-3.5 w-3.5" />}
            />
            <ToggleSelect
              ariaLabel={t('docs_filter_kind')}
              options={kindOptions}
              selected={kinds}
              onChange={setKinds}
              allLabel={t('docs_filter_all_kinds')}
              noneLabel={t('eisenhower_deselect_all')}
              countLabel={countLabel}
              icon={<Shapes className="h-3.5 w-3.5" />}
            />
            <ToggleSelect
              ariaLabel={t('docs_filter_type')}
              options={typeOptions}
              selected={types}
              onChange={setTypes}
              allLabel={t('docs_type_all')}
              noneLabel={t('eisenhower_deselect_all')}
              countLabel={countLabel}
              icon={<FileStack className="h-3.5 w-3.5" />}
            />
            <div
              className="inline-flex overflow-hidden rounded-xl border border-border"
              role="group"
              aria-label={t('docs_view_grid')}
            >
              <button
                type="button"
                onClick={() => setView('grid')}
                title={t('docs_view_grid')}
                aria-pressed={view === 'grid'}
                className={cn(
                  'flex h-9 w-9 items-center justify-center transition-colors',
                  view === 'grid'
                    ? 'bg-accent-teal/15 text-accent-teal'
                    : 'text-text-muted hover:bg-background hover:text-text-primary'
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('rows')}
                title={t('docs_view_rows')}
                aria-pressed={view === 'rows'}
                className={cn(
                  'flex h-9 w-9 items-center justify-center transition-colors',
                  view === 'rows'
                    ? 'bg-accent-teal/15 text-accent-teal'
                    : 'text-text-muted hover:bg-background hover:text-text-primary'
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 rounded-xl border border-border px-2.5 text-[11px] text-text-muted hover:border-accent-red/40 hover:text-text-primary"
              >
                {t('docs_clear_filters')}
              </button>
            )}
          </div>
          <p className="text-[11px] text-text-muted">
            {t('docs_count').replace('{n}', String(filtered.length))}
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1">
          <div
            className={cn(
              'min-h-0 min-w-0 flex-1 overflow-y-auto p-3 md:p-4',
              selected && 'max-md:hidden'
            )}
          >
            {loading ? (
              <div className="flex h-full items-center justify-center py-16 text-text-muted">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text-muted">
                  <FileStack className="h-5 w-5" />
                </div>
                <p className="text-sm text-text-muted">
                  {items.length === 0 ? t('docs_empty') : t('docs_empty_filtered')}
                </p>
              </div>
            ) : view === 'rows' ? (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                {filtered.map(item => (
                  <DocRow
                    key={item.key}
                    item={item}
                    active={selected?.key === item.key}
                    projectName={
                      item.task.projectId
                        ? projectById.get(item.task.projectId)?.name
                        : undefined
                    }
                    kindLabel={kindLabel(item.task.kind)}
                    dateLabel={formatDay(item.task.dayId)}
                    expandLabel={t('docs_expand')}
                    onSelect={() => selectItem(item)}
                    onExpand={() => expandItem(item)}
                  />
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {filtered.map(item => (
                  <DocCard
                    key={item.key}
                    item={item}
                    active={selected?.key === item.key}
                    projectName={
                      item.task.projectId
                        ? projectById.get(item.task.projectId)?.name
                        : undefined
                    }
                    kindLabel={kindLabel(item.task.kind)}
                    dateLabel={formatDay(item.task.dayId)}
                    expandLabel={t('docs_expand')}
                    onSelect={() => selectItem(item)}
                    onExpand={() => expandItem(item)}
                  />
                ))}
              </ul>
            )}
          </div>

          <aside
            className={cn(
              'min-h-0 flex-col border-border bg-surface',
              selected
                ? 'flex w-full border-t md:w-[min(28rem,46%)] md:border-l md:border-t-0 lg:w-[min(36rem,48%)]'
                : 'hidden w-[min(28rem,42%)] border-l md:flex'
            )}
          >
            {selected ? (
              <PreviewPane
                item={selected}
                dateLabel={formatDay(selected.task.dayId)}
                kindLabel={kindLabel(selected.task.kind)}
                onClose={() => {
                  setSelectedKey(null);
                  setExpanded(false);
                }}
                onExpand={() => setExpanded(true)}
                onOpenTask={() => openTask(selected)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-text-muted">
                <FileStack className="h-8 w-8 opacity-50" />
                <p className="text-sm">{t('docs_preview_empty')}</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {expanded && selected && (
        <ExpandedModal
          item={selected}
          dateLabel={formatDay(selected.task.dayId)}
          kindLabel={kindLabel(selected.task.kind)}
          onClose={() => setExpanded(false)}
          onOpenTask={() => openTask(selected)}
        />
      )}

      <TaskDetailSheet />
    </Layout>
  );
}

function Thumbnail({
  item,
  className,
}: {
  item: DocumentItem;
  className?: string;
}) {
  if (item.meta.kind === 'pdf') {
    return (
      <span
        className={cn(
          'flex items-center justify-center bg-accent-red/5 text-accent-red',
          className
        )}
      >
        <FileText className="h-6 w-6" />
      </span>
    );
  }
  return (
    <img src={item.meta.dataUrl} alt="" className={cn('object-cover', className)} />
  );
}

function PreviewMedia({ item }: { item: DocumentItem }) {
  if (item.meta.kind === 'pdf') {
    return (
      <iframe
        src={item.meta.dataUrl}
        title={item.meta.name}
        className="h-full min-h-0 w-full bg-white"
      />
    );
  }
  return (
    <img
      src={item.meta.dataUrl}
      alt={item.meta.name}
      className="mx-auto h-full max-h-full w-full object-contain"
    />
  );
}

function PreviewActions({
  item,
  onOpenTask,
}: {
  item: DocumentItem;
  onOpenTask: () => void;
}) {
  const { t } = useT();
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:border-accent-teal/40"
        onClick={() => downloadDataUrl(item.meta.dataUrl, item.meta.name)}
      >
        <Download className="h-3.5 w-3.5" />
        {t('docs_download')}
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:border-accent-teal/40"
        onClick={() => window.open(item.meta.dataUrl, '_blank', 'noopener')}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {t('docs_open_tab')}
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-accent-teal/40 bg-accent-teal/10 px-2.5 py-1.5 text-xs font-medium text-accent-teal"
        onClick={onOpenTask}
      >
        {t('docs_open_task')}
      </button>
    </>
  );
}

function PreviewPane({
  item,
  dateLabel,
  kindLabel,
  onClose,
  onExpand,
  onOpenTask,
}: {
  item: DocumentItem;
  dateLabel: string;
  kindLabel: string;
  onClose: () => void;
  onExpand: () => void;
  onOpenTask: () => void;
}) {
  const { t } = useT();
  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">
            {item.meta.name}
          </p>
          <p className="truncate text-xs text-text-muted">
            {item.task.title}
            {' · '}
            {dateLabel}
            {' · '}
            {kindLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="rounded-full p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
            onClick={onExpand}
            aria-label={t('docs_expand')}
            title={t('docs_expand')}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-full p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
            onClick={onClose}
            aria-label={t('docs_close_preview')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-background">
        <PreviewMedia item={item} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-3 py-2.5">
        <PreviewActions item={item} onOpenTask={onOpenTask} />
      </div>
    </>
  );
}

function ExpandedModal({
  item,
  dateLabel,
  kindLabel,
  onClose,
  onOpenTask,
}: {
  item: DocumentItem;
  dateLabel: string;
  kindLabel: string;
  onClose: () => void;
  onOpenTask: () => void;
}) {
  const { t } = useT();
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {item.meta.name}
            </p>
            <p className="truncate text-xs text-text-muted">
              {item.task.title}
              {' · '}
              {dateLabel}
              {' · '}
              {kindLabel}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-1.5 text-text-muted hover:bg-background hover:text-text-primary"
            onClick={onClose}
            aria-label={t('action_close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-background">
          {item.meta.kind === 'pdf' ? (
            <iframe
              src={item.meta.dataUrl}
              title={item.meta.name}
              className="h-[62vh] w-full bg-white"
            />
          ) : (
            <img
              src={item.meta.dataUrl}
              alt={item.meta.name}
              className="mx-auto max-h-[62vh] w-full object-contain"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <PreviewActions item={item} onOpenTask={onOpenTask} />
        </div>
      </div>
    </div>
  );
}

function ExpandButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'rounded-md p-1 text-text-muted hover:bg-background hover:text-text-primary',
        className
      )}
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </button>
  );
}

function DocCard({
  item,
  active,
  projectName,
  kindLabel,
  dateLabel,
  expandLabel,
  onSelect,
  onExpand,
}: {
  item: DocumentItem;
  active: boolean;
  projectName?: string;
  kindLabel: string;
  dateLabel: string;
  expandLabel: string;
  onSelect: () => void;
  onExpand: () => void;
}) {
  return (
    <li>
      <div
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background text-left transition-colors',
          active
            ? 'border-accent-teal/60 ring-1 ring-accent-teal/30'
            : 'border-border hover:border-accent-teal/40'
        )}
      >
        <div className="relative aspect-[4/3] bg-surface">
          <button
            type="button"
            onClick={onSelect}
            className="h-full w-full"
          >
            <Thumbnail item={item} className="h-full w-full" />
            {item.meta.kind === 'pdf' && (
              <span className="absolute bottom-1.5 left-1.5 rounded bg-accent-red/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                PDF
              </span>
            )}
          </button>
          <div className="absolute right-1.5 top-1.5">
            <ExpandButton
              label={expandLabel}
              onClick={onExpand}
              className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 p-2.5">
          <button
            type="button"
            onClick={onSelect}
            className="min-w-0 text-left"
          >
            <p className="truncate text-xs font-medium text-text-primary">
              {item.meta.name}
            </p>
            <p className="truncate text-[11px] text-text-muted">
              {item.task.title}
            </p>
          </button>
          <p className="mt-auto pt-1 text-[10px] text-text-muted">
            {dateLabel}
            {' · '}
            {kindLabel}
            {projectName ? ` · ${projectName}` : ''}
          </p>
        </div>
      </div>
    </li>
  );
}

function DocRow({
  item,
  active,
  projectName,
  kindLabel,
  dateLabel,
  expandLabel,
  onSelect,
  onExpand,
}: {
  item: DocumentItem;
  active: boolean;
  projectName?: string;
  kindLabel: string;
  dateLabel: string;
  expandLabel: string;
  onSelect: () => void;
  onExpand: () => void;
}) {
  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-3 px-2 py-2 transition-colors',
          active ? 'bg-accent-teal/10' : 'hover:bg-surface'
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Thumbnail
            item={item}
            className="h-12 w-12 shrink-0 rounded-lg"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-text-primary">
              {item.meta.name}
            </span>
            <span className="block truncate text-xs text-text-muted">
              {item.task.title}
            </span>
            <span className="block truncate text-[10px] text-text-muted">
              {dateLabel}
              {' · '}
              {kindLabel}
              {projectName ? ` · ${projectName}` : ''}
            </span>
          </span>
        </button>
        <ExpandButton label={expandLabel} onClick={onExpand} />
      </div>
    </li>
  );
}
