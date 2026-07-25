import { format, parseISO } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { formatDose } from '@core/lib/rx';
import type { RxPhaseEndingSoon } from '@core/lib/rx';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RxPhasesEndingPanelProps {
  items: RxPhaseEndingSoon[];
  className?: string;
}

export function RxPhasesEndingPanel({ items, className }: RxPhasesEndingPanelProps) {
  const { t, locale, shortDateFormat } = useT();

  function dayLabel(dayId: string): string {
    try {
      return format(parseISO(`${dayId}T12:00:00`), shortDateFormat, { locale });
    } catch {
      return dayId;
    }
  }

  return (
    <section className={cn('rounded-xl border border-border bg-surface p-3 sm:p-4', className)}>
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-accent-teal" />
        <h3 className="text-sm font-semibold text-text-primary">
          {t('rx_phases_ending_title')}
        </h3>
        {items.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {items.length}
          </Badge>
        )}
      </div>
      <p className="mb-3 text-[11px] text-text-muted">{t('rx_phases_ending_subtitle')}</p>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-text-muted">
          {t('rx_phases_ending_empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map(item => (
            <li
              key={`${item.treatmentKey}-${item.phaseIndex}-${item.endDayId}`}
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{item.title}</p>
                  <p className="text-[11px] text-text-muted">
                    {item.subject?.trim() ||
                      (item.kind === 'rx_pet'
                        ? t('rx_subject_unnamed_pet')
                        : t('rx_subject_unnamed_person'))}
                    {' · '}
                    {t('rx_phase')} {item.phaseIndex + 1}
                    {' · '}
                    {formatDose(item.amount, item.unit)}
                  </p>
                </div>
                <div className="text-right text-[11px]">
                  <p className="font-semibold tabular-nums text-accent-teal">
                    {t('rx_phases_ending_on').replace('{date}', dayLabel(item.endDayId))}
                  </p>
                  <p className="text-text-muted">
                    {t('rx_progress_days_left')}:{' '}
                    <span className="tabular-nums font-medium text-text-primary">
                      {item.daysRemaining}
                    </span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
