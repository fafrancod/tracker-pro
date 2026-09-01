import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Loader2, ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isLandingEnabled, getBrandName } from '@/lib/publicConfig';
import { LandingHome } from '@/components/Landing/LandingHome';

type Mode = 'signin' | 'signup';

function describeAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Invalid login credentials')) return 'Credenciales inválidas.';
  if (msg.includes('User already registered')) return 'Ese email ya está registrado.';
  if (msg.includes('Password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'Email inválido.';
  if (msg.includes('Email not confirmed'))
    return 'Debes confirmar el email antes de entrar. Revisa tu bandeja.';
  if (msg.includes('redirect_uri_mismatch') || msg.includes('Redirect'))
    return 'Google OAuth mal configurado (redirect URI). Revisa docs/AUTH_AND_EMAIL.md.';
  if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider'))
    return 'Google no está habilitado en Supabase (Authentication → Providers).';
  if (msg.includes('Popup closed') || msg.includes('user_cancelled'))
    return 'Inicio de sesión con Google cancelado.';
  return 'No pude completar el login. Revisa la consola o docs/AUTH_AND_EMAIL.md.';
}

function describeOAuthQueryError(error: string, desc: string | null): string {
  const d = (desc ?? '').toLowerCase();
  if (error === 'access_denied' || d.includes('denied'))
    return 'Acceso con Google denegado o cancelado.';
  if (d.includes('redirect')) return 'Redirect OAuth incorrecto. Revisa Supabase y Google Cloud.';
  return `Error de Google: ${desc || error}`;
}

export function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const fromPath =
    (location.state as { from?: string } | null)?.from &&
    String((location.state as { from?: string }).from).startsWith('/')
      ? String((location.state as { from?: string }).from)
      : '/board';

  // Errores devueltos por Supabase/Google en la query al volver del OAuth.
  useEffect(() => {
    const err = searchParams.get('error');
    const desc = searchParams.get('error_description');
    if (!err) return;
    showToast(describeOAuthQueryError(err, desc), 'error');
    const next = new URLSearchParams(searchParams);
    next.delete('error');
    next.delete('error_description');
    next.delete('error_code');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, showToast]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={fromPath} replace />;
  }

  async function handleGoogle() {
    try {
      setBusy(true);
      await signInWithGoogle(fromPath === '/' ? '/board' : fromPath);
    } catch (err) {
      console.error(err);
      showToast(describeAuthError(err), 'error');
      setBusy(false);
    }
    // Si OAuth redirige, no desactivamos busy (navegación completa).
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
        showToast(
          'Cuenta creada. Si el proyecto exige confirmar email, revisa tu bandeja.',
          'success'
        );
      }
    } catch (err) {
      console.error(err);
      showToast(describeAuthError(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const card = (
    <div
      data-glass-float
      className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl"
    >
      <div className="mb-6 flex items-center gap-2">
        <ListChecks className="h-6 w-6 text-accent-teal" />
        <h1 className="text-lg font-bold tracking-tight text-text-primary">{getBrandName()}</h1>
      </div>

      <h2 className="mb-1 text-base font-semibold text-text-primary">
        {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h2>
      <p className="mb-4 text-xs text-text-muted">
        {mode === 'signin'
          ? 'Vuelve a tu semana donde la dejaste.'
          : 'Empieza a planificar tu primera semana.'}
      </p>

      <Button
        type="button"
        variant="outline"
        onClick={() => void handleGoogle()}
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

      <form onSubmit={e => void handleSubmit(e)} className="space-y-3">
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
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === 'signin' ? (
            'Entrar'
          ) : (
            'Crear cuenta'
          )}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(m => (m === 'signin' ? 'signup' : 'signin'))}
        className="mt-4 w-full text-center text-xs text-text-muted hover:text-text-primary"
      >
        {mode === 'signin'
          ? '¿No tienes cuenta? Crear una'
          : '¿Ya tienes cuenta? Iniciar sesión'}
      </button>
      <Link
        to="/privacy"
        className="mt-3 block w-full text-center text-[11px] text-text-muted hover:text-text-primary hover:underline"
      >
        Política de privacidad
      </Link>
    </div>
  );

  if (isLandingEnabled()) {
    return <LandingHome>{card}</LandingHome>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">{card}</div>
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
