import { parseFinancePayload } from './payload';
import type { FinanceMovement, FinanceRule } from './types';
import { decryptFinancePayload, financePayloadAad, type FinanceDek } from './vault';

export async function unsealMovement(
  uid: string,
  dek: FinanceDek,
  mov: FinanceMovement
): Promise<FinanceMovement> {
  if (!mov.sealed || !mov.payloadEnc) return mov;
  const payload = parseFinancePayload(
    await decryptFinancePayload(
      dek,
      mov.payloadEnc,
      financePayloadAad(uid, 'finance_movements', mov.id)
    )
  );
  return {
    ...mov,
    ...payload,
    sealed: false,
    payloadEnc: mov.payloadEnc,
  };
}

export async function unsealRule(
  uid: string,
  dek: FinanceDek,
  rule: FinanceRule
): Promise<FinanceRule> {
  if (!rule.sealed || !rule.payloadEnc) return rule;
  const payload = parseFinancePayload(
    await decryptFinancePayload(
      dek,
      rule.payloadEnc,
      financePayloadAad(uid, 'finance_rules', rule.id)
    )
  );
  return {
    ...rule,
    ...payload,
    sealed: false,
    payloadEnc: rule.payloadEnc,
  };
}

export async function unsealFinanceLedger(
  uid: string,
  dek: FinanceDek,
  movements: FinanceMovement[],
  rules: FinanceRule[]
): Promise<{ movements: FinanceMovement[]; rules: FinanceRule[] }> {
  return {
    movements: await Promise.all(movements.map(m => unsealMovement(uid, dek, m))),
    rules: await Promise.all(rules.map(r => unsealRule(uid, dek, r))),
  };
}
