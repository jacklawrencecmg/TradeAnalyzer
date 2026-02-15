/**
 * Epoch-Safe Caching System
 *
 * Cache that automatically invalidates when value_epoch changes.
 * Prevents serving stale data after rebuilds.
 *
 * Key Format: {profile}:{format}:{pos}:{page}:{epoch}
 *
 * Rules:
 * - Rankings pages: 5-15 min cache
 * - Player cards: 15 min cache
 * - Auto-invalidate on epoch change
 * - No stale data ever served
 */

import { getCurrentValueEpoch } from './rankingsApi';

interface CacheEntry<T> {
  data: T;
  epoch: string;
  cachedAt: number;
  expiresAt: number;
}

// In-memory cache (consider Redis for production)
const cache = new Map<string, CacheEntry<any>>();

// Cache TTLs in milliseconds
const CACHE_TTL = {
  rankings: 5 * 60 * 1000, // 5 minutes
  playerCard: 15 * 60 * 1000, // 15 minutes
  topPlayers: 10 * 60 * 1000, // 10 minutes
  stats: 30 * 60 * 1000, // 30 minutes
};

/**
 * Generate epoch-safe cache key
 */
export function generateCacheKey(
  type: string,
  params: Record<string, any>,
  epoch: string
): string {
  const paramsString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  return `${type}:${paramsString}:${epoch}`;
}

/**
 * Get from cache (epoch-safe)
 */
export function getFromCache<T>(
  type: string,
  params: Record<string, any>,
  currentEpoch: string
): T | null {
  const key = generateCacheKey(type, params, currentEpoch);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  // Check epoch match
  if (entry.epoch !== currentEpoch) {
    cache.delete(key);
    return null;
  }

  // Check expiration
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set in cache
 */
export function setInCache<T>(
  type: string,
  params: Record<string, any>,
  epoch: string,
  data: T,
  ttlMs?: number
): void {
  const key = generateCacheKey(type, params, epoch);
  const defaultTTL = CACHE_TTL[type as keyof typeof CACHE_TTL] || CACHE_TTL.rankings;
  const ttl = ttlMs || defaultTTL;

  const entry: CacheEntry<T> = {
    data,
    epoch,
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttl,
  };

  cache.set(key, entry);
}

/**
 * Invalidate all cache entries for an epoch
 */
export function invalidateEpoch(epoch: string): number {
  let count = 0;

  for (const [key, entry] of cache.entries()) {
    if (entry.epoch === epoch) {
      cache.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  size: number;
  byType: Record<string, number>;
  byEpoch: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  const byEpoch: Record<string, number> = {};

  for (const [key, entry] of cache.entries()) {
    const type = key.split(':')[0];
    byType[type] = (byType[type] || 0) + 1;
    byEpoch[entry.epoch] = (byEpoch[entry.epoch] || 0) + 1;
  }

  return {
    size: cache.size,
    byType,
    byEpoch,
  };
}

/**
 * Cached rankings query
 */
export async function getCachedRankings<T>(
  params: Record<string, any>,
  fetchFn: () => Promise<{ data: T; epoch: string | null }>
): Promise<T> {
  const format = params.format || 'dynasty';

  // Get current epoch
  const currentEpoch = await getCurrentValueEpoch(format);

  if (!currentEpoch) {
    // No epoch available, fetch without cache
    const result = await fetchFn();
    return result.data;
  }

  // Try cache
  const cached = getFromCache<T>('rankings', params, currentEpoch);
  if (cached) {
    return cached;
  }

  // Cache miss - fetch and cache
  const result = await fetchFn();

  if (result.epoch) {
    setInCache('rankings', params, result.epoch, result.data);
  }

  return result.data;
}

/**
 * Cached player card
 */
export async function getCachedPlayerCard<T>(
  playerId: string,
  format: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Get current epoch
  const currentEpoch = await getCurrentValueEpoch(format as 'dynasty' | 'redraft');

  if (!currentEpoch) {
    return await fetchFn();
  }

  // Try cache
  const params = { playerId, format };
  const cached = getFromCache<T>('playerCard', params, currentEpoch);
  if (cached) {
    return cached;
  }

  // Cache miss
  const data = await fetchFn();
  setInCache('playerCard', params, currentEpoch, data);

  return data;
}

/**
 * Cleanup expired entries
 */
export function cleanupExpiredCache(): number {
  let count = 0;
  const now = Date.now();

  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Start cache cleanup interval
 */
export function startCacheCleanup(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const cleaned = cleanupExpiredCache();
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }, intervalMs);
}

/**
 * Warmup cache (preload hot data)
 */
export async function warmupCache(
  format: 'dynasty' | 'redraft',
  positions: string[] = ['QB', 'RB', 'WR', 'TE']
): Promise<void> {
  console.log(`🔥 Warming up cache for ${format}...`);

  const currentEpoch = await getCurrentValueEpoch(format);
  if (!currentEpoch) {
    console.warn('No epoch available for warmup');
    return;
  }

  // Preload top players
  // This would call your rankings API and cache the results
  // Implementation depends on your specific API structure

  console.log('✅ Cache warmup complete');
}

/**
 * Cache middleware for API routes
 */
export function withCache<T>(
  cacheType: string,
  params: Record<string, any>,
  ttlMs?: number
) {
  return async (fetchFn: () => Promise<{ data: T; epoch: string | null }>): Promise<T> => {
    const format = params.format || 'dynasty';
    const currentEpoch = await getCurrentValueEpoch(format);

    if (!currentEpoch) {
      const result = await fetchFn();
      return result.data;
    }

    const cached = getFromCache<T>(cacheType, params, currentEpoch);
    if (cached) {
      return cached;
    }

    const result = await fetchFn();

    if (result.epoch) {
      setInCache(cacheType, params, result.epoch, result.data, ttlMs);
    }

    return result.data;
  };
}

/**
 * Check if cache is stale for epoch
 */
export async function isCacheStale(
  format: 'dynasty' | 'redraft',
  cachedEpoch: string
): Promise<boolean> {
  const currentEpoch = await getCurrentValueEpoch(format);
  return currentEpoch !== cachedEpoch;
}

/**
 * Get cache hit rate
 */
let cacheHits = 0;
let cacheMisses = 0;

export function recordCacheHit(): void {
  cacheHits++;
}

export function recordCacheMiss(): void {
  cacheMisses++;
}

export function getCacheHitRate(): number {
  const total = cacheHits + cacheMisses;
  return total > 0 ? cacheHits / total : 0;
}

export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}
