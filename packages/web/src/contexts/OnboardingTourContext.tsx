import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@core/store';
import { isDemoMode } from '@core/lib/demoMode';
import { useSettings } from '@/contexts/SettingsContext';
import { useT } from '@/hooks/useT';
import { GuidedTour } from '@/components/Onboarding/GuidedTour';
import {
  ONBOARDING_STEPS,
  clearOnboardingPending,
  shouldStartOnboardingTour,
  type OnboardingStep,
} from '@/lib/onboardingTour';

interface OnboardingTourContextValue {
  active: boolean;
  step: OnboardingStep | null;
  start: () => void;
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const profile = useStore(s => s.profile);
  const { updateSettings } = useSettings();
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  const step = active ? (ONBOARDING_STEPS[index] ?? null) : null;

  const finish = useCallback(
    (completed: boolean) => {
      setActive(false);
      setIndex(0);
      clearOnboardingPending();
      if (completed) {
        void updateSettings({ onboardingTourCompleted: true });
      }
    },
    [updateSettings]
  );

  const start = useCallback(() => {
    setIndex(0);
    setActive(true);
    if (location.pathname !== '/board') {
      navigate('/board');
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!profile || active) return;
    if (
      !shouldStartOnboardingTour(profile.settings?.onboardingTourCompleted, {
        demo: isDemoMode(),
      })
    ) {
      return;
    }
    if (location.pathname !== '/board') {
      navigate('/board', { replace: true });
      return;
    }
    const timer = window.setTimeout(() => {
      setIndex(0);
      setActive(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [profile, active, location.pathname, navigate]);

  const value = useMemo(
    () => ({ active, step, start }),
    [active, step, start]
  );

  return (
    <OnboardingTourContext.Provider value={value}>
      {children}
      {active && step && (
        <GuidedTour
          title={t(step.titleKey)}
          body={t(step.bodyKey)}
          progress={t('tour_progress')
            .replace('{current}', String(index + 1))
            .replace('{total}', String(ONBOARDING_STEPS.length))}
          target={step.target}
          isFirst={index === 0}
          isLast={index === ONBOARDING_STEPS.length - 1}
          nextLabel={t('tour_next')}
          backLabel={t('tour_back')}
          skipLabel={t('tour_skip')}
          doneLabel={t('tour_done')}
          onNext={() => {
            if (index >= ONBOARDING_STEPS.length - 1) finish(true);
            else setIndex(i => i + 1);
          }}
          onBack={() => setIndex(i => Math.max(0, i - 1))}
          onSkip={() => finish(true)}
        />
      )}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour(): OnboardingTourContextValue {
  const ctx = useContext(OnboardingTourContext);
  if (!ctx) {
    return {
      active: false,
      step: null,
      start: () => undefined,
    };
  }
  return ctx;
}
