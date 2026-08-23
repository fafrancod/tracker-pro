import type { FinanceAccountType } from './types';

/** Efectivo no declara banco; débito, crédito y el resto sí. */
export function paymentMethodRequiresBank(
  type: FinanceAccountType
): boolean {
  return type !== 'cash';
}

export function normalizePaymentInstitution(
  type: FinanceAccountType,
  institution: string | null | undefined
): string {
  if (!paymentMethodRequiresBank(type)) return '';
  return (institution ?? '').trim();
}

export function isValidPaymentInstitution(
  type: FinanceAccountType,
  institution: string | null | undefined
): boolean {
  if (!paymentMethodRequiresBank(type)) return true;
  return normalizePaymentInstitution(type, institution).length > 0;
}
