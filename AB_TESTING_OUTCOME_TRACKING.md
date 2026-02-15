# A/B Testing & Outcome Impact Tracking

## Overview

The **A/B Testing & Outcome Impact Tracking** system measures whether your rankings, advice, and trade recommendations actually improve user results. It tracks decisions users make and compares predicted vs real outcomes.

**The Big Question:** Does our advice work?

**The Answer:** You'll know, not guess.

## Core Innovation

**Before:**
```
Think improvement helps → Deploy → Hope for the best → Never know for sure
```

**After:**
```
Think improvement helps → A/B Test → Measure outcomes → Know with confidence → Roll out winner
```

**This transforms your app from "fantasy app" to "evolving analytics product"**

## Architecture

### 1. Experiment Framework

**Purpose:** Safe feature testing with controlled rollout

**Tables:**
- `feature_experiments` - A/B/C test definitions
- `experiment_variants` - Different versions being tested
- `user_experiment_assignments` - Sticky user-to-variant mapping

**Key Function:**
```typescript
getExperimentVariant(userId, 'scarcity_formula_v2')
// Returns: 'control' | 'new_formula' | 'variant_c'
```

**Assignment is sticky:** Same user always gets same variant (consistent experience)

**Example:**
```typescript
// Create experiment
await createExperiment(
  'scarcity_formula_v2',
  'Test new scarcity adjustment with stronger RB premium',
  [
    { variant: 'control', trafficPercent: 50, config: { useNewFormula: false } },
    { variant: 'new_formula', trafficPercent: 50, config: { useNewFormula: true, rbPremium: 1.25 } }
  ]
);

// In your code
const variant = await getExperimentVariant(userId, 'scarcity_formula_v2');
const config = await getVariantConfig(userId, 'scarcity_formula_v2');

if (config.useNewFormula) {
  // Use new scarcity formula
  scarcityAdjustment = calculateNewScarcity(player, config.rbPremium);
} else {
  // Use control formula
  scarcityAdjustment = calculateScarcity(player);
}
```

### 2. User Action Tracking (CRITICAL)

**Purpose:** Track what users actually do so model can learn

**Table:** `user_actions`

**Tracked Actions:**
- `trade_sent` - User initiated trade
- `trade_accepted` - User accepted trade offer
- `trade_rejected` - User rejected trade
- `pickup` - Added player from waivers
- `drop` - Dropped player
- `start` - Started player in lineup
- `bench` - Benched player
- `viewed_advice` - Viewed advice panel
- `followed_advice` - Acted on advice
- `ignored_advice` - Saw advice but didn't follow
- `player_searched` - Searched for player
- `player_viewed` - Viewed player detail
- `value_checked` - Checked player value
- `watchlist_added` - Added to watchlist
- `trade_calculated` - Used trade calculator

**Example:**
```typescript
// Track trade
await trackTrade(userId, 'trade_accepted', {
  leagueId: 'abc123',
  givingValue: 5000,
  receivingValue: 5200,
  netValue: 200,
  players: ['player1', 'player2']
});

// Track advice
await trackAdviceAction(userId, 'followed_advice', {
  playerId: 'player123',
  adviceType: 'buy_low',
  confidence: 85
});

// Track roster move
await trackRosterAction(userId, 'pickup', {
  leagueId: 'abc123',
  playerId: 'player456',
  playerValue: 1200,
  week: 8
});
```

**Why This Matters:**
- Model learns from user behavior
- Can correlate actions with outcomes
- Identifies most valuable features
- Powers personalization

### 3. Advice Outcome Tracking

**Purpose:** Did our advice predictions come true?

**Table:** `advice_outcomes`

**Flow:**
```
1. Generate advice: "Buy low on Player X" → predicted_direction = 'up'
2. Record prediction
3. Wait for week to complete
4. Evaluate: Did value actually go up?
5. Update: actual_direction = 'up', success = true
```

**Prediction Types:**
- **Buy Low:** Predict value will go `up`
- **Sell High:** Predict value will go `down`
- **Breakout:** Predict significant `up` move

**Evaluation Logic:**
```typescript
// Record prediction
await recordAdvicePrediction('player123', 'up', {
  adviceId: 'advice_xyz',
  week: 8
});

// Later: Evaluate outcome (run via cron)
await evaluateAdviceOutcome(outcomeId);
// Checks if player value actually increased
// Sets success = true/false
```

**Metrics:**
```typescript
// Buy low success rate
const buyLowRate = await getBuyLowSuccessRate(startWeek, endWeek);
console.log(`Buy low hit rate: ${buyLowRate}%`);

// Sell high success rate
const sellHighRate = await getSellHighSuccessRate(startWeek, endWeek);
console.log(`Sell high hit rate: ${sellHighRate}%`);

// Breakout detection accuracy
const breakoutRate = await getBreakoutDetectionAccuracy(startWeek, endWeek);
console.log(`Breakout accuracy: ${breakoutRate}%`);
```

### 4. Trade Outcome Evaluation

**Purpose:** Were trade recommendations good?

**Table:** `trade_outcomes`

**Evaluation Windows:**
- **14 days:** Short-term impact
- **30 days:** Long-term impact

**Flow:**
```
1. User accepts trade
2. Schedule evaluation for +14 and +30 days
3. Calculate fantasy points gained by each team
4. Determine winner: team_a | team_b | tie
5. Check if model prediction was correct
```

**Example:**
```typescript
// When trade accepted
await scheduleTradeEvaluation(
  'trade_abc',
  ['player1', 'player2'], // Team A gave
  ['player3'], // Team B gave
  5000, // Team A value given
  5200, // Team B value given
  85 // Confidence
);

// After 14/30 days (run via cron)
await evaluateTradeOutcome('trade_abc', 30);
// Calculates actual points gained
// Determines if Team A (who got more value) actually won
```

**Metrics:**
```typescript
// Trade success rate
const tradeRate = await getTradeSuccessRate(30);
console.log(`Trade win rate (30-day): ${tradeRate}%`);

// Success by confidence level
const byConfidence = await getTradeSuccessByConfidence(30);
/*
[
  { confidenceRange: '76-100%', total: 45, successful: 40, rate: 88.9 },
  { confidenceRange: '51-75%', total: 32, successful: 24, rate: 75.0 },
  { confidenceRange: '26-50%', total: 18, successful: 10, rate: 55.6 },
  { confidenceRange: '0-25%', total: 5, successful: 2, rate: 40.0 }
]
*/
```

### 5. Model Performance Calculation

**Purpose:** Overall model health tracking

**Table:** `model_performance_history`

**Daily Calculation:**
```typescript
await updateModelPerformance(new Date());
// Calculates:
// - accuracy_score (weighted: advice 60% + trades 40%)
// - advice_score (advice success rate)
// - trade_score (trade success rate)
// - confidence (based on sample size)
// - total_predictions
// - total_trades
```

**Metrics:**
```typescript
// Latest performance
const latest = await getLatestModelPerformance();
console.log(`Accuracy: ${latest.accuracyScore}%`);
console.log(`Advice Score: ${latest.adviceScore}%`);
console.log(`Trade Score: ${latest.tradeScore}%`);
console.log(`Confidence: ${latest.confidence}%`);

// 7-day rolling average
const rolling = await getRollingAveragePerformance(7);

// Performance trend
const trend = await getPerformanceTrend(7);
console.log(`Trend: ${trend.trend}`); // improving | stable | declining
console.log(`Average change: ${trend.averageChange}% per day`);

// Detect regression
const regression = await detectRegression(new Date());
if (regression.hasRegression) {
  console.error('REGRESSION DETECTED:', regression.degradedMetrics);
  // Alert team!
}
```

**Regression Detection:**
```typescript
// Compare today vs yesterday
const comparison = await comparePerformance(today, yesterday);
/*
[
  {
    metric: 'Overall Accuracy',
    current: 82.5,
    previous: 78.3,
    change: 4.2,
    changePercent: 5.4,
    direction: 'up',
    status: 'improved'
  },
  {
    metric: 'Trade Score',
    current: 68.2,
    previous: 75.8,
    change: -7.6,
    changePercent: -10.0,
    direction: 'down',
    status: 'degraded'  // ⚠️ Alert!
  }
]
*/
```

### 6. Adaptive Rollout

**Purpose:** Gradually increase traffic to winning variants

**Key Innovation:** Never blindly deploy changes - let data decide

**Flow:**
```
1. Run experiment with 50/50 split
2. Collect data (advice outcomes, trade outcomes, engagement)
3. Evaluate performance: Is variant significantly better?
4. If yes: Increase variant traffic (50% → 70% → 90% → 100%)
5. If no: Maintain or reduce traffic
6. When winner clear: Declare winner, deactivate experiment
```

**Example:**
```typescript
// Evaluate experiment
const decisions = await evaluateExperimentRollout(
  experimentId,
  'advice_success' // metric to optimize
);

/*
[
  {
    action: 'increase_traffic',
    variant: 'new_formula',
    currentTraffic: 50,
    recommendedTraffic: 70,
    reason: 'Strong performance (+12.3% improvement), increasing traffic',
    confidence: 85
  }
]
*/

// Apply decision (can be automated)
await applyRolloutDecision(experimentId, decisions[0]);

// Auto-rollout (run periodically)
await autoRolloutExperiment(experimentId, 'advice_success');
```

**Traffic Increase Logic:**
```
Improvement > 20% → +25% traffic
Improvement > 15% → +20% traffic
Improvement > 10% → +15% traffic
Improvement > 5%  → +10% traffic

Requires:
- Statistical significance (z-test, p < 0.05)
- Minimum sample size (50 per variant)
```

**Safety:**
```typescript
// Get experiment performance summary
const summary = await getExperimentPerformanceSummary(experimentId, 'advice_success');

if (summary.winner) {
  console.log(`Winner: ${summary.winner}`);
  console.log(`Improvement: ${summary.improvement}%`);
  // Variant has won - safe to roll out 100%
}
```

### 7. Admin Dashboard

**Component:** `ModelPerformanceDashboard.tsx`

**Displays:**

**Overview Tab:**
- Key metrics (accuracy, advice score, trade score, confidence)
- Performance alerts (regressions)
- 7-day rolling averages
- Performance trend (improving/stable/declining)
- Recent performance (last 7 days)

**Experiments Tab:**
- Active experiments
- Variant performance
- Rollout recommendations
- Winner declarations

**History Tab:**
- 30-day performance history
- Daily breakdown
- Trend visualization

**API Endpoint:**
```
GET /functions/v1/admin-model-performance?days=30

Response:
{
  success: true,
  summary: {
    latest: { date, accuracyScore, adviceScore, tradeScore, confidence, ... },
    buyLowHitRate: 78.5,
    sellHighHitRate: 82.3,
    tradeWinRate: 71.2,
    hasRegression: false,
    degradedMetrics: []
  },
  history: [...],
  experiments: [...],
  topActions: [
    { type: 'trade_calculated', count: 1250 },
    { type: 'player_viewed', count: 890 },
    ...
  ]
}
```

## Usage Examples

### Example 1: Test New Scarcity Formula

```typescript
// 1. Create experiment
await createExperiment(
  'scarcity_v2',
  'Test stronger RB premium in scarcity calculation',
  [
    { variant: 'control', trafficPercent: 50, config: { rbMultiplier: 1.0 } },
    { variant: 'stronger_rb', trafficPercent: 50, config: { rbMultiplier: 1.3 } }
  ]
);

// 2. Update scarcity calculation code
async function calculateScarcity(player: Player, userId: string) {
  const variant = await getExperimentVariant(userId, 'scarcity_v2');
  const config = await getVariantConfig(userId, 'scarcity_v2');

  const baseScarcity = getPositionalScarcity(player);

  if (player.position === 'RB') {
    return baseScarcity * config.rbMultiplier;
  }

  return baseScarcity;
}

// 3. Track when advice is given
await recordAdvicePrediction(playerId, 'up', { adviceId: 'advice_123', week: 8 });

// 4. Wait for outcomes (automated via cron)
// Edge function runs: evaluate-advice-outcomes

// 5. Check performance (after 1-2 weeks)
const summary = await getExperimentPerformanceSummary('scarcity_v2', 'advice_success');

if (summary.improvement > 10 && summary.recommendation[0].action === 'increase_traffic') {
  // Variant is winning!
  await applyRolloutDecision('scarcity_v2', summary.recommendation[0]);
}

// 6. Eventually: Winner declared at 95%+ traffic
// Deactivate experiment, make variant permanent
```

### Example 2: Test Market Anchor Strength

```typescript
// Test different weightings of market consensus
await createExperiment(
  'market_anchor_v2',
  'Test reduced market anchor weight for more model confidence',
  [
    { variant: 'control', trafficPercent: 34, config: { marketWeight: 0.5 } },
    { variant: 'lower_anchor', trafficPercent: 33, config: { marketWeight: 0.3 } },
    { variant: 'higher_anchor', trafficPercent: 33, config: { marketWeight: 0.7 } }
  ]
);

// Monitor trade outcomes
const tradePerformance = await getExperimentPerformanceSummary(
  'market_anchor_v2',
  'trade_success'
);

console.log('Variant Performance:');
tradePerformance.variants.forEach(v => {
  console.log(`${v.variant}: ${v.successRate}% (${v.sampleSize} trades)`);
});
```

### Example 3: Test Breakout Detection Boost

```typescript
// Test stronger boost for breakout candidates
await createExperiment(
  'breakout_boost_v2',
  'Test increased value boost for breakout candidates',
  [
    { variant: 'control', trafficPercent: 50, config: { breakoutBoost: 1.15 } },
    { variant: 'stronger', trafficPercent: 50, config: { breakoutBoost: 1.25 } }
  ]
);

// Measure breakout detection accuracy
const accuracy = await getBreakoutDetectionAccuracy(startWeek, endWeek);
console.log(`Breakout detection accuracy: ${accuracy}%`);
```

## Cron Jobs / Scheduled Tasks

**Daily:**
```typescript
// 1. Evaluate advice outcomes (6 AM)
// Edge function: evaluate-advice-outcomes
// Checks if predictions from previous week came true

// 2. Update model performance (7 AM)
// Edge function: update-model-performance
// Calculates daily accuracy/advice/trade scores

// 3. Check for regressions (8 AM)
const regression = await detectRegression(new Date());
if (regression.hasRegression) {
  // Alert via Slack/email
  sendAlert('Performance Regression', regression.degradedMetrics);
}
```

**Weekly:**
```typescript
// 1. Evaluate experiments (Monday 9 AM)
const experiments = await getActiveExperiments();
for (const exp of experiments) {
  await autoRolloutExperiment(exp.id, 'advice_success');
}

// 2. Evaluate 14-day trade outcomes
await batchEvaluateTrades(14);

// 3. Generate performance report
const summary = await getPerformanceSummary();
sendWeeklyReport(summary);
```

**Monthly:**
```typescript
// 1. Evaluate 30-day trade outcomes
await batchEvaluateTrades(30);

// 2. Archive old data
// 3. Generate monthly insights report
```

## Benefits

### Before (No Tracking)

```
❌ Don't know if advice works
❌ Can't test improvements safely
❌ Blind deploys (hope for the best)
❌ No idea what users actually do
❌ Can't measure model accuracy
❌ Regressions go undetected
❌ Can't prove value to users
```

### After (Full Tracking)

```
✅ Know exactly if advice works (78% buy low hit rate)
✅ Safe A/B testing of all changes
✅ Data-driven rollouts (not guesses)
✅ Learn from user behavior
✅ Track model accuracy over time
✅ Instant regression alerts
✅ Prove value with real metrics
```

## Key Metrics to Monitor

### Model Health
- **Overall Accuracy:** 80%+ (target)
- **Advice Score:** 75%+ (target)
- **Trade Score:** 70%+ (target)
- **Confidence:** 80%+ (target)

### Advice Performance
- **Buy Low Hit Rate:** 75%+ (target)
- **Sell High Hit Rate:** 80%+ (target)
- **Breakout Detection:** 70%+ (target)

### Trade Performance
- **14-Day Win Rate:** 65%+ (target)
- **30-Day Win Rate:** 70%+ (target)
- **High Confidence (76-100%):** 85%+ (target)

### User Engagement
- **Actions per User:** 20+/week (target)
- **Advice Follow Rate:** 30%+ (target)
- **Trade Calculator Usage:** 10+/week (target)

## Safety Net Features

### 1. Regression Detection

**Automatic Alerts When:**
- Accuracy drops >5% day-over-day
- Advice score drops >10% day-over-day
- Trade score drops >10% day-over-day
- Confidence drops >20% day-over-day

**Response:**
```typescript
if (regression.hasRegression) {
  // 1. Alert team immediately
  sendSlackAlert(`⚠️ Performance regression detected: ${regression.degradedMetrics.join(', ')}`);

  // 2. Roll back recent experiments
  await deactivateExperiment(recentExperimentId);

  // 3. Investigate cause
  const recentChanges = await getRecentDeployments();

  // 4. Fix and re-test
}
```

### 2. Experiment Safeguards

**Automatic Protections:**
- Minimum 50 samples per variant before decisions
- Statistical significance required (p < 0.05)
- Gradual rollout (never 0% → 100%)
- Can roll back if performance degrades

**Example:**
```typescript
// Variant performing worse?
if (decision.action === 'decrease_traffic') {
  // Automatically reduce traffic
  await applyRolloutDecision(experimentId, decision);

  // If still worse, kill experiment
  if (currentTraffic <= 10) {
    await deactivateExperiment(experimentId);
  }
}
```

### 3. Confidence Tracking

**Low Confidence Handling:**
```typescript
const performance = await getLatestModelPerformance();

if (performance.confidence < 50) {
  // Not enough data - don't make changes
  console.warn('Insufficient data for confident decisions');
  return;
}

if (performance.confidence >= 80) {
  // High confidence - safe to act
  await applyRecommendedChanges();
}
```

## Files Created

### Database Migration
- `supabase/migrations/create_ab_testing_and_outcome_tracking.sql`

### Core Libraries
- `src/lib/experiments/getExperimentVariant.ts` (280 lines) - Experiment assignment
- `src/lib/experiments/adaptiveRollout.ts` (350 lines) - Adaptive traffic management
- `src/lib/tracking/trackUserAction.ts` (370 lines) - User action tracking
- `src/lib/tracking/evaluateAdviceOutcome.ts` (340 lines) - Advice evaluation
- `src/lib/tracking/evaluateTradeOutcome.ts` (320 lines) - Trade evaluation
- `src/lib/tracking/calculateModelPerformance.ts` (380 lines) - Performance calculator

### UI Components
- `src/components/ModelPerformanceDashboard.tsx` (430 lines) - Admin dashboard

### Edge Functions
- `supabase/functions/evaluate-advice-outcomes/index.ts` - Daily advice evaluation
- `supabase/functions/update-model-performance/index.ts` - Daily performance update
- `supabase/functions/admin-model-performance/index.ts` - Admin API

### Database Tables
- `feature_experiments` - A/B test definitions
- `experiment_variants` - Test variants
- `user_experiment_assignments` - User assignments
- `user_actions` - User behavior tracking
- `advice_outcomes` - Advice prediction results
- `trade_outcomes` - Trade evaluation results
- `model_performance_history` - Daily performance metrics

### Helper Functions (Database)
- `get_experiment_variant(user_id, experiment_key)` - Sticky assignment
- `calculate_advice_success_rate(start_date, end_date)` - Advice metrics
- `calculate_trade_success_rate(start_date, end_date, window)` - Trade metrics
- `update_model_performance(date)` - Daily calculation

## Quick Start

### 1. Track User Actions

```typescript
import { trackUserAction, trackTrade, trackAdviceAction } from '@/lib/tracking/trackUserAction';

// In your trade component
await trackTrade(userId, 'trade_accepted', {
  leagueId,
  givingValue: 5000,
  receivingValue: 5200,
  netValue: 200
});

// In your advice component
await trackAdviceAction(userId, 'followed_advice', {
  playerId,
  adviceType: 'buy_low',
  confidence: 85
});
```

### 2. Record Advice Predictions

```typescript
import { recordAdvicePrediction } from '@/lib/tracking/evaluateAdviceOutcome';

// When generating advice
const outcomeId = await recordAdvicePrediction(playerId, 'up', {
  adviceId: generatedAdviceId,
  week: currentWeek
});
```

### 3. Create Experiment

```typescript
import { createExperiment } from '@/lib/experiments/getExperimentVariant';

await createExperiment(
  'new_feature',
  'Test new feature',
  [
    { variant: 'control', trafficPercent: 50, config: {} },
    { variant: 'new', trafficPercent: 50, config: { enabled: true } }
  ]
);
```

### 4. Use Variant in Code

```typescript
import { getExperimentVariant, getVariantConfig } from '@/lib/experiments/getExperimentVariant';

const variant = await getExperimentVariant(userId, 'new_feature');
const config = await getVariantConfig(userId, 'new_feature');

if (config.enabled) {
  // Use new feature
} else {
  // Use old feature
}
```

### 5. Monitor Performance

```typescript
import { getPerformanceSummary } from '@/lib/tracking/calculateModelPerformance';

const summary = await getPerformanceSummary();

console.log(`Accuracy: ${summary.latest?.accuracyScore}%`);
console.log(`Trend: ${summary.trend.trend}`);

if (summary.regression.hasRegression) {
  console.error('Regression detected!', summary.regression.degradedMetrics);
}
```

### 6. View Admin Dashboard

```tsx
import { ModelPerformanceDashboard } from '@/components/ModelPerformanceDashboard';

function AdminPage() {
  return <ModelPerformanceDashboard />;
}
```

## Summary

You now have a complete **A/B Testing & Outcome Impact Tracking** system that:

1. **Tracks Everything** - User actions, advice predictions, trade outcomes
2. **Measures Results** - Buy low hit rate, trade win rate, model accuracy
3. **Enables Safe Testing** - A/B test any change with controlled rollout
4. **Learns from Users** - Understands what users actually do
5. **Detects Regressions** - Automatic alerts when performance degrades
6. **Adaptive Rollout** - Gradually increases traffic to winning variants
7. **Proves Value** - Real metrics showing advice actually works

**Before:** Think improvements help

**After:** Know improvements help

**This is the difference between a fantasy app... and an evolving analytics product.**

Never blindly change the model again. Let data decide.
