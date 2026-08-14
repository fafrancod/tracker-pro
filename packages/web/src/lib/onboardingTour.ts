import type { BoardViewMode } from '@core/types';

export const ONBOARDING_PENDING_KEY = 'daily-tracker:onboarding-pending';

export type OnboardingStepId =
  | 'welcome'
  | 'calendar-views'
  | 'calendar-canvas'
  | 'calendar-day'
  | 'fab'
  | 'create-kind'
  | 'create-title'
  | 'create-when'
  | 'create-save'
  | 'done';

export interface OnboardingStep {
  id: OnboardingStepId;
  target: string | null;
  titleKey: OnboardingCopyKey;
  bodyKey: OnboardingCopyKey;
  view?: BoardViewMode;
  openCreate?: boolean;
}

export type OnboardingCopyKey =
  | 'tour_welcome_title'
  | 'tour_welcome_body'
  | 'tour_views_title'
  | 'tour_views_body'
  | 'tour_canvas_title'
  | 'tour_canvas_body'
  | 'tour_day_title'
  | 'tour_day_body'
  | 'tour_fab_title'
  | 'tour_fab_body'
  | 'tour_kind_title'
  | 'tour_kind_body'
  | 'tour_title_title'
  | 'tour_title_body'
  | 'tour_when_title'
  | 'tour_when_body'
  | 'tour_save_title'
  | 'tour_save_body'
  | 'tour_finish_title'
  | 'tour_finish_body';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    target: null,
    titleKey: 'tour_welcome_title',
    bodyKey: 'tour_welcome_body',
    view: 'month',
  },
  {
    id: 'calendar-views',
    target: 'calendar-views',
    titleKey: 'tour_views_title',
    bodyKey: 'tour_views_body',
    view: 'month',
  },
  {
    id: 'calendar-canvas',
    target: 'calendar-canvas',
    titleKey: 'tour_canvas_title',
    bodyKey: 'tour_canvas_body',
    view: 'month',
  },
  {
    id: 'calendar-day',
    target: 'calendar-day',
    titleKey: 'tour_day_title',
    bodyKey: 'tour_day_body',
    view: 'month',
  },
  {
    id: 'fab',
    target: 'fab',
    titleKey: 'tour_fab_title',
    bodyKey: 'tour_fab_body',
    view: 'month',
  },
  {
    id: 'create-kind',
    target: 'create-kind',
    titleKey: 'tour_kind_title',
    bodyKey: 'tour_kind_body',
    view: 'month',
    openCreate: true,
  },
  {
    id: 'create-title',
    target: 'create-title',
    titleKey: 'tour_title_title',
    bodyKey: 'tour_title_body',
    view: 'month',
    openCreate: true,
  },
  {
    id: 'create-when',
    target: 'create-when',
    titleKey: 'tour_when_title',
    bodyKey: 'tour_when_body',
    view: 'month',
    openCreate: true,
  },
  {
    id: 'create-save',
    target: 'create-save',
    titleKey: 'tour_save_title',
    bodyKey: 'tour_save_body',
    view: 'month',
    openCreate: true,
  },
  {
    id: 'done',
    target: null,
    titleKey: 'tour_finish_title',
    bodyKey: 'tour_finish_body',
    view: 'month',
  },
];

export function markOnboardingPending(): void {
  try {
    sessionStorage.setItem(ONBOARDING_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearOnboardingPending(): void {
  try {
    sessionStorage.removeItem(ONBOARDING_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function isOnboardingPending(): boolean {
  try {
    return sessionStorage.getItem(ONBOARDING_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function shouldStartOnboardingTour(
  completed: boolean | undefined,
  opts?: { demo?: boolean }
): boolean {
  if (opts?.demo) return false;
  if (completed === true) return false;
  if (completed === false) return true;
  return isOnboardingPending();
}
