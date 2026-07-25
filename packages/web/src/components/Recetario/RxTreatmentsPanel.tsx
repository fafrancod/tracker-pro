import { CheckCircle2, ChevronDown, ChevronRight, PawPrint, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from '@/components/Board';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/utils';
import { formatDose } from '@core/lib/rx';
import type { RxPhaseProgress, RxSubjectGroup, RxTreatmentProgress } from '@core/lib/rx';
import type { Task } from '@core/types';
import type { TKey } from '@/lib/i18n';

function phaseStatusKey(status: RxPhaseProgress['status']): TKey {
  if (status === 'active') return 'rx_phase_status_active';
  if (status === 'upcoming') return 'rx_phase_status_upcoming';
  return 'rx_phase_status_done';
}

function DoseToggleRow({
  task,
  onToggle,
  compact,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  compact?: boolean;
}) {
  const { t } = useT();
  const doseLabel = task.rx ? formatDose(task.rx.amount, task.rx.unit) : null;

  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-1.5',
        task.completed
          ? 'border-border bg-background/50 opacity-70'
          : 'border-border bg-background'
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(task)}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
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
      <span
        className={cn(
          'w-11 shrink-0 text-center text-xs font-semibold tabular-nums',
          task.completed ? 'text-text-muted' : 'text-accent-teal'
        )}
      >
        {task.startTime ?? '—'}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            task.completed ? 'text-text-muted line-through' : 'text-text-primary'
          )}
        >
          {task.title}
        </p>
        {!compact && doseLabel && (
          <p className="text-[10px] text-text-muted">{doseLabel}</p>
        )}
      </div>
      {doseLabel && (
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {doseLabel}
        </Badge>
      )}
    </li>
  );
}

function PhaseRow({ phase }: { phase: RxPhaseProgress }) {
  const { t } = useT();
  const dose = formatDose(phase.amount, phase.unit);
  return (
    <div className="rounded-lg border border-border/80 bg-background px-2.5 py-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <span className="text-xs font-semibold text-text-primary">
          {t('rx_phase')} {phase.phaseIndex + 1}
        </span>
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px]',
            phase.status === 'active' && 'bg-accent-teal/15 text-accent-teal',
            phase.status === 'done' && 'opacity-70'
          )}
        >
          {t(phaseStatusKey(phase.status))}
        </Badge>
      </div>
      <p className="text-[11px] text-text-muted">
        {dose}
        {phase.timesPerDay > 0
          ? ` · ${t('rx_times_per_day').replace('{n}', String(phase.timesPerDay))}`
          : ''}
        {' · '}
        {t('rx_phase_days_count').replace('{n}', String(phase.days))}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
        <span>
          {t('rx_progress_days_left')}:{' '}
          <strong className="text-text-primary tabular-nums">{phase.daysRemaining}</strong>
        </span>
        <span>
          {t('rx_progress_doses')}:{' '}
          <strong className="text-text-primary tabular-nums">
            {phase.completedDoses}/{phase.totalDoses}
          </strong>
        </span>
        <span>
          {t('rx_progress_remaining')}:{' '}
          <strong className="text-text-primary tabular-nums">{phase.remainingDoses}</strong>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent-pink/80 transition-all"
          style={{
            width: `${phase.totalDoses > 0 ? Math.round((phase.completedDoses / phase.totalDoses) * 100) : 0}%`,
          }}
        />
      </div>
    </div>
  );
}

function TreatmentCard({
  treatment,
  defaultOpen,
}: {
  treatment: RxTreatmentProgress;
  defaultOpen?: boolean;
}) {
  const { t, locale, shortDateFormat } = useT();
  const [open, setOpen] = useState(defaultOpen ?? treatment.isActive);

  const rangeLabel = useMemo(() => {
    try {
      const a = format(parseISO(`${treatment.planStartDayId}T12:00:00`), shortDateFormat, {
        locale,
      });
      const b = format(parseISO(`${treatment.planEndDayId}T12:00:00`), shortDateFormat, {
        locale,
      });
      return `${a} → ${b}`;
    } catch {
      return `${treatment.planStartDayId} → ${treatment.planEndDayId}`;
    }
  }, [treatment.planStartDayId, treatment.planEndDayId, locale, shortDateFormat]);

  return (
    <div
      className={cn(
        'rounded-xl border bg-surface',
        treatment.isActive ? 'border-border' : 'border-border/60 opacity-85'
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-start gap-3 px-3 py-3 text-left"
      >
        <ProgressRing
          progress={treatment.progressPct}
          completed={treatment.completedDoses}
          total={treatment.totalDoses}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-text-primary">{treatment.title}</p>
            <Badge variant="secondary" className="text-[10px]">
              {treatment.kind === 'rx_pet' ? t('task_kind_rx_pet') : t('task_kind_rx_human')}
            </Badge>
            {!treatment.isActive && (
              <Badge variant="secondary" className="text-[10px] opacity-80">
                {t('rx_treatment_finished')}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-text-muted">{rangeLabel}</p>
          <p className="mt-1 text-[11px] text-text-muted">
            {t('rx_progress_pct')
              .replace('{pct}', String(treatment.progressPct))
              .replace('{done}', String(treatment.completedDoses))
              .replace('{total}', String(treatment.totalDoses))
              .replace('{left}', String(treatment.remainingDoses))}
          </p>
        </div>
        {open ? (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {treatment.phaseProgress.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {t('rx_progress_phases')}
              </p>
              {treatment.phaseProgress.map(p => (
                <PhaseRow key={p.phaseIndex} phase={p} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">{t('rx_progress_no_phases')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function RxSubjectCard({
  group,
  onToggleDose,
  showToday = true,
  compact = false,
}: {
  group: RxSubjectGroup;
  onToggleDose: (task: Task) => void;
  showToday?: boolean;
  compact?: boolean;
}) {
  const { t } = useT();
  const Icon = group.kind === 'rx_pet' ? PawPrint : User;
  const pendingToday = group.todayDoses.filter(d => !d.completed).length;

  return (
    <section className="rounded-xl border border-border bg-surface/80 p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-pink/15 text-accent-pink">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text-primary">
              {group.subjectLabel ||
                (group.kind === 'rx_pet'
                  ? t('rx_subject_unnamed_pet')
                  : group.kind === 'rx_human'
                    ? t('rx_subject_unnamed_person')
                    : t('nav_recetario'))}
            </h3>
            <p className="text-[11px] text-text-muted">
              {group.kind === 'rx_pet'
                ? t('task_kind_rx_pet')
                : group.kind === 'rx_human'
                  ? t('task_kind_rx_human')
                  : t('nav_recetario')}
              {' · '}
              {group.treatments.length}{' '}
              {group.treatments.length === 1
                ? t('rx_treatment_one')
                : t('rx_treatment_many')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProgressRing
            progress={group.progressPct}
            completed={group.completedDoses}
            total={group.totalDoses}
            size={compact ? 36 : 44}
          />
          <div className="text-right text-[11px] text-text-muted">
            <p className="font-semibold tabular-nums text-text-primary">{group.progressPct}%</p>
            <p>
              {group.completedDoses}/{group.totalDoses} · {group.remainingDoses}{' '}
              {t('rx_progress_left_short')}
            </p>
          </div>
        </div>
      </header>

      {showToday && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {t('rx_today_doses')}
            </p>
            {group.todayDoses.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {pendingToday}/{group.todayDoses.length}
              </Badge>
            )}
          </div>
          {group.todayDoses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted">
              {t('rx_no_doses_today_subject')}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {group.todayDoses.map(task => (
                <DoseToggleRow
                  key={task.id}
                  task={task}
                  onToggle={onToggleDose}
                  compact={compact}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {t('rx_treatments_title')}
        </p>
        {group.treatments.map(tr => (
          <TreatmentCard
            key={tr.key}
            treatment={tr}
            defaultOpen={!compact && tr.isActive}
          />
        ))}
      </div>
    </section>
  );
}

export function RxTreatmentsPanel({
  groups,
  onToggleDose,
  emptyLabel,
  compact = false,
  showToday = true,
}: {
  groups: RxSubjectGroup[];
  onToggleDose: (task: Task) => void;
  emptyLabel: string;
  compact?: boolean;
  showToday?: boolean;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {groups.map(g => (
        <RxSubjectCard
          key={g.subjectKey}
          group={g}
          onToggleDose={onToggleDose}
          showToday={showToday}
          compact={compact}
        />
      ))}
    </div>
  );
}
