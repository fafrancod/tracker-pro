import { getSupabase } from '../supabase';

export type Unsubscribe = () => void;

export interface TableSubscription {
  /** Nombre lógico del canal, único por recurso (p.ej. `projects:${uid}`). */
  topic: string;
  /** Tabla de Postgres a observar. */
  table: string;
  /** Filtro de Realtime (p.ej. `user_id=eq.${uid}`). */
  filter: string;
  /** Se invoca en cada cambio (INSERT/UPDATE/DELETE) que matchee el filtro. */
  onChange: () => void;
}

/**
 * Suscripción Realtime idempotente a una tabla de Postgres.
 *
 * Supabase indexa los canales por su `topic`. Si se llama a
 * `supabase.channel(topic)` con un topic YA existente, devuelve el canal
 * existente (ya suscrito); encadenar `.on()` sobre él lanza
 * «cannot add postgres_changes callbacks after subscribe()», una excepción no
 * capturada que rompe el árbol de React (pantalla en negro).
 *
 * Esto pasa cuando el mismo hook se monta varias veces: StrictMode, varios
 * componentes usando el mismo hook, o un remount rápido antes de que el
 * `removeChannel` (asíncrono) termine. Para evitarlo reutilizamos el canal si
 * ya existe en lugar de crear otro.
 */
export function subscribeTable({ topic, table, filter, onChange }: TableSubscription): Unsubscribe {
  const supabase = getSupabase();
  const fullTopic = `realtime:${topic}`;

  const existing = supabase.getChannels().find(ch => ch.topic === fullTopic);
  const channel =
    existing ??
    supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        () => onChange()
      )
      .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
