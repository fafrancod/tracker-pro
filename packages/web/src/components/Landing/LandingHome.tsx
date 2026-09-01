import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBrandName, getPublicAppUrl } from '@/lib/publicConfig';
import { getDict } from '@/lib/i18n';
import type { Language } from '@core/types';

const LANDING_LANG_KEY = 'meteora:landing-lang';

function readLandingLang(): Language {
  try {
    const saved = localStorage.getItem(LANDING_LANG_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    /* noop */
  }
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) {
    return 'en';
  }
  return 'es';
}

function writeLandingLang(lang: Language) {
  try {
    localStorage.setItem(LANDING_LANG_KEY, lang);
  } catch {
    /* no pisa settings */
  }
}

function BoardPreview({ label }: { label: string }) {
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return (
    <div className="rounded-2xl border border-border bg-background p-3 shadow-sm">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => (
          <div key={day} className="rounded-md bg-surface p-1.5">
            <div className="text-center text-[10px] font-semibold text-text-muted">{day}</div>
            <div
              className="mt-1 rounded bg-accent-teal/25"
              style={{ height: i % 3 === 0 ? 28 : i % 2 === 0 ? 16 : 10 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingHome({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(readLandingLang);
  const [copied, setCopied] = useState(false);
  const t = useMemo(() => getDict(lang), [lang]);
  const brand = getBrandName();
  const publicUrl = getPublicAppUrl();

  function selectLang(next: Language) {
    setLang(next);
    writeLandingLang(next);
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const features = [
    { title: t.landing_board, desc: t.landing_board_desc },
    { title: t.landing_habits, desc: t.landing_habits_desc },
    { title: t.landing_rx, desc: t.landing_rx_desc },
    { title: t.landing_money, desc: t.landing_money_desc },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-accent-teal" />
          <span className="text-sm font-bold tracking-tight text-text-primary">{brand}</span>
        </div>
        <div className="flex rounded-full border border-border p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 ${lang === 'es' ? 'bg-surface text-text-primary' : 'text-text-muted'}`}
            onClick={() => selectLang('es')}
          >
            ES
          </button>
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 ${lang === 'en' ? 'bg-surface text-text-primary' : 'text-text-muted'}`}
            onClick={() => selectLang('en')}
          >
            EN
          </button>
        </div>
      </header>

      <main className="mx-auto mt-8 grid w-full max-w-5xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <section>
          <h1 className="text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
            {t.landing_tagline}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">{t.landing_desc}</p>
          <div className="mt-6">
            <BoardPreview label={t.landing_preview} />
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {features.map(item => (
              <li key={item.title} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{item.desc}</p>
              </li>
            ))}
          </ul>
          {publicUrl ? (
            <div className="mt-6 rounded-xl border border-border bg-surface p-3">
              <p className="text-xs text-text-muted">{t.landing_copy_hint}</p>
              <p className="mt-2 truncate font-mono text-xs text-text-primary">{publicUrl}</p>
              <Button type="button" variant="outline" className="mt-3 gap-2" onClick={() => void copyLink()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t.landing_copied : t.landing_copy_link}
              </Button>
            </div>
          ) : null}
        </section>
        <section className="lg:sticky lg:top-8">{children}</section>
      </main>

      <footer className="mx-auto mt-10 w-full max-w-5xl">
        <Link to="/privacy" className="text-xs text-text-muted hover:text-text-primary hover:underline">
          {t.landing_privacy}
        </Link>
      </footer>
    </div>
  );
}
