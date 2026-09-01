import { lazy } from 'react';

/** Solo páginas públicas. El Board (y el resto del producto) sigue eager. */
export const LoginPage = lazy(() =>
  import('@/pages/Login').then(mod => ({ default: mod.LoginPage }))
);
export const PrivacyPage = lazy(() =>
  import('@/pages/Privacy').then(mod => ({ default: mod.PrivacyPage }))
);
