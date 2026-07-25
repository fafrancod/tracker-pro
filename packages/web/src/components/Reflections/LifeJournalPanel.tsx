import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Activity,
  BookOpen,
  ChevronRight,
  Heart,
  Minus,
  PenLine,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import {
  ENERGY_COLORS,
  ENERGY_FEEL_COLORS,
  MOOD_COLORS,
  computePeriodWellbeing,
  formatDayId,
  listLifeJournalEntries,
  type LifeJournalPeriod,
} from '@/lib/dailyJournal';
import { cn } from '@/lib/utils';
import type { EnergyFeel, MoodLevel } from '@core/types';
import type { TKey } from '@/lib/i18n';

const PERIODS: LifeJournalPeriod[] = ['week', 'month', 'quarter'];

const PERIOD_KEYS: Record<LifeJournalPeriod, TKey> = {
  week: 'life_journal_period_week',
  month: 'life_journal_period_month',
  quarter: 'life_journal_period_quarter',
};

const FEEL_LABEL_KEYS: Record<EnergyFeel, TKey> = {
  tense: 'energy_feel_tense',
  relaxed: 'energy_feel_relaxed',
  vigorous: 'energy_feel_vigorous',
};

const FEEL_EMOJI: Record<EnergyFeel, string> = {
  tense: '😣',
  relaxed: '🌿',
  vigorous: '💪',
};

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' | 'unknown' }) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-accent-teal" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-accent-pink" />;
  return <Minus className="h-3.5 w-3.5 text-text-muted" />;
}

function EvolutionChart({
  title,
  values,
  colorFor,
}: {
  title: string;
  values: { dayId: string; value: number | null }[];
  colorFor: (value: number) => string;
}) {
  const maxH = 56;
  const withData = values.filter(v => v.value !== null).length;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className="text-[10px] text-text-muted">
          {withData}/{values.length}
        </span>
      </div>
      {withData === 0 ? (
        <p className="py-6 text-center text-xs text-text-muted">—</p>
      ) : (
        <div className="flex h-16 items-end gap-px overflow-x-auto pb-1">
          {values.map(({ dayId, value }) => {
            const h = value === null ? 2 : Math.max(4, Math.round((value / 5) * maxH));
            const color = value === null ? 'var(--color-border)' : colorFor(value);
            return (
              <div
                key={dayId}
                className="flex min-w-0 flex-1 flex-col items-center justify-end"
                title={value === null ? dayId : `${dayId}: ${value.toFixed(1)}/5`}
              >
                <div
                  className="w-full max-w-[10px] rounded-t-sm transition-all"
                  style={{
                    height: h,
                    backgroundColor: color,
                    opacity: value === null ? 0.35 : 1,
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface LifeJournalPanelProps {
  onOpenDay: (dayId: string) => void;
}

export function LifeJournalPanel({ onOpenDay }: LifeJournalPanelProps) {
  const { settings } = useSettings();
  const { t, locale, shortDateFormat } = useT();
  const todayId = formatDayId(new Date());
  const [period, setPeriod] = useState<LifeJournalPeriod>('week');

  const summary = useMemo(
    () => computePeriodWellbeing(settings.dailyJournal, todayId, period),
    [settings.dailyJournal, todayId, period]
  );

  const entries = useMemo(
    () => listLifeJournalEntries(settings.dailyJournal, todayId, period),
    [settings.dailyJournal, todayId, period]
  );

  const moodSeries = useMemo(
    () => summary.days.map(d => ({ dayId: d.dayId, value: d.avgMood })),
    [summary.days]
  );
  const energySeries = useMemo(
    () => summary.days.map(d => ({ dayId: d.dayId, value: d.avgEnergy })),
    [summary.days]
  );

  const trendLabel = (trend: typeof summary.moodTrend): string => {
    if (trend === 'up') return t('life_journal_trend_up');
    if (trend === 'down') return t('life_journal_trend_down');
    if (trend === 'flat') return t('life_journal_trend_flat');
    return t('life_journal_trend_unknown');
  };

  function formatDayLabel(dayId: string): string {
    try {
      return format(parseISO(`${dayId}T12:00:00`), `EEE ${shortDateFormat}`, { locale });
    } catch {
      return dayId;
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent-teal" />
          <h2 className="text-lg font-semibold text-text-primary">{t('life_journal_title')}</h2>
        </div>
        <p className="text-sm text-text-muted">{t('life_journal_subtitle')}</p>
      </header>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface p-1">
        {PERIODS.map(p => {
          const active = period === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'min-w-[5.5rem] flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                active
                  ? 'bg-accent-teal text-white shadow-sm'
                  : 'text-text-muted hover:bg-background hover:text-text-primary'
              )}
            >
              {t(PERIOD_KEYS[p])}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-[11px] text-text-muted">{t('life_journal_avg_mood')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">
            {summary.avgMood === null ? '—' : summary.avgMood.toFixed(1)}
            <span className="text-xs font-normal text-text-muted">/5</span>
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-text-muted">
            <TrendIcon trend={summary.moodTrend} />
            {trendLabel(summary.moodTrend)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-[11px] text-text-muted">{t('life_journal_avg_energy')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">
            {summary.avgEnergy === null ? '—' : summary.avgEnergy.toFixed(1)}
            <span className="text-xs font-normal text-text-muted">/5</span>
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-text-muted">
            <TrendIcon trend={summary.energyTrend} />
            {trendLabel(summary.energyTrend)}
          </div>
        </div>
        <div className="col-span-2 rounded-xl border border-border bg-surface p-3 sm:col-span-1">
          <p className="text-[11px] text-text-muted">{t('life_journal_days_logged')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">
            {Math.max(summary.daysWithMood, summary.daysWithEnergy)}
            <span className="text-xs font-normal text-text-muted">/{summary.days.length}</span>
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-text-muted">
            <Activity className="h-3.5 w-3.5" />
            {t(PERIOD_KEYS[period])}
          </div>
        </div>
      </div>

      <EvolutionChart
        title={t('life_journal_mood_evolution')}
        values={moodSeries}
        colorFor={v => MOOD_COLORS[Math.round(v) as MoodLevel] ?? MOOD_COLORS[3]}
      />
      <EvolutionChart
        title={t('life_journal_energy_evolution')}
        values={energySeries}
        colorFor={v => ENERGY_COLORS[Math.round(v) as MoodLevel] ?? ENERGY_COLORS[3]}
      />

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <PenLine className="h-4 w-4 text-accent-teal" />
          {t('life_journal_entries')}
        </h3>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-8 text-center text-sm text-text-muted">
            {t('life_journal_empty')}
          </div>
        ) : (
          <ul className="space-y-3">
            {entries.map(entry => (
              <li key={entry.dayId}>
                <button
                  type="button"
                  onClick={() => onOpenDay(entry.dayId)}
                  className="w-full rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent-teal/40"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold capitalize text-text-primary">
                      {formatDayLabel(entry.dayId)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-accent-teal">
                      {t('life_journal_open_day')}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-text-muted">
                    {entry.avgMood !== null && (
                      <span
                        className="rounded-full px-2 py-0.5 font-medium text-white"
                        style={{
                          backgroundColor:
                            MOOD_COLORS[Math.round(entry.avgMood) as MoodLevel] ??
                            MOOD_COLORS[3],
                        }}
                      >
                        {t('metric_mood')} {entry.avgMood.toFixed(1)}
                      </span>
                    )}
                    {entry.avgEnergy !== null && (
                      <span
                        className="rounded-full px-2 py-0.5 font-medium text-white"
                        style={{
                          backgroundColor:
                            ENERGY_COLORS[Math.round(entry.avgEnergy) as MoodLevel] ??
                            ENERGY_COLORS[3],
                        }}
                      >
                        {t('metric_energy')} {entry.avgEnergy.toFixed(1)}
                      </span>
                    )}
                    {entry.dominantFeel && (
                      <span
                        className="rounded-full px-2 py-0.5 font-medium text-white"
                        style={{ backgroundColor: ENERGY_FEEL_COLORS[entry.dominantFeel] }}
                      >
                        {FEEL_EMOJI[entry.dominantFeel]}{' '}
                        {t(FEEL_LABEL_KEYS[entry.dominantFeel])}
                      </span>
                    )}
                  </div>

                  {entry.reflection ? (
                    <p className="mb-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                      {entry.reflection}
                    </p>
                  ) : null}

                  {entry.gratitude ? (
                    <p className="flex items-start gap-1.5 text-sm text-text-muted">
                      <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-pink" />
                      <span className="line-clamp-2 whitespace-pre-wrap">{entry.gratitude}</span>
                    </p>
                  ) : null}

                  {!entry.reflection && !entry.gratitude && (
                    <p className="text-xs text-text-muted">{t('life_journal_no_text')}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
