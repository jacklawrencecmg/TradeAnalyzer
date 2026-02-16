# FDP Policy Gate & Build/Deploy Blocker

## Overview

**Goal:** Prevent merges/deploys if any code path bypasses FDP values, and prevent production from starting if FDP values aren't fresh.

This system adds **hard gates** at multiple checkpoints to ensure FDP canonical values are always used.

---

## Components

### 1. Repo-Wide FDP Policy Scanner ✓

**File:** `scripts/fdp-policy-scan.ts`

Scans entire codebase for FDP policy violations.

**Fails build if it finds:**
- SQL queries to value tables outside `src/lib/fdp/**`
- Value calculations in rankings/trade/advice/export modules
- Endpoints returning values without `value_epoch`
- Direct imports of value tables
- Unsafe `.value` access without FDP validation

**Usage:**
```bash
npm run fdp-scan
npm test          # Includes FDP scan
npm run release   # Includes FDP scan
```

**Rules Enforced:**
1. `DIRECT_TABLE_QUERY` - No queries to value tables outside FDP module
2. `VALUE_CALCULATION` - No ad-hoc value calculations
3. `MISSING_VALUE_EPOCH` - All value responses must include epoch
4. `DIRECT_SUPABASE_IMPORT` - Business logic must use FDP interface
5. `UNSAFE_VALUE_ACCESS` - No direct `.value` access without validation

**Output:**
```
✓ FDP POLICY ENFORCED
✓ No violations found
✓ All code paths use canonical FDP values
```

Or if violations found:
```
✗ POLICY VIOLATIONS DETECTED: 3

[DIRECT_TABLE_QUERY] 2 violation(s):
  File: src/components/Rankings.tsx:45
  Rule: Direct query to latest_player_values is prohibited
  Code: const { data } = await supabase.from('latest_player_values')...

BUILD BLOCKED - FDP POLICY VIOLATIONS
```

---

### 2. Production Startup FDP Freshness Gate ✓

**File:** `src/lib/startup/validateFDPReadiness.ts`

Validates FDP values before allowing production traffic.

**Checks on server boot:**
- `latest_player_values` has > 500 players for required formats
- Values updated within 48 hours
- `value_epoch` exists and is consistent
- Required formats covered: `dynasty_1qb`, `dynasty_superflex`, `redraft`

**If validation fails:**
- Start in maintenance mode
- Block value endpoints (return 503)
- Log to console and database

**Functions:**

#### `validateFDPReadiness()`
Main validation function.

```typescript
const readiness = await validateFDPReadiness();

if (!readiness.ready) {
  console.error('FDP NOT READY:', readiness.errors);
  // Start maintenance mode
}
```

**Returns:**
```typescript
{
  ready: boolean;
  checks: {
    hasValues: boolean;      // 500+ players
    isFresh: boolean;        // < 48h old
    hasEpoch: boolean;       // epoch exists
    formatsCovered: boolean; // all formats present
  };
  details: {
    totalPlayers: number;
    lastUpdated: string;
    ageHours: number;
    valueEpoch: string;
    missingFormats: string[];
  };
  errors: string[];
}
```

#### `createMaintenanceModeMiddleware()`
Blocks value endpoints when not ready.

```typescript
const middleware = createMaintenanceModeMiddleware(readiness);

// In edge function
const blocked = middleware(req);
if (blocked) return blocked; // 503 response
```

#### `logFDPReadiness()`
Logs startup status.

```typescript
await logFDPReadiness();
```

**Console output:**
```
===========================================
       FDP READINESS CHECK
===========================================

✓ FDP VALUES READY FOR PRODUCTION
✓ Players: 1247
✓ Last Updated: 2024-02-16T10:30:00Z
✓ Age: 2.5h
✓ Epoch: abc123...
✓ Formats: All required formats available
```

Or if not ready:
```
✗ FDP VALUES NOT READY
✗ Players: 450 (min 500)
✗ Last Updated: 2024-02-14T10:30:00Z
✗ Age: 50.2h (max 48h)
✗ Epoch: Missing

Errors:
  - Insufficient players: 450 found, 500 required
  - Values are stale: 50.2h old, max 48h

⚠ STARTING IN MAINTENANCE MODE
⚠ Value endpoints will return 503
```

---

### 3. Database Hardening ✓

**Migration:** `harden_fdp_value_access_with_roles`

Role-based access control at database level.

**Changes:**
1. Created `vw_fdp_values` - Only selectable view for app roles
2. Revoked direct SELECT on value tables from `anon` and `authenticated` roles
3. Created safe functions: `get_fdp_value()` and `get_fdp_values_batch()`
4. Created `check_fdp_readiness()` for startup gate

**Security Model:**
```
┌─────────────────────────────────────┐
│  App Roles (anon, authenticated)    │
│  ↓                                   │
│  SELECT vw_fdp_values ONLY           │ ← Enforced by DB
│  ↓                                   │
│  Cannot query tables directly        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Service Role                        │
│  ↓                                   │
│  Full access to all tables           │ ← For sync operations
└─────────────────────────────────────┘
```

**Functions:**

#### `get_fdp_value(player_id, league_profile_id, format)`
Safe wrapper for single player lookup.

```sql
SELECT * FROM get_fdp_value('player_123', NULL, 'dynasty_1qb');
```

#### `get_fdp_values_batch(player_ids[], league_profile_id, format)`
Batch lookup for multiple players.

```sql
SELECT * FROM get_fdp_values_batch(
  ARRAY['p1', 'p2', 'p3'],
  NULL,
  'dynasty_1qb'
);
```

#### `check_fdp_readiness()`
Returns readiness status as JSONB.

```sql
SELECT check_fdp_readiness();

-- Returns:
{
  "ready": true,
  "player_count": 1247,
  "last_updated": "2024-02-16T10:30:00Z",
  "age_hours": 2.5,
  "has_epoch": true,
  "checked_at": "2024-02-16T13:00:00Z"
}
```

**Client Impact:**
```typescript
// ❌ BLOCKED BY DATABASE
const { data } = await supabase
  .from('latest_player_values')
  .select('*'); // Permission denied

// ✅ ALLOWED
const { data } = await supabase
  .from('vw_fdp_values')
  .select('*'); // Works through view

// ✅ BEST PRACTICE
const value = await getFDPValue(playerId); // Use interface
```

---

### 4. Contract Tests ✓

**File:** `src/tests/fdp-contract.test.ts`

API-level tests ensuring endpoints return canonical values.

**Run:**
```bash
npm run test:fdp
```

**Test Coverage:**

#### Player Values Endpoint
- ✓ Returns exact canonical values
- ✓ Includes value_epoch in all responses
- ✓ Consistent epoch across batch queries

#### Rankings Endpoint
- ✓ Values match getFDPValue() exactly
- ✓ No calculated values outside FDP
- ✓ Ranks match canonical

#### Trade Evaluation
- ✓ Uses canonical values in calculations
- ✓ No ad-hoc value modifications
- ✓ Totals match sum of canonical values

#### Export Endpoint
- ✓ Exports exact canonical values
- ✓ Includes value_epoch in exports

#### Value Epoch Consistency
- ✓ Same epoch across all endpoints
- ✓ Epoch within acceptable age (< 48h)

#### No Direct Calculation
- ✓ No endpoint bypasses getFDPValue
- ✓ Build fails if values diverge

#### Database Functions
- ✓ `get_fdp_value()` returns canonical values
- ✓ `get_fdp_values_batch()` matches TypeScript batch

**Example Test:**
```typescript
it('should return exact canonical values', async () => {
  const canonical = await getFDPValue(playerId);

  const { data } = await supabase
    .from('vw_fdp_values')
    .select('*')
    .eq('player_id', playerId)
    .single();

  // Must match exactly
  expect(data.base_value).toBe(canonical.value);
  expect(data.value_epoch_id).toBe(canonical.value_epoch);
});
```

---

## Build Pipeline Integration

### Updated Scripts

```json
{
  "fdp-scan": "tsx scripts/fdp-policy-scan.ts",
  "test": "npm run fdp-scan && vitest",
  "test:fdp": "vitest run src/tests/fdpInvariant.test.ts src/tests/fdp-contract.test.ts",
  "test:ci": "npm run fdp-scan && vitest run",
  "release": "npm run fdp-scan && npm run lint && npm run typecheck && npm run test:values && npm run test:fdp && npm run prelaunch && npm run build && npm run post-deploy"
}
```

### Build Pipeline Flow

```
┌─────────────────────────────────────┐
│  1. FDP Policy Scan                 │ ← Scans for violations
├─────────────────────────────────────┤
│  2. ESLint                          │ ← Enforces no-direct-queries
├─────────────────────────────────────┤
│  3. TypeScript                      │ ← Type safety
├─────────────────────────────────────┤
│  4. Value Tests                     │ ← Consistency tests
├─────────────────────────────────────┤
│  5. FDP Tests                       │ ← Contract tests
├─────────────────────────────────────┤
│  6. Prelaunch Checks                │ ← General validation
├─────────────────────────────────────┤
│  7. Build                           │ ← Compile
├─────────────────────────────────────┤
│  8. Post-Deploy                     │ ← Final checks
└─────────────────────────────────────┘
```

**Any failure = Build blocked**

---

## Enforcement Points

### 1. Pre-Commit
```bash
# Add to .git/hooks/pre-commit
npm run fdp-scan
```

### 2. CI/CD
```yaml
# .github/workflows/test.yml
- run: npm run fdp-scan
- run: npm run test:fdp
```

### 3. Pre-Deploy
```bash
npm run release  # Includes all FDP checks
```

### 4. Production Startup
```typescript
// In main.tsx or server startup
import { logFDPReadiness } from './lib/startup/validateFDPReadiness';

await logFDPReadiness();
```

---

## Monitoring

### Console Logs

**Policy Scan:**
```
Scanning for FDP policy violations...
Root: /project

✓ FDP POLICY ENFORCED
✓ No violations found
✓ All code paths use canonical FDP values
```

**Startup Gate:**
```
===========================================
       FDP READINESS CHECK
===========================================

✓ FDP VALUES READY FOR PRODUCTION
```

**Test Results:**
```
 ✓ src/tests/fdp-contract.test.ts (25 tests)
   ✓ Player Values Endpoint Contract
   ✓ Rankings Endpoint Contract
   ✓ Trade Evaluation Contract
```

### Database Metrics

**Table:** `system_health_metrics`

```sql
-- View readiness checks
SELECT * FROM system_health_metrics
WHERE metric_name = 'fdp_readiness_check'
ORDER BY created_at DESC;

-- View policy violations
SELECT * FROM system_health_metrics
WHERE metric_name = 'fdp_policy_violation'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Build Fails: Policy Violations

**Error:**
```
✗ POLICY VIOLATIONS DETECTED: 1

[DIRECT_TABLE_QUERY] 1 violation(s):
  File: src/components/MyComponent.tsx:23
  Rule: Direct query to latest_player_values is prohibited
```

**Fix:**
```typescript
// Remove this
const { data } = await supabase.from('latest_player_values').select('*');

// Use this
import { getFDPValue } from '../lib/fdp/getFDPValue';
const value = await getFDPValue(playerId);
```

### Production Won't Start

**Error:**
```
✗ FDP VALUES NOT READY
✗ Values are stale: 50h old, max 48h

⚠ STARTING IN MAINTENANCE MODE
```

**Fix:**
1. Run value sync: `npm run sync-values`
2. Check sync pipeline status
3. Verify database connectivity
4. Run manual rebuild if needed

### Contract Tests Fail

**Error:**
```
✗ should return exact canonical values
  Expected: 1000
  Received: 1100
```

**Fix:**
1. Check if endpoint uses getFDPValue()
2. Clear cache and retry
3. Verify no ad-hoc calculations
4. Check database consistency

---

## Summary

### What Was Built

1. **Policy Scanner** - Scans code for FDP bypasses
2. **Startup Gate** - Validates values before production
3. **Database Hardening** - Enforces access through views
4. **Contract Tests** - Verifies API returns canonical values

### Enforcement Layers

```
┌─────────────────────────────────────┐
│  Policy Scanner (Code-level)        │ ← Scans files
├─────────────────────────────────────┤
│  ESLint (Build-time)                │ ← Blocks compilation
├─────────────────────────────────────┤
│  Contract Tests (API-level)         │ ← Verifies responses
├─────────────────────────────────────┤
│  Database Views (DB-level)          │ ← Enforces access
├─────────────────────────────────────┤
│  Startup Gate (Runtime)             │ ← Blocks production
└─────────────────────────────────────┘
```

### Result

**FDP POLICY ENFORCED**

No code can:
- Query value tables directly
- Calculate values outside FDP
- Return values without epoch
- Bypass canonical interface
- Deploy with stale values
- Start production with bad data

**Zero tolerance. Zero exceptions.**
