import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor shell for Android (and future iOS).
 *
 * Production: ships the Vite `dist/` SPA and talks to the same HTTPS API/Supabase
 * as the browser PWA. Set VITE_API_BASE_URL at web build time if the API is not
 * same-origin (required for native WebView).
 *
 * Live reload (optional, device on LAN):
 *   CAP_SERVER_URL=http://192.168.x.x:3005 npx cap run android
 */
const liveReloadUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.cerebrostudios.dailytracker',
  appName: 'Daily Tracker',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0d1117',
  },
  server: {
    // HTTPS scheme improves cookie/storage behaviour vs http://localhost
    androidScheme: 'https',
    // Cleartext only when using live-reload over LAN
    cleartext: Boolean(liveReloadUrl),
    ...(liveReloadUrl
      ? {
          url: liveReloadUrl,
        }
      : {}),
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0d1117',
      showSpinner: false,
      androidScaleType: 'CENTER',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0d1117',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      iconColor: '#58a6ff',
    },
  },
};

export default config;
