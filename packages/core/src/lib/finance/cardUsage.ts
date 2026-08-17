import type { FinanceAccount, FinanceMovement } from './types';

export interface FinanceCardUsage {
  accountId: string;
  spent: number;
  paid: number;
  used: number;
  available: number | null;
}

/** Usado de una TC: cargos en la tarjeta menos pagos etiquetados. El pago no dobla. */
export function summarizeCardUsage(
  account: FinanceAccount,
  movements: FinanceMovement[]
): FinanceCardUsage {
  let spent = 0;
  let paid = 0;
  for (const mov of movements) {
    if (mov.status !== 'confirmed') continue;
    if (mov.flow !== 'expense') continue;
    if (mov.tag === 'card_payment' && mov.cardAccountId === account.id) {
      paid += mov.amount;
      continue;
    }
    if (mov.accountId === account.id && mov.tag !== 'card_payment') {
      spent += mov.amount;
    }
  }
  const used = Math.max(0, spent - paid);
  const available =
    account.type === 'credit' && account.creditLimit > 0
      ? account.creditLimit - used
      : null;
  return { accountId: account.id, spent, paid, used, available };
}
