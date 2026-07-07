import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let client: SupabaseClient | null = null;
let cachedConfig: SupabaseConfig | null = null;

function configIsComplete(c: SupabaseConfig | null): c is SupabaseConfig {
  return Boolean(c?.url && c?.anonKey);
}

export function initSupabase(config: SupabaseConfig): void {
  cachedConfig = config;
  if (configIsComplete(config)) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
}

export function isSupabaseReady(): boolean {
  return configIsComplete(cachedConfig) && client !== null;
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
    );
  }
  return client;
}