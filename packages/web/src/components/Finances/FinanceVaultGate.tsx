import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, Lock, Shield } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/hooks/useT';
import { useToast } from '@/contexts/ToastContext';
import { useStore } from '@core/store';
import {
  createFinanceVault,
  encryptFinancePayload,
  financePayloadAad,
  generateRecoveryPhrase,
  normalizeRecoveryPhrase,
  unlockFinanceVault,
  type FinanceDek,
  type FinanceVaultMeta,
} from '@core/lib/finance';
import {
  fetchFinanceLedger,
  fetchFinanceVault,
  putFinanceVault,
  sealFinanceRule,
  updateFinanceMovement,
  type FinanceVaultCtx,
} from '@core/services/financeMovementService';

type Phase = 'loading' | 'setup' | 'recovery' | 'unlock' | 'ready';

export function FinanceVaultGate({
  children,
}: {
  children: (ctx: FinanceVaultCtx) => ReactNode;
}) {
  const { t } = useT();
  const { showToast } = useToast();
  const uid = useStore(s => s.uid);
  const [phase, setPhase] = useState<Phase>('loading');
  const [meta, setMeta] = useState<FinanceVaultMeta | null>(null);
  const [dek, setDek] = useState<FinanceDek | null>(null);
  const [phrase, setPhrase] = useState('');
  const [phrase2, setPhrase2] = useState('');
  const [recovery, setRecovery] = useState('');
  const [recoveryAck, setRecoveryAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setPhase('loading');
    try {
      const remote = await fetchFinanceVault();
      if (!remote.enabled || !remote.kdfSalt || !remote.wrappedDek) {
        setPhase('setup');
        return;
      }
      setMeta({
        kdfSalt: remote.kdfSalt,
        kdfParams: remote.kdfParams ?? {
          algo: 'PBKDF2',
          iterations: 210000,
          hash: 'SHA-256',
        },
        wrappedDek: remote.wrappedDek,
        recoveryWrappedDek: remote.recoveryWrappedDek ?? '',
        encV: remote.encV ?? '1',
      });
      setPhase('unlock');
    } catch {
      showToast(t('fin_vault_load_error'), 'error');
      setPhase('setup');
    }
  }, [uid, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function migratePlain(ctx: FinanceVaultCtx) {
    const ledger = await fetchFinanceLedger();
    for (const mov of ledger.movements) {
      if (mov.sealed || !mov.title) continue;
      await updateFinanceMovement(
        mov.id,
        {
          title: mov.title,
          amount: mov.amount,
          notes: mov.notes,
          certainty: mov.certainty,
          updatedAt: mov.updatedAt,
        },
        ctx
      );
    }
    for (const rule of ledger.rules) {
      if (rule.sealed || !rule.title) continue;
      const blob = await encryptFinancePayload(
        ctx.dek,
        {
          title: rule.title,
          amount: rule.amount,
          notes: rule.notes,
          certainty: rule.certainty,
        },
        financePayloadAad(ctx.uid, 'finance_rules', rule.id)
      );
      await sealFinanceRule(rule.id, blob);
    }
  }

  async function handleCreate() {
    if (!uid) return;
    if (phrase.trim().length < 8) {
      showToast(t('fin_vault_phrase_short'), 'error');
      return;
    }
    if (phrase !== phrase2) {
      showToast(t('fin_vault_phrase_mismatch'), 'error');
      return;
    }
    setBusy(true);
    try {
      const words = generateRecoveryPhrase();
      const { meta: created, dek: key } = await createFinanceVault(
        uid,
        phrase,
        words
      );
      await putFinanceVault(created);
      const ctx = { uid, dek: key };
      await migratePlain(ctx);
      setDek(key);
      setRecovery(words);
      setMeta(created);
      setPhase('recovery');
    } catch {
      showToast(t('fin_vault_save_error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    if (!uid || !meta) return;
    setBusy(true);
    try {
      const key = await unlockFinanceVault(
        uid,
        meta,
        useRecovery ? normalizeRecoveryPhrase(phrase) : phrase,
        useRecovery ? 'recovery' : 'passphrase'
      );
      setDek(key);
      setPhrase('');
      setPhase('ready');
    } catch {
      showToast(t('fin_vault_bad_phrase'), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'ready' && dek && uid) {
    return <>{children({ uid, dek })}</>;
  }

  return (
    <Layout title={t('nav_finances')} showFab={false}>
    {!uid || phase === 'loading' ? (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('status_checking')}
      </div>
    ) : (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div className="flex items-center gap-2 text-accent-teal">
        <Shield className="h-5 w-5" />
        <h2 className="text-sm font-semibold text-text-primary">
          {t('fin_vault_title')}
        </h2>
      </div>
      <p className="text-xs leading-relaxed text-text-muted">
        {t('fin_vault_desc')}
      </p>

      {phase === 'setup' && (
        <>
          <label className="grid gap-1 text-xs text-text-muted">
            {t('fin_vault_phrase')}
            <Input
              type="password"
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="grid gap-1 text-xs text-text-muted">
            {t('fin_vault_phrase2')}
            <Input
              type="password"
              value={phrase2}
              onChange={e => setPhrase2(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <Button disabled={busy} onClick={() => void handleCreate()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('fin_vault_create')}
          </Button>
        </>
      )}

      {phase === 'recovery' && (
        <>
          <p className="text-xs font-medium text-accent-red">{t('fin_vault_recovery_warn')}</p>
          <pre className="whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-sm leading-7 text-text-primary">
            {recovery}
          </pre>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={recoveryAck}
              onChange={e => setRecoveryAck(e.target.checked)}
            />
            {t('fin_vault_recovery_ack')}
          </label>
          <Button
            disabled={!recoveryAck}
            onClick={() => {
              setRecovery('');
              setPhase('ready');
            }}
          >
            {t('fin_vault_continue')}
          </Button>
        </>
      )}

      {phase === 'unlock' && (
        <>
          <label className="grid gap-1 text-xs text-text-muted">
            {useRecovery ? t('fin_vault_recovery') : t('fin_vault_phrase')}
            {useRecovery ? (
              <textarea
                value={phrase}
                onChange={e => setPhrase(e.target.value)}
                rows={3}
                className="rounded-md border border-border bg-field px-3 py-2 text-sm"
              />
            ) : (
              <Input
                type="password"
                value={phrase}
                onChange={e => setPhrase(e.target.value)}
                autoComplete="current-password"
              />
            )}
          </label>
          <Button disabled={busy} onClick={() => void handleUnlock()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Lock className="mr-2 h-4 w-4" />
            {t('fin_vault_unlock')}
          </Button>
          <button
            type="button"
            className="text-left text-[11px] text-accent-teal"
            onClick={() => {
              setUseRecovery(v => !v);
              setPhrase('');
            }}
          >
            {useRecovery ? t('fin_vault_use_phrase') : t('fin_vault_use_recovery')}
          </button>
        </>
      )}
    </div>
    )}
    </Layout>
  );
}
