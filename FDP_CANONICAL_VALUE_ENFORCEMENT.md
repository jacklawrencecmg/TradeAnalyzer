# FDP Canonical Value Enforcement System

## Overview

This system **guarantees** that every displayed, calculated, exported, cached, or stored player value across the entire platform comes ONLY from the FDP canonical value system.

**Zero tolerance policy:**
- No fallback math
- No duplicated formulas
- No hidden recalculations
- No future feature can accidentally diverge

---

## Architecture

### Single Entry Point: `getFDPValue.ts`

**Location:** `src/lib/fdp/getFDPValue.ts`

This is the ONLY legal interface for player values. All features, exports, calculations, and displays MUST use these functions.

```typescript
// Single player value
const value = await getFDPValue(playerId, leagueProfileId, format);

// Batch operation (more efficient)
const values = await getFDPValuesBatch(playerIds, leagueProfileId, format);

// Dependency injection for engines
const provider = createFDPProvider(leagueProfileId, format);
```

### Value Structure

```typescript
interface FDPValue {
  player_id: string;
  value: number;                 // Final adjusted value
  tier: string;                  // Value tier
  overall_rank: number;          // Overall ranking
  pos_rank: number;             // Position ranking
  position: string;
  value_epoch: number;          // Timestamp for cache validation
  updated_at: string;           // Last update time
  league_profile_id?: string;
  format?: string;
  adjustments?: {               // Applied modifiers
    injury_discount?: number;
    availability_modifier?: number;
    temporary_boost?: number;
  };
}
```

---

## Enforcement Layers

### 1. Build-Time Enforcement (ESLint)

**Custom Rule:** `fdp-canonical/no-direct-value-queries`

**Location:** `eslint-rules/no-direct-value-queries.js`

Prevents direct queries to value tables:
- `latest_player_values`
- `player_value_history`
- `player_values`
- `ktc_value_snapshots`

**Build fails if violated.**

```javascript
// ❌ PROHIBITED - Build error
const { data } = await supabase
  .from('latest_player_values')
  .select('value');

// ✅ REQUIRED - Use canonical interface
const value = await getFDPValue(playerId);
```

### 2. Runtime Verification

**Location:** `src/lib/fdp/verifyFDPConsistency.ts`

Randomly samples 3 players from every API response and verifies against canonical values.

**If mismatch detected:**
1. Log `FDP_MISMATCH` to console and database
2. Invalidate suspect cache
3. Flag build as suspect
4. Never silently allow drift

```typescript
// Verify response consistency
const verification = await verifyFDPConsistency(response);

if (!verification.passed) {
  // Automatic remediation triggered
  console.error('FDP_DRIFT_DETECTED:', verification.errors);
}
```

**Middleware wrapper:**
```typescript
const result = await withFDPVerification(
  async () => fetchPlayerData(),
  { leagueProfileId, format }
);
```

### 3. Database Protection

**View:** `vw_public_player_values`

Public-facing view for controlled access to player values.

```sql
-- Application reads through view
SELECT * FROM vw_public_player_values WHERE player_id = '...';

-- Direct table access discouraged
-- SELECT * FROM latest_player_values; -- Use view instead
```

**Helper Functions:**
- `is_value_epoch_fresh(epoch_id)` - Check if epoch is recent
- `get_latest_value_epoch_id()` - Get current epoch for cache validation

### 4. Test Suite Enforcement

**Location:** `src/tests/fdpInvariant.test.ts`

Build MUST pass these tests:

```bash
npm run test:values
```

**Checks:**
- ✓ Single player queries return consistent values
- ✓ Batch queries match single queries
- ✓ All responses include `value_epoch`
- ✓ Verification detects mismatches
- ✓ Response consistency validation works
- ✓ Epoch timestamps are consistent

**Failure = Build blocked**

### 5. Doctor Mode Integration

**Location:** `src/lib/doctor/fdpValueDriftCheck.ts`

Automated drift detection:
- Scans cached values vs canonical
- Checks endpoint responses
- Auto-repairs cache on drift
- Generates health reports

```typescript
// Manual drift check
const driftCheck = await checkFDPValueDrift();

// Endpoint verification
const endpointCheck = await checkEndpointValueConsistency([
  '/api/player-values',
  '/api/trade-analyzer',
  '/api/rankings'
]);

// Get report for dashboard
const report = await generateDriftReport();
```

---

## Cache Isolation

All caches MUST include:
- `value_epoch` - For freshness validation
- `league_profile_id` - For profile-specific values
- `format` - For format-specific values

**Cache key format:**
```typescript
const cacheKey = `player_value_${playerId}_${leagueProfileId}_${format}_${valueEpoch}`;
```

**Auto-purge if missing epoch:**
```typescript
if (!cached.value_epoch || !is_value_epoch_fresh(cached.value_epoch)) {
  invalidateCache(playerId);
  return await getFDPValue(playerId);
}
```

---

## UI Components

### Value Epoch Badge

**Location:** `src/components/ValueEpochBadge.tsx`

Display value freshness to users:

```tsx
import { ValueEpochBadge } from './components/ValueEpochBadge';

<ValueEpochBadge
  valueEpoch={value.value_epoch}
  updatedAt={value.updated_at}
/>
```

**Shows:**
- Relative time (e.g., "2h ago")
- Freshness indicator (Fresh/Recent/Today/Stale)
- Tooltip with full epoch timestamp

**Compact mode:**
```tsx
<ValueEpochBadge valueEpoch={epoch} updatedAt={time} compact />
```

### Value Epoch Indicator

Simple status dot:

```tsx
import { ValueEpochIndicator } from './components/ValueEpochBadge';

<ValueEpochIndicator valueEpoch={value.value_epoch} />
```

---

## Dependency Injection Pattern

For trade calculators, advice engines, rankings:

```typescript
// Create provider
const fdpProvider = createFDPProvider(leagueProfileId, format);

// Inject into engine
const tradeResult = await tradeEngine(trade, fdpProvider);
const advice = await adviceEngine(roster, fdpProvider);
const rankings = await rankingEngine(teams, fdpProvider);
```

**Benefits:**
- Testable (can inject mock provider)
- Consistent values guaranteed
- No direct DB access in engines
- Clear dependency boundary

---

## Migration Guide

### Step 1: Find Direct Queries

```bash
# Search for prohibited patterns
grep -r "from('latest_player_values')" src/
grep -r "from('player_values')" src/
grep -r ".value" src/ | grep -v "getFDPValue"
```

### Step 2: Replace with Canonical Interface

**Before:**
```typescript
const { data } = await supabase
  .from('latest_player_values')
  .select('player_id, value')
  .eq('player_id', playerId)
  .single();

const value = data.value;
```

**After:**
```typescript
const fdpValue = await getFDPValue(playerId);
const value = fdpValue?.value || 0;
```

### Step 3: Add Value Epoch to Responses

**Before:**
```typescript
return {
  player_id: playerId,
  value: calculatedValue,
};
```

**After:**
```typescript
const fdpValue = await getFDPValue(playerId);
return {
  player_id: playerId,
  value: fdpValue.value,
  value_epoch: fdpValue.value_epoch,
  updated_at: fdpValue.updated_at,
};
```

### Step 4: Update UI Components

```tsx
// Add epoch badge
import { ValueEpochBadge } from './components/ValueEpochBadge';

<div className="flex items-center gap-2">
  <span className="font-bold">{value}</span>
  <ValueEpochBadge
    valueEpoch={player.value_epoch}
    updatedAt={player.updated_at}
    compact
  />
</div>
```

---

## Monitoring & Health

### Metrics Tracked

**Database:** `system_health_metrics`

- `fdp_value_mismatch` - Detected value drift
- `fdp_drift_repair` - Cache invalidation events
- `fdp_verification_failed` - Runtime check failures

### Doctor Dashboard

View drift status in doctor mode:

```
✓ No value drift detected (100 players scanned)
```

Or:

```
⚠ Value drift detected in 3 of 100 players
- Cache invalidated for 3 players
- Recommendations:
  • Clear browser cache and reload
  • Check for outdated edge function deployments
```

### Automated Repairs

System automatically:
1. Detects drift in responses
2. Logs mismatch details
3. Invalidates affected cache keys
4. Alerts via console warnings

**No manual intervention required for most cases.**

---

## Testing

### Run FDP Invariant Tests

```bash
# Full test suite
npm run test:values

# Watch mode
npm test -- src/tests/fdpInvariant.test.ts
```

### Verify Single Player

```typescript
import { verifyFDPValue } from './lib/fdp/getFDPValue';

const verification = await verifyFDPValue(playerId, claimedValue);

if (!verification.valid) {
  console.error('Value mismatch:', verification);
}
```

### Verify Response

```typescript
import { verifyFDPConsistency } from './lib/fdp/verifyFDPConsistency';

const result = await verifyFDPConsistency(apiResponse);

console.log(`Scanned: ${result.sampled}, Mismatches: ${result.mismatches}`);
```

---

## Best Practices

### DO:
✓ Always use `getFDPValue()` or `getFDPValuesBatch()`
✓ Include `value_epoch` in all value responses
✓ Use `ValueEpochBadge` in UI
✓ Inject FDP provider into engines
✓ Run tests before deploying
✓ Monitor drift metrics

### DON'T:
✗ Query value tables directly
✗ Calculate values outside getFDPValue
✗ Cache without value_epoch
✗ Skip runtime verification
✗ Ignore drift warnings
✗ Create new value calculations

---

## Troubleshooting

### Build Fails: "Direct query to value table"

**Cause:** Code directly queries a value table

**Fix:** Replace with `getFDPValue()`:
```typescript
// Replace this
const { data } = await supabase.from('latest_player_values')...

// With this
const value = await getFDPValue(playerId);
```

### Runtime Warning: "FDP_VALUE_MISMATCH"

**Cause:** Response contains non-canonical values

**Fix:**
1. Check where values are calculated
2. Replace calculation with `getFDPValue()`
3. Clear cache: `localStorage.clear()`
4. Reload application

### Test Fails: "Values not consistent"

**Cause:** Multiple code paths return different values

**Fix:**
1. Identify both code paths
2. Ensure both use `getFDPValue()`
3. Verify no caching between calls
4. Check for outdated deployments

### UI Shows Stale Values

**Cause:** Cache not respecting value_epoch

**Fix:**
```typescript
// Add epoch check to cache
if (!cached.value_epoch || cached.value_epoch < latestEpoch) {
  invalidateCache();
  return await getFDPValue(playerId);
}
```

---

## API Reference

### Core Functions

#### `getFDPValue(playerId, leagueProfileId?, format?)`
Get canonical value for single player.

**Returns:** `Promise<FDPValue | null>`

#### `getFDPValuesBatch(playerIds, leagueProfileId?, format?)`
Get canonical values for multiple players.

**Returns:** `Promise<Map<string, FDPValue>>`

#### `createFDPProvider(leagueProfileId?, format?)`
Create provider for dependency injection.

**Returns:** `FDPValueProvider`

### Verification Functions

#### `verifyFDPValue(playerId, claimedValue, leagueProfileId?, format?)`
Verify single value matches canonical.

**Returns:** `Promise<{ valid, canonical, difference }>`

#### `verifyFDPValuesBatch(values, leagueProfileId?, format?)`
Verify multiple values.

**Returns:** `Promise<{ valid, mismatches }>`

#### `verifyFDPConsistency(response, leagueProfileId?, format?)`
Verify API response consistency.

**Returns:** `Promise<VerificationResult>`

### Utility Functions

#### `withFDPVerification(handler, options?)`
Middleware wrapper for automatic verification.

**Returns:** `Promise<T>`

---

## Summary

The FDP Canonical Value Enforcement System creates **multiple layers of protection** against value drift:

1. **Build-time** - ESLint prevents direct queries
2. **Runtime** - Automatic verification of responses
3. **Database** - View-based access control
4. **Testing** - Invariant tests block bad builds
5. **Monitoring** - Doctor mode detects drift
6. **UI** - Value epoch badges show freshness

**Result:** Rock-solid value consistency across the entire platform.

**No exceptions. No workarounds. No drift.**
