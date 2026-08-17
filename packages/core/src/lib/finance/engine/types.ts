import type { FinanceCategory } from '../types';

export const MAX_DEBT_TO_INCOME = 30;
export const HEALTHY_SAVINGS_RATE = 20;

export type HealthLabel =
  | 'critical'
  | 'at_risk'
  | 'stable'
  | 'healthy'
  | 'excellent';

export type HealthRecSeverity = 'strong' | 'watch' | 'ok';

export interface HealthSnapshot {
  monthId: string;
  currency: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  savingsRate: number;
  monthlyDebt: number;
  debtToIncomeRatio: number;
  unnecessaryExpense: number;
  unnecessaryExpenseRatio: number;
  byCategory: Record<FinanceCategory, number>;
}

export interface HealthRecommendation {
  id: 'rec_deficit' | 'rec_high_dti' | 'rec_ants' | 'rec_low_savings';
  severity: HealthRecSeverity;
  kind: 'deficit' | 'dti' | 'ants' | 'savings';
}

export interface AntExpenseGroup {
  key: string;
  title: string;
  category: FinanceCategory;
  count: number;
  total: number;
}
