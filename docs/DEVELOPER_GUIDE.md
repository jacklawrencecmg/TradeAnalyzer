# FDP Dynasty - Developer Guide

**Last Updated:** February 15, 2026
**System Version:** POST-2025 (Production-Heavy Model)
**Canonical System:** Active

---

## 🎯 Core Principle

**SINGLE SOURCE OF TRUTH:** All player values MUST come from `player_values_canonical` via the Canonical API.

**NEVER:**
- Query `player_values_canonical` directly from components
- Use `ktc_value_snapshots` for current values
- Calculate values in multiple places
- Cache values without epoch awareness

**ALWAYS:**
- Use `canonicalApi.ts` functions
- Include epoch in cache keys
- Run validation before swaps
- Test consistency across surfaces

---

## 📚 Table of Contents

1. [Value System Architecture](#value-system-architecture)
2. [How to Safely Change Rankings](#how-to-safely-change-rankings)
3. [What NOT to Touch](#what-not-to-touch)
4. [How to Debug](#how-to-debug)
5. [Adding New Features](#adding-new-features)
6. [Common Pitfalls](#common-pitfalls)
7. [Testing Requirements](#testing-requirements)

---

## 1. Value System Architecture

### 1.1 The Flow (Start to Finish)

```
┌─────────────────────────────────────────────────────┐
│                 DATA SOURCES                         │
├─────────────────────────────────────────────────────┤
│  • KTC Values (ktc_value_snapshots)                 │
│  • FantasyPros Rankings (fantasypros_cache)         │
│  • ADP Data (adp_data)                              │
│  • Player Stats (sleeper_weekly_stats)              │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│         NIGHTLY REBUILD PIPELINE                     │
│  (rebuild-player-values-v2 edge function)            │
├─────────────────────────────────────────────────────┤
│  1. Create new epoch                                 │
│  2. Load model config (weights)                      │
│  3. Load market consensus (KTC)                      │
│  4. Load all active players                          │
│  5. Calculate values:                                │
│     - Base value (market + production)               │
│     - Age curve adjustment                           │
│     - Tier assignment                                │
│  6. Calculate ranks (overall + position)             │
│  7. Write to player_values_staging                   │
│  8. Validate (coverage, duplicates, tiers, sanity)   │
│  9. Atomic swap to player_values_canonical           │
│ 10. Update epoch status                              │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│       PLAYER_VALUES_CANONICAL (SSoT)                │
│  - Single source of truth                            │
│  - One row per (player, profile, format, epoch)      │
│  - Immutable within epoch                            │
│  - Zero downtime swaps                               │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│         CANONICAL API (canonicalApi.ts)              │
│  - getPlayerValue(id, profile, format)               │
│  - getRankings(profile, format, position, limit)     │
│  - getPlayerValues(ids[], profile, format)           │
│  - getCurrentEpochId()                               │
│  - Epoch-aware caching (5min TTL)                    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              ALL SURFACES (Consistent)               │
│  • Rankings Page                                     │
│  • Player Detail                                     │
│  • Trade Calculator                                  │
│  • CSV Exports                                       │
│  • Mobile (future)                                   │
└─────────────────────────────────────────────────────┘
```

### 1.2 Value Calculation Formula (POST-2025)

```typescript
// Step 1: Get market value (from KTC)
const marketValue = ktcValueSnapshots[playerId][format];

// Step 2: Apply POST-2025 weights
const weights = {
  production: 0.65,      // Recent season performance (MAIN)
  draftCapital: 0.25,    // Rookie draft position (reduced)
  snapShare: 0.20,       // Opportunity metrics
  ageCurve: 0.10,        // Age depreciation
  depthChart: 0.05,      // Situation (minimal)
};

// Step 3: Apply age curve
const age = currentYear - rookieYear;
let adjustedValue = marketValue;

if (age > 28) {
  const agePenalty = (age - 28) * weights.ageCurve * 0.05;
  adjustedValue = Math.floor(marketValue * (1 - agePenalty));
}

// Step 4: Determine tier
let tier = 'unranked';
if (adjustedValue >= 8000) tier = 'elite';
else if (adjustedValue >= 5000) tier = 'high';
else if (adjustedValue >= 2000) tier = 'mid';
else if (adjustedValue >= 500) tier = 'low';
else tier = 'depth';

// Step 5: Calculate ranks (after all values calculated)
// Overall rank: ORDER BY adjusted_value DESC
// Position rank: ORDER BY adjusted_value DESC WHERE position = X
```

### 1.3 Epoch System

**What is an Epoch?**
An epoch is a version identifier for a rebuild. Every rebuild creates a new epoch.

**Why Epochs?**
- Safe cache invalidation (cache keys include epoch)
- Zero-downtime rebuilds (atomic swap)
- Rollback capability (keep old epoch)
- Audit trail (track changes)

**Epoch Lifecycle:**
```sql
-- Create new epoch
INSERT INTO value_epochs (status, trigger_reason, created_by)
VALUES ('building', 'nightly_rebuild', 'system')
RETURNING id;

-- Build values to staging (with epoch_id)
INSERT INTO player_values_staging (player_id, value_epoch_id, ...)
VALUES (...);

-- Validate
SELECT validate_staging_all();

-- Atomic swap
SELECT swap_player_values_atomic();

-- Mark active
UPDATE value_epochs SET status = 'active' WHERE id = new_epoch_id;
```

---

## 2. How to Safely Change Rankings

### 2.1 Changing Model Weights

**NEVER change weights directly in code. Always use model_config table.**

```sql
-- View current weights
SELECT key, value, description
FROM model_config
WHERE category = 'core_value'
ORDER BY key;

-- Update a weight
UPDATE model_config
SET value = 0.70,
    updated_at = now()
WHERE key = 'production_weight';

-- Trigger rebuild
SELECT * FROM supabase.functions.invoke('rebuild-player-values-v2');
```

**Safe Ranges:**
- `production_weight`: 0.50 - 0.80 (currently 0.65)
- `draft_capital_weight`: 0.15 - 0.35 (currently 0.25)
- `snap_share_weight`: 0.15 - 0.25 (currently 0.20)
- `age_curve_weight`: 0.05 - 0.15 (currently 0.10)
- `depth_chart_weight`: 0.03 - 0.10 (currently 0.05)

**Total MUST sum to ≤ 1.5** (enforced by database constraint)

### 2.2 Testing Weight Changes

```bash
# 1. Update weight in database
psql> UPDATE model_config SET value = 0.70 WHERE key = 'production_weight';

# 2. Run rebuild
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/rebuild-player-values-v2 \
  -H "Authorization: Bearer SERVICE_ROLE_KEY"

# 3. Check results
npm run test:values

# 4. Verify consistency
npm run prelaunch

# 5. If good, deploy
npm run build
```

### 2.3 Rollback if Needed

```sql
-- Find previous active epoch
SELECT id, epoch_number, created_at, players_processed
FROM value_epochs
WHERE status = 'active' OR status = 'superseded'
ORDER BY epoch_number DESC
LIMIT 3;

-- Rollback to previous epoch
-- (Manual process: restore player_values_canonical from backup)
-- OR trigger new rebuild with old weights
```

---

## 3. What NOT to Touch

### 3.1 CRITICAL - DO NOT MODIFY

**These will break the system:**

#### `player_values_canonical` table structure
```sql
-- NEVER change:
- Column names (player_id, adjusted_value, value_epoch_id)
- Primary key
- Epoch relationship
- RLS policies
```

#### `swap_player_values_atomic()` function
```sql
-- This function performs zero-downtime swaps
-- Changing it risks data loss or downtime
-- If you need to modify, test extensively in dev first
```

#### Canonical API function signatures
```typescript
// NEVER change signatures of:
getPlayerValue(playerId, profileId, format)
getRankings(profileId, format, position, limit)
getPlayerValues(playerIds, profileId, format)

// Adding optional parameters is OK
// Changing required parameters breaks everything
```

#### Validation thresholds
```typescript
// NEVER change without good reason:
- Coverage threshold: 90% (validates enough players)
- Elite tier: 3-10% (prevents everyone being elite)
- Sanity checks: Top players (Jefferson, Mahomes)
```

### 3.2 DANGEROUS - Proceed with Caution

**These might cause inconsistencies:**

#### Direct Database Queries in Components
```typescript
// ❌ NEVER DO THIS
const { data } = await supabase
  .from('player_values_canonical')
  .select('*')
  .eq('player_id', playerId);

// ✅ ALWAYS DO THIS
import { getPlayerValue } from '@/lib/values/canonicalApi';
const value = await getPlayerValue(playerId, null, 'dynasty');
```

#### Multiple Value Sources
```typescript
// ❌ DON'T
const ktcValue = await getKTCValue(playerId);
const fdpValue = await getFDPValue(playerId);
// Which one do you use? Inconsistent!

// ✅ DO
const value = await getPlayerValue(playerId, null, 'dynasty');
// Single source of truth
```

#### Manual Rank Calculation
```typescript
// ❌ DON'T
const sorted = values.sort((a, b) => b.value - a.value);
const rank = sorted.findIndex(v => v.id === playerId) + 1;
// Ranks should come from database

// ✅ DO
const value = await getPlayerValue(playerId, null, 'dynasty');
const rank = value.rank_overall; // Pre-calculated
```

### 3.3 SAFE - Go Ahead

**These are safe to modify:**

- UI components (as long as they use Canonical API)
- Styling and layouts
- Non-value features (chat, notifications, etc.)
- Documentation
- Tests (add more!)
- Edge function logic (not the swap function)
- Model config values (via database, not code)

---

## 4. How to Debug

### 4.1 Values Don't Match Between Surfaces

**Symptom:** Rankings show 8500, trade calc shows 8200

**Diagnosis:**
```typescript
// 1. Check current epoch
const epochId = await getCurrentEpochId();
console.log('Current epoch:', epochId);

// 2. Check value for player
const value1 = await getPlayerValue(playerId, null, 'dynasty');
console.log('Value 1:', value1);

// 3. Check if cache is stale
import { invalidateAllValueCaches } from '@/lib/cache';
invalidateAllValueCaches();

// 4. Re-fetch
const value2 = await getPlayerValue(playerId, null, 'dynasty');
console.log('Value 2:', value2);

// 5. Check database directly
const { data } = await supabase
  .from('player_values_canonical')
  .select('*')
  .eq('player_id', playerId)
  .eq('value_epoch_id', epochId);
console.log('DB value:', data);
```

**Common Causes:**
1. Stale cache → Clear cache
2. Different epochs → Rebuild didn't complete
3. Direct DB query → Use Canonical API
4. Old code → Check file hasn't been replaced

### 4.2 Rebuild Failed

**Symptom:** Rebuild edge function returns error

**Diagnosis:**
```bash
# Check system mode
psql> SELECT get_system_mode();

# If in safe_mode or maintenance
psql> SELECT set_system_mode('normal', 'Manual override', 'admin');

# Check last rebuild attempt
psql> SELECT * FROM value_epochs ORDER BY created_at DESC LIMIT 5;

# Check staging table
psql> SELECT COUNT(*) FROM player_values_staging;

# Run validation manually
psql> SELECT validate_staging_all();

# Check for errors
psql> SELECT * FROM system_health_metrics
      WHERE severity IN ('error', 'critical')
      ORDER BY created_at DESC LIMIT 10;
```

**Common Causes:**
1. System in maintenance mode → Set to normal
2. Validation failed → Check validation output
3. No market data → Check ktc_value_snapshots populated
4. Database connection → Check Supabase status

### 4.3 Running Doctor Mode

**Doctor mode automatically detects and fixes issues**

```bash
# Run audit (read-only)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/doctor-audit \
  -H "Authorization: Bearer SERVICE_ROLE_KEY"

# If issues found, run repair
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/doctor-repair \
  -H "Authorization: Bearer SERVICE_ROLE_KEY"

# Check results
psql> SELECT * FROM doctor_audit_runs ORDER BY started_at DESC LIMIT 1;
```

**What Doctor Checks:**
- Duplicate players
- Missing epochs
- Orphaned values
- Stale data
- Schema integrity
- Index health

### 4.4 Performance Issues

**Symptom:** Queries taking > 1 second

**Diagnosis:**
```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT * FROM player_values_canonical
WHERE format = 'dynasty'
  AND league_profile_id IS NULL
ORDER BY adjusted_value DESC
LIMIT 100;

-- Should use idx_pv_by_value index

-- Check table size
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'player_values%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for missing indexes
SELECT * FROM pg_stat_user_tables WHERE schemaname = 'public';
```

**Common Fixes:**
1. Add index if missing
2. Vacuum table if bloated
3. Update statistics
4. Add caching layer

---

## 5. Adding New Features

### 5.1 Adding a New Value Adjustment

**Example: Add injury discount factor**

```typescript
// Step 1: Add to model_config
INSERT INTO model_config (key, value, category, description, min_value, max_value)
VALUES (
  'injury_discount',
  0.10,
  'core_value',
  'Discount for players with injury history',
  0.0,
  0.5
);

// Step 2: Update rebuild function
// In rebuild-player-values-v2/index.ts

// Load config
const config = await loadModelConfig();
const injuryDiscount = config.injury_discount || 0.10;

// Apply in calculation
if (player.injury_history > 2) {
  adjustedValue *= (1 - injuryDiscount);
}

// Step 3: Test
npm run test:values

// Step 4: Deploy
npm run build
```

### 5.2 Adding a New Surface

**Example: Add mobile app rankings**

```typescript
// Step 1: Import Canonical API
import { getRankings } from '@/lib/values/canonicalApi';

// Step 2: Fetch data
const rankings = await getRankings(
  null,           // default profile
  'dynasty',      // format
  undefined,      // all positions
  100            // limit
);

// Step 3: Display
rankings.forEach(player => {
  console.log(`${player.rank_overall}. ${player.player_name} - ${player.adjusted_value}`);
});

// Step 4: Test consistency
npm run test:values
```

### 5.3 Adding a New Format

**Example: Add "bestball" format**

```typescript
// Step 1: Add to rebuild function
const formats = ['dynasty', 'redraft', 'bestball'];

// Step 2: Add format-specific logic
if (format === 'bestball') {
  // Bestball favors upside
  if (tier === 'high') {
    adjustedValue *= 1.1; // 10% boost
  }
}

// Step 3: Update tests
// Add bestball to test suite

// Step 4: Rebuild
curl -X POST .../rebuild-player-values-v2

// Step 5: Verify
npm run test:values
```

---

## 6. Common Pitfalls

### 6.1 Cache Staleness

**Problem:** User sees old values after rebuild

**Cause:** Cache not invalidated

**Fix:**
```typescript
// Option 1: Automatic (preferred)
// Rebuild function automatically creates new epoch
// Cache keys include epoch, so old cache is ignored

// Option 2: Manual
import { invalidateAllValueCaches } from '@/lib/cache';
invalidateAllValueCaches();
```

### 6.2 Epoch Mismatch

**Problem:** Some values from old epoch, some from new

**Cause:** Rebuild didn't complete, or query doesn't filter by current epoch

**Fix:**
```typescript
// ALWAYS use Canonical API (handles epoch automatically)
const value = await getPlayerValue(playerId, null, 'dynasty');

// If you must query directly:
const currentEpoch = await getCurrentEpochId();
const { data } = await supabase
  .from('player_values_canonical')
  .select('*')
  .eq('value_epoch_id', currentEpoch); // Filter by epoch
```

### 6.3 Direct DB Queries in Components

**Problem:** Values inconsistent, hard to debug

**Cause:** Component queries database directly

**Fix:**
```typescript
// ❌ DON'T
const { data } = await supabase
  .from('player_values_canonical')
  .select('*');

// ✅ DO
import { getRankings } from '@/lib/values/canonicalApi';
const rankings = await getRankings(null, 'dynasty');
```

### 6.4 Calculating Values in Multiple Places

**Problem:** Same player has different values

**Cause:** Value calculated in both backend and frontend

**Fix:**
- Remove frontend calculation
- Always fetch from Canonical API
- Single source of truth

---

## 7. Testing Requirements

### 7.1 Before Every Deploy

```bash
# 1. Lint
npm run lint

# 2. Type check
npm run typecheck

# 3. Value consistency tests
npm run test:values

# 4. Prelaunch validation
npm run prelaunch

# 5. Build
npm run build
```

**If ANY step fails → Deploy BLOCKED**

### 7.2 After Changing Model Weights

```bash
# 1. Rebuild with new weights
curl -X POST .../rebuild-player-values-v2

# 2. Run consistency tests
npm run test:values

# 3. Manual spot check
# - Check Justin Jefferson top-5 WR
# - Check Mahomes top-3 QB
# - Check CMC top-10 RB
# - Check tier distribution (3-10% elite)

# 4. If good, deploy
npm run build
```

### 7.3 Adding New Features

```bash
# 1. Write tests FIRST
# Add to src/tests/valueConsistency.test.ts

# 2. Implement feature

# 3. Run tests
npm run test:values

# 4. If pass, deploy
npm run build
```

---

## 🚨 Emergency Procedures

### System Down

```sql
-- Check system mode
SELECT get_system_mode();

-- If in safe_mode
SELECT set_system_mode('normal', 'Emergency restore', 'admin');
```

### Rebuild Failed Mid-Process

```sql
-- Check staging
SELECT COUNT(*) FROM player_values_staging;

-- If has data but didn't swap
-- Option 1: Manual swap (dangerous)
SELECT swap_player_values_atomic();

-- Option 2: Clear and retry
TRUNCATE player_values_staging;
-- Then trigger rebuild
```

### Values Completely Wrong

```sql
-- Rollback to previous epoch
-- 1. Find previous epoch
SELECT id FROM value_epochs
WHERE status = 'superseded'
ORDER BY epoch_number DESC
LIMIT 1;

-- 2. Mark as active
UPDATE value_epochs
SET status = 'active'
WHERE id = 'previous_epoch_id';

-- 3. Rebuild from old backup
-- (This is why we keep old epochs!)
```

---

## 📞 Need Help?

1. Check this guide
2. Run Doctor mode
3. Check system_health_metrics table
4. Review recent value_epochs
5. Check PHASES_2_7_COMPLETE.md for implementation details

---

**Remember: When in doubt, use the Canonical API. It handles epochs, caching, and consistency for you.**

**SINGLE SOURCE OF TRUTH = player_values_canonical via canonicalApi.ts**
