import type { FinanceVaultCtx } from './types';

let current: FinanceVaultCtx | null = null;
const listeners = new Set<() => void>();

export function setFinanceVaultSession(ctx: FinanceVaultCtx | null): void {
  current = ctx;
  for (const listener of listeners) listener();
}

export function getFinanceVaultSession(): FinanceVaultCtx | null {
  return current;
}

export function subscribeFinanceVaultSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
