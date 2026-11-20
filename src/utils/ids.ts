/**
 * Generates a unique, collision-free identifier with a domain prefix (e.g. `tx-<uuid>`, `m-<uuid>`).
 * Uses `crypto.randomUUID()` when available, with a high-entropy base36 fallback.
 */
export function newId(prefix: string): string {
  const cleanPrefix = (prefix || 'id').replace(/-+$/, '');
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${cleanPrefix}-${rand}`;
}
