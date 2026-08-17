import {
  HEALTHY_SAVINGS_RATE,
  MAX_DEBT_TO_INCOME,
  type HealthLabel,
  type HealthSnapshot,
} from './types';

/** Score 0–100. Puro, sin red. */
export function evaluateFinancialHealth(snapshot: HealthSnapshot): number {
  let score = 0;

  if (snapshot.savingsRate >= HEALTHY_SAVINGS_RATE) {
    score += 35;
  } else if (snapshot.savingsRate > 0) {
    score += (snapshot.savingsRate / HEALTHY_SAVINGS_RATE) * 35;
  }

  if (snapshot.debtToIncomeRatio === 0 || snapshot.debtToIncomeRatio <= 15) {
    score += 25;
  } else if (snapshot.debtToIncomeRatio < MAX_DEBT_TO_INCOME) {
    const range = MAX_DEBT_TO_INCOME - 15;
    const excess = snapshot.debtToIncomeRatio - 15;
    score += (1 - excess / range) * 25;
  }

  if (snapshot.unnecessaryExpenseRatio <= 15) {
    score += 20;
  } else if (snapshot.unnecessaryExpenseRatio < 50) {
    const range = 50 - 15;
    const excess = snapshot.unnecessaryExpenseRatio - 15;
    score += (1 - excess / range) * 20;
  }

  if (snapshot.balance > 0) {
    score += 10;
    const ratio = snapshot.balance / (snapshot.totalIncome || 1);
    score += Math.min(10, ratio * 20);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getHealthLabel(score: number): HealthLabel {
  if (score < 35) return 'critical';
  if (score < 55) return 'at_risk';
  if (score < 75) return 'stable';
  if (score < 90) return 'healthy';
  return 'excellent';
}
