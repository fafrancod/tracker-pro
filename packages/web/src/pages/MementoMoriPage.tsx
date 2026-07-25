import { useMemo, type ReactNode } from 'react';
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
  weekCellState,
  type LifeWeeksSnapshot,
  type WeekCellState,
} from '@/lib/mementoMori';
import { cn } from '@/lib/utils';

function cellClass(state: WeekCellState): string {
  switch (state) {
    case 'lived':
      return 'bg-accent-teal/80 border-accent-teal/50';
    case 'current':
      return 'bg-accent-red border-accent-red ring-1 ring-accent-red/60 scale-110 z-[1]';
    case 'remaining':
    default:
      return 'bg-transparent border-border/80';
  }
}

function LifeGrid({ snap }: { snap: LifeWeeksSnapshot }) {
  const years = snap.lifespanYears;
  const cells: ReactNode[] = [];

  for (let y = 0; y < years; y++) {
    for (let w = 0; w < WEEKS_PER_YEAR; w++) {
      const index = y * WEEKS_PER_YEAR + w;
      const state = weekCellState(index, snap);
      cells.push(
        <span
          key={index}
          title={`Año ${y}, sem. ${w + 1}`}
          className={cn(
            'box-border block h-[5px] w-full min-w-[4px] rounded-[1px] border sm:h-1.5',
            cellClass(state)
          )}
        />
      );
    }
  }

  // Una etiqueta por fila de año, alineada con el gap de la grilla.
  const yearLabels = Array.from({ length: years }, (_, y) => (
    <div
      key={y}
      className="flex h-[5px] items-center justify-end text-[9px] leading-none text-text-muted sm:h-1.5 sm:text-[10px]"
    >
      {y % 10 === 0 || y === years - 1 ? y : ''}
    </div>
  ));

  return (
    <div className="flex gap-1.5 sm:gap-2">
      <div className="flex shrink-0 flex-col gap-[2px]" aria-hidden>
        {yearLabels}
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div
          className="grid w-full min-w-[280px] max-w-[520px] gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${WEEKS_PER_YEAR}, minmax(0, 1fr))` }}
          role="img"
          aria-label={`${snap.weeksLived} semanas vividas, ${snap.weeksRemaining} restantes`}
        >
          {cells}
        </div>
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

  return (
    <Layout title={t('nav_memento')} showFab={false}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <header className="space-y-1">
            <div className="flex items-center gap-2">
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

              <section className="rounded-lg border border-border bg-surface p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
                  <LegendDot className="bg-accent-teal/80 border-accent-teal/50" label={t('memento_legend_lived')} />
                  <LegendDot className="bg-accent-red border-accent-red" label={t('memento_legend_current')} />
                  <LegendDot className="bg-transparent border-border" label={t('memento_legend_left')} />
                </div>
                <LifeGrid snap={snap} />
                <p className="mt-3 text-[11px] text-text-muted">
                  {t('memento_lifespan_note').replace('{years}', String(snap.lifespanYears))}
                  {snap.pastExpectation ? ` ${t('memento_past_expectation')}` : ''}
                </p>
              </section>
            </>
          )}

          {/* Frase estoica del día — siempre visible */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {t('memento_quote_title')}
            </p>
            <blockquote className="border-l-2 border-accent-teal/60 pl-3">
              <p className="text-sm leading-relaxed text-text-primary">«{quote.text}»</p>
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
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-text-primary sm:text-lg">{value}</p>
      {hint ? <p className="text-[10px] text-text-muted">{hint}</p> : null}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-2.5 w-2.5 rounded-[2px] border', className)} />
      {label}
    </span>
  );
}
