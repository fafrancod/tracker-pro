import type {
  DailyJournalEntry,
  EnergyLevel,
  HourlyEnergyEntry,
  HourlyMoodEntry,
  MoodLevel,
} from '@core/types';

export const JOURNAL_RETENTION_DAYS = 90;

export const SCALE_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];
/** @deprecated use SCALE_LEVELS */
export const MOOD_LEVELS = SCALE_LEVELS;

/** Colores de ánimo. */
export const MOOD_COLORS: Record<MoodLevel, string> = {
  1: '#f85149',
  2: '#db6d28',
  3: '#d29922',
  4: '#3fb950',
  5: '#58a6ff',
};

/** Colores de energía (paleta distinta). */
export const ENERGY_COLORS: Record<EnergyLevel, string> = {
  1: '#6e7681',
  2: '#a371f7',
  3: '#db61a2',
  4: '#f778ba',
  5: '#ffa657',
};

export function isMoodLevel(n: unknown): n is MoodLevel {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

export const isEnergyLevel = isMoodLevel;

export function emptyDayEntry(dayId: string): DailyJournalEntry {
  return {
    dayId,
    reflection: '',
    gratitude: '',
    moods: [],
    energies: [],
    sleepHours: null,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeJournalEntry(
  raw: Partial<DailyJournalEntry> & { dayId: string }
): DailyJournalEntry {
  const base = emptyDayEntry(raw.dayId);
  return {
    dayId: raw.dayId,
    reflection: typeof raw.reflection === 'string' ? raw.reflection : base.reflection,
    gratitude: typeof raw.gratitude === 'string' ? raw.gratitude : base.gratitude,
    moods: Array.isArray(raw.moods) ? raw.moods : base.moods,
    energies: Array.isArray(raw.energies) ? raw.energies : base.energies,
    sleepHours:
      typeof raw.sleepHours === 'number' && Number.isFinite(raw.sleepHours)
        ? clampSleepHours(raw.sleepHours)
        : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
}

export function clampSleepHours(n: number): number {
  const rounded = Math.round(n * 2) / 2; // pasos de 0.5
  return Math.min(24, Math.max(0, rounded));
}

export function getJournalEntry(
  journal: DailyJournalEntry[] | null | undefined,
  dayId: string
): DailyJournalEntry {
  const list = Array.isArray(journal) ? journal : [];
  const found = list.find(e => e.dayId === dayId);
  return found ? normalizeJournalEntry(found) : emptyDayEntry(dayId);
}

export function moodAtHour(entry: DailyJournalEntry, hour: number): HourlyMoodEntry | null {
  return (entry.moods ?? []).find(m => m.hour === hour) ?? null;
}

export function energyAtHour(entry: DailyJournalEntry, hour: number): HourlyEnergyEntry | null {
  return (entry.energies ?? []).find(m => m.hour === hour) ?? null;
}

export function setHourMood(
  entry: DailyJournalEntry,
  hour: number,
  mood: MoodLevel | null,
  note?: string
): DailyJournalEntry {
  const e = normalizeJournalEntry(entry);
  const moods = e.moods.filter(m => m.hour !== hour);
  if (mood !== null) {
    moods.push({
      hour,
      mood,
      note: (note ?? e.moods.find(m => m.hour === hour)?.note ?? '').slice(0, 200),
    });
    moods.sort((a, b) => a.hour - b.hour);
  }
  return {
    ...e,
    moods,
    updatedAt: new Date().toISOString(),
  };
}

export function setHourEnergy(
  entry: DailyJournalEntry,
  hour: number,
  energy: EnergyLevel | null,
  note?: string
): DailyJournalEntry {
  const e = normalizeJournalEntry(entry);
  const energies = e.energies.filter(m => m.hour !== hour);
  if (energy !== null) {
    energies.push({
      hour,
      energy,
      note: (note ?? e.energies.find(m => m.hour === hour)?.note ?? '').slice(0, 200),
    });
    energies.sort((a, b) => a.hour - b.hour);
  }
  return {
    ...e,
    energies,
    updatedAt: new Date().toISOString(),
  };
}

export function setSleepHours(
  entry: DailyJournalEntry,
  sleepHours: number | null
): DailyJournalEntry {
  const e = normalizeJournalEntry(entry);
  return {
    ...e,
    sleepHours: sleepHours === null ? null : clampSleepHours(sleepHours),
    updatedAt: new Date().toISOString(),
  };
}

function cleanMoods(moods: HourlyMoodEntry[]): HourlyMoodEntry[] {
  return (moods ?? [])
    .filter(m => m.hour >= 0 && m.hour <= 23 && isMoodLevel(m.mood))
    .map(m => ({
      hour: m.hour,
      mood: m.mood,
      note: (m.note ?? '').slice(0, 200),
    }))
    .sort((a, b) => a.hour - b.hour);
}

function cleanEnergies(energies: HourlyEnergyEntry[]): HourlyEnergyEntry[] {
  return (energies ?? [])
    .filter(m => m.hour >= 0 && m.hour <= 23 && isEnergyLevel(m.energy))
    .map(m => ({
      hour: m.hour,
      energy: m.energy,
      note: (m.note ?? '').slice(0, 200),
    }))
    .sort((a, b) => a.hour - b.hour);
}

export function upsertJournalEntry(
  journal: DailyJournalEntry[] | null | undefined,
  next: DailyJournalEntry
): DailyJournalEntry[] {
  const list = Array.isArray(journal) ? [...journal] : [];
  const idx = list.findIndex(e => e.dayId === next.dayId);
  const cleaned: DailyJournalEntry = {
    dayId: next.dayId,
    reflection: (next.reflection ?? '').slice(0, 8000),
    gratitude: (next.gratitude ?? '').slice(0, 2000),
    moods: cleanMoods(next.moods),
    energies: cleanEnergies(next.energies ?? []),
    sleepHours:
      typeof next.sleepHours === 'number' && Number.isFinite(next.sleepHours)
        ? clampSleepHours(next.sleepHours)
        : null,
    updatedAt: next.updatedAt || new Date().toISOString(),
  };

  const isEmpty =
    !cleaned.reflection.trim() &&
    !cleaned.gratitude.trim() &&
    cleaned.moods.length === 0 &&
    cleaned.energies.length === 0 &&
    cleaned.sleepHours === null;

  if (idx >= 0) {
    if (isEmpty) list.splice(idx, 1);
    else list[idx] = cleaned;
  } else if (!isEmpty) {
    list.push(cleaned);
  }

  return pruneJournal(list);
}

export function pruneJournal(
  journal: DailyJournalEntry[],
  retentionDays = JOURNAL_RETENTION_DAYS
): DailyJournalEntry[] {
  const sorted = [...journal].sort((a, b) => b.dayId.localeCompare(a.dayId));
  if (sorted.length <= retentionDays) return sorted.sort((a, b) => a.dayId.localeCompare(b.dayId));

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffId = formatDayId(cutoff);

  return sorted
    .filter(e => e.dayId >= cutoffId)
    .sort((a, b) => a.dayId.localeCompare(b.dayId));
}

export function formatDayId(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDayId(dayId: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayId);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function addDaysToDayId(dayId: string, delta: number): string {
  const d = parseDayId(dayId);
  if (!d) return dayId;
  d.setDate(d.getDate() + delta);
  return formatDayId(d);
}

export function averageMood(entry: DailyJournalEntry): number | null {
  const moods = entry.moods ?? [];
  if (!moods.length) return null;
  return moods.reduce((a, m) => a + m.mood, 0) / moods.length;
}

export function averageEnergy(entry: DailyJournalEntry): number | null {
  const energies = entry.energies ?? [];
  if (!energies.length) return null;
  return energies.reduce((a, m) => a + m.energy, 0) / energies.length;
}

export function recentDayIds(fromDayId: string, count: number): string[] {
  const ids: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    ids.push(addDaysToDayId(fromDayId, -i));
  }
  return ids;
}

export interface DayWellbeingStats {
  dayId: string;
  avgMood: number | null;
  avgEnergy: number | null;
  sleepHours: number | null;
  moodSamples: number;
  energySamples: number;
}

export interface WeekWellbeingSummary {
  days: DayWellbeingStats[];
  avgMood: number | null;
  avgEnergy: number | null;
  avgSleep: number | null;
  daysWithMood: number;
  daysWithEnergy: number;
  daysWithSleep: number;
  moodTrend: 'up' | 'down' | 'flat' | 'unknown';
  energyTrend: 'up' | 'down' | 'flat' | 'unknown';
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function trendOf(values: number[]): 'up' | 'down' | 'flat' | 'unknown' {
  if (values.length < 2) return 'unknown';
  const mid = Math.floor(values.length / 2);
  const first = mean(values.slice(0, mid));
  const second = mean(values.slice(mid));
  if (first === null || second === null) return 'unknown';
  const delta = second - first;
  if (Math.abs(delta) < 0.25) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

export function computeWeekWellbeing(
  journal: DailyJournalEntry[] | null | undefined,
  endDayId: string,
  dayCount = 7
): WeekWellbeingSummary {
  const dayIds = recentDayIds(endDayId, dayCount);
  const days: DayWellbeingStats[] = dayIds.map(dayId => {
    const entry = getJournalEntry(journal, dayId);
    return {
      dayId,
      avgMood: averageMood(entry),
      avgEnergy: averageEnergy(entry),
      sleepHours: entry.sleepHours,
      moodSamples: entry.moods?.length ?? 0,
      energySamples: entry.energies?.length ?? 0,
    };
  });

  const moodVals = days.map(d => d.avgMood).filter((n): n is number => n !== null);
  const energyVals = days.map(d => d.avgEnergy).filter((n): n is number => n !== null);
  const sleepVals = days.map(d => d.sleepHours).filter((n): n is number => n !== null);

  return {
    days,
    avgMood: mean(moodVals),
    avgEnergy: mean(energyVals),
    avgSleep: mean(sleepVals),
    daysWithMood: moodVals.length,
    daysWithEnergy: energyVals.length,
    daysWithSleep: sleepVals.length,
    moodTrend: trendOf(moodVals),
    energyTrend: trendOf(energyVals),
  };
}

export type EncouragementTone = 'celebrate' | 'support' | 'nudge' | 'rest' | 'neutral';

export interface EncouragementMessage {
  tone: EncouragementTone;
  /** i18n key */
  key:
    | 'wellbeing_msg_no_data'
    | 'wellbeing_msg_great_mood'
    | 'wellbeing_msg_mood_up'
    | 'wellbeing_msg_mood_down'
    | 'wellbeing_msg_energy_low'
    | 'wellbeing_msg_energy_high'
    | 'wellbeing_msg_sleep_low'
    | 'wellbeing_msg_sleep_good'
    | 'wellbeing_msg_balanced'
    | 'wellbeing_msg_keep_logging';
}

/**
 * Elige 1–3 mensajes de ánimo según el resumen semanal (determinista).
 */
export function pickEncouragementMessages(summary: WeekWellbeingSummary): EncouragementMessage[] {
  const out: EncouragementMessage[] = [];
  const hasAny =
    summary.daysWithMood > 0 || summary.daysWithEnergy > 0 || summary.daysWithSleep > 0;

  if (!hasAny) {
    return [{ tone: 'nudge', key: 'wellbeing_msg_no_data' }];
  }

  if (summary.avgMood !== null && summary.avgMood >= 4.2) {
    out.push({ tone: 'celebrate', key: 'wellbeing_msg_great_mood' });
  } else if (summary.moodTrend === 'up') {
    out.push({ tone: 'celebrate', key: 'wellbeing_msg_mood_up' });
  } else if (summary.moodTrend === 'down' || (summary.avgMood !== null && summary.avgMood <= 2.5)) {
    out.push({ tone: 'support', key: 'wellbeing_msg_mood_down' });
  }

  if (summary.avgEnergy !== null && summary.avgEnergy <= 2.4) {
    out.push({ tone: 'rest', key: 'wellbeing_msg_energy_low' });
  } else if (summary.avgEnergy !== null && summary.avgEnergy >= 4) {
    out.push({ tone: 'celebrate', key: 'wellbeing_msg_energy_high' });
  }

  if (summary.avgSleep !== null && summary.avgSleep < 6) {
    out.push({ tone: 'rest', key: 'wellbeing_msg_sleep_low' });
  } else if (summary.avgSleep !== null && summary.avgSleep >= 7 && summary.avgSleep <= 9) {
    out.push({ tone: 'celebrate', key: 'wellbeing_msg_sleep_good' });
  }

  if (out.length === 0) {
    out.push({ tone: 'neutral', key: 'wellbeing_msg_balanced' });
  }

  if (summary.daysWithMood < 3 && summary.daysWithEnergy < 3) {
    out.push({ tone: 'nudge', key: 'wellbeing_msg_keep_logging' });
  }

  return out.slice(0, 3);
}
