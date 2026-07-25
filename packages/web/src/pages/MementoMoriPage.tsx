import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Hourglass, Settings } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import { getStoicQuoteForDate } from '@/lib/stoicQuotes';
import {
  WEEKS_PER_YEAR,
  computeLifeWeeks,
  milestoneWeekMap,
  weekCellState,
  type LifeWeeksSnapshot,
  type WeekCellState,
} from '@/lib/mementoMori';
import { cn } from '@/lib/utils';

/**
 * Colores sólidos con CSS vars (Tailwind /opacity NO funciona con var(--color-*)).
 */
function cellStyle(state: WeekCellState, isMilestone: boolean): CSSProperties {
  if (state === 'current') {
    return {
      backgroundColor: 'var(--color-accent-red)',
      borderColor: 'var(--color-accent-red)',
      boxShadow: isMilestone ? '0 0 0 2px #e3b341' : undefined,
    };
  }
  if (state === 'lived') {
    return {
      backgroundColor: 'var(--color-accent-teal)',
      borderColor: 'var(--color-accent-teal)',
      boxShadow: isMilestone ? '0 0 0 2px #e3b341' : undefined,
    };
  }
  // remaining
  if (isMilestone) {
    return {
      backgroundColor: 'rgba(227, 179, 65, 0.35)',
      borderColor: '#e3b341',
      boxShadow: '0 0 0 1px #e3b341',
    };
  }
  return {
    backgroundColor: 'transparent',
    borderColor: 'var(--color-border)',
  };
}

function LifeGrid({ snap }: { snap: LifeWeeksSnapshot }) {
  const years = snap.lifespanYears;
  const milestones = useMemo(
    () => milestoneWeekMap(snap.ageYears, snap.lifespanYears),
    [snap.ageYears, snap.lifespanYears]
  );

  const cells: ReactNode[] = [];

  for (let y = 0; y < years; y++) {
    const showLabel = y % 5 === 0 || y === years - 1;
    cells.push(
      <div
        key={`label-${y}`}
        className="flex items-center justify-end pr-1.5 text-[10px] tabular-nums leading-none text-text-muted sm:pr-2 sm:text-[11px]"
        aria-hidden
      >
        {showLabel ? y : ''}
      </div>
    );

    for (let w = 0; w < WEEKS_PER_YEAR; w++) {
      const index = y * WEEKS_PER_YEAR + w;
      const state = weekCellState(index, snap);
      const milestoneAge = milestones.get(index);
      const isMilestone = milestoneAge !== undefined;
      const title = isMilestone
        ? `Cumples ${milestoneAge} · año ${y}, sem. ${w + 1}`
        : `Año ${y}, sem. ${w + 1}`;

      cells.push(
        <span
          key={index}
          title={title}
          data-state={state}
          data-milestone={isMilestone ? milestoneAge : undefined}
          className={cn(
            'box-border aspect-square w-full min-w-0 rounded-[2px] border',
            state === 'current' && 'relative z-[1] ring-2 ring-[var(--color-accent-red)] ring-offset-1 ring-offset-[var(--color-surface)]'
          )}
          style={cellStyle(state, isMilestone)}
        />
      );
    }
  }

  return (
    <div className="flex w-full justify-center">
      <div
        className="w-full max-w-5xl"
        style={{
          display: 'grid',
          gridTemplateColumns: `2rem repeat(${WEEKS_PER_YEAR}, minmax(0, 1fr))`,
          gap: '3px',
        }}
        role="img"
        aria-label={`${snap.weeksLived} semanas vividas, ${snap.weeksRemaining} restantes`}
      >
        {cells}
      </div>
    </div>
  );
}

export function MementoMoriPage() {
  const { settings } = useSettings();
  const { t } = useT();

  const snap = useMemo(
    () => computeLifeWeeks(settings.birthDate, settings.expectedLifespanYears),
    [settings.birthDate, settings.expectedLifespanYears]
  );

  const quote = useMemo(() => getStoicQuoteForDate(new Date()), []);

  const milestoneList = useMemo(() => {
    if (!snap) return [];
    return Array.from(milestoneWeekMap(snap.ageYears, snap.lifespanYears).values());
  }, [snap]);

  return (
    <Layout title={t('nav_memento')} showFab={false}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <header className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <Hourglass className="h-5 w-5 text-accent-teal" />
              <h1 className="text-lg font-semibold text-text-primary">{t('memento_title')}</h1>
            </div>
            <p className="text-sm text-text-muted">{t('memento_subtitle')}</p>
          </header>

          {!snap ? (
            <section className="rounded-lg border border-dashed border-border bg-surface p-6 text-center">
              <p className="mb-4 text-sm text-text-muted">{t('memento_no_birthdate')}</p>
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/settings">
                  <Settings className="h-3.5 w-3.5" />
                  {t('memento_go_settings')}
                </Link>
              </Button>
            </section>
          ) : (
            <>
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label={t('memento_weeks_lived')} value={String(snap.weeksLived)} />
                <StatCard label={t('memento_weeks_left')} value={String(snap.weeksRemaining)} />
                <StatCard
                  label={t('memento_age')}
                  value={`${snap.ageYears} ${t('memento_years')}`}
                  hint={
                    snap.ageWeeksRemainder > 0
                      ? `+${snap.ageWeeksRemainder} ${t('memento_weeks_short')}`
                      : undefined
                  }
                />
                <StatCard
                  label={t('memento_percent')}
                  value={`${snap.percentLived.toFixed(1)}%`}
                />
              </section>

              <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-text-muted sm:justify-start">
                  <LegendDot
                    style={{
                      backgroundColor: 'var(--color-accent-teal)',
                      borderColor: 'var(--color-accent-teal)',
                    }}
                    label={t('memento_legend_lived')}
                  />
                  <LegendDot
                    style={{
                      backgroundColor: 'var(--color-accent-red)',
                      borderColor: 'var(--color-accent-red)',
                    }}
                    label={t('memento_legend_current')}
                  />
                  <LegendDot
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: 'var(--color-border)',
                    }}
                    label={t('memento_legend_left')}
                  />
                  <LegendDot
                    style={{
                      backgroundColor: 'rgba(227, 179, 65, 0.35)',
                      borderColor: '#e3b341',
                    }}
                    label={t('memento_legend_milestone')}
                  />
                </div>

                <LifeGrid snap={snap} />

                {milestoneList.length > 0 && (
                  <p className="mt-3 text-center text-[11px] text-text-muted sm:text-left">
                    {t('memento_milestones_hint').replace(
                      '{ages}',
                      milestoneList.slice(0, 8).join(', ') +
                        (milestoneList.length > 8 ? '…' : '')
                    )}
                  </p>
                )}
                <p className="mt-1 text-center text-[11px] text-text-muted sm:text-left">
                  {t('memento_lifespan_note').replace('{years}', String(snap.lifespanYears))}
                  {snap.pastExpectation ? ` ${t('memento_past_expectation')}` : ''}
                </p>
              </section>
            </>
          )}

          <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {t('memento_quote_title')}
            </p>
            <blockquote className="border-l-2 border-accent-teal pl-3">
              <p className="text-sm leading-relaxed text-text-primary sm:text-base">
                «{quote.text}»
              </p>
              <footer className="mt-2 text-xs font-medium text-accent-teal">— {quote.author}</footer>
            </blockquote>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5 text-center sm:text-left">
      <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-text-primary sm:text-lg">{value}</p>
      {hint ? <p className="text-[10px] text-text-muted">{hint}</p> : null}
    </div>
  );
}

function LegendDot({
  style,
  label,
}: {
  style: CSSProperties;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-[2px] border" style={style} />
      {label}
    </span>
  );
}
