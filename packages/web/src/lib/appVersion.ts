// Versionado por PR (ver docs/APP_FAMILY_PLAYBOOK del finanzas-pro).
// Vite lo inyecta vía define en vite.config; este fallback evita romper en dev.

export interface AppVersionInfo {
  version: string;
  channel: string;
  buildId: string;
}

declare const __APP_VERSION__: string | undefined;
declare const __APP_CHANNEL__: string | undefined;
declare const __APP_BUILD_ID__: string | undefined;

export const appVersion: AppVersionInfo = {
  version:
    (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) ||
    import.meta.env.VITE_APP_VERSION ||
    '0.0.0-dev',
  channel:
    (typeof __APP_CHANNEL__ !== 'undefined' && __APP_CHANNEL__) ||
    import.meta.env.VITE_APP_CHANNEL ||
    'dev',
  buildId:
    (typeof __APP_BUILD_ID__ !== 'undefined' && __APP_BUILD_ID__) ||
    new Date().toISOString().slice(0, 10),
};
