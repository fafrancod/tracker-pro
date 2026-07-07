import type { Project, Task, UserProfile } from '@core/types';

const KEY = 'daily-tracker:demo-state:v1';

export interface DemoSnapshot {
  v: 1;
  profile: UserProfile;
  projects: Project[];
  tasksByDay: Record<string, Record<string, Task[]>>;
  currentWeekId: string;
  savedAt: string;
}

export function loadDemoState(): DemoSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoSnapshot;
    if (parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDemoState(snapshot: Omit<DemoSnapshot, 'v' | 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: DemoSnapshot = {
      v: 1,
      ...snapshot,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota o storage deshabilitado; no es fatal en demo.
  }
}

export function clearDemoState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
