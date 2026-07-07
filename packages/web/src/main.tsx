import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { bootstrapFirebase } from './lib/firebase';
import { useStore } from '@core/store';
import './index.css';

bootstrapFirebase();

// Dev-only: expose the Zustand store en window para debugging desde la consola.
if (import.meta.env.DEV) {
  (window as unknown as { __dailyTrackerStore__: typeof useStore }).__dailyTrackerStore__ = useStore;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
