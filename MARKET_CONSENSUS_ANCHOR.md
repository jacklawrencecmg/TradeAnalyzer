# Market Consensus Anchor System

## Overview

The Market Consensus Anchor system provides stability and builds trust by gently aligning model values with external market consensus. This prevents unrealistic outliers WITHOUT overriding the model's intelligence.

**Key Innovation:** Soft pull, not override. The model's values are respected, but extreme divergences from market reality are dampened.

## Philosophy

**Traditional Approach (Bad):**
```
if (model_rank differs from market) {
  use market_rank; // Override model completely
}
```

**Our Approach (Good):**
```
difference = market_value - model_value;
anchor_strength = getTierStrength(rank); // 15-35%
adjustment = difference * anchor_strength;
final_value = model_value + adjustment; // Gentle pull
```

**Result:**
- Model intelligence preserved
- Unrealistic outliers dampened
- Users trust values (transparent explanation)
- Emerging stars protected (breakout logic)

## Architecture

```
Market Sync Job (Daily Cron)
    ↓
Fetch External Rankings (KTC, FantasyPros)
    ↓
Normalize Players → nfl_players
    ↓
Store market_player_consensus (rank only, not value)
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rebuild Pipeline (Nightly/On-Demand)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓
1. Base Model Value
2. Availability Modifiers
3. League Multipliers
4. Scarcity Adjustment
5. Market Anchor ← NEW STEP
6. Calculate Rankings
7. Write to value_snapshots
```

**Pipeline Position:** Step 5 (after scarcity, before ranking)

## Database Schema

### market_player_consensus Table

```sql
CREATE TABLE market_player_consensus (
  id uuid PRIMARY KEY,
  player_id uuid REFERENCES nfl_players(id),
  format text CHECK (format IN ('dynasty', 'redraft')),
  market_rank integer CHECK (market_rank > 0),
  market_tier integer,
  market_source text,
  notes text,
  captured_at timestamptz,
  UNIQUE (player_id, format, market_source)
);
```

**Key Points:**
- Stores RANK not VALUE (value computed from rank)
- One snapshot per source per format
- Updated by sync job (separate from rebuild)
- Multiple sources supported (KTC, FantasyPros, consensus)

### market_anchor_audit Table

```sql
CREATE TABLE market_anchor_audit (
  id uuid PRIMARY KEY,
  player_id uuid REFERENCES nfl_players(id),
  league_profile_id uuid REFERENCES league_profiles(id),
  format text,
  model_value integer,
  market_value integer,
  anchored_value integer,
  anchor_strength numeric,
  rank_difference integer,
  confidence_score numeric,
  is_outlier boolean,
  is_breakout_protected boolean,
  notes text,
  created_at timestamptz
);
```

**Purpose:** Audit trail of all anchor adjustments for analysis.

### value_snapshots Enhancements

```sql
ALTER TABLE value_snapshots
  ADD COLUMN market_rank integer,
  ADD COLUMN pre_anchor_value integer,
  ADD COLUMN anchor_adjustment integer,
  ADD COLUMN confidence_score numeric,
  ADD COLUMN is_market_outlier boolean;
```

**Usage:**
- `pre_anchor_value`: Model value before anchoring
- `anchor_adjustment`: Delta applied by anchor
- `confidence_score`: 0-1 score (model vs market agreement)
- `is_market_outlier`: True if rank diff > 120 spots

## Core Components

### 1. Market Rank to Value Converter

**Formula:**
```
value = 10000 * e^(-0.0045 * (rank - 1))
```

**Examples:**
```
Rank 1   → 10,000 value
Rank 10  →  9,560 value
Rank 50  →  7,990 value
Rank 100 →  6,376 value
Rank 200 →  4,066 value
Rank 500 →  1,054 value
```

**Why exponential decay?**
- Mirrors real dynasty value distributions
- Elite players worth much more than mid-tier
- Large gaps at top, compression at bottom
- Matches market psychology

### 2. Anchor Strength by Tier

| Tier | Ranks | Anchor Strength | Reasoning |
|------|-------|-----------------|-----------|
| 1 | 1-24 | 15% | Elite players, barely move |
| 2 | 25-60 | 20% | Solid starters, slight stabilization |
| 3 | 61-120 | 25% | Flex/depth, moderate stabilization |
| 4+ | 120+ | 35% | Deep players, track market more |

**Why tiered?**
- Elite players: Model likely knows something market doesn't
- Deep players: Market consensus more reliable (less model confidence)

### 3. Anchor Adjustment Algorithm

```typescript
// 1. Get market rank and convert to value
marketRank = getMarketRank(player_id, format);
marketValue = rankToValue(marketRank);

// 2. Calculate difference
difference = marketValue - modelValue;

// 3. Get base anchor strength by tier
anchorStrength = getTierStrength(modelRank);
// Elite (1-24): 0.15
// Mid (25-120): 0.20-0.25
// Deep (120+): 0.35

// 4. Apply breakout protection (if applicable)
if (production_percentile >= 90) {
  anchorStrength *= 0.4; // 60% reduction
}

// 5. Apply outlier guardrail (if applicable)
if (abs(modelRank - marketRank) > 120) {
  anchorStrength = min(anchorStrength, 0.25); // Max 25% pull
}

// 6. Apply adjustment
adjustment = difference * anchorStrength;
anchoredValue = modelValue + adjustment;

// 7. Clamp to valid range
finalValue = clamp(anchoredValue, 0, 10000);
```

### 4. Breakout Protection

**Purpose:** Prevent market lag from suppressing emerging stars.

**Rule:**
```
if (player production_percentile >= 90th) {
  reduce anchor_strength by 60%
}
```

**Example:**
```
Puka Nacua (rookie breakout):
- Model Rank: 25 (recognizes production)
- Market Rank: 60 (lagging, waiting for proof)
- Normal Anchor: 20% pull toward market
- With Protection: 8% pull (60% reduction)
- Result: Model value mostly preserved
```

**How to detect breakouts:**
- Production percentile >= 90th last season
- Snap share increased by 30%+
- Target share increased by 20%+
- Age <= 26 (young upside)

### 5. Outlier Guardrail

**Purpose:** Flag extreme model vs market divergences, but don't overcorrect.

**Rule:**
```
if (abs(modelRank - marketRank) > 120) {
  flag as outlier;
  cap anchor_strength at 25%;
  log for manual review;
}
```

**Example:**
```
Obscure Player:
- Model Rank: 50 (high on hidden metrics)
- Market Rank: 200 (barely ranked)
- Difference: 150 spots (outlier!)
- Normal Anchor: 25% pull
- With Guardrail: 25% pull (already at cap)
- Result: Model mostly preserved, flagged for review
```

**Why not auto-fix?**
- Model might be right (early detection)
- Market might be slow (undervalued gems)
- Manual review better than auto-override

### 6. Confidence Scoring

**Formula:**
```
confidence = 1 - (rank_difference / 400)
```

**Scale:**
```
Perfect match (0 spots): 1.00 (Very High)
10 spots apart: 0.975 (Very High)
50 spots apart: 0.875 (High)
100 spots apart: 0.75 (High)
200 spots apart: 0.50 (Medium)
300 spots apart: 0.25 (Low)
400+ spots apart: 0.00 (Very Low)
```

**Usage:**
- UI shows confidence badge
- Helps users understand agreement level
- High confidence = trust the value
- Low confidence = expect volatility

## Pipeline Integration

### Updated Rebuild Flow

```typescript
async function buildLatestValuesForProfile(profile: LeagueProfile) {
  // 1. Load base values (KTC, FantasyPros)
  const baseValues = await loadBaseValues();

  // 2. Apply availability modifiers (injuries, age)
  const availableValues = applyAvailabilityModifiers(baseValues);

  // 3. Apply league multipliers (SF, TEP, IDP)
  const multipliers = await getProfileMultipliers(profile.id);
  const multipliedValues = applyLeagueMultipliers(availableValues, multipliers);

  // 4. Apply scarcity adjustment (VOR)
  const scarcityAdjusted = applyScarcityAdjustments(
    multipliedValues,
    profile,
    numTeams
  );

  // 5. Apply market anchor (NEW STEP)
  const anchorInputs: MarketAnchorInput[] = scarcityAdjusted.map(player => ({
    player_id: player.player_id,
    position: player.position,
    model_value: player.value,
    model_rank: player.position_rank,
    production_percentile: player.production_percentile,
    league_profile_id: profile.id,
    format: profile.is_dynasty ? 'dynasty' : 'redraft',
  }));

  const anchorResults = await applyMarketAnchors(anchorInputs);

  const anchoredValues = scarcityAdjusted.map(player => {
    const anchor = anchorResults.get(player.player_id)!;
    return {
      ...player,
      pre_anchor_value: player.value,
      value: anchor.anchored_value,
      market_rank: anchor.market_rank,
      market_value: anchor.market_value,
      anchor_adjustment: anchor.anchor_adjustment,
      confidence_score: anchor.confidence_score,
      is_market_outlier: anchor.is_outlier,
    };
  });

  // 6. Calculate rankings and tiers
  const rankedValues = calculateRankings(anchoredValues);

  // 7. Write to value_snapshots
  for (const player of rankedValues) {
    await supabase.from('value_snapshots').insert({
      player_id: player.player_id,
      league_profile_id: profile.id,
      format: profile.is_dynasty ? 'dynasty' : 'redraft',
      position: player.position,
      position_rank: player.position_rank,
      market_value: player.value,
      // Market anchor fields
      market_rank: player.market_rank,
      pre_anchor_value: player.pre_anchor_value,
      anchor_adjustment: player.anchor_adjustment,
      confidence_score: player.confidence_score,
      is_market_outlier: player.is_market_outlier,
      // Standard fields
      captured_at: new Date(),
      value_epoch: getCurrentEpoch(),
    });

    // Log audit record
    if (player.anchor_adjustment !== 0) {
      await logAnchorAudit(anchorInputs.find(i => i.player_id === player.player_id)!, {
        anchored_value: player.value,
        anchor_adjustment: player.anchor_adjustment,
        anchor_strength: player.anchor_strength,
        market_value: player.market_value,
        market_rank: player.market_rank,
        confidence_score: player.confidence_score,
        is_outlier: player.is_market_outlier,
        is_breakout_protected: player.is_breakout_protected,
        explanation: player.explanation,
      });
    }
  }
}
```

## Market Sync Job

### Sync Sources

**Supported Sources:**
1. **KTC (KeepTradeCut)**
   - Dynasty and redraft rankings
   - Updated daily
   - ~800 players ranked

2. **FantasyPros**
   - Expert consensus rankings
   - Dynasty and redraft
   - ~1000 players ranked

3. **Consensus**
   - Average of multiple sources
   - Most stable/reliable
   - Auto-generated from other sources

### Sync Process

```typescript
// Daily cron job
async function runMarketSync() {
  // 1. Sync KTC rankings
  const ktcDynasty = await syncKTCRankings('dynasty');
  const ktcRedraft = await syncKTCRankings('redraft');

  // 2. Sync FantasyPros rankings
  const fpDynasty = await syncFantasyProsRankings('dynasty');
  const fpRedraft = await syncFantasyProsRankings('redraft');

  // 3. Create consensus rankings
  const consensusDynasty = await createConsensusRankings(
    ['ktc', 'fantasypros'],
    'dynasty'
  );
  const consensusRedraft = await createConsensusRankings(
    ['ktc', 'fantasypros'],
    'redraft'
  );

  // 4. Validate all rankings
  await validateMarketRankings('consensus', 'dynasty');
  await validateMarketRankings('consensus', 'redraft');

  // 5. Log results
  console.log('Market sync complete');
}
```

### Player Matching

**Challenge:** External rankings use different player names.

**Solution:** Fuzzy matching with position validation.

```typescript
// Normalize player names
"Patrick Mahomes II" → "Patrick Mahomes"
"Travis Kelce" → "Travis Kelce"
"CeeDee Lamb" → "CeeDee Lamb"

// Match by normalized name + position
const playerId = await resolvePlayerId(normalizedName, position);
```

**Fallback:**
- Try common name variations
- Check aliases in player_aliases table
- Manual review for unmatched players

## UI Components

### 1. Market vs Model Card (Player Pages)

```tsx
<MarketVsModelCard
  data={{
    modelValue: 7420,
    marketValue: 7150,
    finalValue: 7325,
    modelRank: 35,
    marketRank: 40,
    anchorAdjustment: -95,
    confidenceScore: 0.92,
    isOutlier: false,
    explanation: "Model values 5 spots higher, 20% pull toward market"
  }}
  playerName="Jaylen Waddle"
  showDetails={true}
/>
```

**Display:**
```
Value Breakdown
━━━━━━━━━━━━━━━━━━━━━━━
Model Value (#35):    7,420
Market Value (#40):   7,150
                      ------
Difference:          +270 (3.8%)
Anchor Adjustment:     -95
                      ------
Final Value:          7,325

Agreement: ████████████████░░ 92% (High)

Explanation:
Model values 5 spots higher, 20% pull toward market
```

### 2. Confidence Badge (Compact)

```tsx
<ConfidenceBadge confidenceScore={0.88} />
```

**Display:** `High (88%)`

### 3. Model vs Market Indicator

```tsx
<ModelVsMarketIndicator modelValue={7420} marketValue={7150} />
```

**Display:** `↗ Model +270 (3.8%)`

### 4. Detailed Panel (Player Detail Page)

```tsx
<MarketVsModelPanel
  data={data}
  playerName="Jaylen Waddle"
/>
```

**Shows:**
- Full value breakdown
- Confidence score with bar chart
- Outlier warning (if applicable)
- Breakout protection notice (if applicable)
- Explanation text

## Example Scenarios

### Scenario 1: Elite Player, Close Agreement

```
Player: Christian McCaffrey
Model Rank: 3
Market Rank: 2
━━━━━━━━━━━━━━━━━━━━━━━
Model Value: 9,850
Market Value: 9,890
Difference: +40
Anchor Strength: 0.15 (elite tier)
Adjustment: +40 × 0.15 = +6
Final Value: 9,856
Confidence: 0.998 (Very High)
```

**Result:** Minimal change, high confidence.

### Scenario 2: Breakout Player

```
Player: Puka Nacua
Model Rank: 25 (recognizes production)
Market Rank: 60 (lagging)
Production Percentile: 95th (breakout!)
━━━━━━━━━━━━━━━━━━━━━━━
Model Value: 8,900
Market Value: 7,550
Difference: -1,350
Base Anchor Strength: 0.20
Breakout Protection: 0.20 × 0.4 = 0.08 (60% reduction)
Adjustment: -1,350 × 0.08 = -108
Final Value: 8,792
Confidence: 0.91 (Very High)
```

**Result:** Model mostly preserved, emerging star not suppressed.

### Scenario 3: Market Outlier

```
Player: Unknown Rookie
Model Rank: 50 (high on analytics)
Market Rank: 200 (barely ranked)
Rank Difference: 150 (outlier!)
━━━━━━━━━━━━━━━━━━━━━━━
Model Value: 7,990
Market Value: 4,066
Difference: -3,924
Base Anchor Strength: 0.20
Outlier Guardrail: cap at 0.25
Adjustment: -3,924 × 0.25 = -981
Final Value: 7,009
Confidence: 0.63 (Medium)
Flagged: true
```

**Result:** Model mostly preserved, flagged for review.

### Scenario 4: Deep Player, Market Alignment

```
Player: Backup RB
Model Rank: 180
Market Rank: 175
━━━━━━━━━━━━━━━━━━━━━━━
Model Value: 3,450
Market Value: 3,530
Difference: +80
Anchor Strength: 0.35 (deep tier)
Adjustment: +80 × 0.35 = +28
Final Value: 3,478
Confidence: 0.99 (Very High)
```

**Result:** Small adjustment, high agreement.

## Monitoring & Validation

### Key Metrics

1. **Anchor Impact**
   - Average adjustment: should be <200 points
   - % players adjusted: expect 80-90%
   - Max adjustment: should be <2000 points

2. **Confidence Distribution**
   - High confidence (>0.75): expect 70%+
   - Low confidence (<0.25): expect <5%
   - Average confidence: target >0.80

3. **Outlier Rate**
   - Outliers (>120 ranks apart): expect <3%
   - If >5%, investigate model or market data

4. **Breakout Protection**
   - Protected players: expect 5-10%
   - Should capture recent risers

### Validation Queries

```sql
-- Check average confidence
SELECT
  AVG(confidence_score) as avg_confidence,
  COUNT(*) FILTER (WHERE confidence_score >= 0.75) as high_conf_count,
  COUNT(*) FILTER (WHERE confidence_score < 0.25) as low_conf_count
FROM value_snapshots
WHERE league_profile_id = '<profile-id>'
  AND captured_at >= NOW() - INTERVAL '1 day';

-- Check outliers
SELECT
  np.full_name,
  vs.position_rank as model_rank,
  vs.market_rank,
  ABS(vs.position_rank - vs.market_rank) as rank_diff,
  vs.confidence_score
FROM value_snapshots vs
JOIN nfl_players np ON vs.player_id = np.id
WHERE vs.is_market_outlier = true
ORDER BY rank_diff DESC
LIMIT 20;

-- Check anchor impact
SELECT
  position,
  COUNT(*) as player_count,
  AVG(anchor_adjustment) as avg_adjustment,
  MAX(ABS(anchor_adjustment)) as max_adjustment,
  AVG(confidence_score) as avg_confidence
FROM value_snapshots
WHERE league_profile_id = '<profile-id>'
  AND market_rank IS NOT NULL
GROUP BY position
ORDER BY position;
```

## Troubleshooting

### Issue: Low confidence scores across the board

**Symptom:** Average confidence <0.60

**Possible Causes:**
1. Market data is stale
2. Model using different format (SF vs 1QB)
3. Market sync failed

**Fix:**
1. Re-run market sync job
2. Verify format alignment
3. Check market data timestamps

### Issue: Too many outliers

**Symptom:** >5% of players flagged as outliers

**Possible Causes:**
1. Model diverged significantly from market
2. Market data from wrong format
3. Player matching errors

**Fix:**
1. Review model parameters
2. Verify market source format
3. Check unmatched players in sync logs

### Issue: Breakout protection not activating

**Symptom:** Expected breakouts not protected

**Possible Causes:**
1. Production percentile not calculated
2. Threshold too high (>90th)
3. Data lag (last season stats)

**Fix:**
1. Verify production data exists
2. Lower threshold to 85th percentile
3. Use current season stats if available

### Issue: Anchor adjustments too aggressive

**Symptom:** Values changing by >500 points

**Possible Causes:**
1. Anchor strength too high
2. Market data inaccurate
3. Model values not normalized

**Fix:**
1. Reduce tier anchor strengths
2. Validate market rankings
3. Check model value scale

## Summary

### Benefits

✅ **Stability**
- Prevents unrealistic outliers
- Smooths value volatility
- Market-aligned values

✅ **Trust**
- Transparent explanations
- Shows model vs market
- Confidence scoring

✅ **Intelligence Preserved**
- Soft pull, not override
- Elite players barely move
- Breakout protection active

✅ **Flexibility**
- Tiered anchor strengths
- Outlier guardrails
- Audit trail for analysis

### Key Rules

1. **Anchor runs AFTER scarcity, BEFORE ranking**
2. **Store rank in DB, compute value on-demand**
3. **Elite players (1-24) barely move (15% anchor)**
4. **Deep players (120+) track market more (35% anchor)**
5. **Breakout protection reduces anchor by 60%**
6. **Outliers capped at 25% anchor pull**
7. **Confidence score = 1 - (rank_diff / 400)**
8. **Market sync runs daily, separate from rebuild**

### Integration Checklist

- [x] Database tables created
- [x] Market rank to value converter
- [x] Anchor adjustment logic
- [x] Breakout protection
- [x] Outlier guardrails
- [x] Confidence scoring
- [x] Market sync job
- [x] UI components
- [ ] Integrate into rebuild pipeline
- [ ] Schedule daily market sync
- [ ] Add to player detail pages
- [ ] Monitor anchor impact
- [ ] Calibrate anchor strengths if needed

**This system provides the final layer of stability, ensuring values are trusted by users while preserving the model's competitive edge.**

