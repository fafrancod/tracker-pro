import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { bootstrapSupabase } from './lib/supabase';
import { useStore } from '@core/store';
import { applySkin, DEFAULT_SKIN_ID } from './lib/skins';
import './index.css';

function bootstrapSkinFromLocalStorage() {
  try {
    const raw = localStorage.getItem('daily-tracker:settings:v1');
    if (!raw) {
      applySkin(DEFAULT_SKIN_ID);
      return;
    }
    const parsed = JSON.parse(raw) as { skinId?: string };
    applySkin(parsed.skinId ?? DEFAULT_SKIN_ID);
  } catch {
    applySkin(DEFAULT_SKIN_ID);
  }
}

bootstrapSkinFromLocalStorage();

async function main() {
  await bootstrapSupabase();

  // Dev-only: expose the Zustand store en window para debugging desde la consola.
  if (import.meta.env.DEV) {
    (window as unknown as { __dailyTrackerStore__: typeof useStore }).__dailyTrackerStore__ = useStore;
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void main();
