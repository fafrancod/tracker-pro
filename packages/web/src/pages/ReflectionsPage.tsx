import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Battery,
  BookHeart,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Heart,
  Moon,
  PenLine,
  Smile,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import {
  ENERGY_COLORS,
  MOOD_COLORS,
  SCALE_LEVELS,
  addDaysToDayId,
  averageEnergy,
  averageMood,
  energyAtHour,
  formatDayId,
  getJournalEntry,
  moodAtHour,
  recentDayIds,
  setHourEnergy,
  setHourMood,
  setSleepHours,
  upsertJournalEntry,
} from '@/lib/dailyJournal';
import { cn } from '@/lib/utils';
import type { DailyJournalEntry, EnergyLevel, MoodLevel } from '@core/types';
import type { TKey } from '@/lib/i18n';

const MOOD_LABEL_KEYS: Record<MoodLevel, TKey> = {
  1: 'mood_level_1',
  2: 'mood_level_2',
  3: 'mood_level_3',
  4: 'mood_level_4',
  5: 'mood_level_5',
};

const ENERGY_LABEL_KEYS: Record<EnergyLevel, TKey> = {
  1: 'energy_level_1',
  2: 'energy_level_2',
  3: 'energy_level_3',
  4: 'energy_level_4',
  5: 'energy_level_5',
};

const MOOD_EMOJI: Record<MoodLevel, string> = {
  1: '😔',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
};

const ENERGY_EMOJI: Record<EnergyLevel, string> = {
  1: '🪫',
  2: '🔸',
  3: '🔹',
  4: '⚡',
  5: '🔥',
};

const SLEEP_OPTIONS: number[] = [];
for (let h = 0; h <= 14; h += 0.5) SLEEP_OPTIONS.push(h);

type HourMetric = 'mood' | 'energy';

export function ReflectionsPage() {
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const { t, locale, shortDateFormat } = useT();
  const todayId = formatDayId(new Date());
  const [dayId, setDayId] = useState(todayId);
  const [draft, setDraft] = useState<DailyJournalEntry>(() =>
    getJournalEntry(settings.dailyJournal, todayId)
  );
  const [selectedHour, setSelectedHour] = useState<number>(() => new Date().getHours());
  const [hourMetric, setHourMetric] = useState<HourMetric>('mood');
  const [hourNote, setHourNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const entry = getJournalEntry(settings.dailyJournal, dayId);
    setDraft(entry);
    setDirty(false);
    if (hourMetric === 'mood') {
      setHourNote(moodAtHour(entry, selectedHour)?.note ?? '');
    } else {
      setHourNote(energyAtHour(entry, selectedHour)?.note ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId, settings.dailyJournal]);

  const dayLabel = useMemo(() => {
    try {
      return format(parseISO(`${dayId}T12:00:00`), `EEEE, ${shortDateFormat}`, { locale });
    } catch {
      return dayId;
    }
  }, [dayId, locale, shortDateFormat]);

  const isToday = dayId === todayId;
  const avgMood = averageMood(draft);
  const avgEnergy = averageEnergy(draft);
  const currentHour = new Date().getHours();
  const weekIds = useMemo(() => recentDayIds(dayId, 7), [dayId]);

  const markDirty = useCallback((next: DailyJournalEntry) => {
    setDraft(next);
    setDirty(true);
  }, []);

  function confirmLeaveIfDirty(): boolean {
    if (!dirty) return true;
    return window.confirm(t('reflections_discard_confirm'));
  }

  function goDay(delta: number) {
    const next = addDaysToDayId(dayId, delta);
    if (next > todayId) return;
    if (!confirmLeaveIfDirty()) return;
    setDayId(next);
  }

  function goToday() {
    if (dayId === todayId) return;
    if (!confirmLeaveIfDirty()) return;
    setDayId(todayId);
  }

  function selectHour(hour: number) {
    setSelectedHour(hour);
    if (hourMetric === 'mood') {
      setHourNote(moodAtHour(draft, hour)?.note ?? '');
    } else {
      setHourNote(energyAtHour(draft, hour)?.note ?? '');
    }
  }

  function switchMetric(metric: HourMetric) {
    setHourMetric(metric);
    if (metric === 'mood') {
      setHourNote(moodAtHour(draft, selectedHour)?.note ?? '');
    } else {
      setHourNote(energyAtHour(draft, selectedHour)?.note ?? '');
    }
  }

  /** Solo persiste al pulsar Guardar. */
  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const nextJournal = upsertJournalEntry(settings.dailyJournal, {
        ...draft,
        updatedAt: new Date().toISOString(),
      });
      await updateSettings({ dailyJournal: nextJournal });
      setDirty(false);
      showToast(t('reflections_saved'), 'success');
    } catch {
      showToast(t('reflections_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  function pickMood(mood: MoodLevel | null) {
    markDirty(setHourMood(draft, selectedHour, mood, hourNote));
  }

  function pickEnergy(energy: EnergyLevel | null) {
    markDirty(setHourEnergy(draft, selectedHour, energy, hourNote));
  }

  function applyHourNote(note: string) {
    setHourNote(note);
    if (hourMetric === 'mood') {
      const existing = moodAtHour(draft, selectedHour);
      if (!existing) return;
      markDirty(setHourMood(draft, selectedHour, existing.mood, note));
    } else {
      const existing = energyAtHour(draft, selectedHour);
      if (!existing) return;
      markDirty(setHourEnergy(draft, selectedHour, existing.energy, note));
    }
  }

  function onSleepChange(value: string) {
    if (value === '') {
      markDirty(setSleepHours(draft, null));
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    markDirty(setSleepHours(draft, n));
  }

  const selectedMood = moodAtHour(draft, selectedHour)?.mood ?? null;
  const selectedEnergy = energyAtHour(draft, selectedHour)?.energy ?? null;

  return (
    <Layout title={t('nav_reflections')} showFab={false}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <header className="space-y-1">
            <div className="flex items-center gap-2">
              <BookHeart className="h-5 w-5 text-accent-teal" />
              <h1 className="text-lg font-semibold text-text-primary">{t('reflections_title')}</h1>
            </div>
            <p className="text-sm text-text-muted">{t('reflections_subtitle')}</p>
          </header>

          {/* Día */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => goDay(-1)}
              aria-label={t('reflections_prev_day')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-semibold capitalize text-text-primary">{dayLabel}</p>
              {isToday ? (
                <p className="text-[11px] text-accent-teal">{t('action_today')}</p>
              ) : (
                <button
                  type="button"
                  className="text-[11px] text-accent-teal hover:underline"
                  onClick={goToday}
                >
                  {t('reflections_go_today')}
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={isToday}
              onClick={() => goDay(1)}
              aria-label={t('reflections_next_day')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </section>

          {/* Sueño del día */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-2">
              <Moon className="h-4 w-4 text-accent-teal" />
              <h2 className="text-sm font-semibold text-text-primary">{t('sleep_title')}</h2>
            </div>
            <p className="mb-3 text-xs text-text-muted">{t('sleep_hint')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <span>{t('sleep_hours_label')}</span>
                <select
                  value={draft.sleepHours === null ? '' : String(draft.sleepHours)}
                  onChange={e => onSleepChange(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">{t('sleep_not_set')}</option>
                  {SLEEP_OPTIONS.map(h => (
                    <option key={h} value={String(h)}>
                      {h % 1 === 0 ? `${h} h` : `${h.toFixed(1)} h`}
                    </option>
                  ))}
                </select>
              </label>
              {draft.sleepHours !== null && (
                <span className="text-xs font-medium text-text-primary">
                  {t('sleep_recorded').replace('{h}', String(draft.sleepHours))}
                </span>
              )}
            </div>
          </section>

          {/* Strip semanal */}
          <section className="rounded-xl border border-border bg-surface p-3 sm:p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {t('reflections_week_strip')}
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {weekIds.map(id => {
                const entry = id === dayId ? draft : getJournalEntry(settings.dailyJournal, id);
                const a = averageMood(entry);
                const color =
                  a === null
                    ? 'transparent'
                    : MOOD_COLORS[Math.round(a) as MoodLevel] ?? MOOD_COLORS[3];
                const dayNum = id.slice(8);
                const active = id === dayId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const target = id <= todayId ? id : todayId;
                      if (target === dayId) return;
                      if (!confirmLeaveIfDirty()) return;
                      setDayId(target);
                    }}
                    title={id}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors',
                      active
                        ? 'border-accent-teal bg-accent-teal/10'
                        : 'border-border hover:border-accent-teal/40'
                    )}
                  >
                    <span className="text-[10px] tabular-nums text-text-muted">{dayNum}</span>
                    <span
                      className="h-3 w-3 rounded-full border"
                      style={{
                        backgroundColor: a === null ? 'transparent' : color,
                        borderColor: a === null ? 'var(--color-border)' : color,
                      }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px] text-text-muted">
              {avgMood !== null && (
                <span>
                  {t('reflections_day_avg')}: {avgMood.toFixed(1)}/5 · {draft.moods.length}{' '}
                  {t('reflections_hours_logged')}
                </span>
              )}
              {avgEnergy !== null && (
                <span>
                  {t('energy_day_avg')}: {avgEnergy.toFixed(1)}/5 · {draft.energies.length}{' '}
                  {t('reflections_hours_logged')}
                </span>
              )}
            </div>
          </section>

          {/* Ánimo + Energía por hora */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {hourMetric === 'mood' ? (
                  <CloudSun className="h-4 w-4 text-accent-teal" />
                ) : (
                  <Battery className="h-4 w-4 text-accent-pink" />
                )}
                <h2 className="text-sm font-semibold text-text-primary">
                  {hourMetric === 'mood' ? t('mood_hourly_title') : t('energy_hourly_title')}
                </h2>
              </div>
              <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => switchMetric('mood')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                    hourMetric === 'mood'
                      ? 'bg-accent-teal/15 text-accent-teal'
                      : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {t('metric_mood')}
                </button>
                <button
                  type="button"
                  onClick={() => switchMetric('energy')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                    hourMetric === 'energy'
                      ? 'bg-accent-pink/15 text-accent-pink'
                      : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {t('metric_energy')}
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-text-muted">
              {hourMetric === 'mood' ? t('mood_hourly_hint') : t('energy_hourly_hint')}
            </p>

            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12">
              {Array.from({ length: 24 }, (_, hour) => {
                const m =
                  hourMetric === 'mood' ? moodAtHour(draft, hour) : energyAtHour(draft, hour);
                const level =
                  hourMetric === 'mood'
                    ? (m as ReturnType<typeof moodAtHour>)?.mood
                    : (m as ReturnType<typeof energyAtHour>)?.energy;
                const colors = hourMetric === 'mood' ? MOOD_COLORS : ENERGY_COLORS;
                const emoji = hourMetric === 'mood' ? MOOD_EMOJI : ENERGY_EMOJI;
                const active = selectedHour === hour;
                const isNow = isToday && hour === currentHour;
                return (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => selectHour(hour)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] transition-all',
                      active
                        ? 'border-accent-teal ring-1 ring-accent-teal/50'
                        : 'border-border hover:border-text-muted',
                      isNow && !active && 'border-accent-red/50'
                    )}
                    title={`${String(hour).padStart(2, '0')}:00`}
                  >
                    <span
                      className={cn(
                        'tabular-nums',
                        active ? 'font-semibold text-accent-teal' : 'text-text-muted'
                      )}
                    >
                      {String(hour).padStart(2, '0')}
                    </span>
                    <span
                      className="flex h-6 w-full items-center justify-center rounded-md text-sm"
                      style={
                        level
                          ? { backgroundColor: colors[level], color: '#fff' }
                          : { backgroundColor: 'var(--color-background)' }
                      }
                    >
                      {level ? emoji[level] : '·'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background p-3">
              <p className="mb-2 text-xs font-medium text-text-primary">
                {(hourMetric === 'mood' ? t('mood_pick_for_hour') : t('energy_pick_for_hour')).replace(
                  '{hour}',
                  `${String(selectedHour).padStart(2, '0')}:00`
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SCALE_LEVELS.map(level => {
                  const active =
                    hourMetric === 'mood' ? selectedMood === level : selectedEnergy === level;
                  const colors = hourMetric === 'mood' ? MOOD_COLORS : ENERGY_COLORS;
                  const emoji = hourMetric === 'mood' ? MOOD_EMOJI : ENERGY_EMOJI;
                  const labelKey =
                    hourMetric === 'mood' ? MOOD_LABEL_KEYS[level] : ENERGY_LABEL_KEYS[level];
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        if (hourMetric === 'mood') {
                          pickMood(active ? null : level);
                        } else {
                          pickEnergy(active ? null : level);
                        }
                      }}
                      className={cn(
                        'flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-transform hover:scale-[1.02]',
                        active ? 'border-2' : 'border-border'
                      )}
                      style={{
                        borderColor: active ? colors[level] : undefined,
                        backgroundColor: active ? `${colors[level]}22` : undefined,
                        boxShadow: active ? `0 0 0 2px ${colors[level]}44` : undefined,
                      }}
                    >
                      <span className="text-lg">{emoji[level]}</span>
                      <span className="text-[10px] font-medium text-text-primary">
                        {t(labelKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {((hourMetric === 'mood' && selectedMood !== null) ||
                (hourMetric === 'energy' && selectedEnergy !== null)) && (
                <label className="mt-3 block space-y-1">
                  <span className="text-[11px] text-text-muted">{t('mood_hour_note')}</span>
                  <input
                    type="text"
                    value={hourNote}
                    maxLength={200}
                    onChange={e => applyHourNote(e.target.value)}
                    placeholder={t('mood_hour_note_placeholder')}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </label>
              )}
            </div>
          </section>

          {/* Reflexión */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <PenLine className="h-4 w-4 text-accent-teal" />
              <h2 className="text-sm font-semibold text-text-primary">{t('reflection_daily_title')}</h2>
            </div>
            <Textarea
              value={draft.reflection}
              onChange={e =>
                markDirty({
                  ...draft,
                  reflection: e.target.value,
                  updatedAt: new Date().toISOString(),
                })
              }
              placeholder={t('reflection_daily_placeholder')}
              className="min-h-[140px] rounded-xl text-sm leading-relaxed"
              maxLength={8000}
            />

            <div className="mt-4 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                <Heart className="h-3.5 w-3.5 text-accent-pink" />
                {t('reflection_gratitude_title')}
              </label>
              <Textarea
                value={draft.gratitude}
                onChange={e =>
                  markDirty({
                    ...draft,
                    gratitude: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                placeholder={t('reflection_gratitude_placeholder')}
                className="min-h-[72px] rounded-xl text-sm"
                maxLength={2000}
              />
            </div>
          </section>

          {/* Espacio para la barra sticky de guardar */}
          <div className="h-16" aria-hidden />
        </div>
      </div>

      {/* Barra de guardar: se ilumina solo con cambios pendientes */}
      <div
        className={cn(
          'pointer-events-none sticky bottom-0 z-20 border-t px-4 py-3 transition-all',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          dirty
            ? 'border-accent-teal/50 bg-surface/95 shadow-[0_-8px_24px_rgba(0,0,0,0.25)] backdrop-blur-sm'
            : 'border-border/60 bg-surface/80'
        )}
      >
        <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <p
            className={cn(
              'text-xs font-medium',
              dirty ? 'text-accent-teal' : 'text-text-muted'
            )}
          >
            {dirty ? t('reflections_unsaved') : t('reflections_synced')}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={saving || !dirty}
            onClick={() => void handleSave()}
            className={cn(
              'gap-1.5 min-w-[8.5rem] transition-all',
              dirty &&
                !saving &&
                'bg-accent-teal text-white shadow-md shadow-accent-teal/30 ring-2 ring-accent-teal/40 hover:brightness-110'
            )}
          >
            <Smile className="h-3.5 w-3.5" />
            {saving ? t('life_goal_saving') : t('action_save')}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
