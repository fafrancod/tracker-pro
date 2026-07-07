import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let cachedConfig: FirebaseConfig | null = null;

function configIsComplete(c: FirebaseConfig | null): c is FirebaseConfig {
  if (!c) return false;
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

function ensureApp(): FirebaseApp {
  if (app) return app;
  if (!configIsComplete(cachedConfig)) {
    throw new Error(
      'Firebase config is missing or incomplete. ' +
        'Copy packages/web/.env.example to .env.local and fill VITE_FIREBASE_* values.'
    );
  }
  const existing = getApps();
  app = existing.length === 0 ? initializeApp(cachedConfig) : existing[0];
  return app;
}

/**
 * Guarda la config y prepara el app lazy. No llama a getAuth/getFirestore en
 * sincronía: así, si las env vars faltan en dev, la app puede renderizar una
 * pantalla informativa en lugar de crashear durante el bootstrap.
 */
export function initFirebase(config: FirebaseConfig): void {
  cachedConfig = config;
  if (configIsComplete(config)) {
    // Inicialización temprana sólo si la config está completa, así el primer
    // listener no paga el costo en el primer render.
    ensureApp();
  }
}

export function isFirebaseReady(): boolean {
  return configIsComplete(cachedConfig);
}

/**
 * Devuelve la FirebaseApp lista. Util para que la capa de plataforma
 * (web/mobile) inicialice App Check, Analytics, etc.
 */
export function getFirebaseApp(): FirebaseApp {
  return ensureApp();
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(ensureApp());
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(ensureApp());
  return auth;
}
