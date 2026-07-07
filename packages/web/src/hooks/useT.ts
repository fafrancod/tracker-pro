import { useMemo } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { getDict, getLocale, type TKey } from '@/lib/i18n';
import type { Language } from '@core/types';
import type { Locale } from 'date-fns/locale';

export interface I18nContext {
  language: Language;
  locale: Locale;
  t: (key: TKey) => string;
  /** Formato de fecha corto adecuado al idioma (ej. "25 may" en es, "May 25" en en). */
  shortDateFormat: string;
  /** Formato de día de la semana adecuado al idioma. */
  weekdayFormat: string;
}

export function useT(): I18nContext {
  const { settings } = useSettings();
  const language = settings.language;

  return useMemo<I18nContext>(() => {
    const dict = getDict(language);
    const locale = getLocale(language);
    return {
      language,
      locale,
      t: (key: TKey) => dict[key] ?? key,
      shortDateFormat: language === 'es' ? 'd MMM' : 'MMM d',
      weekdayFormat: 'EEEE',
    };
  }, [language]);
}
