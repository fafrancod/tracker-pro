// Espejo del archivo equivalente en `packages/api/src/lib/planLimits.ts`.
// La VERDAD vive en el backend (no se puede saltar desde el cliente). Esto es
// solo para que la UI muestre los limites correctos. Mantener ambos en sync.

import type { Plan } from '../types';

export interface PlanLimits {
  maxProjects: number;
  maxTasksPerMonth: number;
  canViewPastWeeks: boolean;
  canViewAnalytics: boolean;
  canExportCsv: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    // Proyectos sin tope: la app es personal y el límite de 3 bloqueaba el uso real.
    maxProjects: Infinity,
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
