/**
 * Rate Limiting System
 *
 * Prevents API abuse with IP-based rate limiting.
 * Uses in-memory storage (dev) or Supabase table (prod).
 *
 * Rate Limits:
 * - GET /api/rankings* → 60 req/min/IP
 * - GET /api/player/* → 120 req/min/IP
 * - POST /api/trade-eval → 30 req/min/IP
 * - GET /api/export/* → 10 req/min/IP
 *
 * Returns 429 with Retry-After header when exceeded.
 */

import { supabase } from '../supabase';
import { getClientIP } from './requireAdminSecret';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit storage (dev/fallback)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit configurations by endpoint pattern
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'GET:/api/rankings': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },
  'GET:/api/player': {
    windowMs: 60 * 1000,
    maxRequests: 120,
  },
  'POST:/api/trade-eval': {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
  'GET:/api/export': {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  'GET:/api/search': {
    windowMs: 60 * 1000,
    maxRequests: 60,
  },
  'POST:/api/trade': {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
  'default': {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
};

/**
 * Get rate limit config for endpoint
 */
function getRateLimitConfig(method: string, pathname: string): RateLimitConfig {
  const key = `${method}:${pathname}`;

  // Check exact match
  if (RATE_LIMITS[key]) {
    return RATE_LIMITS[key];
  }

  // Check prefix match
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pattern === 'default') continue;

    const [patternMethod, patternPath] = pattern.split(':');
    if (method === patternMethod && pathname.startsWith(patternPath)) {
      return config;
    }
  }

  // Default
  return RATE_LIMITS.default;
}

/**
 * Generate rate limit key
 */
function getRateLimitKey(ip: string, method: string, pathname: string): string {
  // Normalize pathname (remove trailing slash, query params)
  const normalizedPath = pathname.split('?')[0].replace(/\/$/, '');
  return `${ip}:${method}:${normalizedPath}`;
}

/**
 * Check rate limit (in-memory)
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No entry or window expired
  if (!entry || now >= entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Within window
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Check rate limit (Supabase - production)
 */
async function checkRateLimitDatabase(
  key: string,
  config: RateLimitConfig
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const now = Date.now();
  const resetAt = now + config.windowMs;

  try {
    // Get or create rate limit entry
    const { data: existing } = await supabase
      .from('rate_limits')
      .select('count, reset_at')
      .eq('key', key)
      .maybeSingle();

    // No entry or expired
    if (!existing || new Date(existing.reset_at).getTime() <= now) {
      // Upsert new entry
      await supabase
        .from('rate_limits')
        .upsert({
          key,
          count: 1,
          reset_at: new Date(resetAt).toISOString(),
        });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }

    // Check limit
    if (existing.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(existing.reset_at).getTime(),
      };
    }

    // Increment count
    await supabase
      .from('rate_limits')
      .update({ count: existing.count + 1 })
      .eq('key', key);

    return {
      allowed: true,
      remaining: config.maxRequests - existing.count - 1,
      resetAt: new Date(existing.reset_at).getTime(),
    };
  } catch (error) {
    console.error('Rate limit database error:', error);
    // Fallback to memory on error
    return checkRateLimitMemory(key, config);
  }
}

/**
 * Check rate limit
 */
export async function checkRateLimit(
  request: Request,
  useDatabase: boolean = false
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  const ip = getClientIP(request);
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  const config = getRateLimitConfig(method, pathname);
  const key = getRateLimitKey(ip, method, pathname);

  // Check limit
  const result = useDatabase
    ? await checkRateLimitDatabase(key, config)
    : checkRateLimitMemory(key, config);

  // Calculate retry-after
  const retryAfter = !result.allowed
    ? Math.ceil((result.resetAt - Date.now()) / 1000)
    : undefined;

  return {
    ...result,
    retryAfter,
  };
}

/**
 * Rate limit middleware
 */
export async function withRateLimit<T>(
  request: Request,
  handler: (request: Request) => Promise<T>,
  useDatabase: boolean = false
): Promise<Response> {
  // Check rate limit
  const rateLimit = await checkRateLimit(request, useDatabase);

  // Add rate limit headers
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': getRateLimitConfig(
      request.method,
      new URL(request.url).pathname
    ).maxRequests.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
  });

  // Rate limit exceeded
  if (!rateLimit.allowed) {
    headers.set('Retry-After', rateLimit.retryAfter!.toString());

    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: rateLimit.retryAfter,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      }),
      {
        status: 429,
        headers,
      }
    );
  }

  try {
    // Execute handler
    const result = await handler(request);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Handler error:', error);

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers,
      }
    );
  }
}

/**
 * Clear rate limits for IP (admin only)
 */
export async function clearRateLimits(ip: string): Promise<number> {
  // Clear memory
  let count = 0;
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(ip)) {
      rateLimitStore.delete(key);
      count++;
    }
  }

  // Clear database
  try {
    await supabase
      .from('rate_limits')
      .delete()
      .like('key', `${ip}:%`);
  } catch (error) {
    console.error('Error clearing rate limits:', error);
  }

  return count;
}

/**
 * Cleanup expired rate limits (run periodically)
 */
export function cleanupExpiredRateLimits(): number {
  const now = Date.now();
  let count = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Start rate limit cleanup interval
 */
export function startRateLimitCleanup(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const cleaned = cleanupExpiredRateLimits();
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired rate limit entries`);
    }
  }, intervalMs);
}

/**
 * Get rate limit stats (admin dashboard)
 */
export function getRateLimitStats(): {
  totalKeys: number;
  byIP: Record<string, number>;
  byEndpoint: Record<string, number>;
} {
  const byIP: Record<string, number> = {};
  const byEndpoint: Record<string, number> = {};

  for (const [key, entry] of rateLimitStore.entries()) {
    const [ip, method, path] = key.split(':');

    byIP[ip] = (byIP[ip] || 0) + entry.count;

    const endpoint = `${method}:${path}`;
    byEndpoint[endpoint] = (byEndpoint[endpoint] || 0) + entry.count;
  }

  return {
    totalKeys: rateLimitStore.size,
    byIP,
    byEndpoint,
  };
}

/**
 * Get rate limits for specific IP (admin)
 */
export function getRateLimitsForIP(ip: string): Array<{
  endpoint: string;
  count: number;
  resetAt: string;
}> {
  const limits: Array<{
    endpoint: string;
    count: number;
    resetAt: string;
  }> = [];

  for (const [key, entry] of rateLimitStore.entries()) {
    if (key.startsWith(ip)) {
      const [, method, path] = key.split(':');
      limits.push({
        endpoint: `${method}:${path}`,
        count: entry.count,
        resetAt: new Date(entry.resetAt).toISOString(),
      });
    }
  }

  return limits;
}

/**
 * Block IP (extreme cases only)
 */
const blockedIPs = new Set<string>();

export function blockIP(ip: string): void {
  blockedIPs.add(ip);
  console.warn(`🚫 Blocked IP: ${ip}`);
}

export function unblockIP(ip: string): void {
  blockedIPs.delete(ip);
  console.log(`✅ Unblocked IP: ${ip}`);
}

export function isIPBlocked(ip: string): boolean {
  return blockedIPs.has(ip);
}

/**
 * Check if IP is blocked
 */
export function checkIPBlock(request: Request): boolean {
  const ip = getClientIP(request);
  return isIPBlocked(ip);
}
