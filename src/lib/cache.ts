interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();

    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    const now = Date.now();

    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const cache = new CacheManager(5 * 60 * 1000);

setInterval(() => {
  cache.cleanup();
}, 60 * 1000);

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = cache.get<T>(key);

  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  cache.set(key, data, ttl);

  return data;
}

export function invalidateCache(pattern?: string): void {
  if (pattern) {
    cache.invalidatePattern(pattern);
  } else {
    cache.clear();
  }
}

export function getCacheKey(parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join(':');
}

/**
 * Get cache key with epoch for versioning (Phase 2)
 */
export function getCacheKeyWithEpoch(parts: (string | number | undefined)[], epochId: string): string {
  return [...parts.filter(Boolean), epochId].join(':');
}

/**
 * Invalidate all keys for a specific epoch (Phase 2)
 */
export function invalidateEpoch(epochId: string): void {
  cache.invalidatePattern(`.*:${epochId}$`);
}

/**
 * Invalidate all value-related caches (Phase 2)
 */
export function invalidateAllValueCaches(): void {
  cache.invalidatePattern('player-value:.*');
  cache.invalidatePattern('rankings:.*');
  cache.invalidatePattern('current-epoch');
}
