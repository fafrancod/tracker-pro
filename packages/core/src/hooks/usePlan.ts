import { useStore } from '../store';
import type { Plan } from '../types';
import { getLimits } from '../lib/planLimits';

export function usePlan() {
  const profile = useStore(s => s.profile);
  const plan: Plan = profile?.plan ?? 'free';
  const isPro = plan === 'pro';
  const limits = getLimits(plan);

  return {
    plan,
    isPro,
    limits,
    canAddProject: (currentCount: number) => currentCount < limits.maxProjects,
    canViewPastWeeks: limits.canViewPastWeeks,
    canViewAnalytics: limits.canViewAnalytics,
    canExportCsv: limits.canExportCsv,
    freeProjectLimit: limits.maxProjects,
  };
}
