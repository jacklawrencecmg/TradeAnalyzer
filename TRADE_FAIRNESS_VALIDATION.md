# Trade Fairness Validation System

## Overview

A comprehensive fairness validation layer that evaluates trade structural balance beyond raw value totals. The system detects consolidation trades, positional imbalance, tier breaking, and package-for-star abuse before trades are confirmed.

**Key Principle:** Displays raw values unchanged. Fairness engine only evaluates structure.

## Architecture

```
Raw Trade Analysis (Unchanged)
    ↓
+ Fairness Evaluation (New Layer)
    ↓
= Structural Warnings & Score
```

## Fairness Score System

Score Range: **0-100**

| Score | Interpretation | Color | Icon |
|-------|----------------|-------|------|
| **90-100** | Fair Trade | Green | ✓ |
| **75-89** | Slight Lean | Yellow | ⚠ |
| **60-74** | Risky Trade | Orange | ⚠️ |
| **<60** | Unfair / Unbalanced | Red | ✕ |

Score starts at 100, then penalties are subtracted based on structural issues.

## Detection Systems

### 1. Tier Break Protection (MOST IMPORTANT)

**Purpose:** Prevent elite player giveaways without fair return

**Rules:**

#### Elite Player Split
```typescript
IF one_side_gives_tier1 AND other_side_gives_no_tier1:
  FLAG: ELITE_PLAYER_SPLIT
  SEVERITY: critical
  PENALTY: -15 points
```

**Example:**
- Team A gives: Mahomes (Tier 1 QB)
- Team B gives: 2 Tier 3 WRs
- Result: **-15 fairness penalty**

#### Elite for Depth Pieces
```typescript
IF tier1_for_3+_tier4_players:
  FLAG: TIER_MISMATCH
  SEVERITY: critical
  PENALTY: -25 points
```

**Example:**
- Team A gives: Justin Jefferson (Tier 1 WR)
- Team B gives: 4 bench players (all Tier 4)
- Result: **-25 fairness penalty** (severe tier mismatch)

#### Large Tier Disparity
```typescript
IF tier_disparity >= 2:
  FLAG: TIER_MISMATCH
  SEVERITY: high
  PENALTY: -10 points
```

**How it works:**
- System pulls tier data from `latest_player_values.tier`
- Compares Tier 1 count on each side
- Flags mismatch and applies penalty

### 2. Positional Scarcity Balance

**Purpose:** Ensure positional value is properly weighted

**Positional Weights** (applied to fairness calc only, not display):

| Position | Weight | Reasoning |
|----------|--------|-----------|
| QB | 1.25 | Superflex scarcity |
| RB | 1.10 | Position scarcity |
| WR | 1.00 | Baseline |
| TE | 1.15 | Positional scarcity |
| DL/LB/DB | 0.70 | IDP discount |
| PICK | 1.00 | Baseline |

**Superflex Bonus:** QB weight becomes 1.25 × 1.15 = **1.44** in superflex leagues

**Adjusted Value Formula:**
```typescript
adjusted_value = base_value × positional_weight × (superflex_bonus if QB)
```

**Scarcity Violation:**
```typescript
IF one_side_gives_2+_scarce_positions AND other_gives_0:
  FLAG: SCARCITY_VIOLATION
  SEVERITY: high
  PENALTY: -12 points
```

**Scarce Positions:** QB, RB, TE

**Example:**
- Team A gives: 2 RBs
- Team B gives: 4 WRs
- Result: **-12 penalty** (RB scarcity violation)

**Positional Imbalance:**
```typescript
IF positional_imbalance > 5:
  PENALTY: min(15, floor(imbalance / 2))
```

Imbalance score accounts for weighted position differences.

### 3. Package-for-Star Detection (Prevent 5 for 1 Abuse)

**Purpose:** Detect consolidation trades where quantity doesn't equal quality

**Rule:**
```typescript
IF assetsA >= 4 AND assetsB == 1:
  package_value = sum(assetsA)
  star_value = assetsB[0].value
  ratio = package_value / star_value

  IF ratio < 1.65:  // Package must be 165%+ of star
    FLAG: PACKAGE_FOR_STAR
    SEVERITY: critical (if ratio < 1.3) or high
    PENALTY: -20 points
```

**Example 1: Fair Consolidation**
- Team A gives: 4 players worth 2000 each = 8000 total
- Team B gives: 1 star worth 4500
- Ratio: 8000 / 4500 = **1.78** (>1.65)
- Result: ✓ **No penalty**

**Example 2: Unfair Consolidation**
- Team A gives: 4 players worth 1500 each = 6000 total
- Team B gives: 1 star worth 5000
- Ratio: 6000 / 5000 = **1.20** (<1.65)
- Result: **-20 penalty** (package 45% short of fair value)

**Why 165% threshold?**
- Accounts for roster spot value (star player frees up spot)
- Reflects market reality: stars command premium
- Prevents quantity-over-quality abuse

### 4. Pick vs Player Protection

**Purpose:** Ensure pick trades account for uncertainty

**Pick Baseline Values:**

| Pick | Value |
|------|-------|
| Early 1st | 8500 |
| Mid 1st | 7000 |
| Late 1st | 5800 |
| Early 2nd | 4200 |
| Mid 2nd | 3500 |
| Late 2nd | 3000 |
| Early 3rd | 2000 |
| Mid 3rd | 1500 |
| Late 3rd | 1000 |

**Season Phase Multipliers:**

| Phase | Multiplier | Notes |
|-------|------------|-------|
| Preseason | 1.00 | Full value |
| Regular Season | 0.95 | 5% discount |
| **Playoffs** | **0.85** | **15% discount (uncertainty)** |
| Offseason | 1.00 | Full value |

**Pick Overpay Detection:**
```typescript
IF picks_dominate_trade (>60% of total value):
  IF pick_value / player_value < 1.2:
    FLAG: PICK_OVERPAY
    SEVERITY: medium
    PENALTY: -8 points
```

**Reasoning:** Picks can't outweigh proven elite without +20% premium.

**Playoff Phase Warning:**
```typescript
IF currentPhase == 'playoffs' AND picks >= 2:
  FLAG: PICK_OVERPAY
  SEVERITY: low
  PENALTY: -3 points
  MESSAGE: "Rookie picks discounted 15% during playoffs"
```

**Example:**
- Mid-season: Early 1st = 8500 points
- Playoffs: Early 1st = 8500 × 0.85 = **7225 points**
- Discount reflects draft position uncertainty

### 5. Raw Value Disparity

**Purpose:** Penalize extreme value gaps

**Progressive Penalty:**

| Value Gap | Penalty |
|-----------|---------|
| 30%+ | -20 points |
| 20-30% | -15 points |
| 15-20% | -10 points |
| 10-15% | -5 points |
| <10% | No penalty |

**Calculation:**
```typescript
percentDiff = abs(teamA_value - teamB_value) / max(teamA_value, teamB_value) × 100
```

**Example:**
- Team A: 8000 points
- Team B: 5000 points
- Gap: 3000 / 8000 = **37.5%**
- Result: **-20 penalty** (extreme value gap)

## Fairness Evaluation Flow

```typescript
1. Start: fairness_score = 100

2. Tier Analysis:
   - Count Tier 1 players each side
   - Check elite split: -15
   - Check elite for depth (3+ Tier 4): -25
   - Check tier disparity: -10

3. Package Detection:
   - Check 4+ for 1 trades
   - Verify 165% value premium
   - Penalty: -20 if insufficient

4. Positional Analysis:
   - Calculate adjusted values (weighted)
   - Check scarcity violations: -12
   - Check positional imbalance: up to -15

5. Pick Protection:
   - Apply phase discounts (playoffs: -15%)
   - Check pick dominance
   - Penalty: -8 for pick overpay
   - Penalty: -3 for playoff picks

6. Value Disparity:
   - Calculate percentage gap
   - Progressive penalty: -5 to -20

7. Final Score:
   - Clamp to 0-100
   - Determine recommendation
   - Generate warnings
```

## UI Components

### TradeFairnessWarning Component

**Location:** Displays at top of Trade Analysis Results

**Elements:**

#### 1. Header Banner
```
[Icon] Fair Trade                    Fairness Score: 95/100
       This trade appears structurally balanced

[Progress Bar: =========>                    ]
            0   60   75   90              100
         Unfair              Fair
```

**Color Schemes:**

| Score | Background | Border | Text | Icon |
|-------|------------|--------|------|------|
| 90+ | Green/30% | Green/50% | Green | ✓ CheckCircle |
| 75-89 | Yellow/30% | Yellow/50% | Yellow | ⚠ AlertCircle |
| 60-74 | Orange/30% | Orange/50% | Orange | ⚠️ AlertTriangle |
| <60 | Red/30% | Red/50% | Red | ✕ XCircle |

#### 2. Key Concerns Section
```
⚠ Key Concerns
  • Elite player given up without elite return
  • Consolidation trade detected - verify package value
  • Positional scarcity imbalance detected
```

Displays high-level warnings from evaluation.

#### 3. Structural Issues (Flags)
```
[CRITICAL] -15 pts
Elite player (Tier 1) given up without elite return

[HIGH] -20 pts
Team A giving 4 assets for 1 star - package 45% short of fair value

[MEDIUM] -8 pts
Team B giving mostly picks without sufficient premium
```

Each flag shows:
- Severity badge (critical/high/medium/low)
- Penalty applied
- Explanation of issue

#### 4. Elite Player Alert (if applicable)
```
⚠️ Elite Player Alert
One side is giving up an elite player (Tier 1) without receiving
an elite player in return.

Team A Tier 1: 1
Team B Tier 1: 0
```

Special callout for tier breaks.

#### 5. Positional Scarcity Warning (if applicable)
```
ℹ Positional Scarcity Warning
Scarce positions (QB/RB/TE) are being traded without positional
return, which may create roster imbalance.
```

#### 6. Info Banner
```
ℹ Note: This evaluation analyzes trade structure beyond raw values.
Displayed values are unchanged - fairness engine only evaluates balance.
```

Always shown to clarify purpose.

### Flag Severity Indicators

**Visual Design:**

```
CRITICAL: Red background, red border, red text
HIGH:     Orange background, orange border, orange text
MEDIUM:   Yellow background, yellow border, yellow text
LOW:      Blue background, blue border, blue text
```

## Integration with TradeAnalyzer

### Data Flow

```typescript
1. User builds trade (players, picks, FAAB)
2. Click "Analyze Trade"
3. analyzeTrade() runs (unchanged)
4. Convert analysis to TradeAsset format
5. evaluateTrade() runs (new)
6. Display both:
   - TradeFairnessWarning (at top)
   - Regular analysis results (below)
```

### Asset Conversion

**From TradeAnalysis to TradeAsset:**

```typescript
// Team A gives (Team B gets)
for (const item of result.teamAItems) {
  teamBAssets.push({
    player_id: item.id,
    player_name: item.name,
    position: item.position || 'PICK',
    value: item.value,
    tier: item.tier,
    is_pick: item.type === 'pick',
  });
}

// Team B gives (Team A gets)
for (const item of result.teamBItems) {
  teamAAssets.push({
    player_id: item.id,
    player_name: item.name,
    position: item.position || 'PICK',
    value: item.value,
    tier: item.tier,
    is_pick: item.type === 'pick',
  });
}
```

### Evaluation Call

```typescript
const fairness = evaluateTrade(
  teamAAssets,
  teamBAssets,
  format,  // 'dynasty' or 'redraft'
  {
    isSuperflex: leagueSettings.isSuperflex,
    currentPhase: 'regular_season',  // or 'playoffs', 'offseason'
  }
);
```

### Error Handling

Fairness evaluation runs in try/catch:
- If fails, trade analysis still displays
- Error logged but doesn't block user
- Graceful degradation

## Usage Examples

### Example 1: Fair Trade (Score: 92)

**Trade:**
- Team A gives: Tier 2 WR (5000) + Tier 2 RB (4500) + Late 1st (5800)
- Team B gives: Tier 1 WR (8500) + Tier 3 TE (3000) + Mid 2nd (3500)

**Analysis:**
- Team A value: 15,300
- Team B value: 15,000
- Diff: 300 (2%)
- No tier split (both have elite players through picks/tiers)
- Balanced positions
- Fair package size

**Result:**
```
✓ Fair Trade                        Score: 92/100
  This trade appears structurally balanced

No major concerns detected.
```

### Example 2: Elite Player Split (Score: 72)

**Trade:**
- Team A gives: Justin Jefferson (Tier 1 WR, 9500)
- Team B gives: 2× Tier 2 WRs (4500 each) + Late 1st (5800)

**Analysis:**
- Team A value: 9,500
- Team B value: 14,800
- Team B actually giving MORE value (+56%)
- BUT: Elite split detected

**Penalties:**
- Elite split: -15
- Value disparity: -10 (favors Team A, but they lose elite)
- Tier mismatch: -10

**Result:**
```
⚠️ Risky Trade                      Score: 72/100
  Significant structural imbalance detected

⚠ Key Concerns:
  • Elite player given up without elite return

[CRITICAL] -15 pts
Elite player (Tier 1) given up without elite return

Team A is giving up a league-winner for depth pieces.
```

### Example 3: Package-for-Star Abuse (Score: 58)

**Trade:**
- Team A gives: 5× bench players (1200 each = 6000 total)
- Team B gives: Christian McCaffrey (Tier 1 RB, 9500)

**Analysis:**
- Team A value: 6,000
- Team B value: 9,500
- Package ratio: 6000 / 9500 = **0.63** (need 1.65)

**Penalties:**
- Package-for-star: -20 (way below 165% threshold)
- Elite split: -15
- Value disparity: -20 (37% gap)

**Result:**
```
✕ Unfair Trade                      Score: 58/100
  League-breaking imbalance - proceed with caution

⚠ Key Concerns:
  • Elite player given up without elite return
  • Consolidation trade detected - verify package value

[CRITICAL] -20 pts
Team A giving 5 assets for 1 star - package 37% short of fair value

[CRITICAL] -15 pts
Elite player (Tier 1) given up without elite return

This is a classic "quantity for quality" abuse trade.
Team A needs to add 5,750 points for fairness.
```

### Example 4: Positional Scarcity (Score: 78)

**Trade:**
- Team A gives: 3× RBs (Tier 2/3, total 12000)
- Team B gives: 5× WRs (Tier 2/3, total 12000)

**Analysis:**
- Raw values equal: 12,000 each
- BUT: RBs worth 1.10× in fairness calc
- Team A adjusted: 12,000 × 1.10 = 13,200
- Team B adjusted: 12,000 × 1.00 = 12,000

**Penalties:**
- Scarcity violation: -12 (giving multiple scarce RBs)
- Positional imbalance: -10

**Result:**
```
⚠ Slightly Uneven                   Score: 78/100
  Minor structural concerns, but within acceptable range

⚠ Key Concerns:
  • Positional scarcity imbalance detected

[HIGH] -12 pts
Scarce position (RB) given up without positional return

Team A is giving up RB depth for WR depth. This may
create roster imbalance.
```

### Example 5: Playoff Pick Discount (Score: 85)

**Trade:**
- Team A gives: Early 1st (8500) + Mid 1st (7000)
- Team B gives: Tier 2 RB (8000) + Tier 3 WR (3500)
- **Phase: Playoffs**

**Analysis:**
- Team A raw: 15,500
- Team B raw: 11,500
- BUT: Playoff phase discount (15%)
- Team A adjusted: 8500×0.85 + 7000×0.85 = **13,175**
- Team B adjusted: 11,500
- Gap: ~15%

**Penalties:**
- Value disparity: -10
- Playoff pick warning: -3

**Result:**
```
⚠ Slightly Uneven                   Score: 85/100
  Minor structural concerns, but within acceptable range

[MEDIUM] -10 pts
Value gap: 4000 points (26%)

[LOW] -3 pts
Note: Rookie picks discounted 15% during playoffs (uncertainty)

Team A's picks are worth less during playoffs due to
draft position uncertainty.
```

## Safety Limits & Caps

### Maximum Penalties

**Per Flag Type:**
- Tier mismatch: Max -25 (elite for depth)
- Elite split: Fixed -15
- Package-for-star: Fixed -20
- Scarcity violation: Fixed -12
- Positional imbalance: Max -15 (scaled)
- Value disparity: Max -20
- Pick overpay: Max -8
- Playoff picks: Max -3

**Total:** Theoretical max penalty ~125, but score clamped to 0

### Score Clamping

```typescript
fairness_score = Math.max(0, Math.min(100, fairness_score));
```

Ensures score always in 0-100 range.

## Important Rules

### 1. Values Never Modified

```typescript
// CORRECT: Evaluation uses separate adjusted values
teamA_adjusted = calculateAdjustedValue(teamAAssets);

// Display still shows:
console.log(`Team A Value: ${teamA_value}`);  // Raw value unchanged
```

**UI shows raw values.** Fairness engine uses adjusted values internally only.

### 2. Fairness is Advisory Only

System provides warnings and scores, but:
- Users can proceed with any trade
- No hard blocks (even score 0)
- "Proceed Anyway" button available

### 3. Recommendation Logic

```typescript
if (criticalFlags >= 2 || score < 60) return 'unfair';
if (score < 75) return 'risky';
if (score < 90) return 'lean_a' or 'lean_b';
return 'fair';
```

### 4. Graceful Degradation

If fairness evaluation fails:
- Regular trade analysis still works
- No warning banner shown
- Error logged silently
- User unaffected

## API Reference

### evaluateTrade()

```typescript
function evaluateTrade(
  teamAAssets: TradeAsset[],
  teamBAssets: TradeAsset[],
  format: 'dynasty' | 'redraft',
  options?: {
    isSuperflex?: boolean;
    currentPhase?: 'preseason' | 'regular_season' | 'playoffs' | 'offseason';
  }
): TradeEvaluationResult
```

**Returns:**
```typescript
{
  teamA_value: number;              // Raw totals
  teamB_value: number;
  teamA_adjusted_value: number;     // With positional weights
  teamB_adjusted_value: number;
  diff: number;                     // Absolute difference
  fairness_score: number;           // 0-100
  flags: FairnessFlag[];            // Structural issues
  recommendation: 'fair' | 'lean_a' | 'lean_b' | 'risky' | 'unfair';
  warnings: string[];               // User-friendly warnings
  tier_analysis: TierAnalysis;      // Tier breakdown
  positional_analysis: PositionalAnalysis;  // Position breakdown
}
```

### getPickBaselineValue()

```typescript
function getPickBaselineValue(
  round: number,
  position: 'early' | 'mid' | 'late'
): number
```

Returns baseline value for a draft pick.

**Example:**
```typescript
getPickBaselineValue(1, 'early');  // 8500
getPickBaselineValue(2, 'late');   // 3000
```

## Monitoring & Analytics

### Track Fairness Scores

```typescript
// When trade is saved, store fairness score
await supabase.from('saved_trades').insert({
  user_id: user.id,
  league_id: leagueId,
  trade_data: tradeData,
  fairness_score: fairnessEvaluation.fairness_score,
  fairness_flags: fairnessEvaluation.flags,
});
```

### Analytics Queries

**Average fairness score:**
```sql
SELECT AVG(fairness_score) FROM saved_trades;
```

**Most common flags:**
```sql
SELECT
  jsonb_array_elements(fairness_flags)->>'type' as flag_type,
  COUNT(*) as count
FROM saved_trades
GROUP BY flag_type
ORDER BY count DESC;
```

**Trades by recommendation:**
```sql
SELECT
  recommendation,
  COUNT(*) as trade_count
FROM saved_trades
GROUP BY recommendation;
```

## Future Enhancements

### Possible Additions

1. **League Veto Threshold:**
   - Set minimum fairness score for league
   - Auto-flag trades below threshold for commissioner review

2. **Historical Comparison:**
   - "This trade has a fairness score of 72. The average for your league is 85."

3. **Smart Suggestions:**
   - "Add an Early 2nd (4200) to balance this trade (fairness: 72 → 89)"

4. **Machine Learning:**
   - Train model on accepted/rejected trades
   - Refine weights and penalties based on outcomes

5. **Commissioner Overrides:**
   - Allow commissioners to adjust weights per league
   - Custom tier definitions

## Troubleshooting

### Issue: Fairness score seems wrong

**Check:**
1. Are player tiers properly set in `latest_player_values`?
2. Is league format correct (dynasty vs redraft)?
3. Is superflex setting accurate?
4. Is current phase correct (playoffs vs regular season)?

### Issue: Elite split not detected

**Cause:** Player tier not set to 1 in database

**Fix:**
```sql
UPDATE latest_player_values
SET tier = 1
WHERE player_id = 'elite-player-uuid';
```

### Issue: Too many false positives

**Solution:** Adjust penalty thresholds in `evaluateTrade.ts`

```typescript
// Reduce elite split penalty
const ELITE_SPLIT_PENALTY = 10;  // Down from 15

// Reduce package-for-star threshold
const PACKAGE_PREMIUM_REQUIRED = 1.50;  // Down from 1.65
```

### Issue: Pick values feel off

**Solution:** Update pick baselines

```typescript
const PICK_BASELINES = {
  'early_1': 9000,  // Increase early 1st value
  'mid_1': 7500,    // etc.
  ...
};
```

## Summary

The Trade Fairness Validation System provides:

✅ **Tier break protection** - Prevents elite giveaways without fair return
✅ **Positional scarcity balance** - Accounts for QB/RB/TE value
✅ **Package abuse detection** - Stops 5-for-1 exploitation
✅ **Pick uncertainty adjustment** - Discounts picks during playoffs
✅ **Transparent scoring** - Users see why score is what it is
✅ **Non-invasive** - Doesn't modify displayed values, only evaluates

**Key Innovation:** Evaluates trade structure, not just summed totals. Detects imbalances that raw value comparisons miss.

**Without this system:** 8000 for 8000 looks "fair" even if it's elite player for 5 bench pieces.

**With this system:** "⚠️ Risky Trade - Score 65. Elite player split detected."
