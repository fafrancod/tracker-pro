import { useEffect, useState } from 'react';
import { useStore } from '../store';
import {
  defaultHydrationWindow,
  hydrateBoardLinkedFinance,
} from '../lib/finance/bridge';
import {
  getFinanceVaultSession,
  setFinanceVaultSession,
  subscribeFinanceVaultSession,
} from '../lib/finance/session';

/** Cuando la bóveda está abierta, rellena linkedFinance en las tareas del tablero. */
export function useLinkedFinanceHydration(): void {
  const uid = useStore(s => s.uid);
  const [generation, setGeneration] = useState(0);

  useEffect(() => subscribeFinanceVaultSession(() => setGeneration(n => n + 1)), []);

  useEffect(() => {
    if (!uid) {
      setFinanceVaultSession(null);
      return;
    }
    const vault = getFinanceVaultSession();
    if (!vault || vault.uid !== uid) return;
    const { from, to } = defaultHydrationWindow();
    void hydrateBoardLinkedFinance(from, to, vault).catch(() => undefined);
  }, [uid, generation]);
}
