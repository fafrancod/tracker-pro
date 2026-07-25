export type HabitKind = 'habit_good' | 'habit_quit';

export function isHabitKind(kind: string | null | undefined): kind is HabitKind {
  return kind === 'habit_good' || kind === 'habit_quit';
}

export function isHabitGood(kind: string | null | undefined): boolean {
  return kind === 'habit_good';
}

export function isHabitQuit(kind: string | null | undefined): boolean {
  return kind === 'habit_quit';
}

/** Color por defecto del hábito. */
export function defaultHabitColor(kind: HabitKind): string {
  return kind === 'habit_good' ? '#3fb950' : '#f85149';
}
