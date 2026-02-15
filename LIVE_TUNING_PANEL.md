# Live Tuning Panel - Complete Implementation

## Overview

**Live Tuning Panel** lets you adjust model weights and thresholds in real-time without code changes or deploys. Tune your valuation economy like a game balance patch.

**Core Guarantee:** Change how players are valued instantly - no rebuild, no redeploy, just tune and go.

---

## 🎯 System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   LIVE TUNING SYSTEM                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Database-Driven Config                                  │
│     └─ model_config table (23 tunable parameters)          │
│     └─ Live updates, no code changes needed                │
│                                                              │
│  2. Config Loader with Caching                              │
│     ├─ 60-second cache TTL                                  │
│     ├─ Fallback to safe defaults                           │
│     └─ Never crashes rebuild                                │
│                                                              │
│  3. Automatic Rebuild Trigger                               │
│     ├─ Detects config changes via trigger                   │
│     ├─ Queues rebuild job                                   │
│     ├─ Creates new value epoch                              │
│     └─ Invalidates caches                                   │
│                                                              │
│  4. Admin UI with Sliders                                   │
│     ├─ Visual tuning by category                            │
│     ├─ Real-time preview                                    │
│     ├─ Safety guardrails                                    │
│     └─ Change history with revert                           │
│                                                              │
│  5. Preview Mode                                            │
│     ├─ In-memory simulation                                 │
│     ├─ No DB writes                                         │
│     ├─ Shows top value changes                              │
│     └─ Impact analysis                                      │
│                                                              │
│  6. Version History                                         │
│     └─ model_config_history table                           │
│     └─ One-click revert                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Tunable Parameters (23 Total)

### **Core Value Weights** (5 parameters)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `production_weight` | 0.60 | 0.30-0.80 | Weight given to production stats |
| `age_curve_weight` | 0.10 | 0.00-0.30 | Weight given to age-based adjustments |
| `snap_share_weight` | 0.20 | 0.10-0.40 | Weight given to opportunity metrics |
| `depth_chart_weight` | 0.10 | 0.00-0.20 | Weight given to depth chart position |
| `rookie_draft_capital_weight` | 0.35 | 0.20-0.60 | Weight given to draft capital for rookies |

**Constraint:** Sum of all `*_weight` parameters cannot exceed 1.5

### **Market Behavior** (4 parameters)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `market_anchor_tier1` | 0.15 | 0.05-0.40 | Market anchor strength for elite (top 5%) |
| `market_anchor_tier2` | 0.20 | 0.10-0.50 | Market anchor for high-end (top 25%) |
| `market_anchor_tier3` | 0.25 | 0.15-0.60 | Market anchor for mid-tier |
| `market_anchor_tier4` | 0.35 | 0.20-0.70 | Market anchor for depth players |

**Lower values = more model-driven, Higher values = more market consensus**

### **Advice Engine** (3 parameters)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `breakout_usage_threshold` | 0.25 | 0.15-0.40 | Min usage % for breakout candidate flag |
| `buy_low_delta` | 600 | 300-1500 | Value drop to trigger buy-low alert |
| `sell_high_delta` | -600 | -1500 to -300 | Value spike to trigger sell-high alert |

### **League Effects** (2 parameters)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `qb_superflex_boost` | 1.25 | 1.10-1.50 | QB value multiplier in superflex |
| `te_premium_factor` | 0.30 | 0.15-0.50 | TE premium in TEP leagues |

### **Position Scaling** (3 parameters)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `scarcity_multiplier` | 1.35 | 1.10-1.60 | Scarce position (TE) premium |
| `rb_workhorse_bonus` | 250 | 100-500 | Bonus for workhorse RBs |
| `rb_committee_penalty` | -150 | -300 to -50 | Penalty for committee RBs |

### **Rookie Adjustments** (1 parameter)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `rookie_uncertainty_discount` | 0.85 | 0.70-0.95 | Discount factor for rookie uncertainty |

### **Value Thresholds** (5 parameters)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `elite_tier_percent` | 0.05 | 0.03-0.10 | Percentile for elite tier classification |
| `value_tier_elite` | 8000 | 6000-10000 | Minimum value for elite tier |
| `value_tier_high` | 5000 | 3000-7000 | Minimum value for high tier |
| `value_tier_mid` | 2500 | 1500-4000 | Minimum value for mid tier |
| `value_tier_low` | 1000 | 500-2000 | Minimum value for low tier |

---

## 🚀 Usage

### **1. Admin UI** (Recommended)

**Route:** `/admin/model-tuning`

**Workflow:**
1. Navigate to `/admin/model-tuning`
2. Adjust sliders by category
3. Click "Preview Changes" to see impact
4. Review top value movers
5. Click "Save Changes" to apply
6. Rebuild triggers automatically

**Features:**
- Visual sliders grouped by category
- Real-time value display
- Change counter
- Preview mode (no DB writes)
- Safety validation
- Change history with revert
- One-click reset

### **2. Programmatic Access**

**Load Config:**
```typescript
import { getModelConfig } from '@/lib/model/getModelConfig';

// Load config (cached 60s)
const config = await getModelConfig();

// Use in calculations
const value = production * config.production_weight +
              ageScore * config.age_curve_weight +
              usage * config.snap_share_weight;
```

**Invalidate Cache:**
```typescript
import { invalidateModelConfigCache } from '@/lib/model/getModelConfig';

// After config update
invalidateModelConfigCache();
```

**Get Specific Values:**
```typescript
import {
  getMarketAnchorStrength,
  getValueTier,
  getRbRoleAdjustment
} from '@/lib/model/getModelConfig';

// Market anchor strength by percentile
const strength = getMarketAnchorStrength(0.95, config); // elite tier

// Value tier classification
const tier = getValueTier(7500, config); // 'elite'

// RB role adjustment
const adjustment = getRbRoleAdjustment('workhorse', config); // +250
```

### **3. API Endpoints**

#### **GET /functions/v1/model-preview**

Preview changes without applying.

**Request:**
```json
{
  "config_changes": {
    "production_weight": 0.65,
    "qb_superflex_boost": 1.35
  }
}
```

**Response:**
```json
{
  "top_movers": [
    {
      "player_id": "123",
      "player_name": "Patrick Mahomes",
      "position": "QB",
      "old_value": 8500,
      "new_value": 9200,
      "delta": 700,
      "delta_percent": 8.2
    }
  ],
  "summary": {
    "players_analyzed": 100,
    "avg_change": 150,
    "max_increase": 700,
    "max_decrease": -200
  }
}
```

#### **POST /functions/v1/update-model-config**

Bulk update config values.

**Request:**
```json
{
  "updates": {
    "production_weight": 0.65,
    "qb_superflex_boost": 1.35
  },
  "updated_by": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "updated": ["production_weight", "qb_superflex_boost"],
  "failed": []
}
```

---

## 🛡️ Safety Guardrails

### **1. Value Bounds Enforcement**

All parameters have `min_value` and `max_value` enforced at database level:

```sql
-- Trigger validates before insert/update
IF NEW.value < NEW.min_value OR NEW.value > NEW.max_value THEN
  RAISE EXCEPTION 'Value outside allowed range';
END IF;
```

**Result:** Cannot set invalid values, even via direct DB access.

### **2. Weight Sum Constraint**

Core value weights cannot sum to more than 1.5:

```sql
-- Validates weight sum
IF (weight_sum + NEW.value) > 1.5 THEN
  RAISE EXCEPTION 'Sum of core value weights cannot exceed 1.5';
END IF;
```

**Example:**
```
production_weight: 0.65
age_curve_weight: 0.30
snap_share_weight: 0.35
depth_chart_weight: 0.20
----------------------------
Sum: 1.50 ✅ ALLOWED

Try to increase production_weight to 0.70:
Sum: 1.55 ❌ REJECTED
```

### **3. Preview Before Apply**

Preview mode simulates changes without writing to DB:

```typescript
// Run in-memory simulation
const preview = await supabase.functions.invoke('model-preview', {
  body: { config_changes: { production_weight: 0.65 } }
});

// Review top movers
console.log(preview.top_movers);

// If satisfied, then save
await saveChanges();
```

### **4. Change History & Revert**

Every change logged to `model_config_history`:

```typescript
// Revert to previous value
await supabase.rpc('revert_model_config', {
  p_key: 'production_weight',
  p_history_id: 'abc-123'
});
```

### **5. Fallback Defaults**

Config loader NEVER crashes:

```typescript
// If DB fails, returns safe defaults
const config = await getModelConfig();
// Always returns valid config
```

---

## 🔄 Automatic Rebuild Workflow

### **Trigger Chain**

```
User saves config change
    ↓
Database trigger fires
    ↓
Logs to system_health_metrics
    ↓
Cron monitor detects change (every 5 min)
    ↓
Queues rebuild job
    ↓
Invokes rebuild-player-values
    ↓
Creates new value_epoch
    ↓
Invalidates caches
    ↓
New values available
```

### **Timeline Example**

```
14:00:00 - Admin changes production_weight from 0.60 → 0.65
14:00:01 - Database trigger logs change
14:00:02 - UI shows "Rebuild will trigger automatically"
14:05:00 - Cron monitor runs (5-minute interval)
14:05:01 - Detects config change
14:05:02 - Queues rebuild job
14:05:03 - Invokes rebuild edge function
14:05:04 - Rebuild starts
14:15:00 - Rebuild completes
14:15:01 - New epoch active
14:15:02 - Values reflect new weights
```

### **Manual Trigger** (Optional)

Force immediate rebuild:

```typescript
const { data } = await supabase.functions.invoke(
  'rebuild-player-values',
  {
    body: { reason: 'config_changed' },
    headers: {
      Authorization: `Bearer ${ADMIN_SECRET}`
    }
  }
);
```

---

## 🎨 Admin UI Features

### **Grouped Sliders**

```
┌─────────────────────────────────────┐
│ Core Value Weights                  │
├─────────────────────────────────────┤
│ Production weight         ▓▓▓░░ 0.60│
│ [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]│
│ 0.30                            0.80│
├─────────────────────────────────────┤
│ Age curve weight          ▓░░░░ 0.10│
│ [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]│
│ 0.00                            0.30│
└─────────────────────────────────────┘
```

### **Change Counter**

```
[Preview Changes]  [Save Changes (3)]  [Reset]
                      ↑
                   Shows # of pending changes
```

### **Preview Table**

```
┌──────────────────┬─────┬──────────┬──────────┬────────────┐
│ Player           │ Pos │ Old      │ New      │ Change     │
├──────────────────┼─────┼──────────┼──────────┼────────────┤
│ Patrick Mahomes  │ QB  │ 8,500    │ 9,200    │ +700 (8%)  │
│ Justin Jefferson │ WR  │ 7,800    │ 7,650    │ -150 (-2%) │
│ Christian McCaffrey│RB │ 8,200    │ 8,450    │ +250 (3%)  │
└──────────────────┴─────┴──────────┴──────────┴────────────┘
```

### **Change History**

```
┌────────────────────────────────────────────────────────┐
│ Recent Changes                                         │
├────────────────────────────────────────────────────────┤
│ production_weight                            [Revert]  │
│ 0.60 → 0.65 • 2:34 PM • by admin                      │
├────────────────────────────────────────────────────────┤
│ qb_superflex_boost                           [Revert]  │
│ 1.25 → 1.35 • 2:33 PM • by admin                      │
└────────────────────────────────────────────────────────┘
```

---

## 💡 Real-World Use Cases

### **Use Case 1: Fix RB Overvaluation**

**Problem:** Model overvalues committee RBs

**Solution:**
1. Navigate to Position Scaling
2. Increase `rb_committee_penalty` from -150 → -250
3. Preview changes
4. See committee RBs drop 100-200 value
5. Save changes
6. Wait 10 minutes for rebuild
7. Values adjusted across entire system

**No code changes. No deploy. Just tune.**

### **Use Case 2: React to Superflex Meta Shift**

**Problem:** League adopts superflex, QBs undervalued

**Solution:**
1. Go to League Effects
2. Increase `qb_superflex_boost` from 1.25 → 1.40
3. Preview impact on top 20 QBs
4. All QBs increase 10-15%
5. Save and rebuild
6. Trade recommendations adjust automatically

**Meta shifts handled in minutes, not days.**

### **Use Case 3: Rookie Class Adjustment**

**Problem:** Strong rookie class, but model undervalues draft capital

**Solution:**
1. Go to Core Value Weights
2. Increase `rookie_draft_capital_weight` from 0.35 → 0.45
3. Decrease `rookie_uncertainty_discount` from 0.85 → 0.90
4. Preview: Top rookies gain 200-400 value
5. Save changes
6. Draft rankings reflect higher rookie values

**Adapt to class strength without code changes.**

### **Use Case 4: Market Divergence**

**Problem:** Model too aggressive vs market consensus

**Solution:**
1. Go to Market Behavior
2. Increase all `market_anchor_tier*` values by 0.05
3. Preview: Values shift closer to consensus
4. Save changes
5. Values blend more with market

**Fine-tune model vs market balance.**

### **Use Case 5: Age Curve Adjustment**

**Problem:** Age penalties too harsh for modern NFL

**Solution:**
1. Go to Core Value Weights
2. Decrease `age_curve_weight` from 0.10 → 0.07
3. Preview: Veterans gain 50-150 value
4. Save changes
5. Older players valued more fairly

**Philosophy changes without rewrites.**

---

## 📈 Integration Examples

### **Value Calculation**

**Before (Hardcoded):**
```typescript
const value = production * 0.60 +  // Hardcoded!
              ageScore * 0.10 +
              usage * 0.20;
```

**After (Live Tunable):**
```typescript
const config = await getModelConfig();

const value = production * config.production_weight +  // Live tunable!
              ageScore * config.age_curve_weight +
              usage * config.snap_share_weight;
```

### **Buy-Low Alert**

**Before:**
```typescript
if (valueDrop >= 600) {  // Hardcoded threshold
  sendBuyLowAlert(player);
}
```

**After:**
```typescript
const config = await getModelConfig();

if (valueDrop >= config.buy_low_delta) {  // Live tunable
  sendBuyLowAlert(player);
}
```

### **Superflex Adjustment**

**Before:**
```typescript
if (position === 'QB' && leagueType === 'superflex') {
  value *= 1.25;  // Hardcoded
}
```

**After:**
```typescript
const config = await getModelConfig();

if (position === 'QB' && leagueType === 'superflex') {
  value *= config.qb_superflex_boost;  // Live tunable
}
```

### **Batch Processing (Efficient)**

```typescript
// Load config ONCE for entire batch
const config = await getModelConfig();

for (const player of players) {
  // Use config throughout without reloading
  const value = calculateValue(player, config);
  values[player.id] = value;
}
```

---

## 🗂️ Database Schema

### **model_config**

```sql
CREATE TABLE model_config (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  min_value numeric NOT NULL,
  max_value numeric NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT 'system'
);
```

### **model_config_history**

```sql
CREATE TABLE model_config_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  old_value numeric NOT NULL,
  new_value numeric NOT NULL,
  changed_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
```

---

## 📦 File Structure

```
src/
├── lib/
│   └── model/
│       ├── getModelConfig.ts              # Config loader with caching
│       └── valueCalculationExample.ts     # Integration examples
│
├── components/
│   └── ModelTuningPanel.tsx               # Admin UI
│
supabase/
├── migrations/
│   └── create_live_model_config_system.sql  # Schema & seed data
│
└── functions/
    ├── model-preview/                     # Preview endpoint
    ├── update-model-config/               # Bulk update endpoint
    └── cron-model-config-monitor/         # Auto-rebuild trigger
```

---

## 🎯 Best Practices

### **1. Preview Before Applying**

Always preview major changes:

```typescript
// 1. Preview
const preview = await previewChanges(changes);

// 2. Review impact
if (preview.max_increase > 1000) {
  console.warn('Large changes detected!');
}

// 3. Save if acceptable
if (confirm('Apply changes?')) {
  await saveChanges(changes);
}
```

### **2. Small Iterative Changes**

Don't change everything at once:

```
❌ BAD: Change 10 parameters simultaneously
✅ GOOD: Change 1-2 parameters, test, iterate
```

### **3. Document Reasoning**

Add notes when making changes:

```typescript
// Change reason
const metadata = {
  reason: 'RB committee backs overvalued in week 12 trades',
  expected_impact: 'Decrease committee RB values by ~150'
};
```

### **4. Monitor Impact**

After changes, check:
- Top value movers
- Tier distribution shifts
- Trade fairness metrics
- User feedback

### **5. Keep History**

Don't delete history - use it to learn:

```sql
-- Analyze config changes over time
SELECT key, AVG(new_value - old_value) as avg_change
FROM model_config_history
GROUP BY key
ORDER BY avg_change DESC;
```

---

## 🚨 Troubleshooting

### **Changes not reflecting?**

1. Check cache: Config cached for 60s
2. Wait for rebuild: Takes 5-10 minutes
3. Check epoch: New values in new epoch only

### **Preview shows no changes?**

1. Verify changes are saved
2. Check authorization
3. Ensure players in dataset

### **Rebuild not triggering?**

1. Check cron monitor logs
2. Verify trigger fired
3. Check system_health_metrics table

### **Values seem wrong?**

1. Check effective config via API
2. Compare with defaults
3. Review recent history
4. Run doctor audit

---

## 🎊 Summary

You now have a **Live Tuning Panel** that:

### ✅ 23 Tunable Parameters
- Core value weights
- Market behavior
- Advice thresholds
- League effects
- Position scaling
- Value tiers

### ✅ Zero-Downtime Updates
- Change values in seconds
- Auto-rebuild in minutes
- No code changes
- No deploys

### ✅ Safety First
- Value bounds enforcement
- Weight sum validation
- Preview mode
- Change history
- One-click revert

### ✅ Admin UI
- Visual sliders by category
- Real-time preview
- Change counter
- Impact analysis
- Version history

### ✅ Developer Integration
- Simple API: `getModelConfig()`
- 60-second caching
- Fallback defaults
- Never crashes

---

## 🔥 Core Innovation

**Before:** Every model tweak = code change + deploy + hours/days

**After:** Tune model like game balance patch = sliders + preview + save = minutes

**Result:**
- 🎮 React to meta shifts instantly
- 🔧 Fix overvaluations without deploys
- 📊 Test philosophies in real-time
- 🚀 Iterate 100x faster
- 💪 Control your economy

**Your valuation model is now a live, tunable system. Balance the meta in real-time.** 🎚️✨
