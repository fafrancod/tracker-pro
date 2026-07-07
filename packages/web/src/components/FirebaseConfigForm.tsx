import { useState, type FormEvent } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveRuntimeConfig, type RuntimeFirebaseConfig } from '@/lib/firebase';

interface Props {
  onSaved: () => void;
}

const FIELDS: Array<{
  key: keyof RuntimeFirebaseConfig;
  label: string;
  placeholder: string;
  required?: boolean;
}> = [
  { key: 'apiKey', label: 'API Key', placeholder: 'AIzaSy…', required: true },
  { key: 'authDomain', label: 'Auth Domain', placeholder: 'mi-proyecto.firebaseapp.com', required: true },
  { key: 'projectId', label: 'Project ID', placeholder: 'mi-proyecto-123', required: true },
  { key: 'appId', label: 'App ID', placeholder: '1:1234567890:web:abc123', required: true },
  { key: 'storageBucket', label: 'Storage Bucket', placeholder: 'mi-proyecto.appspot.com' },
  { key: 'messagingSenderId', label: 'Messaging Sender ID', placeholder: '1234567890' },
  { key: 'appCheckSiteKey', label: 'App Check site key (opcional)', placeholder: '6Lc…' },
];

/**
 * Form que toma la config de Firebase y la guarda en localStorage. Sirve para
 * setup rápido sin tocar `.env.local` (útil en demos o en dispositivos donde
 * editar archivos no es práctico).
 */
export function FirebaseConfigForm({ onSaved }: Props) {
  const [values, setValues] = useState<Partial<RuntimeFirebaseConfig>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');

  function handlePasteJson() {
    setError(null);
    try {
      // Acepta objeto JS-like de Firebase Console: { apiKey: "…", authDomain: "…", … }
      // y también JSON estricto.
      const cleaned = pasteText
        .trim()
        // Eliminar prefijos tipo `const firebaseConfig =`
        .replace(/^\s*(const|var|let)?\s*\w*\s*=\s*/, '')
        // Quitar punto y coma final
        .replace(/;?\s*$/, '');
      let parsed: Record<string, string>;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Fallback: parse no-estricto envolviendo claves sin comillas.
        // (Function permite literales JS, evitamos eval directo.)
        const fn = new Function(`return (${cleaned});`);
        parsed = fn() as Record<string, string>;
      }

      const next: Partial<RuntimeFirebaseConfig> = {
        apiKey: parsed.apiKey,
        authDomain: parsed.authDomain,
        projectId: parsed.projectId,
        storageBucket: parsed.storageBucket,
        messagingSenderId: parsed.messagingSenderId,
        appId: parsed.appId,
      };
      setValues(next);
      setShowPaste(false);
    } catch (err) {
      setError(
        'No pude parsear ese texto. Pegá el objeto entre {…} de "Project settings → Your apps → SDK setup".'
      );
      console.error(err);
    }
  }

  function setField<K extends keyof RuntimeFirebaseConfig>(key: K, value: string) {
    setValues(v => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const missing = FIELDS.filter(f => f.required && !values[f.key]?.toString().trim()).map(f => f.label);
    if (missing.length > 0) {
      setError(`Faltan campos obligatorios: ${missing.join(', ')}`);
      return;
    }

    try {
      setSaving(true);
      saveRuntimeConfig({
        apiKey: values.apiKey!.trim(),
        authDomain: values.authDomain!.trim(),
        projectId: values.projectId!.trim(),
        storageBucket: (values.storageBucket ?? '').trim(),
        messagingSenderId: (values.messagingSenderId ?? '').trim(),
        appId: values.appId!.trim(),
        appCheckSiteKey: values.appCheckSiteKey?.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError('No pudimos guardar la configuración.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">Pegá los datos de tu proyecto Firebase.</p>
        <button
          type="button"
          onClick={() => setShowPaste(s => !s)}
          className="text-[11px] text-accent-teal hover:underline"
        >
          {showPaste ? 'Campos individuales' : 'Pegar objeto JS'}
        </button>
      </div>

      {showPaste ? (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={8}
            placeholder={`const firebaseConfig = {\n  apiKey: "…",\n  authDomain: "…",\n  …\n};`}
            className="w-full rounded-md border border-border bg-background p-2 font-mono text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button type="button" onClick={handlePasteJson} size="sm" variant="outline" className="w-full">
            Usar este objeto
          </Button>
        </div>
      ) : (
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="mb-0.5 block text-[11px] text-text-muted">
                {f.label}
                {f.required && <span className="text-accent-red">*</span>}
              </label>
              <Input
                value={(values[f.key] as string | undefined) ?? ''}
                onChange={e => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded border border-accent-red/40 bg-accent-red/5 p-2 text-xs text-accent-red">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar y conectar'}
      </Button>

      <p className="text-[10px] text-text-muted">
        Se guarda en este navegador. Para producción usá las variables{' '}
        <code className="rounded bg-background px-1">VITE_FIREBASE_*</code> en build time.
      </p>
    </form>
  );
}
