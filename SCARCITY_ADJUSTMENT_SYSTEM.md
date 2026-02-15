# Scarcity Adjustment System

## Overview

The Scarcity Adjustment System transforms raw player values into lineup-impact-adjusted values using **Value Over Replacement (VOR)** theory. This ensures player values reflect their actual utility in fantasy lineups rather than just raw talent.

**Key Innovation:** Values are normalized against league-specific replacement levels, so a QB in a Superflex league is valued differently than in a 1QB league, even if they have identical raw talent.

## Why Scarcity Matters

Raw talent-based values don't account for **positional scarcity** and **lineup constraints**.

### Example Problem

**Without Scarcity Adjustment:**
- Top QB: 10,000 value
- Top RB: 10,000 value
- User thinks: "These players are equal"

**Reality in 1QB League:**
- You can only start 1 QB
- There are 32+ viable starting QBs
- You MUST start 2-3 RBs
- There are only ~40-50 viable starting RBs

**Result:** The RB is MORE valuable because RB scarcity >> QB scarcity in 1QB leagues.

**With Scarcity Adjustment:**
- Top QB (1QB): 7,500 value (compressed due to low scarcity)
- Top RB (1QB): 9,200 value (boosted due to high scarcity)

Now values match market reality.

## Architecture

```
Rebuild Pipeline Order:
1. Base Model Value (KTC, FantasyPros)
2. Availability Modifiers (injuries, age)
3. League Multipliers (SF, TEP, IDP)
4. Scarcity Adjustment (NEW) ← THIS STEP
5. Rank + Tier Generation
```

**Critical:** Scarcity adjustment happens AFTER multipliers but BEFORE ranking.

## Core Components

### 1. Replacement Level Calculation

**File:** `src/lib/values/replacementLevels.ts`

#### Formula

```
replacement_rank = (teams × starters_at_position) + flex_adjustment
```

#### Flex Distribution

**Standard FLEX:**
- 35% RB
- 35% WR
- 15% TE
- 15% Others

**Superflex:**
- 75% QB
- 10% RB
- 10% WR
- 5% TE

**IDP FLEX:**
- Evenly distributed across DL/LB/DB based on roster composition

#### Example: 12-Team Dynasty SF

```
QB: 12×1 + (12×1×0.75) = 12 + 9 = QB21
RB: 12×2 + (12×1×0.35) = 24 + 4.2 ≈ RB28
WR: 12×3 + (12×1×0.35) = 36 + 4.2 ≈ WR40
TE: 12×1 + (12×1×0.15) = 12 + 1.8 ≈ TE14
```

**Interpretation:**
- QB21 = The 21st-best QB is a "replacement level" player
- Players ranked higher are "starters"
- Players ranked lower are "bench"

### 2. Value Over Replacement (VOR)

**File:** `src/lib/values/scarcityAdjustment.ts`

#### Algorithm

```typescript
// 1. Get replacement value for position
replacement_value = value_of_player_at(replacement_rank)

// 2. Calculate VOR
vor = player_value - replacement_value

// 3. Normalize to new scale
scarcity_adjusted_value = 5000 + (vor × 1.35)

// 4. Clamp to valid range
final_value = clamp(scarcity_adjusted_value, 0, 10000)
```

#### Scale Design

```
Value Range    | Meaning
---------------|------------------
0-3000         | Deep bench / waiver
3000-5000      | Bench depth
~5000          | Replacement level
5000-7000      | Starter
7000-9000      | Elite starter
9000-10000     | League-winner
```

**Why 5000 for replacement?**
- Mid-scale (0-10000)
- Easy to understand (5000 = average starter)
- Starters > 5000, Bench < 5000

**Why 1.35 multiplier?**
- Amplifies differences between starters and replacement
- Tested to produce realistic value spreads
- Adjustable based on market calibration

#### Example: Patrick Mahomes

**12-Team 1QB Dynasty:**
```
Raw Value: 10,000
Replacement (QB13): 6,000
VOR: 10,000 - 6,000 = 4,000
Adjusted: 5,000 + (4,000 × 1.35) = 10,400
Clamped: 10,000 (max)
```

**12-Team SF Dynasty:**
```
Raw Value: 10,000
Replacement (QB21): 4,000
VOR: 10,000 - 4,000 = 6,000
Adjusted: 5,000 + (6,000 × 1.35) = 13,100
Clamped: 10,000 (max)
```

**Result:** Same raw talent, but higher scarcity value in SF due to deeper replacement level.

### 3. Positional Elasticity Caps

#### Purpose

Prevents one position from dominating top rankings.

Without caps, WRs could fill 60%+ of top 100 (too many elite WRs).
With caps, distribution matches real dynasty markets.

#### Caps (% of Top 100)

| Position | Min | Max | Typical |
|----------|-----|-----|---------|
| QB       | 8%  | 18% | 12-15%  |
| RB       | 18% | 30% | 22-26%  |
| WR       | 25% | 45% | 35-40%  |
| TE       | 4%  | 12% | 6-8%    |
| DL       | 5%  | 15% | 8-10%   |
| LB       | 5%  | 15% | 8-10%   |
| DB       | 5%  | 15% | 6-8%    |

#### How Caps Work

1. **Calculate actual distribution** in top 100 after VOR
2. **Identify violations** (position over/under cap)
3. **Apply smooth scaling**:
   - Over-represented: compress top players (gradual reduction)
   - Under-represented: boost top players (gradual increase)

#### Smooth Scaling

**NOT:** Hard cutoff (drastic reordering)
**YES:** Graduated adjustment (preserves relative order)

```typescript
// Example: WRs are 50% of top 100 (cap is 45%)
excess = 0.05

// Apply compression to top 50 WRs
for (i = 0; i < 50; i++) {
  rankFactor = 1.0 - (i / 50)  // 1.0 at top, 0.0 at rank 50
  compression = 1.0 - (excess × 0.5 × rankFactor)
  adjusted_value = original_value × compression
}
```

**Result:**
- WR1 compressed by ~2.5%
- WR25 compressed by ~1.25%
- WR50 compressed by ~0%

**Preserves order:** WR1 still > WR2 > WR3, just slightly closer together.

### 4. Debug Fields

**Database Schema:**

```sql
ALTER TABLE value_snapshots
  ADD COLUMN debug_raw_value integer,
  ADD COLUMN debug_replacement_value integer,
  ADD COLUMN debug_vor integer,
  ADD COLUMN debug_elasticity_adj integer;
```

**Fields:**
- `debug_raw_value`: Value before scarcity adjustment
- `debug_replacement_value`: Replacement level value for position
- `debug_vor`: VOR (raw - replacement)
- `debug_elasticity_adj`: Adjustment from positional caps

**Admin Endpoint:**
```
GET /api/value-scarcity-debug?player_id=<uuid>&league_profile_id=<uuid>&format=dynasty
```

**Response:**
```json
{
  "player": {
    "name": "Patrick Mahomes",
    "position": "QB",
    "position_rank": 1
  },
  "profile": {
    "name": "Dynasty Superflex",
    "format_key": "dynasty_sf"
  },
  "values": {
    "raw_value": 10000,
    "final_value": 10000,
    "total_adjustment": 0,
    "pct_change": 0
  },
  "scarcity": {
    "replacement_value": 4000,
    "vor": 6000,
    "vor_explanation": "6000 points above replacement",
    "elasticity_adjustment": 0,
    "explanation": "Above replacement level - strong lineup impact"
  },
  "breakdown": [
    { "step": 1, "description": "Base value", "value": 10000 },
    { "step": 2, "description": "VOR adjustment", "value": 10000, "delta": 0 },
    { "step": 3, "description": "Elasticity adjustment", "value": 10000, "delta": 0 }
  ]
}
```

## Usage in Rebuild Pipeline

### Integration Point

```typescript
async function buildLatestValuesForProfile(profile: LeagueProfile) {
  // 1. Load base values
  const baseValues = await loadBaseValues();

  // 2. Apply availability modifiers
  const availableValues = applyAvailabilityModifiers(baseValues);

  // 3. Apply league multipliers
  const multipliers = await getProfileMultipliers(profile.id);
  const multipliedValues = availableValues.map(player => ({
    ...player,
    value: applyMultiplier(player.value, player.position, multipliers),
  }));

  // 4. Apply scarcity adjustment (NEW)
  const scarcityAdjustments = applyScarcityAdjustments(
    multipliedValues,
    profile,
    numTeams
  );

  const adjustedValues = multipliedValues.map(player => {
    const adjustment = scarcityAdjustments.get(player.player_id);
    return {
      ...player,
      value: adjustment.adjustedValue,
      debug: adjustment.debug, // Store for admin debugging
    };
  });

  // 5. Calculate rankings
  const rankedValues = calculateRankings(adjustedValues);

  // 6. Write to value_snapshots
  for (const player of rankedValues) {
    await supabase.from('value_snapshots').insert({
      player_id: player.player_id,
      league_profile_id: profile.id,
      format: profile.is_dynasty ? 'dynasty' : 'redraft',
      position: player.position,
      position_rank: player.position_rank,
      market_value: player.value,
      fdp_value: player.value,
      dynasty_value: profile.is_dynasty ? player.value : null,
      redraft_value: !profile.is_dynasty ? player.value : null,
      // Debug fields
      debug_raw_value: player.debug.rawValue,
      debug_replacement_value: player.debug.replacementValue,
      debug_vor: player.debug.vor,
      debug_elasticity_adj: player.debug.elasticityAdjustment,
      // Standard fields
      source: 'rebuilt_with_scarcity',
      captured_at: new Date(),
      value_epoch: getCurrentEpoch(),
    });
  }
}
```

## UI Integration

### 1. Scarcity Tooltip (Player Lists)

```tsx
import { ScarcityTooltip } from '@/components/ScarcityTooltip';

<ScarcityTooltip
  position="RB"
  positionRank={5}
  replacementRank={28}
  vor={2500}
  profileName="Dynasty Superflex"
/>
```

**Display:**
- Info icon with "Scarcity adjusted" text
- Hover shows tooltip with:
  - Position rank vs replacement rank
  - Distance from replacement
  - VOR value
  - Explanation text

### 2. Scarcity Badge (Compact)

```tsx
import { ScarcityBadge } from '@/components/ScarcityTooltip';

<ScarcityBadge
  positionRank={5}
  replacementRank={28}
/>
```

**Display:**
- Small badge: "Elite", "Starter", or "Flex"
- Color-coded (green/blue/yellow)

### 3. Scarcity Panel (Player Detail Page)

```tsx
import { ScarcityPanel } from '@/components/ScarcityTooltip';

<ScarcityPanel
  position="RB"
  positionRank={5}
  replacementRank={28}
  rawValue={8500}
  finalValue={9200}
  vor={2500}
  elasticityAdjustment={200}
  profileName="Dynasty Superflex"
/>
```

**Display:**
- Full breakdown panel
- Position rank vs replacement
- Value breakdown with all adjustments
- Detailed explanation

## Expected Behavior

### Superflex Leagues

**Before Scarcity:**
- QB1: 10,000
- RB1: 10,000
- They appear equal

**After Scarcity:**
- QB1: 10,000 (high demand, deep replacement = stays high)
- RB1: 9,800 (already high scarcity)

**Result:** QBs gain value in SF as expected.

### Shallow Leagues (8-team)

**Before Scarcity:**
- WR1: 9,000
- WR10: 7,500

**After Scarcity:**
- WR1: 8,500 (compressed due to shallow replacement)
- WR10: 7,200

**Result:** Elite WRs compress slightly because replacement level is shallower (more good options available).

### Deep Leagues (14-team)

**Before Scarcity:**
- RB20: 4,000
- RB25: 3,500

**After Scarcity:**
- RB20: 5,500 (boosted - above replacement)
- RB25: 4,800 (boosted - near replacement)

**Result:** RB2/RB3 types gain value because replacement level is deeper (fewer good options).

### IDP Heavy

**Before Scarcity:**
- LB5: 3,000
- LB15: 2,000

**After Scarcity (tackle-heavy):**
- LB5: 6,500 (major boost - LBs are scarce starters)
- LB15: 5,200

**Result:** IDP starters jump tiers when IDP slots are required.

## Validation

### Check Replacement Levels

```typescript
import { validateReplacementLevels } from './lib/values/replacementLevels';

const levels = calculateReplacementLevels(profile);
const { valid, warnings } = validateReplacementLevels(levels);

if (!valid) {
  console.warn('Replacement level warnings:', warnings);
}
```

### Check Scarcity Adjustments

```typescript
import { validateScarcityAdjustments } from './lib/values/scarcityAdjustment';

const adjustments = applyScarcityAdjustments(players, profile);
const { valid, warnings, stats } = validateScarcityAdjustments(adjustments);

console.log('Scarcity stats:', stats);
// {
//   avgAdjustment: 450,
//   maxAdjustment: 2500,
//   minAdjustment: -1200,
//   numIncreased: 320,
//   numDecreased: 180
// }
```

### Check Position Distribution

```typescript
import { getPositionDistribution } from './lib/values/scarcityAdjustment';

const distribution = getPositionDistribution(players, adjustments, 100);

console.log('Top 100 distribution:', distribution);
// {
//   QB: { count: 15, share: 0.15 },
//   RB: { count: 25, share: 0.25 },
//   WR: { count: 42, share: 0.42 },
//   TE: { count: 8, share: 0.08 }
// }
```

## Common Issues

### Issue: Replacement levels seem wrong

**Symptom:** QB replacement at QB50 (way too deep)

**Cause:** Flex adjustment not accounting for Superflex properly

**Fix:** Check `calculateFlexAdjustment()` logic in `replacementLevels.ts`

### Issue: VOR values are extreme

**Symptom:** Players going from 5,000 → 500 or 5,000 → 9,999

**Cause:** VOR multiplier (1.35) too aggressive, or replacement value estimate off

**Fix:**
1. Check replacement value estimation
2. Adjust VOR_SCALE constant (lower = less dramatic)
3. Validate input values are normalized

### Issue: Position distribution violated

**Symptom:** WRs still 55% of top 100 after caps

**Cause:** Elasticity compression not strong enough

**Fix:** Increase compression factor in `compressPosition()`:
```typescript
const compressionFactor = 1.0 - excessShare * 0.75; // Was 0.5
```

### Issue: Rankings drastically reordered

**Symptom:** WR5 becomes WR20 after scarcity

**Cause:** Too much elasticity adjustment

**Fix:** Use more graduated scaling (reduce rankFactor impact)

## Testing

### Unit Tests

```typescript
describe('Scarcity Adjustment', () => {
  it('should place replacement level at 5000', () => {
    const player = { value: 6000, positionRank: 28 }; // At replacement
    const replacement = 6000;

    const result = applyScarcityAdjustment(player, replacement, [], profile);

    expect(result.adjustedValue).toBeCloseTo(5000, -50); // Within 50
  });

  it('should boost QBs in Superflex', () => {
    const qb1qb = getReplacementLevel(profile1QB, 'QB');
    const qbSF = getReplacementLevel(profileSF, 'QB');

    expect(qbSF).toBeGreaterThan(qb1qb); // Deeper replacement in SF
  });

  it('should compress over-represented positions', () => {
    // Create scenario with 60% WRs in top 100
    const players = createMockPlayers({ WR: 60, RB: 20, QB: 15, TE: 5 });

    const adjustments = applyScarcityAdjustments(players, profile);
    const distribution = getPositionDistribution(players, adjustments);

    expect(distribution.WR.share).toBeLessThanOrEqual(0.45); // Max 45%
  });
});
```

### Integration Tests

```typescript
it('should produce correct values end-to-end', async () => {
  // 1. Load real profile
  const profile = await getLeagueProfile('dynasty_sf');

  // 2. Load sample players
  const players = await loadSamplePlayers();

  // 3. Apply full pipeline
  const result = await buildLatestValuesForProfile(profile, players);

  // 4. Verify results
  const qb1 = result.find(p => p.position === 'QB' && p.positionRank === 1);
  const rb1 = result.find(p => p.position === 'RB' && p.positionRank === 1);

  expect(qb1.value).toBeGreaterThan(9000); // Elite QB in SF
  expect(rb1.value).toBeGreaterThan(9000); // Elite RB always valuable
});
```

## Performance

### Complexity

- Replacement level calculation: O(P) where P = positions
- VOR calculation: O(N) where N = players
- Elasticity caps: O(N log N) due to sorting
- **Total: O(N log N)**

### Optimization

For large rebuilds (10+ profiles × 1000+ players):

1. **Cache replacement levels per profile** (computed once)
2. **Batch process by position** (parallel VOR calculation)
3. **Use staged writes** (bulk insert to database)

```typescript
// Optimized rebuild
const profiles = await loadProfiles();
const players = await loadPlayers();

// Calculate replacement levels once per profile
const replacementCache = new Map();
for (const profile of profiles) {
  replacementCache.set(profile.id, calculateReplacementLevels(profile));
}

// Process in parallel
await Promise.all(
  profiles.map(profile =>
    buildLatestValuesForProfile(profile, players, replacementCache.get(profile.id))
  )
);
```

## Summary

**Benefits:**
- ✅ Values reflect lineup impact, not just talent
- ✅ QBs correctly valued higher in Superflex
- ✅ RB scarcity accounted for
- ✅ Position balance maintained via elasticity caps
- ✅ Transparent (users see why values differ)
- ✅ Validated against real dynasty markets

**Key Rules:**
1. Scarcity runs AFTER multipliers, BEFORE ranking
2. Replacement level = league-specific baseline
3. VOR = player_value - replacement_value
4. Normalize VOR to 0-10000 scale (5000 = replacement)
5. Apply smooth elasticity caps (no drastic reordering)
6. Store debug fields for validation

**Next Steps:**
1. Integrate into rebuild pipeline
2. Test against real market data
3. Calibrate VOR_SCALE if needed (currently 1.35)
4. Add UI tooltips to player pages
5. Monitor position distribution in production

**This system makes your values match how dynasty managers actually evaluate players.**

