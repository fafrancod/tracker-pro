const SENSITIVE_KEYS = new Set(['amount', 'password', 'token', 'anonkey']);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[_-]/g, ''));
}

/** Redacta PII financiera y de auth antes de persistir o devolver logs de ops. */
export function redactPii<T>(value: T, replacement = '[redacted]'): T {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => redactPii(item, replacement)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? replacement : redactPii(nested, replacement);
  }
  return out as T;
}
