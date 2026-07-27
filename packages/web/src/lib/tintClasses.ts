/**
 * Semantic tints that stay readable on both light and dark skins.
 * Light skins have no `.dark` class; dark skins set `html.dark` via applySkin.
 * Avoid bare `text-*-200` / `text-*-100` — they vanish on light backgrounds.
 */

export const tintHoliday =
  'bg-rose-500/15 text-rose-800 ring-1 ring-rose-600/30 dark:bg-rose-500/20 dark:text-rose-200 dark:ring-rose-500/35';

export const tintEvent =
  'bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200';

export const tintPossible =
  'bg-fuchsia-500/15 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200';

export const tintHabit =
  'bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200';

export const tintEventBorder =
  'border-sky-600/35 bg-sky-500/10 text-sky-800 hover:bg-sky-500/20 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:bg-sky-500/20';

export const tintPossibleBorder =
  'border-fuchsia-600/35 bg-fuchsia-500/10 text-fuchsia-800 hover:bg-fuchsia-500/20 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-200 dark:hover:bg-fuchsia-500/20';

export const tintHabitBorder =
  'border-emerald-600/35 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20';

export const tintEventActive =
  'border-sky-600/50 bg-sky-500/15 text-sky-800 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-200';

export const tintPossibleActive =
  'border-fuchsia-600/50 bg-fuchsia-500/15 text-fuchsia-800 dark:border-fuchsia-500/50 dark:bg-fuchsia-500/15 dark:text-fuchsia-200';

export const tintHabitActive =
  'border-emerald-600/50 bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-200';
