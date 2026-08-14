import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Battery,
  BookHeart,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudSun,
  Heart,
  Moon,
  PenLine,
  Smile,
  Sun,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Layout } from '@/components/Layout';
import { LifeJournalPanel } from '@/components/Reflections/LifeJournalPanel';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/contexts/SettingsContext';
import { todayDayId } from '@core/lib/civilDate';
import { useToast } from '@/contexts/ToastContext';
import { useT } from '@/hooks/useT';
import {
  ENERGY_COLORS,
  ENERGY_FEELS,
  ENERGY_FEEL_COLORS,
  MOOD_COLORS,
  SCALE_LEVELS,
  addDaysToDayId,
  averageEnergy,
  averageMood,
  energyAtHour,
  getJournalEntry,
  moodAtHour,
  recentDayIds,
  setHourEnergy,
  setHourEnergyFeel,
  setHourMood,
  setSleepHours,
  upsertJournalEntry,
} from '@/lib/dailyJournal';
import { cn } from '@/lib/utils';
import type { DailyJournalEntry, EnergyFeel, EnergyLevel, MoodLevel } from '@core/types';
import type { TKey } from '@/lib/i18n';

type ReflectionsTab = 'day' | 'life';

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

const ENERGY_FEEL_LABEL_KEYS: Record<EnergyFeel, TKey> = {
  tense: 'energy_feel_tense',
  relaxed: 'energy_feel_relaxed',
  vigorous: 'energy_feel_vigorous',
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

const ENERGY_FEEL_EMOJI: Record<EnergyFeel, string> = {
  tense: '😣',
  relaxed: '🌿',
  vigorous: '💪',
};

const SLEEP_OPTIONS: number[] = [];
for (let h = 0; h <= 14; h += 0.5) SLEEP_OPTIONS.push(h);

export function ReflectionsPage() {
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const { t, locale, shortDateFormat } = useT();
  const todayId = todayDayId(settings.timezone);
  const [tab, setTab] = useState<ReflectionsTab>('day');
  const [dayId, setDayId] = useState(todayId);
  const [draft, setDraft] = useState<DailyJournalEntry>(() =>
    getJournalEntry(settings.dailyJournal, todayId)
  );
  const [selectedHour, setSelectedHour] = useState<number>(() => new Date().getHours());
  const [hourNote, setHourNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  useEffect(() => {
    const entry = getJournalEntry(settings.dailyJournal, dayId);
    setDraft(entry);
    setDirty(false);
    const mNote = moodAtHour(entry, selectedHour)?.note ?? '';
    const eNote = energyAtHour(entry, selectedHour)?.note ?? '';
    setHourNote(mNote || eNote);
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

  function requestLeaveIfDirty(action: () => void) {
    if (!dirty) {
      action();
      return;
    }
    setPendingLeave(() => action);
  }

  function goDay(delta: number) {
    const next = addDaysToDayId(dayId, delta);
    if (next > todayId) return;
    requestLeaveIfDirty(() => setDayId(next));
  }

  function goToday() {
    if (dayId === todayId) return;
    requestLeaveIfDirty(() => setDayId(todayId));
  }

  function openDayFromLifeJournal(targetDayId: string) {
    const target = targetDayId <= todayId ? targetDayId : todayId;
    requestLeaveIfDirty(() => {
      setDayId(target);
      setTab('day');
    });
  }

  function selectHour(hour: number) {
    setSelectedHour(hour);
    const mNote = moodAtHour(draft, hour)?.note ?? '';
    const eNote = energyAtHour(draft, hour)?.note ?? '';
    setHourNote(mNote || eNote);
  }

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
    const existingNote =
      hourNote ||
      moodAtHour(draft, selectedHour)?.note ||
      energyAtHour(draft, selectedHour)?.note ||
      '';
    markDirty(setHourMood(draft, selectedHour, mood, existingNote));
  }

  function pickEnergy(energy: EnergyLevel | null) {
    const existingNote =
      hourNote ||
      energyAtHour(draft, selectedHour)?.note ||
      moodAtHour(draft, selectedHour)?.note ||
      '';
    markDirty(setHourEnergy(draft, selectedHour, energy, existingNote));
  }

  function pickEnergyFeel(feel: EnergyFeel | null) {
    markDirty(setHourEnergyFeel(draft, selectedHour, feel));
  }

  function applyHourNote(note: string) {
    setHourNote(note);
    let next = draft;
    const mood = moodAtHour(draft, selectedHour);
    const energy = energyAtHour(draft, selectedHour);
    if (mood) {
      next = setHourMood(next, selectedHour, mood.mood, note);
    }
    if (energy && (energy.energy !== null || energy.feel !== null)) {
      next = setHourEnergy(next, selectedHour, energy.energy, note);
    }
    if (mood || energy) {
      markDirty(next);
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
  const selectedEnergyEntry = energyAtHour(draft, selectedHour);
  const selectedEnergy = selectedEnergyEntry?.energy ?? null;
  const selectedFeel = selectedEnergyEntry?.feel ?? null;
  const hourLabel = `${String(selectedHour).padStart(2, '0')}:00`;
  const hasHourMetric =
    selectedMood !== null || selectedEnergy !== null || selectedFeel !== null;

  return (
    <Layout title={t('nav_reflections')} showFab={false}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <header className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BookHeart className="h-5 w-5 text-accent-teal" />
                <h1 className="text-lg font-semibold text-text-primary">{t('reflections_title')}</h1>
              </div>
              <p className="text-sm text-text-muted">{t('reflections_subtitle')}</p>
            </div>

            <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => setTab('day')}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                  tab === 'day'
                    ? 'bg-accent-teal text-white shadow-sm'
                    : 'text-text-muted hover:bg-background hover:text-text-primary'
                )}
              >
                {t('reflections_tab_day')}
              </button>
              <button
                type="button"
                onClick={() => {
                  requestLeaveIfDirty(() => setTab('life'));
                }}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                  tab === 'life'
                    ? 'bg-accent-teal text-white shadow-sm'
                    : 'text-text-muted hover:bg-background hover:text-text-primary'
                )}
              >
                {t('reflections_tab_life')}
              </button>
            </div>
          </header>

          {tab === 'life' ? (
            <LifeJournalPanel onOpenDay={openDayFromLifeJournal} />
          ) : (
            <>
              {/* Navegación de día */}
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
                  <p className="truncate text-sm font-semibold capitalize text-text-primary">
                    {dayLabel}
                  </p>
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

              {/* ─────────── ARRIBA: cosas del día ─────────── */}
              <div className="space-y-4">
                <div className="flex items-start gap-2 px-0.5">
                  <Sun className="mt-0.5 h-4 w-4 shrink-0 text-accent-teal" />
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">
                      {t('reflections_section_day')}
                    </h2>
                    <p className="text-[11px] text-text-muted">{t('reflections_section_day_hint')}</p>
                  </div>
                </div>

                <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Moon className="h-4 w-4 text-accent-teal" />
                    <h3 className="text-sm font-semibold text-text-primary">{t('sleep_title')}</h3>
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

                <section className="rounded-xl border border-border bg-surface p-3 sm:p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {t('reflections_week_strip')}
                  </p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {weekIds.map(id => {
                      const entry =
                        id === dayId ? draft : getJournalEntry(settings.dailyJournal, id);
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
                            requestLeaveIfDirty(() => setDayId(target));
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
                        {t('reflections_day_avg')} · {t('metric_mood')}: {avgMood.toFixed(1)}/5 ·{' '}
                        {draft.moods.length} {t('reflections_hours_logged')}
                      </span>
                    )}
                    {avgEnergy !== null && (
                      <span>
                        {t('metric_energy')}: {avgEnergy.toFixed(1)}/5 ·{' '}
                        {
                          draft.energies.filter(e => e.energy !== null && e.energy !== undefined)
                            .length
                        }{' '}
                        {t('reflections_hours_logged')}
                      </span>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-accent-teal" />
                    <h3 className="text-sm font-semibold text-text-primary">
                      {t('reflection_daily_title')}
                    </h3>
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
              </div>

              {/* ─────────── ABAJO: por hora ─────────── */}
              <div className="space-y-4 border-t border-border pt-6">
                <div className="flex items-start gap-2 px-0.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-pink" />
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">
                      {t('reflections_section_hourly')}
                    </h2>
                    <p className="text-[11px] text-text-muted">
                      {t('reflections_section_hourly_hint')}
                    </p>
                  </div>
                </div>

                <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <CloudSun className="h-3.5 w-3.5 text-accent-teal" />
                      {t('metric_mood')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Battery className="h-3.5 w-3.5 text-accent-pink" />
                      {t('metric_energy')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[12px]">🌿</span>
                      {t('energy_feel_title')}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const mood = moodAtHour(draft, hour)?.mood;
                      const energyRow = energyAtHour(draft, hour);
                      const energy = energyRow?.energy ?? null;
                      const feel = energyRow?.feel ?? null;
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
                          <div className="flex w-full gap-0.5">
                            <span
                              className="flex h-5 min-w-0 flex-1 items-center justify-center rounded text-[11px]"
                              style={
                                mood
                                  ? { backgroundColor: MOOD_COLORS[mood], color: '#fff' }
                                  : { backgroundColor: 'var(--color-background)' }
                              }
                              title={t('metric_mood')}
                            >
                              {mood ? MOOD_EMOJI[mood] : '·'}
                            </span>
                            <span
                              className="flex h-5 min-w-0 flex-1 items-center justify-center rounded text-[11px]"
                              style={
                                energy
                                  ? { backgroundColor: ENERGY_COLORS[energy], color: '#fff' }
                                  : feel
                                    ? {
                                        backgroundColor: ENERGY_FEEL_COLORS[feel],
                                        color: '#fff',
                                      }
                                    : { backgroundColor: 'var(--color-background)' }
                              }
                              title={
                                energy
                                  ? t('metric_energy')
                                  : feel
                                    ? t(ENERGY_FEEL_LABEL_KEYS[feel])
                                    : t('metric_energy')
                              }
                            >
                              {energy
                                ? ENERGY_EMOJI[energy]
                                : feel
                                  ? ENERGY_FEEL_EMOJI[feel]
                                  : '·'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-4 rounded-xl border border-border bg-background p-3">
                    <p className="text-xs font-medium text-text-primary">
                      {t('mood_pick_for_hour').replace('{hour}', hourLabel)}
                    </p>

                    {/* Ánimo */}
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                        <CloudSun className="h-3.5 w-3.5 text-accent-teal" />
                        {t('metric_mood')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {SCALE_LEVELS.map(level => {
                          const active = selectedMood === level;
                          return (
                            <button
                              key={`mood-${level}`}
                              type="button"
                              onClick={() => pickMood(active ? null : level)}
                              className={cn(
                                'flex min-w-[4rem] flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-transform hover:scale-[1.02]',
                                active ? 'border-2' : 'border-border'
                              )}
                              style={{
                                borderColor: active ? MOOD_COLORS[level] : undefined,
                                backgroundColor: active ? `${MOOD_COLORS[level]}22` : undefined,
                                boxShadow: active
                                  ? `0 0 0 2px ${MOOD_COLORS[level]}44`
                                  : undefined,
                              }}
                            >
                              <span className="text-lg">{MOOD_EMOJI[level]}</span>
                              <span className="text-[10px] font-medium text-text-primary">
                                {t(MOOD_LABEL_KEYS[level])}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Energía (nivel) */}
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                        <Battery className="h-3.5 w-3.5 text-accent-pink" />
                        {t('metric_energy')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {SCALE_LEVELS.map(level => {
                          const active = selectedEnergy === level;
                          return (
                            <button
                              key={`energy-${level}`}
                              type="button"
                              onClick={() => pickEnergy(active ? null : level)}
                              className={cn(
                                'flex min-w-[4rem] flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-transform hover:scale-[1.02]',
                                active ? 'border-2' : 'border-border'
                              )}
                              style={{
                                borderColor: active ? ENERGY_COLORS[level] : undefined,
                                backgroundColor: active
                                  ? `${ENERGY_COLORS[level]}22`
                                  : undefined,
                                boxShadow: active
                                  ? `0 0 0 2px ${ENERGY_COLORS[level]}44`
                                  : undefined,
                              }}
                            >
                              <span className="text-lg">{ENERGY_EMOJI[level]}</span>
                              <span className="text-[10px] font-medium text-text-primary">
                                {t(ENERGY_LABEL_KEYS[level])}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tono corporal (complemento) */}
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                        <span className="text-[13px]">🌿</span>
                        {t('energy_feel_title')}
                      </div>
                      <p className="mb-2 text-[11px] text-text-muted">{t('energy_feel_hint')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ENERGY_FEELS.map(feel => {
                          const active = selectedFeel === feel;
                          return (
                            <button
                              key={`feel-${feel}`}
                              type="button"
                              onClick={() => pickEnergyFeel(active ? null : feel)}
                              className={cn(
                                'flex min-w-[5.5rem] flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition-transform hover:scale-[1.02]',
                                active ? 'border-2' : 'border-border'
                              )}
                              style={{
                                borderColor: active ? ENERGY_FEEL_COLORS[feel] : undefined,
                                backgroundColor: active
                                  ? `${ENERGY_FEEL_COLORS[feel]}22`
                                  : undefined,
                                boxShadow: active
                                  ? `0 0 0 2px ${ENERGY_FEEL_COLORS[feel]}44`
                                  : undefined,
                              }}
                            >
                              <span className="text-lg">{ENERGY_FEEL_EMOJI[feel]}</span>
                              <span className="text-[10px] font-medium text-text-primary">
                                {t(ENERGY_FEEL_LABEL_KEYS[feel])}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {hasHourMetric && (
                      <label className="block space-y-1">
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
              </div>

              <div className="h-16" aria-hidden />
            </>
          )}
        </div>
      </div>

      {tab === 'day' && (
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
      )}

      <ConfirmDialog
        open={pendingLeave !== null}
        onOpenChange={open => {
          if (!open) setPendingLeave(null);
        }}
        title={t('reflections_discard_title')}
        description={t('reflections_discard_confirm')}
        confirmLabel={t('action_discard')}
        variant="warning"
        onConfirm={() => {
          const action = pendingLeave;
          setPendingLeave(null);
          action?.();
        }}
      />
    </Layout>
  );
}
