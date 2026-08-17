import { useEffect, type ReactNode } from 'react';
import type { FinanceVaultCtx } from '@core/services/financeMovementService';
import { fetchFinanceVault } from '@core/services/financeMovementService';
import { setFinanceVaultSession } from '@core/lib/finance';

/**
 * El cifrado es de cuenta (login = acceso). No hay pantalla de frase.
 * Si quedó una fila `private` de legado, GET /vault la pasa a account.
 */
export function FinanceVaultGate({
  children,
}: {
  children: (ctx: FinanceVaultCtx | null) => ReactNode;
}) {
  useEffect(() => {
    setFinanceVaultSession(null);
    void fetchFinanceVault().catch(() => undefined);
  }, []);
  return <>{children(null)}</>;
}
