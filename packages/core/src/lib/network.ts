/** Browser online/offline helpers (safe for non-DOM environments). */

export function isBrowserOnline(): boolean {
  if (typeof globalThis === 'undefined') return true;
  const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
  if (!nav || nav.onLine === undefined) return true;
  return nav.onLine !== false;
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch failed
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes('failed to fetch') || m.includes('network') || m.includes('offline')) {
      return true;
    }
  }
  return false;
}

/** Prefer queue when offline OR when the transport failed. */
export function shouldQueueMutation(err?: unknown): boolean {
  if (!isBrowserOnline()) return true;
  if (err !== undefined && isLikelyNetworkError(err)) return true;
  return false;
}
