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

export type FinanceMovementTag = 'card_payment';

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
}

export interface FinanceAccountPayload {
  name: string;
  institution: string;
  creditLimit: number;
}

export interface FinanceAccount {
  id: string;
  type: FinanceAccountType;
  currency: string;
  name: string;
  institution: string;
  creditLimit: number;
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
  tag: FinanceMovementTag | null;
  originalAmount: number | null;
  originalCurrency: string | null;
  exchangeRate: number | null;
  fxPending: boolean;
  reportingCurrency: string | null;
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
  tag?: FinanceMovementTag | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  fxPending?: boolean;
  reportingCurrency?: string | null;
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
  tag?: FinanceMovementTag | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  fxPending?: boolean;
  reportingCurrency?: string | null;
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
