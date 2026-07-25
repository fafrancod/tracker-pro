import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Hourglass, Settings, Sparkles, Map as MapIcon } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { LifeGoalsPanel } from '@/components/Memento/LifeGoalsPanel';
import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import { getStoicQuoteForDate } from '@/lib/stoicQuotes';
import {
  WEEKS_PER_YEAR,
  computeLifeWeeks,
  lifeGoalsByWeekIndex,
  milestoneWeekMap,
  weekCellState,
  type LifeGoalMarker,
  type LifeWeeksSnapshot,
  type WeekCellState,
} from '@/lib/mementoMori';
import { cn } from '@/lib/utils';
import type { LifeGoal, LifeGoalKind } from '@core/types';
import type { TKey } from '@/lib/i18n';

type TabId = 'map' | 'goals';

const KIND_LABEL_KEY: Record<LifeGoalKind, TKey> = {
  goal: 'life_goal_kind_goal',
  manifestation: 'life_goal_kind_manifestation',
  milestone: 'life_goal_kind_milestone',
  vision: 'life_goal_kind_vision',
};

/**
 * Colores sólidos con CSS vars (Tailwind /opacity NO funciona con var(--color-*)).
 */
function cellStyle(
  state: WeekCellState,
  isMilestone: boolean,
  goalColor: string | null
): CSSProperties {
  if (goalColor) {
    // Meta de vida: relleno del color de la meta; anillo dorado si también es hito ×5
    return {
      backgroundColor: goalColor,
      borderColor: goalColor,
      boxShadow: isMilestone
        ? '0 0 0 2px #e3b341, 0 0 0 3px rgba(0,0,0,0.25)'
        : '0 0 0 1px rgba(255,255,255,0.35)',
    };
  }
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

function LifeGrid({
  snap,
  goalsByWeek,
  goalsById,
}: {
  snap: LifeWeeksSnapshot;
  goalsByWeek: Map<number, LifeGoalMarker[]>;
  goalsById: Map<string, LifeGoal>;
}) {
  const { t } = useT();
  const years = snap.lifespanYears;
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewGoals, setPreviewGoals] = useState<LifeGoal[] | null>(null);
  /** Índice de semana del hover activo (para no reabrir al moverse entre el mismo cell). */
  const [hoverWeekIndex, setHoverWeekIndex] = useState<number | null>(null);

  const milestones = useMemo(
    () => milestoneWeekMap(snap.ageYears, snap.lifespanYears),
    [snap.ageYears, snap.lifespanYears]
  );

  const resolveGoals = useCallback(
    (markers: LifeGoalMarker[]): LifeGoal[] =>
      markers.map(m => goalsById.get(m.goalId)).filter((g): g is LifeGoal => Boolean(g)),
    [goalsById]
  );

  const openGoals = useCallback(
    (markers: LifeGoalMarker[], weekIndex: number) => {
      const goals = resolveGoals(markers);
      if (goals.length === 0) return;
      setPreviewGoals(goals);
      setHoverWeekIndex(weekIndex);
    },
    [resolveGoals]
  );

  const closePreview = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setPreviewGoals(null);
    setHoverWeekIndex(null);
  }, []);

  /** Abre tras un breve delay; el modal vive solo mientras el mouse está en el cuadrado. */
  const onCellEnter = useCallback(
    (markers: LifeGoalMarker[], weekIndex: number) => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      if (openTimer.current) clearTimeout(openTimer.current);
      openTimer.current = setTimeout(() => openGoals(markers, weekIndex), 120);
    },
    [openGoals]
  );

  /** Al salir del cuadrado se cierra el preview (sin esperar al modal: no intercepta el mouse). */
  const onCellLeave = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    // Cierre inmediato al sacar el mouse del hito
    closeTimer.current = setTimeout(() => {
      setPreviewGoals(null);
      setHoverWeekIndex(null);
      closeTimer.current = null;
    }, 0);
  }, []);

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
      const goalsHere = goalsByWeek.get(index);
      const primaryGoal = goalsHere?.[0] ?? null;
      const goalColor = primaryGoal?.color ?? null;
      const hasGoals = Boolean(goalsHere?.length);

      const titleParts: string[] = [];
      if (primaryGoal) {
        titleParts.push(
          goalsHere!.length === 1
            ? `Meta: ${primaryGoal.title}`
            : `Metas: ${goalsHere!.map(g => g.title).join(' · ')}`
        );
      }
      if (isMilestone) titleParts.push(`Cumples ${milestoneAge}`);
      titleParts.push(`Año ${y}, sem. ${w + 1}`);

      const cellClass = cn(
        'box-border aspect-square w-full min-w-0 rounded-[2px] border',
        state === 'current' &&
          !goalColor &&
          'relative z-[1] ring-2 ring-[var(--color-accent-red)] ring-offset-1 ring-offset-[var(--color-surface)]',
        goalColor && 'relative z-[1] cursor-pointer transition-transform hover:scale-150 hover:z-[2]',
        hasGoals && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal'
      );

      if (hasGoals && goalsHere) {
        const isHovering = hoverWeekIndex === index;
        cells.push(
          <button
            key={index}
            type="button"
            title={titleParts.join(' · ')}
            data-state={state}
            data-milestone={isMilestone ? milestoneAge : undefined}
            data-goal={primaryGoal?.goalId}
            className={cn(cellClass, isHovering && 'scale-150 z-[3]')}
            style={cellStyle(state, isMilestone, goalColor)}
            aria-label={t('memento_goal_preview_aria').replace(
              '{title}',
              goalsHere.map(g => g.title).join(', ')
            )}
            onMouseEnter={() => onCellEnter(goalsHere, index)}
            onMouseLeave={onCellLeave}
            onFocus={() => onCellEnter(goalsHere, index)}
            onBlur={onCellLeave}
            // Táctil: mantener mientras se toca; al soltar fuera no hay leave fiable → toggle
            onClick={e => {
              e.preventDefault();
              if (hoverWeekIndex === index && previewGoals) {
                closePreview();
              } else {
                openGoals(goalsHere, index);
              }
            }}
          />
        );
      } else {
        cells.push(
          <span
            key={index}
            title={titleParts.join(' · ')}
            data-state={state}
            data-milestone={isMilestone ? milestoneAge : undefined}
            className={cellClass}
            style={cellStyle(state, isMilestone, goalColor)}
          />
        );
      }
    }
  }

  const list = previewGoals ?? [];
  const showPreview = list.length > 0;

  return (
    <>
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

      {/*
        Preview no modal bloqueante: pointer-events-none para que el mouse
        siga “en el cuadrado” y al salir se cierre de verdad.
      */}
      {showPreview && (
        <div
          className="pointer-events-none fixed inset-x-3 top-[max(4.5rem,env(safe-area-inset-top))] z-50 mx-auto max-h-[min(70vh,32rem)] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:right-6 sm:top-20"
          role="tooltip"
          aria-live="polite"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Sparkles className="h-4 w-4 text-accent-teal" />
              {list.length > 1
                ? t('memento_goal_preview_title_multi').replace('{n}', String(list.length))
                : t('memento_goal_preview_title')}
            </p>
            <p className="mt-0.5 text-[11px] text-text-muted">{t('memento_goal_preview_desc')}</p>
          </div>
          <div className="space-y-3 p-3">
            {list.map(goal => {
              const color =
                goal.color && /^#[0-9A-Fa-f]{6}$/.test(goal.color) ? goal.color : '#a371f7';
              const kindKey = KIND_LABEL_KEY[goal.kind] ?? KIND_LABEL_KEY.goal;
              return (
                <article
                  key={goal.id}
                  className="overflow-hidden rounded-lg border border-border bg-background"
                >
                  <div className="relative h-36 w-full bg-surface">
                    {goal.imageDataUrl ? (
                      <img
                        src={goal.imageDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${color}44, transparent 70%)`,
                        }}
                      >
                        <Sparkles className="h-10 w-10 opacity-50" style={{ color }} />
                      </div>
                    )}
                    <span
                      className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow"
                      style={{ backgroundColor: color }}
                    >
                      {t(kindKey)}
                    </span>
                  </div>
                  <div className="space-y-1.5 p-3">
                    <h3 className="text-sm font-semibold leading-snug text-text-primary">
                      {goal.title}
                    </h3>
                    {goal.description ? (
                      <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-text-muted">
                        {goal.description}
                      </p>
                    ) : (
                      <p className="text-[11px] italic text-text-muted">
                        {t('memento_goal_preview_no_manifestation')}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-[11px] text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <time dateTime={goal.targetDate}>{goal.targetDate}</time>
                      </span>
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                        title={t('life_goal_color')}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export function MementoMoriPage() {
  const { settings } = useSettings();
  const { t } = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: TabId = tabParam === 'goals' ? 'goals' : 'map';

  function setTab(next: TabId) {
    if (next === 'map') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: 'goals' }, { replace: true });
    }
  }

  const snap = useMemo(
    () => computeLifeWeeks(settings.birthDate, settings.expectedLifespanYears),
    [settings.birthDate, settings.expectedLifespanYears]
  );

  const quote = useMemo(() => getStoicQuoteForDate(new Date()), []);

  const lifeGoals = useMemo(
    () => (Array.isArray(settings.lifeGoals) ? settings.lifeGoals : []),
    [settings.lifeGoals]
  );

  const goalsByWeek = useMemo(
    () =>
      lifeGoalsByWeekIndex(
        settings.birthDate,
        settings.expectedLifespanYears,
        lifeGoals
      ),
    [settings.birthDate, settings.expectedLifespanYears, lifeGoals]
  );

  const goalsById = useMemo(() => {
    const map = new Map<string, LifeGoal>();
    for (const g of lifeGoals) map.set(g.id, g);
    return map;
  }, [lifeGoals]);

  const milestoneList = useMemo(() => {
    if (!snap) return [];
    return Array.from(milestoneWeekMap(snap.ageYears, snap.lifespanYears).values());
  }, [snap]);

  const goalCount = Array.isArray(settings.lifeGoals) ? settings.lifeGoals.length : 0;

  return (
    <Layout title={t('nav_memento')} showFab={false}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <header className="space-y-3">
            <div className="flex flex-col gap-1 text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Hourglass className="h-5 w-5 text-accent-teal" />
                <h1 className="text-lg font-semibold text-text-primary">{t('memento_title')}</h1>
              </div>
              <p className="text-sm text-text-muted">{t('memento_subtitle')}</p>
            </div>

            {/* Tabs: mapa | metas */}
            <div className="flex justify-center sm:justify-start">
              <div className="inline-flex rounded-xl border border-border bg-surface p-1">
                <TabButton
                  active={tab === 'map'}
                  onClick={() => setTab('map')}
                  icon={<MapIcon className="h-3.5 w-3.5" />}
                  label={t('memento_tab_map')}
                />
                <TabButton
                  active={tab === 'goals'}
                  onClick={() => setTab('goals')}
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label={t('memento_tab_goals')}
                  badge={goalCount > 0 ? String(goalCount) : undefined}
                />
              </div>
            </div>
          </header>

          {tab === 'goals' ? (
            <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
              <LifeGoalsPanel />
              {!settings.birthDate && (
                <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {t('life_goal_need_birthdate')}{' '}
                  <Link to="/settings" className="font-medium underline">
                    {t('memento_go_settings')}
                  </Link>
                </p>
              )}
            </section>
          ) : !snap ? (
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
                  <LegendDot
                    style={{
                      backgroundColor: '#a371f7',
                      borderColor: '#a371f7',
                    }}
                    label={t('memento_legend_goal')}
                  />
                </div>

                <LifeGrid snap={snap} goalsByWeek={goalsByWeek} goalsById={goalsById} />

                {goalCount > 0 && (
                  <div className="mt-4 space-y-1.5 border-t border-border pt-3">
                    <p className="text-[11px] text-text-muted">{t('memento_goal_hover_hint')}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-text-muted">
                        {t('memento_goals_on_map').replace('{n}', String(goalsByWeek.size))}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('goals')}
                        className="text-[11px] font-medium text-accent-teal hover:underline"
                      >
                        {t('memento_manage_goals')} →
                      </button>
                    </div>
                  </div>
                )}

                {milestoneList.length > 0 && (
                  <p className="mt-2 text-center text-[11px] text-text-muted sm:text-left">
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

          {tab === 'map' && (
            <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {t('memento_quote_title')}
              </p>
              <blockquote className="border-l-2 border-accent-teal pl-3">
                <p className="text-sm leading-relaxed text-text-primary sm:text-base">
                  «{quote.text}»
                </p>
                <footer className="mt-2 text-xs font-medium text-accent-teal">
                  — {quote.author}
                </footer>
              </blockquote>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-accent-teal/15 text-accent-teal'
          : 'text-text-muted hover:text-text-primary'
      )}
    >
      {icon}
      {label}
      {badge ? (
        <span
          className={cn(
            'ml-0.5 rounded-full px-1.5 py-px text-[10px] tabular-nums',
            active ? 'bg-accent-teal/25' : 'bg-background text-text-muted'
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
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
      <p className="mt-0.5 text-base font-semibold tabular-nums text-text-primary sm:text-lg">
        {value}
      </p>
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
