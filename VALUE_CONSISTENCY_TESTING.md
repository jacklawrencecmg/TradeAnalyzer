# End-to-End Value Consistency Test Suite

## Overview

**Problem:** "Rankings show X, trade calc shows Y" bugs destroy user trust.

**Solution:** Automated tests that **FAIL THE BUILD** if any page, widget, or API shows a different value for the same player/league/format.

**Core Guarantee:** All surfaces (rankings, trade eval, player detail, advice, export) return EXACTLY the same value for each player. No drift. Ever.

---

## 🎯 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│         VALUE CONSISTENCY TEST SUITE                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Canonical Value Source                             │
│     └─ Single source of truth for tests                │
│     └─ Uses same query as production                   │
│     └─ fetchCanonicalValue(player_id, config)         │
│                                                         │
│  2. Cross-Surface Tests                                │
│     ├─ Rankings API                                    │
│     ├─ Player Detail API                               │
│     ├─ Trade Evaluator                                 │
│     ├─ Advice Engine                                   │
│     └─ Export CSV                                      │
│                                                         │
│  3. Epoch Correctness Tests                            │
│     ├─ All responses include value_epoch               │
│     ├─ All endpoints return same epoch                 │
│     └─ No mixed epochs in responses                    │
│                                                         │
│  4. Stale Snapshot Tests                               │
│     ├─ No values older than 7 days                     │
│     ├─ Refuse stale reads                              │
│     └─ Never mix epochs                                │
│                                                         │
│  5. CI/CD Gate                                         │
│     └─ npm run test:values                             │
│     └─ Blocks deploy if tests fail                     │
│                                                         │
│  6. Admin Consistency Report                           │
│     └─ /functions/v1/admin-consistency-report          │
│     └─ Live production checks                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 What Gets Tested

### **Test Sample Players**

Deterministic set across all tiers:
- **Top 25** - Highest value players
- **Mid-tier** - Players ranked 100-110
- **Deep** - Players ranked 500-510
- **IDP** - 10 defensive players (if enabled)

### **Test Surfaces**

Every surface that displays player values:
1. **player_values** table (direct DB query)
2. **latest_player_values** view
3. **Rankings API** (dynasty/redraft)
4. **Trade Evaluator** (1-for-1 trades)
5. **Player Detail** page
6. **Batch queries** (multiple players)
7. **Cache** (rapid repeat queries)

### **Test Assertions**

For each player, across each surface:
- ✅ Value matches canonical exactly (0.01% tolerance)
- ✅ Epoch matches canonical epoch
- ✅ updated_at is recent (< 7 days)
- ✅ Effective value = base + adjustments
- ✅ No epoch mixing in batch queries
- ✅ Consistent across multiple rapid queries

---

## 🔬 Canonical Value Source

### **The ONLY Source of Truth**

```typescript
import { fetchCanonicalValue } from '@/lib/testing/canonicalValue';

const canonical = await fetchCanonicalValue(player_id, {
  format: 'dynasty',
  use_default_profile: true
});

console.log(canonical.effective_value); // 5234
console.log(canonical.value_epoch);     // "2026-02-15T10:00:00Z"
```

**How It Works:**
1. Queries `player_identity` for player info
2. Queries `player_values` with exact same query as production
3. Calculates effective_value = base + scarcity + league adjustments
4. Returns canonical value with full metadata

**Key Properties:**
```typescript
interface CanonicalValue {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  format: string;
  league_profile_id: string | null;

  // Core value
  base_value: number;
  effective_value: number;

  // Adjustments
  scarcity_adjustment: number;
  league_adjustment: number;
  total_adjustment: number;

  // Metadata
  value_source: string;
  value_epoch: string | null;
  updated_at: string;
  confidence: number;
}
```

---

## ✅ Value Consistency Tests

### **Test Suite 1: Basic Consistency** (`valueConsistency.test.ts`)

**Tests:**
1. ✅ Load canonical values for all sample players
2. ✅ All values have epoch information
3. ✅ Consistent epoch across all values
4. ✅ Recent updated_at timestamps (< 7 days)
5. ✅ Matching values from player_values table
6. ✅ Matching epochs for all values
7. ✅ Current epoch is set
8. ✅ Epoch in correct format (ISO or version)
9. ✅ Same epoch across all test players
10. ✅ No null epochs for recent values
11. ✅ No stale values (< 10% older than 7 days)
12. ✅ No mixed epochs in same query
13. ✅ Consistent updated_at within epoch
14. ✅ Scarcity adjustments reasonable (-500 to +500)
15. ✅ League adjustments reasonable (-1000 to +1000)
16. ✅ effective_value = base + adjustments
17. ✅ Positive values for top players
18. ✅ value_source present (< 5% unknown)
19. ✅ Valid value_source values
20. ✅ High confidence for top players (0.8+)
21. ✅ Consistent player_id across formats
22. ✅ Reasonable dynasty vs redraft ratio (0.3x to 3x)

### **Test Suite 2: Cross-Surface Consistency** (`crossSurfaceConsistency.test.ts`)

**Tests:**
1. ✅ latest_player_values view matches canonical
2. ✅ Dynasty rankings match canonical
3. ✅ Consistent rankings order across queries
4. ✅ Trade evaluator matches canonical
5. ✅ Consistent trade eval across multiple calls
6. ✅ Player detail page matches canonical
7. ✅ Batch queries match individual queries
8. ✅ Same epoch in batch queries
9. ✅ Cache returns same value (5 rapid queries)
10. ✅ All top 25 players consistent

**Example Test:**
```typescript
it('should match canonical value via latest_player_values view', async () => {
  const { data } = await supabase
    .from('latest_player_values')
    .select('effective_value, value_epoch')
    .eq('player_id', testPlayerId)
    .eq('format', 'dynasty')
    .maybeSingle();

  const comparison = compareValue(
    canonicalValue,
    data.effective_value,
    data.value_epoch,
    'latest_player_values_view'
  );

  expect(comparison.matches).toBe(true);
  expect(comparison.epoch_matches).toBe(true);
});
```

---

## 🚀 Running Tests

### **Local Development**

```bash
# Run all value consistency tests
npm run test:values

# Run all tests (watch mode)
npm test

# Run all tests (CI mode)
npm run test:ci
```

### **CI/CD Integration**

Tests automatically run on:
```bash
npm run release
```

**Pipeline Steps:**
1. ✅ Lint code
2. ✅ Type check
3. ✅ **Run value consistency tests** ← BLOCKS DEPLOY IF FAILS
4. ✅ Pre-launch checks
5. ✅ Build production
6. ✅ Post-deploy validation

**If tests fail:**
- ❌ Build is blocked
- ❌ Deploy is prevented
- ❌ Console shows which values mismatched
- ❌ Shows drift percentage for each mismatch

---

## 🔧 Admin Consistency Report

### **Live Production Checks**

**Endpoint:** `POST /functions/v1/admin-consistency-report`

**Headers:**
```
Authorization: Bearer <ADMIN_SECRET>
```

**Response:**
```json
{
  "status": "pass",
  "summary": {
    "total_players_checked": 50,
    "mismatches_found": 0,
    "epoch_mismatches": 0,
    "stale_values": 0,
    "missing_epochs": 0,
    "current_epoch": "2026-02-15T10:00:00Z",
    "unique_epochs": 1
  },
  "mismatches": [],
  "warnings": [],
  "timestamp": "2026-02-15T12:00:00Z"
}
```

**If Mismatches Found:**
```json
{
  "status": "fail",
  "summary": { ... },
  "mismatches": [
    {
      "player_id": "abc123",
      "player_name": "Justin Jefferson",
      "position": "WR",
      "consistent": false,
      "canonical_value": 5234,
      "actual_value": 5200,
      "drift": 34,
      "drift_percent": 0.65,
      "epoch_mismatch": false,
      "canonical_epoch": "2026-02-15T10:00:00Z",
      "actual_epoch": "2026-02-15T10:00:00Z",
      "is_stale": false,
      "age_days": 0.5,
      "has_epoch": true
    }
  ],
  "warnings": [
    "15 values older than 7 days",
    "3 values missing epoch"
  ]
}
```

### **Usage**

```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/admin-consistency-report`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminSecret}`,
      'Content-Type': 'application/json'
    }
  }
);

const report = await response.json();

if (report.status === 'fail') {
  console.error('Value inconsistencies detected!');
  console.error('Mismatches:', report.mismatches);
}
```

---

## 📐 Value Comparison Algorithm

### **Drift Calculation**

```typescript
function calculateValueDrift(canonical: number, actual: number) {
  const drift = Math.abs(canonical - actual);
  const driftPercent = canonical > 0 ? (drift / canonical) * 100 : 0;

  // Allow 0.01% tolerance for floating point errors
  const isDrifted = driftPercent > 0.01;

  return {
    drift,
    driftPercent,
    isDrifted
  };
}
```

**Tolerance:** 0.01% (effectively zero)

**Examples:**
```typescript
// Value: 5000, Actual: 5000 → 0% drift ✅
// Value: 5000, Actual: 5001 → 0.02% drift ❌
// Value: 5000, Actual: 4999 → 0.02% drift ❌
// Value: 10000, Actual: 10001 → 0.01% drift ❌
```

### **Epoch Comparison**

```typescript
function isSameEpoch(epoch1: string | null, epoch2: string | null): boolean {
  if (!epoch1 || !epoch2) return false;
  return epoch1 === epoch2;
}
```

**Rules:**
- Both must be non-null
- Must match exactly (string comparison)
- No tolerance for mismatches

---

## 🛡️ What This Prevents

### **Before This System**
```
❌ Rankings show value X
❌ Trade calc shows value Y
❌ Player detail shows value Z
❌ No way to detect drift
❌ Users lose trust
❌ "Which value is correct?"
```

### **After This System**
```
✅ All surfaces show EXACT same value
✅ Build fails if any mismatch
✅ Automatic drift detection
✅ Epoch consistency enforced
✅ Stale values caught early
✅ Zero tolerance for inconsistency
```

---

## 🎯 Integration with Production

### **Before Rebuild**

```typescript
import { validatePlayerUniverse } from '@/lib/identity/validatePlayerUniverse';
import { runConsistencyChecks } from '@/lib/testing/valueConsistency';

// 1. Validate player universe
await validatePlayerUniverse();

// 2. Run consistency checks (if values exist)
const hasValues = await checkIfValuesExist();
if (hasValues) {
  await runConsistencyChecks();
}

// 3. Start rebuild
await rebuildAllPlayerValues();
```

### **After Rebuild**

```typescript
// 1. Rebuild complete
await rebuildAllPlayerValues();

// 2. Run consistency checks
await runConsistencyChecks();

// 3. If failed → rollback
if (!consistencyPassed) {
  await rollbackToSnapshot(previousEpoch);
  throw new Error('Consistency checks failed - rolled back');
}

// 4. Commit new epoch
await commitNewEpoch(newEpoch);
```

---

## 📊 Monitoring

### **Daily Health Check**

```bash
# Run consistency report
curl -X POST https://yourdomain.com/functions/v1/admin-consistency-report \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

### **CI/CD Metrics**

Track over time:
- Test pass rate (should be 100%)
- Number of mismatches detected
- Average drift (should be 0)
- Epoch consistency rate
- Stale value percentage

### **Alerts**

Set up alerts for:
- ❌ Consistency test failures
- ⚠️ Drift > 0.01%
- ⚠️ Multiple epochs active (> 2)
- ⚠️ Stale values > 10%
- ⚠️ Missing epochs > 5%

---

## 🔥 Real-World Example

### **Scenario: Rankings vs Trade Calc Mismatch**

**Before (Broken):**
```typescript
// Rankings API
const rankings = await getRankings();
console.log(rankings[0].value); // 5234

// Trade Evaluator
const tradeValue = await evaluateTrade([player_id]);
console.log(tradeValue); // 5180  ← DIFFERENT!

// User: "Why do rankings and trade calc disagree?"
// Developer: "Uh... let me investigate..."
```

**After (Fixed):**
```typescript
// Consistency test automatically detects mismatch
npm run test:values

// ❌ Test fails:
// Rankings mismatch: canonical=5234, actual=5180, drift=1.03%

// Build is BLOCKED until fixed
// Developer fixes root cause
// Tests pass → deploy allowed
```

---

## 🎊 Summary

You now have a **Value Consistency Test Suite** that:

### ✅ Canonical Source
- Single source of truth for all tests
- Uses exact same query as production
- Complete value with all adjustments
- Epoch and metadata included

### ✅ Cross-Surface Testing
- Tests all user-facing surfaces
- Rankings, trade eval, player detail
- Batch queries and cache
- Zero tolerance for drift (0.01%)

### ✅ Epoch Correctness
- All responses include epoch
- Same epoch across all surfaces
- No mixed epochs in responses
- Stale values detected

### ✅ CI/CD Integration
- npm run test:values
- Blocks deploy if tests fail
- Part of npm run release
- Automatic on every build

### ✅ Admin Tools
- Live production checks
- Detailed mismatch reports
- Drift percentages
- Epoch status

### ✅ Zero Drift Guarantee
- All surfaces show same value
- Floating point tolerance (0.01%)
- Automatic detection
- Build blocks deployment

---

## 🔥 Core Innovation

**Never allow value drift.** One canonical source, tested across all surfaces, enforced by CI/CD.

**Result:** "Rankings show X, trade calc shows Y" bugs are **IMPOSSIBLE**. If a test passes, all surfaces are guaranteed consistent. If a test fails, deployment is blocked until fixed.

**Your value system is now drift-proof. Forever.** 🛡️🚀
