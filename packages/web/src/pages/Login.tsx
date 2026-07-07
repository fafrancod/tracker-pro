import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Mode = 'signin' | 'signup';

function describeAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'Credenciales inválidas.';
  }
  if (msg.includes('auth/email-already-in-use')) return 'Ese email ya está registrado.';
  if (msg.includes('auth/weak-password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('auth/invalid-email')) return 'Email inválido.';
  if (msg.includes('auth/popup-closed-by-user')) return 'Se cerró el popup antes de terminar.';
  if (msg.includes('auth/network-request-failed')) return 'Sin conexión con Firebase.';
  return 'No pude completar el login. Revisá la consola para más detalles.';
}

export function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (user) {
    const target = (location.state as { from?: string } | null)?.from ?? '/board';
    return <Navigate to={target} replace />;
  }

  async function handleGoogle() {
    try {
      setBusy(true);
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      showToast(describeAuthError(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    try {
      setBusy(true);
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password, name.trim());
      }
    } catch (err) {
      console.error(err);
      showToast(describeAuthError(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-accent-teal" />
          <h1 className="text-lg font-bold tracking-tight text-text-primary">Daily Tracker</h1>
        </div>

        <h2 className="mb-1 text-base font-semibold text-text-primary">
          {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          {mode === 'signin'
            ? 'Volvé a tu semana donde la dejaste.'
            : 'Empezá a planificar tu primera semana.'}
        </p>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogle}
          disabled={busy}
          className="mb-4 w-full gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Continuar con Google
        </Button>

        <div className="relative my-4 flex items-center">
          <div className="flex-1 border-t border-border" />
          <span className="px-2 text-[10px] uppercase tracking-wider text-text-muted">o</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <Input
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <Input
            type="email"
            placeholder="email@ejemplo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
          <Button type="submit" disabled={busy || !email.trim() || !password} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(m => (m === 'signin' ? 'signup' : 'signin'))}
          className="mt-4 w-full text-center text-xs text-text-muted hover:text-text-primary"
        >
          {mode === 'signin' ? '¿No tenés cuenta? Crear una' : '¿Ya tenés cuenta? Iniciar sesión'}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 11v3.2h4.5c-.2 1.2-1.4 3.4-4.5 3.4-2.7 0-4.9-2.2-4.9-5s2.2-5 4.9-5c1.5 0 2.6.6 3.2 1.2l2.2-2.1C16.1 5.3 14.2 4.5 12 4.5 7.9 4.5 4.5 7.9 4.5 12s3.4 7.5 7.5 7.5c4.3 0 7.2-3 7.2-7.3 0-.5-.1-.9-.1-1.2H12z"
      />
    </svg>
  );
}
