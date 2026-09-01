import { isNativePlatform } from '@/lib/capacitor';

export interface PublicConfigPayload {
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  configured?: boolean;
  brand?: string;
  publicAppUrl?: string;
  landingEnabled?: boolean;
  playStoreUrl?: string | null;
}

export interface PublicAppConfig {
  brand: string;
  publicAppUrl: string;
  landingEnabled: boolean;
  playStoreUrl: string | null;
}

const DEFAULTS: PublicAppConfig = {
  brand: 'Daily Tracker',
  publicAppUrl: '',
  landingEnabled: false,
  playStoreUrl: null,
};

let cached: PublicAppConfig = { ...DEFAULTS };

function firstHttpsOrigin(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  if (isNativePlatform() && /localhost|capacitor/i.test(origin)) return '';
  return origin.replace(/\/$/, '');
}

export function ingestPublicConfig(raw: PublicConfigPayload | null | undefined): void {
  if (!raw) return;
  const brand = typeof raw.brand === 'string' && raw.brand.trim() ? raw.brand.trim() : DEFAULTS.brand;
  const fromApi =
    typeof raw.publicAppUrl === 'string' ? raw.publicAppUrl.trim().replace(/\/$/, '') : '';
  cached = {
    brand,
    publicAppUrl: fromApi || firstHttpsOrigin(),
    landingEnabled: raw.landingEnabled === true,
    playStoreUrl:
      typeof raw.playStoreUrl === 'string' && raw.playStoreUrl.trim() ? raw.playStoreUrl.trim() : null,
  };
}

export function isLandingEnabled(): boolean {
  return cached.landingEnabled;
}

export function getBrandName(): string {
  return cached.brand || DEFAULTS.brand;
}

export function getPlayStoreUrl(): string | null {
  return cached.playStoreUrl;
}

/** URL copiable. Nunca un dominio hardcodeado. En nativo no usa https://localhost. */
export function getPublicAppUrl(): string {
  if (cached.publicAppUrl) return cached.publicAppUrl;
  return firstHttpsOrigin();
}
