import { useState, type FormEvent } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveRuntimeConfig, type RuntimeSupabaseConfig } from '@/lib/supabase';

interface Props {
  onSaved: () => void;
}

export function SupabaseConfigForm({ onSaved }: Props) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!url.trim() || !anonKey.trim()) {
      setError('URL y anon key son obligatorios.');
      return;
    }

    try {
      setSaving(true);
      saveRuntimeConfig({
        url: url.trim(),
        anonKey: anonKey.trim(),
      } satisfies RuntimeSupabaseConfig);
      onSaved();
    } catch {
      setError('No pudimos guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-text-muted">
        Pega la URL del proyecto y la anon key desde Supabase → Project Settings → API.
      </p>

      <div>
        <label className="mb-0.5 block text-[11px] text-text-muted">
          Project URL<span className="text-accent-red">*</span>
        </label>
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://xxxx.supabase.co"
          className="h-8 text-xs"
        />
      </div>

      <div>
        <label className="mb-0.5 block text-[11px] text-text-muted">
          Anon key<span className="text-accent-red">*</span>
        </label>
        <Input
          value={anonKey}
          onChange={e => setAnonKey(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
          className="h-8 text-xs"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded border border-accent-red/40 bg-accent-red/5 p-2 text-xs text-accent-red">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar y conectar'}
      </Button>
    </form>
  );
}