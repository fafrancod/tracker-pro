import { MAX_DEBT_TO_INCOME, type HealthRecommendation, type HealthSnapshot } from './types';
import type { AntExpenseGroup } from './types';

/**
 * Recs fuertes: déficit de flujo y DTI > 30 %.
 * El resto es watch. Sin copy — la UI traduce por id.
 */
export function generateHealthRecommendations(
  snapshot: HealthSnapshot,
  ants: AntExpenseGroup[] = []
): HealthRecommendation[] {
  const recs: HealthRecommendation[] = [];

  if (snapshot.savingsRate < 0) {
    recs.push({
      id: 'rec_deficit',
      severity: 'strong',
      kind: 'deficit',
    });
  } else if (snapshot.savingsRate < 10 && snapshot.totalIncome > 0) {
    recs.push({
      id: 'rec_low_savings',
      severity: 'watch',
      kind: 'savings',
    });
  }

  if (snapshot.debtToIncomeRatio > MAX_DEBT_TO_INCOME) {
    recs.push({
      id: 'rec_high_dti',
      severity: 'strong',
      kind: 'dti',
    });
  }

  if (ants.length > 0) {
    recs.push({
      id: 'rec_ants',
      severity: 'watch',
      kind: 'ants',
    });
  }

  return recs;
}
