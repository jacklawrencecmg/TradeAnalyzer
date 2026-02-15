/**
 * Admin Secret Authentication
 *
 * Guards admin endpoints with secret token validation.
 * Only authorized admins can access sync/rebuild/doctor tools.
 *
 * Usage:
 * ```typescript
 * import { requireAdminSecret, validateAdminAuth } from './requireAdminSecret';
 *
 * // In API handler
 * const authResult = requireAdminSecret(request);
 * if (!authResult.authorized) {
 *   return Response.json({ error: authResult.error }, { status: 401 });
 * }
 * ```
 */

/**
 * Environment variables (SERVER ONLY - NEVER expose to client)
 */
const ADMIN_SYNC_SECRET = import.meta.env.VITE_ADMIN_SYNC_SECRET;
const CRON_SECRET = import.meta.env.VITE_CRON_SECRET;

/**
 * Allowed origins (production domains only)
 */
const ALLOWED_ORIGINS = [
  'https://fdpdynasty.com',
  'https://www.fdpdynasty.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

export interface AuthResult {
  authorized: boolean;
  error?: string;
  actor?: string;
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Validate admin secret from request
 */
export function requireAdminSecret(request: Request): AuthResult {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return {
      authorized: false,
      error: 'Missing authorization token',
    };
  }

  // Validate secret
  if (!ADMIN_SYNC_SECRET) {
    console.error('ADMIN_SYNC_SECRET not configured!');
    return {
      authorized: false,
      error: 'Server configuration error',
    };
  }

  if (token !== ADMIN_SYNC_SECRET) {
    return {
      authorized: false,
      error: 'Invalid authorization token',
    };
  }

  // Check origin (best-effort CSRF protection)
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`Blocked admin request from unauthorized origin: ${origin}`);
    return {
      authorized: false,
      error: 'Unauthorized origin',
    };
  }

  return {
    authorized: true,
    actor: 'admin',
  };
}

/**
 * Validate cron secret (for scheduled tasks)
 */
export function requireCronSecret(request: Request): AuthResult {
  // Check query param secret
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');

  if (!secret) {
    // Return 404 instead of 401 to reduce probing
    return {
      authorized: false,
      error: 'Not found',
    };
  }

  // Validate secret
  if (!CRON_SECRET) {
    console.error('CRON_SECRET not configured!');
    return {
      authorized: false,
      error: 'Not found',
    };
  }

  if (secret !== CRON_SECRET) {
    return {
      authorized: false,
      error: 'Not found',
    };
  }

  // Optional: Check X-Cron header
  const cronHeader = request.headers.get('x-cron');
  if (cronHeader !== 'true') {
    console.warn('Cron request missing X-Cron header');
  }

  return {
    authorized: true,
    actor: 'cron',
  };
}

/**
 * Combined auth validator (checks both admin and cron)
 */
export function validateAuth(
  request: Request,
  allowCron: boolean = false
): AuthResult {
  // Try admin auth first
  const adminAuth = requireAdminSecret(request);
  if (adminAuth.authorized) {
    return adminAuth;
  }

  // If cron allowed, try cron auth
  if (allowCron) {
    const cronAuth = requireCronSecret(request);
    if (cronAuth.authorized) {
      return cronAuth;
    }
  }

  // Neither succeeded
  return {
    authorized: false,
    error: 'Unauthorized',
  };
}

/**
 * Check if request has valid user agent (anti-bot)
 */
export function hasValidUserAgent(request: Request): boolean {
  const userAgent = request.headers.get('user-agent');

  // Allow missing user agent for cron
  const cronHeader = request.headers.get('x-cron');
  if (cronHeader === 'true') {
    return true;
  }

  // Require user agent for regular requests
  if (!userAgent || userAgent.length < 10) {
    return false;
  }

  // Block suspicious user agents
  const suspicious = ['bot', 'crawler', 'spider', 'scraper'];
  const lowerUA = userAgent.toLowerCase();

  for (const term of suspicious) {
    if (lowerUA.includes(term)) {
      console.warn(`Blocked suspicious user agent: ${userAgent}`);
      return false;
    }
  }

  return true;
}

/**
 * Admin endpoint middleware (use in all admin routes)
 */
export async function withAdminAuth<T>(
  request: Request,
  handler: (request: Request, actor: string) => Promise<T>
): Promise<Response> {
  // Validate auth
  const authResult = requireAdminSecret(request);

  if (!authResult.authorized) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Validate user agent
  if (!hasValidUserAgent(request)) {
    return new Response(
      JSON.stringify({ error: 'Invalid user agent' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Execute handler
    const result = await handler(request, authResult.actor!);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Admin handler error:', error);

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Cron endpoint middleware (use in all cron routes)
 */
export async function withCronAuth<T>(
  request: Request,
  handler: (request: Request) => Promise<T>
): Promise<Response> {
  // Validate cron secret
  const authResult = requireCronSecret(request);

  if (!authResult.authorized) {
    // Return 404 instead of 401 to reduce probing
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Execute handler
    const result = await handler(request);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Cron handler error:', error);

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Check if service role key is being used (should only be server-side)
 */
export function isUsingServiceRole(): boolean {
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  // WARNING: Service role key should NEVER be in client code
  if (serviceRoleKey && typeof window !== 'undefined') {
    console.error('⚠️ SECURITY WARNING: Service role key detected in client code!');
    return true;
  }

  return false;
}

/**
 * Get client IP address (for rate limiting)
 */
export function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return 'unknown';
}

/**
 * Security headers (add to all responses)
 */
export function addSecurityHeaders(headers: Headers): Headers {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CSP (adjust as needed)
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );

  return headers;
}
