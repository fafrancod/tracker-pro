import type { FinanceCertainty } from '../../types';
import type { FinanceDek } from './vault';

export type FinanceVaultCtx = { uid: string; dek: FinanceDek };

export type FinanceMovementFlow = 'income' | 'expense' | 'investment';
export type FinanceMovementStatus = 'planned' | 'confirmed' | 'skipped';
export type FinanceRuleFrequency = 'monthly' | 'weekly';

/** JSON interior (claro ahora; cifrado en payload_enc cuando haya bóveda). */
export type FinanceAccountType =
  | 'cash'
  | 'debit'
  | 'credit'
  | 'brokerage'
  | 'other';

export type FinanceMovementTag =
  | 'card_payment'
  | 'goal_contribution'
  | 'credit_payment';

export type FinanceInvestmentSide = 'buy' | 'sell';
export type FinanceInvestmentStatus = 'open' | 'sold';

export type FinanceCreditKind = 'consumer' | 'mortgage' | 'auto' | 'other';

export const FINANCE_CATEGORIES = [
  'housing',
  'food',
  'transport',
  'health',
  'leisure',
  'debt',
  'invest',
  'other',
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export interface FinanceCategoryPayload {
  name: string;
  monthlyBudget: number;
  necessary: boolean;
}

export interface FinanceUserCategory {
  id: string;
  groupKey: FinanceCategory;
  color: string;
  currency: string;
  name: string;
  monthlyBudget: number;
  necessary: boolean;
  archived: boolean;
  sealed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceMovementPayload {
  title: string;
  amount: number;
  notes: string;
  certainty: FinanceCertainty;
  tag?: FinanceMovementTag | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  fxPending?: boolean;
  reportingCurrency?: string | null;
  investmentSide?: FinanceInvestmentSide | null;
  ticker?: string | null;
  assetName?: string | null;
  quantity?: number | null;
  investedAmount?: number | null;
  investmentStatus?: FinanceInvestmentStatus | null;
  closesLotId?: string | null;
  category?: FinanceCategory | null;
  categoryId?: string | null;
  images?: string[];
}

export interface FinanceAccountPayload {
  name: string;
  institution: string;
  creditLimit: number;
  billedTotal: number;
  billingDate: string;
}

export interface FinanceGoalPayload {
  name: string;
  targetAmount: number;
  notes: string;
}

export interface FinanceCreditPayload {
  name: string;
  principal: number;
  monthlyInstallment: number;
  notes: string;
}

export interface FinanceCredit {
  id: string;
  currency: string;
  kind: FinanceCreditKind;
  dueDay: number;
  startDayId: string;
  termMonths: number;
  name: string;
  principal: number;
  monthlyInstallment: number;
  notes: string;
  archived: boolean;
  sealed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceGoal {
  id: string;
  currency: string;
  targetDayId: string | null;
  linkedAccountId: string | null;
  name: string;
  targetAmount: number;
  notes: string;
  archived: boolean;
  sealed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceAccount {
  id: string;
  type: FinanceAccountType;
  currency: string;
  name: string;
  institution: string;
  creditLimit: number;
  billedTotal?: number;
  billingDate?: string;
  archived: boolean;
  sealed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceMovement {
  id: string;
  dayId: string;
  flow: FinanceMovementFlow;
  status: FinanceMovementStatus;
  currency: string;
  title: string;
  amount: number;
  notes: string;
  certainty: FinanceCertainty;
  accountId: string | null;
  cardAccountId: string | null;
  goalId: string | null;
  creditId: string | null;
  installmentGroupId: string | null;
  installmentIndex: number | null;
  installmentTotal: number | null;
  tag: FinanceMovementTag | null;
  originalAmount: number | null;
  originalCurrency: string | null;
  exchangeRate: number | null;
  fxPending: boolean;
  reportingCurrency: string | null;
  investmentSide?: FinanceInvestmentSide | null;
  ticker?: string | null;
  assetName?: string | null;
  quantity?: number | null;
  investedAmount?: number | null;
  investmentStatus?: FinanceInvestmentStatus | null;
  closesLotId?: string | null;
  category?: FinanceCategory | null;
  categoryId?: string | null;
  images?: string[];
  ruleId: string | null;
  sourceTaskId: string | null;
  virtual?: boolean;
  /** Presente si el mayor está en bóveda: el cliente debe descifrar. */
  payloadEnc?: string | null;
  sealed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceRule {
  id: string;
  flow: FinanceMovementFlow;
  currency: string;
  frequency: FinanceRuleFrequency;
  /** monthly: 1–31; weekly: 0–6 (Sun–Sat, JS getDay). */
  recurrenceDay: number;
  startDayId: string;
  title: string;
  amount: number;
  notes: string;
  certainty: FinanceCertainty;
  payloadEnc?: string | null;
  sealed?: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinanceMovementPayload {
  dayId: string;
  flow: FinanceMovementFlow;
  status?: FinanceMovementStatus;
  currency?: string;
  title?: string;
  amount?: number;
  notes?: string;
  certainty?: FinanceCertainty;
  clientMutationId?: string;
  /** Id generado en cliente (obligatorio si se manda payloadEnc). */
  id?: string;
  payloadEnc?: string;
  ruleId?: string;
  rulePayloadEnc?: string;
  sourceTaskId?: string | null;
  accountId?: string | null;
  cardAccountId?: string | null;
  goalId?: string | null;
  creditId?: string | null;
  installmentGroupId?: string | null;
  installmentIndex?: number | null;
  installmentTotal?: number | null;
  tag?: FinanceMovementTag | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  fxPending?: boolean;
  reportingCurrency?: string | null;
  investmentSide?: FinanceInvestmentSide | null;
  ticker?: string | null;
  assetName?: string | null;
  quantity?: number | null;
  investedAmount?: number | null;
  investmentStatus?: FinanceInvestmentStatus | null;
  closesLotId?: string | null;
  category?: FinanceCategory | null;
  categoryId?: string | null;
  images?: string[];
  recurrence?: {
    frequency: FinanceRuleFrequency;
    recurrenceDay: number;
  } | null;
}

export interface UpdateFinanceMovementPayload {
  dayId?: string;
  flow?: FinanceMovementFlow;
  status?: FinanceMovementStatus;
  currency?: string;
  title?: string;
  amount?: number;
  notes?: string;
  certainty?: FinanceCertainty;
  updatedAt?: string;
  payloadEnc?: string;
  sourceTaskId?: string | null;
  accountId?: string | null;
  cardAccountId?: string | null;
  goalId?: string | null;
  creditId?: string | null;
  installmentGroupId?: string | null;
  installmentIndex?: number | null;
  installmentTotal?: number | null;
  tag?: FinanceMovementTag | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  fxPending?: boolean;
  reportingCurrency?: string | null;
  investmentSide?: FinanceInvestmentSide | null;
  ticker?: string | null;
  assetName?: string | null;
  quantity?: number | null;
  investedAmount?: number | null;
  investmentStatus?: FinanceInvestmentStatus | null;
  closesLotId?: string | null;
  category?: FinanceCategory | null;
  categoryId?: string | null;
  images?: string[];
}

export interface FinanceMovementMonthSummary {
  monthId: string;
  currency: string;
  confirmedIncome: number;
  confirmedExpense: number;
  plannedIncome: number;
  plannedExpense: number;
  balance: number;
}
