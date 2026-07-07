// Plan limits backend-owned. El frontend tambien refleja estos numeros, pero
// la verdad la pone el backend para que el limite no se pueda saltar.
//
// Valores placeholder — ajustar tras decision de producto.

export type Plan = 'free' | 'pro';

export interface PlanLimits {
  maxProjects: number; // Infinity = sin limite.
  maxTasksPerMonth: number;
  canViewPastWeeks: boolean;
  canViewAnalytics: boolean;
  canExportCsv: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxProjects: 3,
    maxTasksPerMonth: 500,
    canViewPastWeeks: false,
    canViewAnalytics: false,
    canExportCsv: false,
  },
  pro: {
    maxProjects: Infinity,
    maxTasksPerMonth: Infinity,
    canViewPastWeeks: true,
    canViewAnalytics: true,
    canExportCsv: true,
  },
};

export function getLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}
