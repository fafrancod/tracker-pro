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

/** El API ya abre el sobre de cuenta: hidrata pastillas sin frase. */
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
    const { from, to } = defaultHydrationWindow();
    void hydrateBoardLinkedFinance(
      from,
      to,
      vault && vault.uid === uid ? vault : undefined
    ).catch(() => undefined);
  }, [uid, generation]);
}
