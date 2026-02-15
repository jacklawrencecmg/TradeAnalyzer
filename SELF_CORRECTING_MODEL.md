# Self-Correcting Model System

## Overview

The Self-Correcting Model system creates a feedback loop that automatically improves player value predictions based on actual fantasy results. The model measures its own accuracy, detects systematic biases, and adjusts internal parameters to perform better in future predictions.

**Key Innovation:** The model NEVER changes past values—it only adjusts future weighting parameters. This preserves historical integrity while continuously learning and improving.

## Philosophy

**Traditional Static Model:**
```
Predictions → Season → Results
                         ↓
                    (ignored, no learning)
```

**Our Self-Correcting Model:**
```
Predictions → Season → Results
                         ↓
                   Measure Accuracy
                         ↓
                   Detect Biases
                         ↓
                   Adjust Parameters
                         ↓
                Better Future Predictions
```

**Result:**
- Model learns from mistakes
- Systematic biases corrected
- Predictions improve season-over-season
- Transparent learning process
- Safe boundaries prevent overcorrection

## Architecture

```
Weekly Cycle (During Season)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Monday Night Football ends
    ↓
Tuesday (Step 1): Sync Weekly Results
    - Fetch actual fantasy points from Sleeper API
    - Store in player_weekly_outcomes
    - Calculate snap share, target share, etc.
    ↓
Tuesday (Step 2): Measure Accuracy
    - Load frozen predictions (captured before games)
    - Convert actual fantasy points to rankings
    - Calculate prediction errors per position
    - Detect overvalued/undervalued biases
    - Store metrics in model_accuracy_history
    ↓
Tuesday (Step 3): Auto-Tune Parameters
    - Analyze last 4 weeks of accuracy metrics
    - Detect systematic biases
    - Propose parameter adjustments (±5% max)
    - Apply safe adjustments automatically
    - Log all changes to model_learning_audit
    ↓
Tuesday (Step 4): Capture Next Week Predictions
    - Run nightly rebuild with tuned parameters
    - Capture predictions BEFORE next week's games
    - Store in player_value_predictions
    ↓
Wednesday-Sunday: Games played
    ↓
Monday: Repeat cycle
```

## Database Schema

### player_weekly_outcomes

Stores actual fantasy performance after games.

```sql
CREATE TABLE player_weekly_outcomes (
  player_id uuid PRIMARY KEY,
  season integer,
  week integer,
  fantasy_points numeric,
  snap_share numeric,
  target_share numeric,
  opportunity_share numeric,
  games_started boolean,
  games_played boolean,
  injured boolean,
  dnp_reason text,
  PRIMARY KEY (player_id, season, week)
);
```

**Purpose:** Source of truth for measuring prediction accuracy.

### player_value_predictions

Stores predictions made BEFORE games are played.

```sql
CREATE TABLE player_value_predictions (
  player_id uuid,
  season integer,
  week integer,
  format text CHECK (format IN ('dynasty', 'redraft')),
  predicted_rank integer,
  predicted_position_rank integer,
  predicted_value integer,
  confidence_score numeric,
  model_version text,
  UNIQUE (player_id, season, week, format)
);
```

**Purpose:** Frozen predictions used for accuracy measurement.

**Key Point:** These are captured Tuesday BEFORE games. Never modified after capture.

### model_accuracy_history

Stores weekly accuracy metrics by position.

```sql
CREATE TABLE model_accuracy_history (
  season integer,
  week integer,
  position text,
  format text,
  sample_size integer,
  avg_error numeric,
  median_error numeric,
  max_error numeric,
  overvalued_bias numeric,
  undervalued_bias numeric,
  accuracy_score numeric,
  UNIQUE (season, week, position, format)
);
```

**Purpose:** Tracks accuracy trends and detects biases.

**Metrics:**
- `avg_error`: Average rank difference (lower = better)
- `overvalued_bias`: % of players we ranked too high
- `undervalued_bias`: % of players we ranked too low
- `accuracy_score`: 0-1 score (1.0 = perfect)

### model_tuning_parameters

Stores adjustable model weights.

```sql
CREATE TABLE model_tuning_parameters (
  parameter text PRIMARY KEY,
  value numeric,
  default_value numeric,
  min_value numeric,
  max_value numeric,
  category text,
  auto_tune boolean,
  last_adjustment numeric,
  adjustment_count integer,
  last_adjusted_at timestamptz,
  reason text
);
```

**Purpose:** Weights that can be automatically tuned based on learning.

**Categories:**
- `age_decay`: Age-based decline rates
- `breakout`: Young player breakout probabilities
- `rookie`: Rookie projection weights
- `production`: Recent production impact
- `volatility`: Year-to-year volatility factors
- `injury`: Injury history impact

**Example Parameters:**
```sql
qb_age_decay: 1.0 (can adjust 0.8-1.2)
rb_age_decay: 1.0 (can adjust 0.8-1.2)
young_wr_breakout_weight: 1.0 (can adjust 0.7-1.3)
rookie_draft_capital_weight: 1.0 (can adjust 0.6-1.4)
recent_production_weight: 1.0 (can adjust 0.7-1.3)
```

### model_learning_audit

Audit log of all parameter adjustments.

```sql
CREATE TABLE model_learning_audit (
  parameter text,
  old_value numeric,
  new_value numeric,
  adjustment numeric,
  trigger_reason text,
  season integer,
  week integer,
  bias_detected text,
  auto_applied boolean,
  approved_by text,
  created_at timestamptz
);
```

**Purpose:** Complete audit trail for transparency and rollback.

## Core Components

### 1. Weekly Results Sync

**File:** `src/lib/learning/syncWeeklyResults.ts`

Fetches actual fantasy performance from Sleeper API.

```typescript
// Runs Tuesday morning after Monday Night Football
await syncWeeklyResults(season, week);

// Process:
1. Fetch stats from Sleeper API
2. Calculate PPR fantasy points
3. Calculate snap share, target share
4. Match players to nfl_players registry
5. Store in player_weekly_outcomes
```

**Data Source:** Sleeper API (primary)
- Comprehensive weekly stats
- All offensive skill positions
- Snap counts and usage metrics

**Formula:** PPR Fantasy Points
```
points = 0
points += pass_yards * 0.04  // 1 pt per 25 yards
points += pass_td * 4
points -= pass_int * 2
points += rush_yards * 0.1   // 1 pt per 10 yards
points += rush_td * 6
points += receptions * 1      // PPR
points += rec_yards * 0.1
points += rec_td * 6
points -= fumbles_lost * 2
```

### 2. Prediction Capture System

**File:** `src/lib/learning/capturePredictions.ts`

Freezes predictions BEFORE games are played.

```typescript
// Runs Tuesday before next week's games
await capturePredictions(season, nextWeek, 'dynasty');
await capturePredictions(season, nextWeek, 'redraft');

// Process:
1. Load latest_player_values (current rankings)
2. Check if already captured (prevent duplicates)
3. Store predictions with timestamp
4. Lock records (never modified)
```

**Timing:**
- Preseason (Week 0): Capture before season starts
- Weekly: Capture Tuesday for upcoming week
- Must happen BEFORE rebuild with new parameters

**Model Version:** Tracked per prediction
```
Format: YYYY.MM.DD
Example: "2024.09.10"
```

### 3. Accuracy Calculator

**File:** `src/lib/learning/calculateModelAccuracy.ts`

Measures prediction errors and detects biases.

```typescript
// Runs Tuesday after results are synced
const result = await calculateModelAccuracy(season, week);

// Process:
1. Load frozen predictions for this week
2. Load actual results (fantasy points)
3. Convert actual points to rankings
4. Match predictions to actuals
5. Calculate errors per position
6. Detect bias patterns
7. Store metrics
```

**Error Calculation:**
```
prediction_error = abs(predicted_rank - actual_rank)

Example:
Predicted: Ja'Marr Chase #5 WR
Actual:    Ja'Marr Chase #3 WR (28.4 pts)
Error: 2 ranks
```

**Bias Detection:**
```
if overvalued_bias > 0.65:
  # We consistently rank position too high
  # Players underperform expectations

if undervalued_bias > 0.65:
  # We consistently rank position too low
  # Players outperform expectations
```

**Accuracy Score:**
```
accuracy_score = 1.0 - (avg_error / 100)

Perfect predictions (0 error): 1.00
10 ranks off average: 0.90
20 ranks off average: 0.80
50 ranks off average: 0.50
```

### 4. Auto-Tuning System

**File:** `src/lib/learning/applyModelLearning.ts`

Automatically adjusts parameters based on detected biases.

```typescript
// Runs Tuesday after accuracy calculation
const result = await applyModelLearning(season, week);

// Process:
1. Load last 4 weeks of accuracy metrics
2. Detect systematic biases
3. Propose parameter adjustments
4. Validate adjustments within safe boundaries
5. Apply approved adjustments
6. Log all changes
```

**Safety Rules:**

**Rule 1:** Maximum ±5% adjustment per week
```typescript
const MAX_ADJUSTMENT_PER_WEEK = 0.05;

// Example:
rb_age_decay = 1.0
max_increase = 1.05
max_decrease = 0.95
```

**Rule 2:** Never auto-adjust elite tier (1-24)
```typescript
// Elite players are too important
// Only adjust mid/late tier multipliers
```

**Rule 3:** Minimum sample size required
```typescript
const MIN_SAMPLE_SIZE = 30;

// Need 30+ data points for confident adjustment
```

**Rule 4:** Confidence threshold for auto-apply
```typescript
const MIN_CONFIDENCE = 0.7;

// confidence = min(1.0, sample_size / 100)
// More samples = higher confidence
```

**Rule 5:** Stay within parameter bounds
```typescript
// Each parameter has min/max values
rb_age_decay: min=0.8, max=1.2
young_wr_breakout_weight: min=0.7, max=1.3
```

### Bias Detection Logic

**RB Age Decay:**
```typescript
if (RB_overvalued_bias > 0.65) {
  // RBs consistently underperform
  // → They decline faster than model expects
  // → Increase age decay by 1.5%

  rb_age_decay += 0.015;
}
```

**Young WR Breakouts:**
```typescript
if (WR_undervalued_bias > 0.65) {
  // Young WRs consistently outperform
  // → Breakouts happening more often
  // → Increase breakout weight by 2%

  young_wr_breakout_weight += 0.02;
}
```

**Rookie Optimism:**
```typescript
if (rookie_avg_error > 15 && rookie_overvalued_bias > 0.6) {
  // Rookies consistently overvalued
  // → Market/model too optimistic
  // → Decrease draft capital weight by 2%

  rookie_draft_capital_weight -= 0.02;
}
```

**QB Longevity:**
```typescript
if (QB_overvalued_bias > 0.65 && avg_qb_age > 32) {
  // Older QBs underperforming
  // → Age decay too lenient
  // → Increase QB age decay by 1%

  qb_age_decay += 0.01;
}
```

## Integration with Rebuild Pipeline

### Original Pipeline (Before Self-Correction)

```typescript
async function buildLatestValuesForProfile(profile) {
  1. Load base values (KTC, FantasyPros)
  2. Apply availability modifiers
  3. Apply league multipliers
  4. Apply scarcity adjustment
  5. Apply market anchor
  6. Calculate rankings
  7. Write to latest_player_values
}
```

### Enhanced Pipeline (With Self-Correction)

```typescript
async function buildLatestValuesForProfile(profile) {
  // STEP 0: Load tuned parameters
  const params = await getAllTuningParameters();

  // Apply parameters throughout pipeline:
  1. Load base values (KTC, FantasyPros)

  2. Apply availability modifiers
     - Use params.age_injury_correlation
     - Use params.injury_history_weight

  3. Apply league multipliers
     - Standard multipliers (no tuning)

  4. Apply scarcity adjustment
     - Use params.recent_production_weight
     - Use params.opportunity_weight

  5. Apply market anchor
     - Standard anchor logic

  6. Calculate rankings
     - Use position-specific age decay
     - qb_age_decay, rb_age_decay, wr_age_decay, te_age_decay
     - young_breakout_weights
     - rookie_optimism factors

  7. Write to latest_player_values
}
```

### Example: Age Decay Application

**Before Tuning:**
```typescript
function applyAgeDecay(value, age, position) {
  const baseDecay = getAgeDecay(position);
  // All positions use same decay curve

  return value * (1 - baseDecay * (age - 25));
}
```

**After Tuning:**
```typescript
function applyAgeDecay(value, age, position) {
  // Load tuned parameter
  const tuningParam = await getTuningParameter(`${position.toLowerCase()}_age_decay`);

  const baseDecay = getAgeDecay(position);
  const tunedDecay = baseDecay * tuningParam;

  return value * (1 - tunedDecay * (age - 25));
}

// Example:
RB age 28, value 5000
baseDecay = 0.05 per year
rb_age_decay = 1.15 (learned from data)
tunedDecay = 0.05 * 1.15 = 0.0575
adjusted_value = 5000 * (1 - 0.0575 * 3) = 4137

// Model learned RBs decline 15% faster than initially thought
```

### Example: Breakout Application

**Before Tuning:**
```typescript
function applyBreakoutBoost(value, age, position, production_percentile) {
  if (age <= 25 && production_percentile >= 85) {
    return value * 1.15; // 15% boost for young high-producers
  }
  return value;
}
```

**After Tuning:**
```typescript
function applyBreakoutBoost(value, age, position, production_percentile) {
  if (age <= 25 && production_percentile >= 85) {
    const tuningParam = await getTuningParameter(`young_${position.toLowerCase()}_breakout_weight`);

    const baseBoost = 1.15;
    const tunedBoost = 1.0 + ((baseBoost - 1.0) * tuningParam);

    return value * tunedBoost;
  }
  return value;
}

// Example:
Young WR breakout candidate, value 6000
baseBoost = 1.15 (15%)
young_wr_breakout_weight = 1.25 (learned they break out more often)
tunedBoost = 1.0 + (0.15 * 1.25) = 1.1875
adjusted_value = 6000 * 1.1875 = 7125

// Model learned young WR breakouts happen 25% more often
```

## Confidence Scoring Enhancement

### Original Confidence

```typescript
confidence = base_confidence * market_agreement
```

### Enhanced Confidence (Self-Correction)

```typescript
// Load position accuracy from recent history
const positionErrorRate = await getPositionErrorRate(position, 'dynasty', 4);

// Calculate experience factor
const experienceFactor = calculateExperienceFactor(years_exp);

// Enhanced confidence
confidence =
  base_confidence
  * (1 - positionErrorRate)
  * experienceFactor
  * market_agreement;
```

**Position Error Rate:**
```
Recent 4-week average error for position

QB avg_error: 8.2 ranks → error_rate = 0.082
RB avg_error: 12.5 ranks → error_rate = 0.125
WR avg_error: 10.1 ranks → error_rate = 0.101
TE avg_error: 9.8 ranks → error_rate = 0.098
```

**Experience Factor:**
```typescript
function calculateExperienceFactor(years_exp) {
  if (years_exp === 0) return 0.6;  // Rookies: 60% confidence
  if (years_exp === 1) return 0.75; // 2nd year: 75%
  if (years_exp === 2) return 0.85; // 3rd year: 85%
  return 1.0;                       // Veterans: 100%
}
```

**Example:**
```
Patrick Mahomes (QB, 7 years exp)
base_confidence: 0.95
position_error_rate: 0.082
experience_factor: 1.0
market_agreement: 0.98

confidence = 0.95 * (1 - 0.082) * 1.0 * 0.98
confidence = 0.95 * 0.918 * 1.0 * 0.98
confidence = 0.855 (85.5%)

Rookie QB (0 years exp)
base_confidence: 0.70
position_error_rate: 0.082
experience_factor: 0.6
market_agreement: 0.75

confidence = 0.70 * 0.918 * 0.6 * 0.75
confidence = 0.289 (28.9%)
```

## Model Health Dashboard

### Admin Interface

**Component:** `src/components/ModelHealthDashboard.tsx`

Displays:
1. **System Health Overview**
   - Total parameters
   - Auto-tune enabled count
   - Parameters adjusted
   - Average adjustment magnitude
   - Recent accuracy score

2. **Accuracy Trends by Position**
   - Last 4 weeks error trends
   - Improving vs declining indicators
   - Current accuracy score
   - Position-specific metrics

3. **Parameter Adjustments Table**
   - All tunable parameters
   - Current vs default values
   - Total adjustment (%)
   - Adjustment count
   - Last adjusted date

4. **Recent Learning Activity**
   - Latest parameter changes
   - Trigger reasons
   - Confidence scores
   - Auto vs manual adjustments

### API Endpoints

**GET /api/admin/model-health**
```json
{
  "healthy": true,
  "warnings": [],
  "stats": {
    "total_parameters": 19,
    "auto_tune_enabled": 15,
    "parameters_adjusted": 8,
    "avg_adjustment": 0.023,
    "recent_accuracy": 0.847
  }
}
```

**GET /api/admin/accuracy-trends?position=RB&format=dynasty&weeks=4**
```json
{
  "position": "RB",
  "format": "dynasty",
  "avg_error_trend": [12.3, 11.8, 10.9, 10.5],
  "accuracy_score_trend": [0.877, 0.882, 0.891, 0.895],
  "improving": true
}
```

**GET /api/admin/parameter-summary**
```json
[
  {
    "parameter": "rb_age_decay",
    "category": "age_decay",
    "current_value": 1.048,
    "default_value": 1.0,
    "total_adjustment": 0.048,
    "adjustment_count": 6,
    "last_adjusted_at": "2024-10-15T14:22:00Z"
  }
]
```

## Example Scenarios

### Scenario 1: RB Age Decline Learning

**Week 1-4 Results:**
```
Predicted: Dalvin Cook #8 RB (age 29)
Actual:    Dalvin Cook #18 RB (10.2 ppg)
Error: 10 ranks (overvalued)

Predicted: Leonard Fournette #12 RB (age 29)
Actual:    Leonard Fournette #28 RB (7.8 ppg)
Error: 16 ranks (overvalued)

Predicted: Aaron Jones #10 RB (age 29)
Actual:    Aaron Jones #15 RB (11.5 ppg)
Error: 5 ranks (overvalued)

Pattern: Aging RBs consistently underperform
RB overvalued_bias: 0.68 (68%)
```

**Tuning Response:**
```
Detected bias: RBs consistently overvalued
Sample size: 42 RBs over 4 weeks
Confidence: 0.84

Proposed adjustment:
rb_age_decay: 1.0 → 1.015 (+1.5%)

Applied: Yes (within ±5% limit, high confidence)

Result: Future RB values decay 1.5% faster with age
```

### Scenario 2: Young WR Breakout Learning

**Week 1-4 Results:**
```
Predicted: Puka Nacua #45 WR (age 23, rookie)
Actual:    Puka Nacua #8 WR (18.3 ppg)
Error: 37 ranks (undervalued)

Predicted: Jordan Addison #62 WR (age 22, rookie)
Actual:    Jordan Addison #35 WR (12.1 ppg)
Error: 27 ranks (undervalued)

Predicted: Rashee Rice #78 WR (age 23, rookie)
Actual:    Rashee Rice #42 WR (11.8 ppg)
Error: 36 ranks (undervalued)

Pattern: Young WRs breaking out faster than expected
WR undervalued_bias: 0.71 (71%)
```

**Tuning Response:**
```
Detected bias: Young WRs consistently undervalued
Sample size: 38 young WRs over 4 weeks
Confidence: 0.76

Proposed adjustment:
young_wr_breakout_weight: 1.0 → 1.02 (+2%)

Applied: Yes (within ±5% limit, sufficient confidence)

Result: Young WR breakout candidates get 2% higher values
```

### Scenario 3: Rookie QB Optimism Learning

**Week 1-4 Results:**
```
Predicted: Anthony Richardson #15 QB (rookie)
Actual:    Anthony Richardson #28 QB (injured Week 5)
Error: 13 ranks (overvalued)

Predicted: Will Levis #22 QB (rookie)
Actual:    Will Levis #31 QB (12.8 ppg, inconsistent)
Error: 9 ranks (overvalued)

Pattern: Rookie QBs overvalued
Rookie QB overvalued_bias: 0.64 (64%)
```

**Tuning Response:**
```
Detected bias: Rookie QBs overvalued
Sample size: 8 rookie QBs over 4 weeks (small sample!)
Confidence: 0.16 (low confidence)

Proposed adjustment:
rookie_qb_optimism: 1.0 → 0.98 (-2%)

Applied: No (confidence too low, need more data)

Result: Adjustment deferred until more data collected
```

### Scenario 4: Safe Boundary Protection

**Week 1-4 Results:**
```
Massive bias detected: TEs overvalued by 85%
Sample size: 52 TEs over 4 weeks
Confidence: 1.0

Ideal adjustment: -12% (bring values down significantly)
```

**Tuning Response:**
```
Proposed adjustment exceeds safe boundary:
te_age_decay: 1.0 → 1.12 (+12%)

Safety cap applied:
te_age_decay: 1.0 → 1.05 (+5% max)

Applied: Yes (capped at safe limit)

Note: Large bias detected but incremental adjustment applied.
Will continue adjusting in subsequent weeks if bias persists.

Result: Gradual correction over multiple weeks instead of overcorrection
```

## Monitoring & Validation

### Key Metrics

**1. Accuracy Score Trends**
```sql
SELECT
  position,
  AVG(accuracy_score) as avg_accuracy,
  COUNT(*) as weeks_tracked
FROM model_accuracy_history
WHERE season = 2024
  AND format = 'dynasty'
GROUP BY position
ORDER BY avg_accuracy DESC;

Expected:
QB: 0.90+ (most predictable)
WR: 0.85+ (high variance)
RB: 0.82+ (age/injury volatility)
TE: 0.88+ (less depth)
```

**2. Parameter Drift**
```sql
SELECT
  parameter,
  current_value - default_value as drift,
  adjustment_count
FROM model_tuning_parameters
WHERE auto_tune = true
ORDER BY ABS(current_value - default_value) DESC;

Healthy: Most parameters within ±10% of default
Warning: Any parameter >20% from default
Alert: Any parameter at min/max boundary
```

**3. Learning Velocity**
```sql
SELECT
  COUNT(*) as total_adjustments,
  AVG(ABS(adjustment)) as avg_magnitude,
  COUNT(*) FILTER (WHERE auto_applied = true) as auto_count,
  COUNT(*) FILTER (WHERE auto_applied = false) as manual_count
FROM model_learning_audit
WHERE created_at >= NOW() - INTERVAL '4 weeks';

Healthy: 2-5 auto adjustments per week
Warning: >10 adjustments per week (too volatile)
Alert: 0 adjustments for 4+ weeks (system not learning)
```

### Validation Queries

**Check Recent Accuracy:**
```sql
SELECT
  position,
  format,
  AVG(accuracy_score) as avg_accuracy,
  AVG(avg_error) as avg_error,
  COUNT(*) as weeks
FROM model_accuracy_history
WHERE created_at >= NOW() - INTERVAL '4 weeks'
GROUP BY position, format
ORDER BY position, format;
```

**Check Parameter Health:**
```sql
SELECT *
FROM parameter_adjustment_summary
WHERE ABS(total_adjustment) > 0.15  -- >15% from default
ORDER BY ABS(total_adjustment) DESC;
```

**Check Learning Activity:**
```sql
SELECT
  parameter,
  adjustment,
  trigger_reason,
  confidence,
  created_at
FROM model_learning_audit
ORDER BY created_at DESC
LIMIT 20;
```

## Troubleshooting

### Issue: Low Accuracy Scores

**Symptom:** accuracy_score < 0.70 for multiple weeks

**Possible Causes:**
1. Injury luck (unpredictable injuries skewing results)
2. Model parameters need more time to converge
3. External factors (coaching changes, trades)

**Fix:**
1. Review biggest misses for patterns
2. Check if injuries are the primary cause
3. Consider manual parameter adjustment
4. Wait 2-3 more weeks for auto-tuning

### Issue: Parameters Not Adjusting

**Symptom:** adjustment_count = 0 for all parameters

**Possible Causes:**
1. Accuracy metrics not being calculated
2. Sample sizes too small (need 30+ per position)
3. Biases not reaching 65% threshold
4. Auto-tune disabled

**Fix:**
1. Verify weekly jobs are running
2. Check accuracy_history table has recent data
3. Review bias thresholds (may need to lower)
4. Ensure auto_tune = true for parameters

### Issue: Excessive Parameter Drift

**Symptom:** Parameters >20% from default

**Possible Causes:**
1. Model responding to temporary anomalies
2. Safety boundaries too permissive
3. Sustained real bias in model

**Fix:**
1. Review audit log for adjustment reasons
2. Consider tightening ±5% weekly limit
3. Manually reset parameter if needed
4. Investigate if real pattern or noise

### Issue: Confidence Scores Too Low

**Symptom:** All confidence_score < 0.50

**Possible Causes:**
1. High prediction errors (model struggling)
2. Rookies dominating (low experience factor)
3. Position error rates high

**Fix:**
1. Allow learning system more time
2. Review position-specific error rates
3. Consider if current season unusual
4. May need to collect more historical data

## Summary

### System Benefits

✅ **Continuous Improvement**
- Model learns from actual results
- Systematic biases corrected automatically
- Performance improves season-over-season

✅ **Transparency**
- All adjustments logged and visible
- Clear reasoning for each change
- Admin dashboard for monitoring

✅ **Safety**
- Never changes past values (historical integrity)
- ±5% max adjustment per week
- Elite tier protected from auto-tuning
- Minimum sample size requirements

✅ **Flexibility**
- Manual override capability
- Parameter reset functionality
- Adjustable safety boundaries
- Extensible bias detection

### Key Rules

1. **Predictions captured BEFORE games (Tuesday)**
2. **Results synced AFTER games (Tuesday)**
3. **Accuracy measured weekly (Tuesday)**
4. **Parameters adjusted within ±5% max**
5. **Elite tier (1-24) never auto-adjusted**
6. **Minimum 30 samples required for tuning**
7. **All changes logged in audit table**
8. **Manual override always available**

### Integration Checklist

- [x] Database tables created
- [x] Weekly results sync job
- [x] Prediction capture system
- [x] Accuracy calculator
- [x] Bias detection logic
- [x] Auto-tuning system
- [x] Parameter loading in rebuild
- [x] Enhanced confidence scoring
- [x] Model health dashboard
- [ ] Schedule weekly cron jobs
- [ ] Add admin dashboard to app
- [ ] Monitor first season of learning
- [ ] Calibrate safety thresholds if needed
- [ ] Build reporting for season analysis

**This system completes the value calculation stack, creating a truly intelligent model that learns and adapts from real-world fantasy football results.**
