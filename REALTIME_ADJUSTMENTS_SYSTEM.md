# Real-Time Player Value Adjustments System

## Overview

A lightweight, reactive layer that modifies player values during the day based on roster movements and role changes **without recalculating base rankings**. These are temporary "market adjustments" overlaid on top of `latest_player_values` that automatically reset every nightly rebuild.

## System Architecture

### Key Principle: Separation of Concerns

```
Base Values (Stable)     ←  Calculated nightly, production-based
    ↓
+ Adjustments (Reactive)  ←  Temporary market reactions, expire 24-168 hours
    ↓
= Effective Value (UI)    ←  What users see
```

**Base values never change intraday.** Adjustments are overlays only.

## Database Schema

### `player_value_adjustments` Table

```sql
CREATE TABLE player_value_adjustments (
  id uuid PRIMARY KEY,
  player_id uuid REFERENCES nfl_players(id),
  format text CHECK (format IN ('dynasty', 'redraft', 'both')),
  delta integer CHECK (delta >= -2000 AND delta <= 2000),
  reason text NOT NULL,
  confidence integer CHECK (confidence >= 1 AND confidence <= 5),
  source text CHECK (source IN ('waiver', 'trade', 'depth_chart',
                                  'usage_spike', 'injury', 'manual',
                                  'snap_share', 'role_change')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  metadata jsonb
);
```

**Key Constraints:**
- Individual delta: -2000 to +2000
- **Total per player: capped at ±1500** (enforced by `add_value_adjustment()`)
- All adjustments expire (24-168 hours depending on type)
- All adjustments reset during nightly rebuild

### `adjustment_events` Table

Audit trail of what triggered each adjustment:

```sql
CREATE TABLE adjustment_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL,
  player_id uuid REFERENCES nfl_players(id),
  old_value jsonb,
  new_value jsonb,
  adjustment_created uuid REFERENCES player_value_adjustments(id),
  detected_at timestamptz DEFAULT now(),
  metadata jsonb
);
```

## Effective Value Calculation

### New Read Path (ALL UI MUST USE THIS)

```typescript
import { getEffectiveValue } from './lib/adjustments/getEffectiveValue';

const result = await getEffectiveValue(playerId, 'dynasty');

// Returns:
{
  player_id: "uuid",
  format: "dynasty",
  base_value: 8000,          // From latest_player_values
  adjustment: +350,          // Sum of active adjustments (capped ±1500)
  effective_value: 8350,     // base + adjustment (clamped 0-10000)
  adjustments: [             // Details of each active adjustment
    {
      delta: +350,
      reason: "Starter injured - backup opportunity",
      source: "injury",
      confidence: 4,
      expires_at: "2025-02-20T12:00:00Z"
    }
  ],
  has_adjustment: true,
  trend: "up"               // "up" | "down" | "neutral"
}
```

**Critical:** UI MUST display `effective_value`, NOT `base_value`.

### Database Function

```sql
SELECT calculate_effective_value('player_uuid', 'dynasty');
```

Returns JSON with base value, adjustment sum, and effective value.

## Auto-Detection Systems

### 1. Role Change Detection

**File:** `src/lib/adjustments/detectRoleChanges.ts`

**Runs:** Every 30 minutes (via edge function cron)

**Detects:**

| Event Type | Trigger | Dynasty Δ | Redraft Δ | Expires |
|------------|---------|-----------|-----------|---------|
| **Starter Promotion** | Backup QB becomes starter | +400 | +800 | 48h |
| | Backup RB becomes starter | +500 | +700 | 48h |
| | Backup WR promoted to top 2 | +600 | +500 | 48h |
| **Injury Replacement** | Starter on IR, direct backup | +350-600 | +600-800 | 7 days |
| | Committee RB situation | +350 | +350 | 7 days |
| **Depth Chart Rise** | Player moves up depth chart | +200-400 | +200-400 | 3 days |
| **Snap Breakout** | 70%+ snap share jump | +500 | +400 | 5 days |
| **Waiver Spike** | Large add % increase | +300 | +300 | 2 days |

**Example Output:**

```typescript
{
  events_detected: 3,
  adjustments_created: 6,
  events: [
    {
      player_id: "abc123",
      player_name: "Backup RB",
      event_type: "injury_replacement",
      confidence: 4,
      suggested_delta_dynasty: 500,
      suggested_delta_redraft: 700,
      reason: "Starter RB1 on IR - direct backup opportunity"
    }
  ]
}
```

### 2. Transaction Feed Listener

**File:** `src/lib/adjustments/syncTransactions.ts`

**Runs:** Periodically (recommended: every 2 hours)

**Detects:**

| Transaction Type | Scenario | Dynasty Δ | Redraft Δ | Expires |
|------------------|----------|-----------|-----------|---------|
| **Trade** | WR to top offense (KC, SF, BUF) | +300 | +250 | 3 days |
| | RB to bottom offense (CAR, NE) | -150 | -100 | 3 days |
| | TE to pass-heavy team | +250 | +200 | 3 days |
| | QB to better O-line | +200 | +300 | 3 days |
| **Release** | Veteran cut, backup gets role | +400 | +400 | 5 days |
| **Signing** | New player signed to depth chart | -200 | -150 | 3 days |

**Example: WR Trade**

```typescript
{
  player_id: "xyz789",
  player_name: "WR2",
  transaction_type: "trade",
  old_team: "JAX",
  new_team: "KC",
  impact_assessment: {
    delta_dynasty: +300,
    delta_redraft: +250,
    reason: "Traded to top offense KC - opportunity boost"
  }
}
```

## UI Components

### 1. ValueAdjustmentBadge

Displays trending indicator on player cards.

**Props:**
```typescript
<ValueAdjustmentBadge
  adjustment={+350}
  adjustments={[...]}  // Array of active adjustments
  showTooltip={true}
  size="md"            // "sm" | "md" | "lg"
/>
```

**Renders:**
```
▲ +350    (green badge, trending up)
▼ -200    (red badge, trending down)
```

**Tooltip (on hover):**
```
Active Adjustments
━━━━━━━━━━━━━━━━━━━━
+350    Injury
Starter injured - backup opportunity
Expires: 02/20/2025
Confidence: ████░ (4/5)

+200    Role Change
Promoted to starter
Expires: 02/18/2025
Confidence: ███░░ (3/5)
━━━━━━━━━━━━━━━━━━━━
Total: +550 (capped at +1500)
```

### 2. TrendingPlayersPanel

Dashboard widget showing all players with active adjustments.

**Features:**
- Filter by trend: All / Rising / Falling
- Shows adjustment sources (injury, trade, role change)
- Displays confidence levels
- Expiry dates
- Auto-refreshes every 5 minutes

**Access:** Dashboard → Trending Players tab

**Example Display:**

```
┌─────────────────────────────────────────────┐
│ 📈 Trending Players                    🔄   │
├─────────────────────────────────────────────┤
│ All (23) | ▲ Rising (18) | ▼ Falling (5)   │
├─────────────────────────────────────────────┤
│ Backup RB          RB  DEN          ▲ +700  │
│ ├─ Injury | Role Change                     │
│ └─ Expires: 02/20/2025                      │
│                                              │
│ WR2 Name           WR  KC           ▲ +300  │
│ ├─ Trade                                    │
│ └─ Expires: 02/18/2025                      │
└─────────────────────────────────────────────┘
```

## Admin Tools

### Manual Adjustment Creation

```typescript
import { createManualAdjustment } from './lib/adjustments/getEffectiveValue';

await createManualAdjustment(
  playerId: "abc123",
  format: "both",         // "dynasty" | "redraft" | "both"
  delta: 500,
  reason: "Coaching change - increased role expected",
  confidence: 3,          // 1-5
  expiresHours: 72        // 3 days
);
```

### Remove Adjustment

```typescript
import { removeAdjustment } from './lib/adjustments/getEffectiveValue';

await removeAdjustment(adjustmentId);
```

### View Statistics

```typescript
import { getAdjustmentStats } from './lib/adjustments/getEffectiveValue';

const stats = await getAdjustmentStats();
// Returns:
{
  active_count: 87,
  by_source: {
    injury: 23,
    role_change: 18,
    trade: 12,
    ...
  }
}
```

## Edge Functions

### `/functions/v1/detect-role-changes`

**Trigger:** POST request or cron (every 30 minutes)

**Purpose:** Detect starter promotions, injury replacements, depth chart movements

**Usage:**
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/detect-role-changes"
```

### `/functions/v1/sync-transactions`

**Trigger:** POST request or cron (every 2 hours)

**Purpose:** Sync player transactions and assess trade impacts

**Usage:**
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/sync-transactions"
```

## Nightly Reset System

### Automatic Reset During Rebuild

**File:** `src/lib/top1000/rebuildAllPlayerValues.ts`

**Step 8 (added):**

```typescript
// Reset all adjustments (nightly cleanup)
console.log('Resetting all value adjustments...');
const { data: resetCount } = await supabase.rpc('reset_all_adjustments');
console.log(`Reset ${resetCount || 0} value adjustments`);
```

**What happens:**
1. Archives adjustments to `adjustment_events` with reason='nightly_reset'
2. Deletes ALL adjustments from `player_value_adjustments`
3. Returns count of cleared adjustments

**Manual trigger:**
```sql
SELECT reset_all_adjustments();
-- Returns: integer (count of adjustments cleared)
```

**Expire old only (keeps unexpired):**
```sql
SELECT expire_old_adjustments();
-- Returns: integer (count of expired adjustments deleted)
```

## Safety Limits

### 1. Maximum Delta Per Adjustment

**Range:** -2000 to +2000 (database constraint)

**Typical values:**
- Minor: ±100-200 (trade to lateral team)
- Moderate: ±300-500 (role change, waiver spike)
- Major: ±600-900 (starter promotion, injury replacement)

### 2. Maximum Total Per Player

**Cap:** ±1500 (enforced by `add_value_adjustment()`)

**Example:**
```typescript
Player has:
  +600 (injury replacement)
  +400 (snap breakout)
  +300 (trade bonus)
  = +1300 total

New adjustment requested: +500
Capped to: +200 (to reach +1500 max)
```

**Rationale:** Prevents adjustment chaos. Base values remain authoritative.

### 3. Automatic Expiry

**All adjustments MUST have expiry:**

| Source | Default Expiry |
|--------|----------------|
| Injury | 7 days (168h) |
| Role Change | 2 days (48h) |
| Trade | 3 days (72h) |
| Snap Breakout | 5 days (120h) |
| Waiver Spike | 2 days (48h) |
| Manual | Admin choice |

**Expired adjustments:**
- Automatically excluded from `calculate_effective_value()`
- Deleted by nightly `expire_old_adjustments()`
- Archived in `adjustment_events`

### 4. Nightly Reset Guarantee

**Promise:** No adjustment survives past nightly rebuild.

**Ensures:**
- Adjustments never accumulate indefinitely
- System self-corrects daily
- Base values remain source of truth

## Confidence Levels

Scale: 1-5 (displayed as ★★★★★)

| Level | Meaning | Usage |
|-------|---------|-------|
| **5** | Very High | QB starter promotion (injury), confirmed role change |
| **4** | High | RB/WR starter promotion, direct backup opportunity |
| **3** | Medium | Depth chart rise, trade to better team, snap breakout |
| **2** | Low | Waiver spike (hype), committee backfield situation |
| **1** | Very Low | Speculative, manual adjustment with uncertainty |

**UI Display:**

```
Confidence: ████░ (4/5)
```

## Usage Examples

### Example 1: Injury Replacement Detection

**Scenario:** Patrick Mahomes goes on IR, backup QB becomes starter.

**Detection (automatic):**
```typescript
// detectRoleChanges() runs every 30 minutes
{
  player_id: "backup-qb-id",
  player_name: "Backup QB",
  event_type: "injury_replacement",
  confidence: 5,
  suggested_delta_dynasty: 400,
  suggested_delta_redraft: 800,
  reason: "Starter Patrick Mahomes injured - direct backup opportunity"
}
```

**Adjustment Created:**
```typescript
{
  player_id: "backup-qb-id",
  format: "redraft",
  delta: +800,
  source: "injury",
  expires_at: "2025-02-22T00:00:00Z" // 7 days
}
```

**User sees:**
```
Backup QB
QB  KC
Value: 5800 (base: 5000)  ▲ +800

Tooltip:
━━━━━━━━━━━━━━━━━━━━━━━━━━
+800  Injury
Starter Patrick Mahomes injured
Expires: 02/22/2025
Confidence: █████ (5/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 2: Trade to Better Situation

**Scenario:** WR3 traded from CAR to KC.

**Detection (automatic):**
```typescript
// syncTransactions() runs every 2 hours
{
  player_id: "wr3-id",
  transaction_type: "trade",
  old_team: "CAR",
  new_team: "KC",
  impact_assessment: {
    delta_dynasty: +300,
    delta_redraft: +250,
    reason: "Traded to top offense KC - opportunity boost"
  }
}
```

**Adjustment Created:**
```typescript
{
  player_id: "wr3-id",
  format: "dynasty",
  delta: +300,
  source: "trade",
  expires_at: "2025-02-18T00:00:00Z" // 3 days
}
```

**User sees:**
```
WR Name
WR  KC  (was CAR)
Value: 4300 (base: 4000)  ▲ +300

Tooltip:
━━━━━━━━━━━━━━━━━━━━━━━━━━
+300  Trade
Traded to top offense KC
Expires: 02/18/2025
Confidence: ███░░ (3/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 3: Manual Adjustment (Admin)

**Scenario:** Admin knows of coaching change affecting RB usage.

**Admin Action:**
```typescript
await createManualAdjustment(
  playerId: "rb-id",
  format: "both",
  delta: 400,
  reason: "New OC favors bell-cow RBs - usage expected to increase",
  confidence: 3,
  expiresHours: 72  // 3 days
);
```

**User sees:**
```
RB Name
RB  DEN
Value: 5400 (base: 5000)  ▲ +400

Tooltip:
━━━━━━━━━━━━━━━━━━━━━━━━━━
+400  Manual
New OC favors bell-cow RBs
Expires: 02/18/2025
Confidence: ███░░ (3/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Migration from Old System

### Before (old system):
```typescript
// Direct query to latest_player_values
const { data } = await supabase
  .from('latest_player_values')
  .select('dynasty_value')
  .eq('player_id', playerId);

const value = data?.dynasty_value || 0;
```

### After (new system):
```typescript
// Use effective value calculation
import { getEffectiveValue } from './lib/adjustments/getEffectiveValue';

const result = await getEffectiveValue(playerId, 'dynasty');
const value = result?.effective_value || 0;
```

**Change Required:** Update all UI components that display player values to use `getEffectiveValue()`.

## Performance Considerations

### Query Performance

**Effective value calculation:**
- Uses indexed lookups on `player_value_adjustments(player_id, expires_at)`
- Typical query time: < 5ms per player
- Batch queries: 50 players in ~100ms

**Trending players view:**
- Materialized as database view `trending_players`
- Updates automatically
- Query time: < 10ms

### Cache Strategy

**Base values:** Cached aggressively (can be cached for hours)

**Effective values:** Cache for 5-10 minutes (adjustments change intraday)

**Trending players:** Cache for 5 minutes, auto-refresh

## Monitoring & Alerts

### Health Checks

**Check 1: Adjustment Count**
```sql
SELECT COUNT(*) FROM player_value_adjustments
WHERE expires_at > now();
```

**Expected:** 50-200 active adjustments (healthy market activity)
**Alert if:** > 500 (too many adjustments, review detection logic)

**Check 2: Max Adjustment**
```sql
SELECT MAX(ABS(delta)) FROM player_value_adjustments
WHERE expires_at > now();
```

**Expected:** < 1000 (reasonable adjustments)
**Alert if:** > 1500 (hitting cap frequently, review delta logic)

**Check 3: Expiry Distribution**
```sql
SELECT
  EXTRACT(EPOCH FROM (expires_at - now())) / 3600 as hours_until_expiry,
  COUNT(*)
FROM player_value_adjustments
WHERE expires_at > now()
GROUP BY 1
ORDER BY 1;
```

**Expected:** Spread across 24-168 hours
**Alert if:** All expiring at same time (bug in expiry logic)

### Admin Dashboard

**View adjustment statistics:**
- Navigate to Dashboard → Admin Sync Hub → Season Rollover section
- View active adjustment count
- See adjustments by source
- Review recent events

## Troubleshooting

### Problem: Too many adjustments created

**Symptom:** 500+ active adjustments, performance degraded

**Cause:** Detection logic too sensitive, creating duplicate adjustments

**Fix:**
1. Review recent `adjustment_events` for patterns
2. Adjust confidence thresholds in detection logic
3. Add deduplication check (don't create if adjustment exists for same player + source)

```typescript
// Add to detectRoleChanges.ts
const { data: existing } = await supabase
  .from('adjustment_events')
  .select('*')
  .eq('player_id', player.id)
  .eq('event_type', event.event_type)
  .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .limit(1);

if (existing && existing.length > 0) continue; // Skip duplicate
```

### Problem: Adjustments not appearing in UI

**Symptom:** Trending Players panel shows no players, but adjustments exist in DB

**Cause:** UI not using `getEffectiveValue()`, still reading base values

**Fix:** Update component to use effective value:

```typescript
// Before
const value = player.dynasty_value;

// After
import { getEffectiveValue } from '../lib/adjustments/getEffectiveValue';
const result = await getEffectiveValue(player.id, 'dynasty');
const value = result?.effective_value || 0;
```

### Problem: Adjustments not resetting nightly

**Symptom:** Old adjustments accumulating, never cleared

**Cause:** Nightly rebuild not calling `reset_all_adjustments()`

**Fix:** Verify Step 8 in `rebuildAllPlayerValues.ts`:

```typescript
// Should be present:
const { data: resetCount } = await supabase.rpc('reset_all_adjustments');
```

**Manual reset:**
```sql
SELECT reset_all_adjustments();
```

### Problem: Adjustment exceeds ±1500 cap

**Symptom:** Player has more than ±1500 total adjustment

**Cause:** Bug in `add_value_adjustment()` capping logic

**Fix:** Function should enforce cap:

```sql
-- Check current total before adding
IF v_current_total + p_delta > 1500 THEN
  p_delta := 1500 - v_current_total;
END IF;
```

**Workaround:** Manually remove excess adjustments:

```sql
DELETE FROM player_value_adjustments
WHERE player_id = 'player-uuid'
AND expires_at > now();
```

## Best Practices

### For Developers

1. **Always use effective value in UI:**
   - Never display base_value directly to users
   - Always call `getEffectiveValue()` for current values

2. **Cache appropriately:**
   - Base values: Cache aggressively (hours)
   - Effective values: Cache briefly (5-10 min)

3. **Show adjustment reasons:**
   - Always include tooltip/explanation
   - Users should understand WHY value changed

4. **Respect confidence levels:**
   - Display confidence visually (stars, dots)
   - Low-confidence adjustments should be obvious

### For Admins

1. **Monitor adjustment count:**
   - Check daily: 50-200 is healthy
   - Alert if > 500 (investigate detection logic)

2. **Review trending players weekly:**
   - Verify adjustments make sense
   - Remove false positives manually

3. **Tune detection sensitivity:**
   - If too many false positives: Increase confidence thresholds
   - If missing events: Decrease thresholds

4. **Manual adjustments sparingly:**
   - Use only for known, non-automated events
   - Always include clear reason
   - Set appropriate expiry

## Summary

The Real-Time Adjustments System provides:

✅ **Reactive values** without destabilizing base rankings
✅ **Automatic detection** of role changes and transactions
✅ **Transparent explanations** for every value movement
✅ **Safety limits** (±1500 cap, auto-expiry, nightly reset)
✅ **User trust** through visible adjustments and tooltips

**Key Innovation:** Separates stable economy (base values) from reactive market (adjustments), giving users both stability and freshness.

**Without this system:** Values feel outdated within hours of injuries/trades.

**With this system:** Rankings stay stable, market reacts instantly, users understand why.
