import type { FinanceCertainty } from '../../types';

export type FinanceMovementFlow = 'income' | 'expense' | 'investment';
export type FinanceMovementStatus = 'planned' | 'confirmed' | 'skipped';
export type FinanceRuleFrequency = 'monthly' | 'weekly';

/** JSON interior (claro ahora; cifrado en payload_enc cuando haya bóveda). */
export interface FinanceMovementPayload {
  title: string;
  amount: number;
  notes: string;
  certainty: FinanceCertainty;
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
