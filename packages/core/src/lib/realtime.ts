import { getSupabase } from '../supabase';

export type Unsubscribe = () => void;

/** Payload normalizado de postgres_changes (Supabase Realtime). */
export type PostgresChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

export interface TableSubscription {
  /** Nombre lógico del canal, único por recurso (p.ej. `tasks:${uid}`). */
  topic: string;
  /** Tabla de Postgres a observar. */
  table: string;
  /** Filtro de Realtime (p.ej. `user_id=eq.${uid}`). */
  filter: string;
  /**
   * Se invoca en cada cambio. `payload` está presente cuando el servidor
   * envía el registro; puede ser undefined en suscriptores legados sin uso.
   */
  onChange: (payload?: PostgresChangePayload) => void;
}

type RegistryEntry = {
  listeners: Set<(payload?: PostgresChangePayload) => void>;
  channel: ReturnType<ReturnType<typeof getSupabase>['channel']>;
};

const registry = new Map<string, RegistryEntry>();

function normalizePayload(raw: {
  eventType?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
}): PostgresChangePayload {
  const eventType =
    raw.eventType === 'INSERT' || raw.eventType === 'UPDATE' || raw.eventType === 'DELETE'
      ? raw.eventType
      : 'UPDATE';
  return {
    eventType,
    new: (raw.new as Record<string, unknown> | null) ?? null,
    old: (raw.old as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Suscripción Realtime multi-listener a una tabla de Postgres.
 *
 * - Un solo canal por `topic` (varios hooks pueden compartir sin re-`.on()`).
 * - Evita «cannot add postgres_changes callbacks after subscribe()».
 * - Refcount: al irse el último listener se hace removeChannel.
 */
export function subscribeTable({ topic, table, filter, onChange }: TableSubscription): Unsubscribe {
  const supabase = getSupabase();
  const fullTopic = `realtime:${topic}`;

  let entry = registry.get(fullTopic);
  if (!entry) {
    const listeners = new Set<(payload?: PostgresChangePayload) => void>();
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        raw => {
          const payload = normalizePayload(
            raw as {
              eventType?: string;
              new?: Record<string, unknown> | null;
              old?: Record<string, unknown> | null;
            }
          );
          for (const listener of listeners) {
            try {
              listener(payload);
            } catch {
              /* no tumbar el canal por un listener roto */
            }
          }
        }
      )
      .subscribe();
    entry = { listeners, channel };
    registry.set(fullTopic, entry);
  }

  entry.listeners.add(onChange);

  return () => {
    const current = registry.get(fullTopic);
    if (!current) return;
    current.listeners.delete(onChange);
    if (current.listeners.size === 0) {
      registry.delete(fullTopic);
      void supabase.removeChannel(current.channel);
    }
  };
}

/** Solo tests / sign-out. */
export function _resetRealtimeRegistry(): void {
  registry.clear();
}
