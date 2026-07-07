import { useState, type ReactNode } from 'react';
import { ListChecks, Play, Settings as SettingsIcon } from 'lucide-react';
import { isDemoMode } from '@core/lib/demoMode';
import { enableDemo, isSupabaseReady } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { SupabaseConfigForm } from './SupabaseConfigForm';

type Mode = 'menu' | 'configure';

export function SupabaseConfigGate({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('menu');

  if (isSupabaseReady() || isDemoMode()) return <>{children}</>;

  function handleDemo() {
    enableDemo();
    window.location.reload();
  }

  function handleConfigSaved() {
    window.location.reload();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-accent-teal" />
          <h1 className="text-base font-bold text-text-primary">Daily Tracker</h1>
        </div>

        {mode === 'menu' ? (
          <>
            <Button onClick={() => setMode('configure')} className="mb-3 w-full gap-2">
              <SettingsIcon className="h-4 w-4" />
              Conectar a Supabase
            </Button>
            <p className="mb-5 text-[11px] text-text-muted">
              Necesitas la URL del proyecto y la anon key. Se guarda en este navegador.
            </p>

            <Button onClick={handleDemo} variant="outline" className="mb-3 w-full gap-2">
              <Play className="h-4 w-4" />
              Ver demo sin login
            </Button>
            <p className="text-[11px] text-text-muted">
              Datos de ejemplo, no se guardan en ningún backend.
            </p>

            <details className="mt-5 border-t border-border pt-3 text-[11px] text-text-muted">
              <summary className="cursor-pointer">¿Usar archivo `.env.local` en su lugar?</summary>
              <ol className="mt-2 space-y-1 pl-3">
                <li>
                  1. Copia{' '}
                  <code className="rounded bg-background px-1 text-text-primary">packages/web/.env.example</code> a{' '}
                  <code className="rounded bg-background px-1 text-text-primary">packages/web/.env.local</code>.
                </li>
                <li>
                  2. Rellena{' '}
                  <code className="rounded bg-background px-1 text-text-primary">VITE_SUPABASE_URL</code> y{' '}
                  <code className="rounded bg-background px-1 text-text-primary">VITE_SUPABASE_ANON_KEY</code>.
                </li>
                <li>3. Reinicia el dev server.</li>
              </ol>
            </details>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMode('menu')}
              className="mb-3 text-[11px] text-text-muted hover:text-text-primary"
            >
              ← Volver
            </button>
            <SupabaseConfigForm onSaved={handleConfigSaved} />
          </>
        )}
      </div>
    </div>
  );
}