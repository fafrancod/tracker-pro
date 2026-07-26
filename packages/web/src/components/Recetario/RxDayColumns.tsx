import { useEffect, useMemo, useRef } from 'react';
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import { capitalize } from '@/lib/i18n';
import { formatDose, isRxKind } from '@core/lib/rx';
import { getDayId } from '@core/services/taskService';
import type { Task } from '@core/types';
import { CheckCircle2 } from 'lucide-react';

const STRIP_PAST = 14;
const STRIP_FUTURE = 21;

export type RxSubjectFilter = 'all' | 'human' | 'pet';

function doseDayId(task: Task): string {
  return (task as Task & { dayId?: string }).dayId || task.endDayId || '';
}

function matchesSubjectFilter(task: Task, filter: RxSubjectFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'human') return task.kind === 'rx_human';
  return task.kind === 'rx_pet';
}

function sortDoses(a: Task, b: Task): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  return (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99');
}

export function dosesForDay(
  tasks: Task[],
  dayId: string,
  filter: RxSubjectFilter
): Task[] {
  return tasks
    .filter(t => isRxKind(t.kind) && doseDayId(t) === dayId && matchesSubjectFilter(t, filter))
    .slice()
    .sort(sortDoses);
}

export interface RxDayColumnsProps {
  tasks: Task[];
  filter: RxSubjectFilter;
  /** Day id (yyyy-MM-dd) of the center column. */
  centerDayId: string;
  onCenterDayChange: (dayId: string) => void;
  onToggleDose: (task: Task) => void;
}

export function RxDayColumns({
  tasks,
  filter,
  centerDayId,
  onCenterDayChange,
  onToggleDose,
}: RxDayColumnsProps) {
  const { t, locale, shortDateFormat } = useT();
  const stripRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayId = getDayId(today);

  const centerDate = useMemo(() => {
    try {
      return startOfDay(parseISO(`${centerDayId}T12:00:00`));
    } catch {
      return today;
    }
  }, [centerDayId, today]);

  const dayIds = useMemo(
    () => [
      getDayId(subDays(centerDate, 1)),
      centerDayId,
      getDayId(addDays(centerDate, 1)),
    ],
    [centerDate, centerDayId]
  );

  const stripDays = useMemo(() => {
    const start = subDays(today, STRIP_PAST);
    return Array.from({ length: STRIP_PAST + STRIP_FUTURE + 1 }, (_, i) =>
      addDays(start, i)
    );
  }, [today]);

  // Centra el chip del día ancla en el strip al cambiar.
  useEffect(() => {
    const root = stripRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-day-id="${centerDayId}"]`) as HTMLElement | null;
    if (!el) return;
    const rootRect = root.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta =
      elRect.left + elRect.width / 2 - (rootRect.left + rootRect.width / 2);
    root.scrollBy({ left: delta, behavior: 'smooth' });
  }, [centerDayId]);

  function shiftCenter(delta: number) {
    onCenterDayChange(getDayId(addDays(centerDate, delta)));
  }

  function labelForDay(dayId: string): { weekday: string; date: string; isToday: boolean } {
    const d = parseISO(`${dayId}T12:00:00`);
    return {
      weekday: capitalize(format(d, 'EEE', { locale })),
      date: format(d, shortDateFormat, { locale }),
      isToday: dayId === todayId,
    };
  }

  return (
    <div className="space-y-3">
      {/* Selector lineal de días */}
      <div className="rounded-xl border border-border bg-surface p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('recetario_day_range')}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t('recetario_prev_day')}
              onClick={() => shiftCenter(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => onCenterDayChange(todayId)}
            >
              {t('action_today')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t('recetario_next_day')}
              onClick={() => shiftCenter(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Línea de días: scroll horizontal; el rango de 3 se resalta */}
        <div
          ref={stripRef}
          className="flex gap-1 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]"
          role="listbox"
          aria-label={t('recetario_day_range')}
        >
          {stripDays.map(d => {
            const id = getDayId(d);
            const inWindow = dayIds.includes(id);
            const isCenter = id === centerDayId;
            const isToday = isSameDay(d, today);
            return (
              <button
                key={id}
                type="button"
                data-day-id={id}
                role="option"
                aria-selected={isCenter}
                onClick={() => onCenterDayChange(id)}
                className={cn(
                  'flex min-w-[2.75rem] shrink-0 flex-col items-center rounded-lg px-1.5 py-1.5 text-center transition-colors',
                  isCenter
                    ? 'bg-accent-pink text-white shadow-sm'
                    : inWindow
                      ? 'bg-accent-pink/15 text-accent-pink ring-1 ring-accent-pink/40'
                      : 'text-text-muted hover:bg-background hover:text-text-primary',
                  isToday && !isCenter && !inWindow && 'ring-1 ring-accent-teal/40'
                )}
              >
                <span className="text-[9px] font-medium uppercase leading-none opacity-80">
                  {format(d, 'EEE', { locale }).slice(0, 2)}
                </span>
                <span className="mt-0.5 text-sm font-semibold tabular-nums leading-none">
                  {format(d, 'd')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tres columnas: ayer | centro | mañana */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {dayIds.map((dayId, idx) => {
          const meta = labelForDay(dayId);
          const doses = dosesForDay(tasks, dayId, filter);
          const pending = doses.filter(d => !d.completed).length;
          const isCenter = idx === 1;
          return (
            <section
              key={dayId}
              className={cn(
                'flex min-h-[12rem] flex-col rounded-xl border bg-surface',
                isCenter ? 'border-accent-pink/50 shadow-sm' : 'border-border',
                meta.isToday && 'ring-1 ring-accent-teal/30'
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      isCenter ? 'text-accent-pink' : 'text-text-primary'
                    )}
                  >
                    {meta.weekday}
                    {meta.isToday ? ` · ${t('action_today')}` : ''}
                  </p>
                  <p className="truncate text-[11px] text-text-muted">{meta.date}</p>
                </div>
                {doses.length > 0 && (
                  <Badge
                    variant={pending === 0 ? 'green' : 'secondary'}
                    className="shrink-0 text-[10px]"
                  >
                    {pending}/{doses.length}
                  </Badge>
                )}
              </header>

              <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
                {doses.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-border px-2 py-4 text-center text-[11px] text-text-muted">
                    {t('recetario_no_doses_day')}
                  </li>
                ) : (
                  doses.map(task => (
                    <DoseChip
                      key={task.id}
                      task={task}
                      onToggle={() => onToggleDose(task)}
                    />
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DoseChip({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const { t } = useT();
  const doseLabel = task.rx ? formatDose(task.rx.amount, task.rx.unit) : null;
  const subject = task.rx?.subject?.trim();

  return (
    <li
      className={cn(
        'flex items-start gap-1.5 rounded-md border px-2 py-1.5',
        task.completed
          ? 'border-border bg-background/50 opacity-70'
          : 'border-border bg-background'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          task.completed
            ? 'border-accent-green bg-accent-green/20 text-accent-green'
            : 'border-border hover:border-accent-green'
        )}
        aria-label={
          task.completed ? t('dashboard_dose_done') : t('dashboard_dose_pending')
        }
      >
        {task.completed && <CheckCircle2 className="h-3 w-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'shrink-0 text-[11px] font-semibold tabular-nums',
              task.completed ? 'text-text-muted' : 'text-accent-teal'
            )}
          >
            {task.startTime ?? '—'}
          </span>
          <p
            className={cn(
              'truncate text-xs font-medium',
              task.completed ? 'text-text-muted line-through' : 'text-text-primary'
            )}
          >
            {task.title}
          </p>
        </div>
        {(subject || doseLabel) && (
          <p className="mt-0.5 truncate text-[10px] text-text-muted">
            {[subject, doseLabel].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </li>
  );
}
