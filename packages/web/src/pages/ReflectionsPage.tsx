import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookHeart,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Heart,
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
  MOOD_COLORS,
  MOOD_LEVELS,
  addDaysToDayId,
  averageMood,
  formatDayId,
  getJournalEntry,
  moodAtHour,
  recentDayIds,
  setHourMood,
  upsertJournalEntry,
} from '@/lib/dailyJournal';
import { cn } from '@/lib/utils';
import type { DailyJournalEntry, MoodLevel } from '@core/types';
import type { TKey } from '@/lib/i18n';

const MOOD_LABEL_KEYS: Record<MoodLevel, TKey> = {
  1: 'mood_level_1',
  2: 'mood_level_2',
  3: 'mood_level_3',
  4: 'mood_level_4',
  5: 'mood_level_5',
};

const MOOD_EMOJI: Record<MoodLevel, string> = {
  1: '😔',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
};

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
  const [hourNote, setHourNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sincronizar borrador al cambiar de día o al cargar journal
  useEffect(() => {
    const entry = getJournalEntry(settings.dailyJournal, dayId);
    setDraft(entry);
    setDirty(false);
    const m = moodAtHour(entry, selectedHour);
    setHourNote(m?.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar dayId / fuente journal
  }, [dayId, settings.dailyJournal]);

  const dayLabel = useMemo(() => {
    try {
      return format(parseISO(`${dayId}T12:00:00`), `EEEE, ${shortDateFormat}`, { locale });
    } catch {
      return dayId;
    }
  }, [dayId, locale, shortDateFormat]);

  const isToday = dayId === todayId;
  const avg = averageMood(draft);
  const currentHour = new Date().getHours();

  const weekIds = useMemo(() => recentDayIds(dayId, 7), [dayId]);

  const markDirty = useCallback((next: DailyJournalEntry) => {
    setDraft(next);
    setDirty(true);
  }, []);

  function goDay(delta: number) {
    const next = addDaysToDayId(dayId, delta);
    if (next > todayId) return;
    setDayId(next);
  }

  function selectHour(hour: number) {
    setSelectedHour(hour);
    const m = moodAtHour(draft, hour);
    setHourNote(m?.note ?? '');
  }

  function applyHourNote(note: string) {
    setHourNote(note);
    const existing = moodAtHour(draft, selectedHour);
    if (!existing) return;
    const next = setHourMood(draft, selectedHour, existing.mood, note);
    markDirty(next);
  }

  async function handleSave() {
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

  // Auto-guardar mood al elegir (mejor UX); reflexión con botón Guardar
  async function saveMoodNow(next: DailyJournalEntry) {
    setDraft(next);
    setDirty(false);
    try {
      const nextJournal = upsertJournalEntry(settings.dailyJournal, {
        ...next,
        updatedAt: new Date().toISOString(),
      });
      await updateSettings({ dailyJournal: nextJournal });
    } catch {
      setDirty(true);
      showToast(t('reflections_save_error'), 'error');
    }
  }

  function pickMoodAndSave(mood: MoodLevel | null) {
    const next = setHourMood(draft, selectedHour, mood, hourNote);
    void saveMoodNow(next);
  }

  const selectedMood = moodAtHour(draft, selectedHour)?.mood ?? null;

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
              <p className="truncate text-sm font-semibold capitalize text-text-primary">{dayLabel}</p>
              {isToday ? (
                <p className="text-[11px] text-accent-teal">{t('action_today')}</p>
              ) : (
                <button
                  type="button"
                  className="text-[11px] text-accent-teal hover:underline"
                  onClick={() => setDayId(todayId)}
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

          {/* Semana: mini heatmap */}
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
                    onClick={() => setDayId(id <= todayId ? id : todayId)}
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
            {avg !== null && (
              <p className="mt-2 text-center text-[11px] text-text-muted">
                {t('reflections_day_avg')}: {avg.toFixed(1)} / 5 · {draft.moods.length}{' '}
                {t('reflections_hours_logged')}
              </p>
            )}
          </section>

          {/* Estado de ánimo por hora */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <CloudSun className="h-4 w-4 text-accent-teal" />
              <h2 className="text-sm font-semibold text-text-primary">{t('mood_hourly_title')}</h2>
            </div>
            <p className="mb-3 text-xs text-text-muted">{t('mood_hourly_hint')}</p>

            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12">
              {Array.from({ length: 24 }, (_, hour) => {
                const m = moodAtHour(draft, hour);
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
                        m
                          ? { backgroundColor: MOOD_COLORS[m.mood], color: '#fff' }
                          : { backgroundColor: 'var(--color-background)' }
                      }
                    >
                      {m ? MOOD_EMOJI[m.mood] : '·'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selector de ánimo para la hora activa */}
            <div className="mt-4 rounded-xl border border-border bg-background p-3">
              <p className="mb-2 text-xs font-medium text-text-primary">
                {t('mood_pick_for_hour').replace(
                  '{hour}',
                  `${String(selectedHour).padStart(2, '0')}:00`
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MOOD_LEVELS.map(level => {
                  const active = selectedMood === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => pickMoodAndSave(active ? null : level)}
                      className={cn(
                        'flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-transform hover:scale-[1.02]',
                        active ? 'border-2' : 'border-border'
                      )}
                      style={{
                        borderColor: active ? MOOD_COLORS[level] : undefined,
                        backgroundColor: active ? `${MOOD_COLORS[level]}22` : undefined,
                        boxShadow: active ? `0 0 0 2px ${MOOD_COLORS[level]}44` : undefined,
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
              {selectedMood !== null && (
                <label className="mt-3 block space-y-1">
                  <span className="text-[11px] text-text-muted">{t('mood_hour_note')}</span>
                  <input
                    type="text"
                    value={hourNote}
                    maxLength={200}
                    onChange={e => applyHourNote(e.target.value)}
                    onBlur={() => {
                      if (selectedMood !== null) {
                        void saveMoodNow(setHourMood(draft, selectedHour, selectedMood, hourNote));
                      }
                    }}
                    placeholder={t('mood_hour_note_placeholder')}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </label>
              )}
            </div>
          </section>

          {/* Reflexión diaria */}
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-text-muted">
                {dirty ? t('reflections_unsaved') : t('reflections_synced')}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={saving || !dirty}
                onClick={() => void handleSave()}
                className="gap-1.5"
              >
                <Smile className="h-3.5 w-3.5" />
                {saving ? t('life_goal_saving') : t('action_save')}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
