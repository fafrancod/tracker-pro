import { useEffect, type ReactNode } from 'react';
import { applySkin, DEFAULT_SKIN_ID } from '@/lib/skins';

const LANDING_SKIN = 'light-paper';
const SETTINGS_KEY = 'daily-tracker:settings:v1';

function restoreBoardSkin() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      applySkin(DEFAULT_SKIN_ID, { force: true });
      return;
    }
    const parsed = JSON.parse(raw) as { skinId?: string };
    applySkin(parsed.skinId ?? DEFAULT_SKIN_ID, { force: true });
  } catch {
    applySkin(DEFAULT_SKIN_ID, { force: true });
  }
}

/**
 * Tema claro de marketing. Al desmontar, el skin del board vuelve a mandar.
 * Solo se monta si landingEnabled.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.landing = '1';
    applySkin(LANDING_SKIN, { force: true });
    return () => {
      delete root.dataset.landing;
      restoreBoardSkin();
    };
  }, []);

  return <div data-landing="1">{children}</div>;
}
