type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 30_000;

export function getCachedList<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedList<T>(
  key: string,
  value: T,
  ttlMs = DEFAULT_TTL_MS,
) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidatePhotoListCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  Array.from(store.keys()).forEach((key) => {
    if (key.startsWith(prefix)) store.delete(key);
  });
}
