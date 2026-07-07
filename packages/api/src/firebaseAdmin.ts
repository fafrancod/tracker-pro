import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAppCheck } from 'firebase-admin/app-check';
import { config } from './config.js';

function init() {
  if (getApps().length > 0) return;

  const { projectId, clientEmail, privateKey } = config.firebase;
  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    return;
  }

  // Fallback a Application Default Credentials (GCP, GOOGLE_APPLICATION_CREDENTIALS).
  initializeApp({ credential: applicationDefault() });
}

init();

export const adminAuth = getAuth();
export const adminAppCheck = getAppCheck();
export const db = getFirestore();
export { FieldValue, Timestamp };
