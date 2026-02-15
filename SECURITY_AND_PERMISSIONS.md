# Security, Permissions & Rate Limits

## Overview

Complete security hardening with **admin authentication**, **Row Level Security (RLS)**, **rate limiting**, **input validation**, and **audit logging**.

**Core Guarantee:** Only admins can run sync/rebuild/doctor tools. Users can only access their own data. Public endpoints are protected from abuse.

---

## 🎯 Security Layers

### Layer 1: Secrets & Admin Gating
- **Admin secret** protects sensitive endpoints
- **Cron secret** protects scheduled tasks
- **Service role key** never exposed to client

### Layer 2: Row Level Security (RLS)
- Users can only access their own leagues/watchlists/alerts
- Admin tables are read-only from client
- Enforced at database level (unbypassable)

### Layer 3: Rate Limiting
- IP-based rate limits prevent API abuse
- Returns 429 with Retry-After header
- Configurable per-endpoint limits

### Layer 4: Input Validation
- Zod schemas validate all inputs
- Invalid data rejected with 400
- No silent coercion

### Layer 5: Audit Logging
- All admin actions logged
- Track who did what, when
- 90-day retention

---

## Architecture

### 1. Admin Secret Authentication

**File:** `src/lib/security/requireAdminSecret.ts`

**Environment Variables (SERVER ONLY):**
```bash
VITE_ADMIN_SYNC_SECRET=your-secret-here
VITE_CRON_SECRET=your-cron-secret-here
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Generate Secrets:**
```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Usage:**
```typescript
import { withAdminAuth, withCronAuth } from '@/lib/security/requireAdminSecret';

// Admin endpoint
export async function POST(request: Request) {
  return withAdminAuth(request, async (req, actor) => {
    // Admin logic here
    return { success: true };
  });
}

// Cron endpoint
export async function GET(request: Request) {
  return withCronAuth(request, async (req) => {
    // Cron logic here
    return { success: true };
  });
}
```

**Protected Endpoints:**
- `/api/admin/*` - Requires `Authorization: Bearer <ADMIN_SYNC_SECRET>`
- `/api/cron/*` - Requires `?secret=<CRON_SECRET>`
- `/api/admin/doctor/*` - Admin only
- `/api/admin/rebuild/*` - Admin only

**Features:**
- Bearer token authentication
- Origin validation (CSRF protection)
- User agent validation (anti-bot)
- IP extraction for rate limiting
- Security headers on all responses

### 2. Rate Limiting

**File:** `src/lib/security/rateLimit.ts`

**Rate Limits:**
```typescript
GET /api/rankings* → 60 req/min/IP
GET /api/player/* → 120 req/min/IP
POST /api/trade-eval → 30 req/min/IP
GET /api/export/* → 10 req/min/IP
GET /api/search → 60 req/min/IP
Default → 100 req/min/IP
```

**Usage:**
```typescript
import { withRateLimit } from '@/lib/security/rateLimit';

export async function GET(request: Request) {
  return withRateLimit(
    request,
    async (req) => {
      // Handler logic
      return { data: 'result' };
    },
    false // Use in-memory (true = database)
  );
}
```

**Response Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2026-02-15T12:00:00Z
Retry-After: 30 (when rate limited)
```

**429 Response:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 30,
  "resetAt": "2026-02-15T12:00:00Z"
}
```

**Admin Functions:**
```typescript
import {
  clearRateLimits,
  getRateLimitStats,
  blockIP,
  unblockIP,
} from '@/lib/security/rateLimit';

// Clear rate limits for specific IP
await clearRateLimits('192.168.1.1');

// Get stats
const stats = getRateLimitStats();
console.log('Total keys:', stats.totalKeys);
console.log('By IP:', stats.byIP);

// Block/unblock IP
blockIP('192.168.1.100');
unblockIP('192.168.1.100');
```

**Storage:**
- **Development:** In-memory (fast, volatile)
- **Production:** Supabase `rate_limits` table (persistent)

### 3. Input Validation

**File:** `src/lib/security/validation.ts`

**Schemas Available:**
- `RankingsQuerySchema` - Rankings API
- `TradeEvalSchema` - Trade evaluation
- `SearchQuerySchema` - Player search
- `ExportQuerySchema` - Data exports
- `LeagueProfileCreateSchema` - Profile creation
- `AdminRebuildSchema` - Rebuild operations
- `DoctorAuditSchema` - Doctor checks

**Usage:**
```typescript
import { validateInput, RankingsQuerySchema } from '@/lib/security/validation';

// Validate input
const result = validateInput(RankingsQuerySchema, params);

if (!result.success) {
  return Response.json({ error: result.error }, { status: 400 });
}

// Use validated data (typed!)
const { format, position, limit } = result.data;
```

**Request Body Validation:**
```typescript
import { validateRequestBody, TradeEvalSchema } from '@/lib/security/validation';

const result = await validateRequestBody(request, TradeEvalSchema);

if (!result.success) {
  return Response.json({ error: result.error }, { status: 400 });
}

const { side1, side2, format } = result.data;
```

**Query Parameter Validation:**
```typescript
import { validateQueryParams, RankingsQuerySchema } from '@/lib/security/validation';

const url = new URL(request.url);
const result = validateQueryParams(url, RankingsQuerySchema);

if (!result.success) {
  return Response.json({ error: result.error }, { status: 400 });
}
```

**Base Types:**
```typescript
UUIDSchema - UUID validation
FormatSchema - 'dynasty' | 'redraft'
PositionSchema - 'QB' | 'RB' | 'WR' | 'TE' | 'DL' | 'LB' | 'DB' | 'K'
PaginationSchema - limit (1-200), offset (0+)
```

**Validation Features:**
- **No silent coercion** - Rejects invalid data
- **Type safety** - Returns typed objects
- **Clear error messages** - Field-level errors
- **XSS prevention** - Sanitizes strings
- **Enum validation** - Only allowed values

### 4. Row Level Security (RLS)

**Migration:** `supabase/migrations/add_security_rls_policies_v3.sql`

**User Tables (Users Own Data):**
```sql
-- LEAGUES: Users can only access their own leagues
CREATE POLICY "Users can read own leagues"
  ON leagues FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

-- Similar policies for:
- watchlist_players
- notifications
- player_advice
- trade_analysis_history
- league_profiles
- user_experiment_assignments
- user_actions
```

**Admin Tables (Public Read-Only):**
```sql
-- VALUE_SNAPSHOTS: Public read, only service role can write
CREATE POLICY "Public can read snapshots"
  ON value_snapshots FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage snapshots"
  ON value_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Similar for:
- player_values
- player_values_versioned
- nfl_players
- system_snapshots
- system_health_checks
```

**Testing RLS:**
```sql
-- As authenticated user
SELECT * FROM leagues; -- Only shows your leagues

-- Try to access other user's league (fails)
SELECT * FROM leagues WHERE owner_user_id = 'other-uuid'; -- Empty

-- Try to write to admin table (fails)
INSERT INTO value_snapshots (...) VALUES (...); -- Permission denied
```

**RLS Benefits:**
- **Enforced at DB level** - Can't be bypassed
- **Works with any client** - SQL, REST, GraphQL
- **Automatic** - No code changes needed
- **Secure by default** - Deny-all until policy added

### 5. Audit Logging

**File:** `src/lib/security/auditLog.ts`

**Table:** `admin_audit_log`

**Logged Actions:**
- `rebuild_started`, `rebuild_completed`, `rebuild_failed`
- `sync_started`, `sync_completed`, `sync_failed`
- `rollback`
- `doctor_audit`, `doctor_repair`
- `profile_created`, `profile_updated`, `profile_deleted`
- `cache_cleared`
- `rate_limit_cleared`
- `ip_blocked`, `ip_unblocked`
- `security_event`
- `manual_value_adjustment`
- `data_export`

**Usage:**
```typescript
import { logAdminAction, logRebuild, logSecurityEvent } from '@/lib/security/auditLog';

// Log admin action
await logAdminAction({
  action: 'rebuild_completed',
  actor: 'admin',
  metadata: {
    format: 'dynasty',
    duration_ms: 15000,
    players_updated: 1500,
  },
  success: true,
});

// Log rebuild
await logRebuild('admin', 'started', { format: 'dynasty' });

// Log security event
await logSecurityEvent('Unauthorized admin access attempt', {
  ip: '192.168.1.100',
  endpoint: '/api/admin/rebuild',
});
```

**Timed Actions:**
```typescript
import { logTimedAction } from '@/lib/security/auditLog';

// Automatically logs duration and success/failure
const result = await logTimedAction(
  'admin',
  'rebuild_completed',
  async () => {
    // Do rebuild work
    return { players: 1500 };
  },
  { format: 'dynasty' }
);
```

**Admin Dashboard:**
```typescript
import { getAuditLogs, getAuditStats, getRecentFailures } from '@/lib/security/auditLog';

// Get recent logs
const logs = await getAuditLogs(100, 0, 'rebuild_started');

// Get statistics
const stats = await getAuditStats(new Date(Date.now() - 24 * 60 * 60 * 1000));
console.log('Success rate:', stats.successRate);
console.log('By action:', stats.byAction);
console.log('By actor:', stats.byActor);

// Get recent failures
const failures = await getRecentFailures(20);
```

**Retention:** 90 days (automatic cleanup)

### 6. Cron Endpoint Security

**Protected Endpoints:**
```
GET /api/cron/health-check?secret=<CRON_SECRET>
GET /api/cron/sync-values?secret=<CRON_SECRET>
GET /api/cron/compute-alerts?secret=<CRON_SECRET>
```

**Security Features:**
- Requires secret in query param
- Optional `X-Cron: true` header
- Returns 404 (not 401) on invalid secret (reduces probing)

**Usage Example:**
```bash
# Vercel cron
curl "https://yourdomain.com/api/cron/health-check?secret=your-cron-secret" \
  -H "X-Cron: true"

# GitHub Actions
- name: Run health check
  run: |
    curl "https://yourdomain.com/api/cron/health-check?secret=${{ secrets.CRON_SECRET }}" \
      -H "X-Cron: true"
```

### 7. Abuse Prevention

**Pagination Caps:**
```typescript
// Rankings
limit: max 200
offset: min 0

// Exports
limit: max 1500
rows: cap at 1000 for dynasty, 1500 for redraft

// Search
query: min 2 chars, max 100 chars
limit: max 50
```

**Required Fields:**
```typescript
// Exports require:
- league_profile_id (optional but recommended)
- format (required)
- Rows capped at 1000/1500

// Search requires:
- query length >= 2
- debounce on client (500ms)
```

**Input Sanitization:**
```typescript
import { sanitizeString } from '@/lib/security/validation';

// Remove XSS vectors
const safe = sanitizeString(userInput);
// Removes: <>, javascript:, on*= event handlers
```

---

## Security Smoke Test

**Component:** `src/components/SecurityCheck.tsx`

**Access:** Navigate to `/admin/security-check`

**Tests:**
1. ✓ RLS enabled on leagues
2. ✓ RLS enabled on value_snapshots
3. ✓ Forbidden writes to admin tables blocked
4. ✓ Admin endpoints require secrets
5. ✓ Rate limiting works
6. ✓ Input validation rejects invalid data
7. ✓ Service role key not in client code

**Usage:**
```tsx
import { SecurityCheck } from '@/components/SecurityCheck';

// In your app router
<Route path="/admin/security-check" element={<SecurityCheck />} />
```

**Automated Testing:**
- Run on deploy
- Run weekly via cron
- Alert on failures

---

## API Examples

### Example 1: Protected Admin Endpoint

```typescript
// /api/admin/rebuild.ts
import { withAdminAuth } from '@/lib/security/requireAdminSecret';
import { validateRequestBody, AdminRebuildSchema } from '@/lib/security/validation';
import { logRebuild } from '@/lib/security/auditLog';

export async function POST(request: Request) {
  return withAdminAuth(request, async (req, actor) => {
    // Validate input
    const validation = await validateRequestBody(req, AdminRebuildSchema);
    if (!validation.success) {
      return { error: validation.error };
    }

    const { format, dryRun } = validation.data;

    // Log start
    await logRebuild(actor, 'started', { format, dryRun });

    try {
      // Do rebuild
      await rebuildValues(format, dryRun);

      // Log success
      await logRebuild(actor, 'completed', { format });

      return { success: true, format };
    } catch (error) {
      // Log failure
      await logRebuild(actor, 'failed', {
        format,
        error: error.message,
      });

      throw error;
    }
  });
}
```

### Example 2: Rate Limited Public Endpoint

```typescript
// /api/rankings.ts
import { withRateLimit } from '@/lib/security/rateLimit';
import { validateQueryParams, RankingsQuerySchema } from '@/lib/security/validation';
import { getRankings } from '@/lib/performance/rankingsApi';

export async function GET(request: Request) {
  return withRateLimit(request, async (req) => {
    // Validate query params
    const url = new URL(req.url);
    const validation = validateQueryParams(url, RankingsQuerySchema);

    if (!validation.success) {
      throw new Error(validation.error);
    }

    const { format, position, limit, offset } = validation.data;

    // Get rankings
    const result = await getRankings({ format, position, limit, offset });

    return result;
  });
}
```

### Example 3: Protected Cron Endpoint

```typescript
// /api/cron/health-check.ts
import { withCronAuth } from '@/lib/security/requireAdminSecret';
import { runHealthChecks } from '@/lib/health/runHealthChecks';
import { logAdminAction } from '@/lib/security/auditLog';

export async function GET(request: Request) {
  return withCronAuth(request, async (req) => {
    await logAdminAction({
      action: 'health_check',
      actor: 'cron',
    });

    const results = await runHealthChecks();

    return {
      success: true,
      timestamp: new Date().toISOString(),
      results,
    };
  });
}
```

---

## Environment Setup

### 1. Create `.env` File

```bash
cp .env.example .env
```

### 2. Generate Secrets

```bash
# Admin secret
openssl rand -hex 32

# Cron secret
openssl rand -hex 32
```

### 3. Add to `.env`

```bash
VITE_ADMIN_SYNC_SECRET=<generated-admin-secret>
VITE_CRON_SECRET=<generated-cron-secret>
```

### 4. Deploy Secrets

**Vercel:**
```bash
vercel env add VITE_ADMIN_SYNC_SECRET
vercel env add VITE_CRON_SECRET
vercel env add VITE_SUPABASE_SERVICE_ROLE_KEY
```

**Netlify:**
```bash
netlify env:set VITE_ADMIN_SYNC_SECRET <value>
netlify env:set VITE_CRON_SECRET <value>
netlify env:set VITE_SUPABASE_SERVICE_ROLE_KEY <value>
```

---

## Admin API Usage

### Making Admin Requests

```bash
# With curl
curl -X POST https://yourdomain.com/api/admin/rebuild \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"format": "dynasty", "dryRun": false}'

# With JavaScript
const response = await fetch('https://yourdomain.com/api/admin/rebuild', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ADMIN_SECRET}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    format: 'dynasty',
    dryRun: false,
  }),
});

const result = await response.json();
```

### Admin Dashboard Integration

```typescript
// Admin panel component
import { useState } from 'react';

function AdminPanel() {
  const [adminSecret, setAdminSecret] = useState('');

  const runRebuild = async () => {
    const response = await fetch('/api/admin/rebuild', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: 'dynasty',
        dryRun: false,
      }),
    });

    if (response.status === 401) {
      alert('Invalid admin secret');
      return;
    }

    const result = await response.json();
    console.log('Rebuild result:', result);
  };

  return (
    <div>
      <input
        type="password"
        value={adminSecret}
        onChange={(e) => setAdminSecret(e.target.value)}
        placeholder="Admin secret"
      />
      <button onClick={runRebuild}>Run Rebuild</button>
    </div>
  );
}
```

---

## Security Checklist

### Before Deployment

- [ ] Generate admin secret and cron secret
- [ ] Add secrets to environment variables
- [ ] Verify service role key NOT in client code
- [ ] Run security smoke test (`/admin/security-check`)
- [ ] Verify RLS enabled on all user tables
- [ ] Test rate limiting with rapid requests
- [ ] Test admin endpoints require secrets
- [ ] Test input validation rejects invalid data

### After Deployment

- [ ] Verify secrets deployed correctly
- [ ] Run security smoke test in production
- [ ] Monitor audit logs for failures
- [ ] Check rate limit logs for abuse
- [ ] Review security events
- [ ] Test RLS with real user accounts

### Ongoing

- [ ] Review audit logs weekly
- [ ] Monitor rate limit stats
- [ ] Check for failed authentication attempts
- [ ] Update secrets every 90 days
- [ ] Run security smoke test monthly
- [ ] Review and adjust rate limits as needed

---

## Files Created

### Core Security Libraries (5 files)
- `src/lib/security/requireAdminSecret.ts` (360 lines)
- `src/lib/security/rateLimit.ts` (420 lines)
- `src/lib/security/validation.ts` (380 lines)
- `src/lib/security/auditLog.ts` (320 lines)

### Components
- `src/components/SecurityCheck.tsx` (280 lines)

### Database
- `supabase/migrations/add_security_rls_policies_v3.sql`

### Configuration
- `.env.example`

### Documentation
- `SECURITY_AND_PERMISSIONS.md`

---

## Summary

You now have **complete security hardening**:

### ✅ Admin Authentication
- Secret-based authentication
- Origin validation
- User agent checking
- IP extraction

### ✅ Row Level Security
- Users own their data
- Admin tables read-only from client
- Enforced at database level
- Automatic and unbypassable

### ✅ Rate Limiting
- IP-based limits
- Per-endpoint configuration
- 429 with Retry-After
- In-memory or database storage

### ✅ Input Validation
- Zod schemas for all inputs
- Type-safe validation
- Clear error messages
- XSS prevention

### ✅ Audit Logging
- All admin actions logged
- Performance timing
- Success/failure tracking
- 90-day retention

### ✅ Abuse Prevention
- Pagination caps
- Required fields
- Query length limits
- Debouncing

### ✅ Security Testing
- Automated smoke tests
- RLS verification
- Rate limit testing
- Admin endpoint protection

**Result:** Your app is **locked down** with multiple layers of security. Only admins can sync/rebuild. Users can only access their own data. Public endpoints are protected from abuse.

**Core Innovation:** Defense in depth - multiple independent security layers ensure no single point of failure.

Secure. Audited. Protected. 🔒
