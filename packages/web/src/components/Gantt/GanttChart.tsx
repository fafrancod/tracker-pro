import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDays, format } from 'date-fns';
import {
  Bell,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useT';
import { civilDateFromDayId } from '@core/lib/civilDate';
import {
  ganttBarLayout,
  ganttDayOffset,
  ganttInclusiveDays,
  ganttItemColor,
  ganttMonthHeaders,
  ganttPxPerDay,
  ganttTimelineWidth,
  ganttWeekendOffsets,
  type GanttItem,
  type GanttProjectGroup,
  type GanttScale,
} from '@core/lib/gantt';
import type { Locale } from 'date-fns/locale';

const LABEL_W_DESKTOP = 220;
const LABEL_W_MOBILE = 148;
const HEADER_MONTH_H = 26;
const HEADER_DAY_H = 22;
const ROW_H = 28;
const GROUP_H = 30;

function useLabelWidth(): number {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile ? LABEL_W_MOBILE : LABEL_W_DESKTOP;
}

function KindIcon({ kind, className }: { kind: GanttItem['kind']; className?: string }) {
  const cls = cn('h-3 w-3 shrink-0', className);
  if (kind === 'event') return <CalendarCheck className={cls} />;
  if (kind === 'possible_event') return <CircleDashed className={cls} />;
  if (kind === 'reminder') return <Bell className={cls} />;
  return <ListTodo className={cls} />;
}

export interface GanttChartProps {
  groups: GanttProjectGroup[];
  rangeFrom: string;
  rangeTo: string;
  todayId: string;
  scale: GanttScale;
  locale: Locale;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  onItemClick: (item: GanttItem) => void;
  onRenameCategory?: (
    projectId: string,
    categoryId: string,
    name: string
  ) => void;
  /** En vista vida, mostrar cabecera de proyecto. En vista proyecto, solo subproyectos. */
  showProjectHeaders: boolean;
  todayLabel: string;
  itemsCountLabel: (n: number) => string;
  emptyTitle: string;
  emptyHint: string;
  seriesCountLabel?: (n: number) => string;
  /** Incrementar para re-centrar en hoy. */
  focusNonce?: number;
}

export function GanttChart({
  groups,
  rangeFrom,
  rangeTo,
  todayId,
  scale,
  locale,
  collapsed,
  onToggle,
  onItemClick,
  onRenameCategory,
  showProjectHeaders,
  todayLabel,
  itemsCountLabel,
  emptyTitle,
  emptyHint,
  seriesCountLabel,
  focusNonce = 0,
}: GanttChartProps) {
  const { t } = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [editingCatKey, setEditingCatKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const px = ganttPxPerDay(scale);
  const labelW = useLabelWidth();
  const days = ganttInclusiveDays(rangeFrom, rangeTo);
  const timelineW = ganttTimelineWidth(rangeFrom, rangeTo, px);
  const months = useMemo(
    () => ganttMonthHeaders(rangeFrom, rangeTo),
    [rangeFrom, rangeTo]
  );
  const weekends = useMemo(
    () => ganttWeekendOffsets(rangeFrom, rangeTo),
    [rangeFrom, rangeTo]
  );
  const todayOffset = ganttDayOffset(rangeFrom, todayId);
  const todayInRange = todayOffset >= 0 && todayOffset < days;

  const ticks = useMemo(() => {
    const start = civilDateFromDayId(rangeFrom);
    const out: Array<{ offset: number; label: string; sub?: string }> = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      if (scale === 'day') {
        out.push({
          offset: i,
          label: format(d, 'd'),
          sub: format(d, 'EEEEE', { locale }),
        });
      } else if (scale === 'week' && (d.getDay() === 1 || i === 0)) {
        out.push({ offset: i, label: format(d, 'd MMM', { locale }) });
      } else if (scale === 'month' && (d.getDate() === 1 || i === 0)) {
        out.push({ offset: i, label: format(d, 'd') });
      }
    }
    return out;
  }, [rangeFrom, days, scale, locale]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !todayInRange) return;
    const left = labelW + todayOffset * px - el.clientWidth * 0.28;
    el.scrollLeft = Math.max(0, left);
  }, [labelW, todayOffset, px, todayInRange, rangeFrom, rangeTo, scale, focusNonce]);

  useEffect(() => {
    if (!editingCatKey) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingCatKey]);

  function SummaryBar({
    start,
    end,
    color,
  }: {
    start: string;
    end: string;
    color: string;
  }) {
    const layout = ganttBarLayout(
      { startDayId: start, endDayId: end },
      rangeFrom,
      rangeTo,
      px
    );
    if (!layout) return null;
    return (
      <div
        className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-70"
        style={{
          left: layout.left,
          width: layout.width,
          backgroundColor: color,
        }}
      />
    );
  }

  function Track({ children }: { children?: ReactNode }) {
    return (
      <div className="relative z-[1] shrink-0" style={{ width: timelineW, height: '100%' }}>
        {children}
      </div>
    );
  }

  const gridBg = (
    <div className="pointer-events-none absolute bottom-0 right-0 top-0" style={{ width: timelineW }}>
      {weekends.map(i => (
        <div
          key={`w-${i}`}
          className="absolute inset-y-0 bg-text-muted/5"
          style={{ left: i * px, width: px }}
        />
      ))}
      {months.slice(1).map(m => (
        <div
          key={`ms-${m.startDayId}`}
          className="absolute inset-y-0 w-px bg-border/80"
          style={{ left: m.offset * px }}
        />
      ))}
      {todayInRange && (
        <div
          className="absolute inset-y-0 z-[1] w-0.5 bg-accent-red/80"
          style={{ left: todayOffset * px + px / 2 }}
          title={todayLabel}
        />
      )}
    </div>
  );

  function LabelCell({
    children,
    className,
    indent = 0,
  }: {
    children: ReactNode;
    className?: string;
    indent?: number;
  }) {
    return (
      <div
        className={cn(
          'sticky left-0 z-[2] flex shrink-0 items-center gap-1 border-r border-border bg-surface px-1.5 text-xs',
          className
        )}
        style={{ width: labelW, paddingLeft: 6 + indent }}
      >
        {children}
      </div>
    );
  }

  const rows: ReactNode[] = [];
  for (const group of groups) {
    const projectCollapsed = collapsed.has(group.key);
    if (showProjectHeaders) {
      rows.push(
        <div
          key={`p-${group.key}`}
          className="flex border-b border-border"
          style={{ height: GROUP_H }}
        >
          <LabelCell className="font-semibold text-text-primary">
            <button
              type="button"
              onClick={() => onToggle(group.key)}
              className="flex min-w-0 flex-1 items-center gap-1 text-left"
            >
              {projectCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              )}
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: group.projectColor }}
              />
              <span className="min-w-0 truncate">{group.projectName}</span>
              <span className="shrink-0 text-[10px] font-normal text-text-muted">
                {itemsCountLabel(group.itemCount)}
              </span>
            </button>
          </LabelCell>
          <Track>
            <SummaryBar
              start={group.spanStart}
              end={group.spanEnd}
              color={group.projectColor}
            />
          </Track>
        </div>
      );
    }
    if (showProjectHeaders && projectCollapsed) continue;

    for (const cat of group.categories) {
      const catCollapsed = collapsed.has(cat.key);
      rows.push(
        <div
          key={`c-${cat.key}`}
          className="flex border-b border-border/70"
          style={{ height: GROUP_H }}
        >
          <LabelCell
            indent={showProjectHeaders ? 12 : 0}
            className="text-text-primary"
          >
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => onToggle(cat.key)}
                className="flex shrink-0 items-center text-text-muted"
                aria-label={catCollapsed ? t('gantt_expand') : t('gantt_collapse')}
              >
                {catCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {editingCatKey === cat.key && cat.categoryId && group.projectId ? (
                <input
                  ref={renameInputRef}
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onRenameCategory?.(group.projectId!, cat.categoryId!, editingName);
                      setEditingCatKey(null);
                    }
                    if (e.key === 'Escape') {
                      setEditingCatKey(null);
                    }
                  }}
                  onBlur={() => {
                    onRenameCategory?.(group.projectId!, cat.categoryId!, editingName);
                    setEditingCatKey(null);
                  }}
                  className="min-w-0 flex-1 rounded border border-accent-teal/50 bg-field px-1 py-0.5 text-[13px] font-medium text-text-primary outline-none"
                  maxLength={40}
                />
              ) : (
                <button
                  type="button"
                  title={cat.categoryId ? t('gantt_rename_subproject') : undefined}
                  onClick={e => {
                    e.stopPropagation();
                    if (!cat.categoryId || !group.projectId || !onRenameCategory) {
                      onToggle(cat.key);
                      return;
                    }
                    setEditingCatKey(cat.key);
                    setEditingName(cat.categoryName);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-[13px] font-medium hover:text-accent-teal"
                >
                  {cat.categoryName}
                </button>
              )}
              <span className="shrink-0 text-[10px] text-text-muted">
                {itemsCountLabel(cat.items.length)}
              </span>
            </div>
          </LabelCell>
          <Track>
            <SummaryBar
              start={cat.spanStart}
              end={cat.spanEnd}
              color={group.projectColor}
            />
          </Track>
        </div>
      );
      if (catCollapsed) continue;

      for (const item of cat.items) {
        const color = ganttItemColor(item, group.projectColor);
        const dashed = item.kind === 'possible_event';
        const occs =
          item.occurrences.length > 0
            ? item.occurrences
            : [
                {
                  id: item.id,
                  weekId: item.weekId,
                  startDayId: item.startDayId,
                  endDayId: item.endDayId,
                  completed: item.completed,
                },
              ];
        const series = Boolean(item.seriesId) && occs.length > 1;
        rows.push(
          <div
            key={`i-${item.seriesId ?? item.id}`}
            className="flex border-b border-border/40"
            style={{ height: ROW_H }}
          >
            <LabelCell
              indent={showProjectHeaders ? 22 : 12}
              className="text-text-muted"
            >
              <KindIcon kind={item.kind} />
              <span
                className={cn(
                  'min-w-0 truncate',
                  item.completed && 'task-completed-title opacity-60'
                )}
                title={item.title}
              >
                {item.title}
              </span>
              {series && seriesCountLabel ? (
                <span className="shrink-0 text-[10px] text-text-muted">
                  {seriesCountLabel(occs.length)}
                </span>
              ) : null}
            </LabelCell>
            <Track>
              {occs.map(occ => {
                const layout = ganttBarLayout(occ, rangeFrom, rangeTo, px);
                if (!layout) return null;
                return (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() =>
                      onItemClick({
                        ...item,
                        id: occ.id,
                        weekId: occ.weekId,
                        startDayId: occ.startDayId,
                        endDayId: occ.endDayId,
                        completed: occ.completed,
                      })
                    }
                    className={cn(
                      'absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-md px-1.5 text-left text-[10px] font-medium text-white shadow-sm transition-opacity hover:opacity-90',
                      occ.completed && 'opacity-45',
                      dashed && 'border border-dashed border-white/70 bg-transparent'
                    )}
                    style={{
                      left: layout.left,
                      width: layout.width,
                      height: 18,
                      backgroundColor: dashed ? `${color}33` : color,
                      color: dashed ? color : '#fff',
                      borderRadius: layout.clippedStart || layout.clippedEnd ? 4 : 6,
                    }}
                    title={`${item.title} · ${occ.startDayId}${
                      occ.endDayId !== occ.startDayId ? ` → ${occ.endDayId}` : ''
                    }`}
                  >
                    {layout.width > 48 && occs.length === 1 ? (
                      <span className="truncate">{item.title}</span>
                    ) : null}
                  </button>
                );
              })}
            </Track>
          </div>
        );
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        data-gantt-scroll
        className="min-h-0 flex-1 overflow-auto"
        style={{ ['--gantt-label-w' as string]: `${labelW}px` }}
      >
        <div style={{ minWidth: labelW + timelineW }}>
          <div
            className="sticky top-0 z-20 flex border-b border-border bg-surface"
            style={{ height: HEADER_MONTH_H + HEADER_DAY_H }}
          >
            <div
              className="sticky left-0 z-30 flex shrink-0 items-end border-r border-border bg-surface px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted"
              style={{ width: labelW }}
            >
              {todayLabel}
            </div>
            <div className="relative shrink-0" style={{ width: timelineW }}>
              <div className="absolute inset-x-0 top-0" style={{ height: HEADER_MONTH_H }}>
                {months.map(m => (
                  <div
                    key={m.startDayId}
                    className="absolute top-0 flex h-full items-center border-l border-border/60 px-1.5 text-[11px] font-semibold text-text-primary"
                    style={{
                      left: m.offset * px,
                      width: m.days * px,
                    }}
                  >
                    {format(civilDateFromDayId(m.startDayId), 'MMM yyyy', { locale })}
                  </div>
                ))}
              </div>
              <div
                className="absolute inset-x-0 bottom-0 border-t border-border/50"
                style={{ height: HEADER_DAY_H }}
              >
                {ticks.map(tick => (
                  <div
                    key={tick.offset}
                    className="absolute top-0 flex h-full flex-col items-center justify-center text-[9px] leading-none text-text-muted"
                    style={{ left: tick.offset * px, width: Math.max(px, 16) }}
                  >
                    <span>{tick.label}</span>
                    {tick.sub ? <span className="opacity-70">{tick.sub}</span> : null}
                  </div>
                ))}
                {todayInRange && (
                  <div
                    className="absolute bottom-0 top-0 z-[1] w-0.5 bg-accent-red/80"
                    style={{ left: todayOffset * px + px / 2 }}
                  />
                )}
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <p className="text-sm font-semibold text-text-primary">{emptyTitle}</p>
              <p className="max-w-md text-xs text-text-muted">{emptyHint}</p>
            </div>
          ) : (
            <div className="relative">
              {gridBg}
              {rows}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
