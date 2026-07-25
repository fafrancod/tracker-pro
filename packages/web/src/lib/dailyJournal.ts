import type { DailyJournalEntry, HourlyMoodEntry, MoodLevel } from '@core/types';

export const JOURNAL_RETENTION_DAYS = 90;

export const MOOD_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

/** Colores sólidos por nivel (no depender de Tailwind /opacity + CSS vars). */
export const MOOD_COLORS: Record<MoodLevel, string> = {
  1: '#f85149',
  2: '#db6d28',
  3: '#d29922',
  4: '#3fb950',
  5: '#58a6ff',
};

export function isMoodLevel(n: unknown): n is MoodLevel {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

export function emptyDayEntry(dayId: string): DailyJournalEntry {
  return {
    dayId,
    reflection: '',
    gratitude: '',
    moods: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getJournalEntry(
  journal: DailyJournalEntry[] | null | undefined,
  dayId: string
): DailyJournalEntry {
  const list = Array.isArray(journal) ? journal : [];
  return list.find(e => e.dayId === dayId) ?? emptyDayEntry(dayId);
}

export function moodAtHour(entry: DailyJournalEntry, hour: number): HourlyMoodEntry | null {
  return entry.moods.find(m => m.hour === hour) ?? null;
}

export function setHourMood(
  entry: DailyJournalEntry,
  hour: number,
  mood: MoodLevel | null,
  note?: string
): DailyJournalEntry {
  const moods = entry.moods.filter(m => m.hour !== hour);
  if (mood !== null) {
    moods.push({
      hour,
      mood,
      note: (note ?? entry.moods.find(m => m.hour === hour)?.note ?? '').slice(0, 200),
    });
    moods.sort((a, b) => a.hour - b.hour);
  }
  return {
    ...entry,
    moods,
    updatedAt: new Date().toISOString(),
  };
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
    moods: (next.moods ?? [])
      .filter(m => m.hour >= 0 && m.hour <= 23 && isMoodLevel(m.mood))
      .map(m => ({
        hour: m.hour,
        mood: m.mood,
        note: (m.note ?? '').slice(0, 200),
      }))
      .sort((a, b) => a.hour - b.hour),
    updatedAt: next.updatedAt || new Date().toISOString(),
  };

  // No guardar días vacíos
  const isEmpty =
    !cleaned.reflection.trim() &&
    !cleaned.gratitude.trim() &&
    cleaned.moods.length === 0;

  if (idx >= 0) {
    if (isEmpty) list.splice(idx, 1);
    else list[idx] = cleaned;
  } else if (!isEmpty) {
    list.push(cleaned);
  }

  return pruneJournal(list);
}

/** Conserva los últimos N días por dayId (orden lexicográfico = cronológico ISO). */
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
  if (!entry.moods.length) return null;
  const sum = entry.moods.reduce((a, m) => a + m.mood, 0);
  return sum / entry.moods.length;
}

/** Últimos `count` días inclusive hacia atrás desde dayId. */
export function recentDayIds(fromDayId: string, count: number): string[] {
  const ids: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    ids.push(addDaysToDayId(fromDayId, -i));
  }
  return ids;
}
