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

/** Bancos ya guardados: se reutilizan al crear otro medio de pago. */
export function collectFinanceBanks(
  accounts: Array<{ institution?: string | null }>,
  extra: string[] = []
): string[] {
  const set = new Set<string>();
  for (const acc of accounts) {
    const name = (acc.institution ?? '').trim();
    if (name) set.add(name);
  }
  for (const raw of extra) {
    const name = raw.trim();
    if (name) set.add(name);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}
