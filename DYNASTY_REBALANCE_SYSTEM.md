# Dynasty Value Rebalance System

## Overview

The Dynasty Value Rebalance System automatically adjusts player dynasty values on a weekly basis using performance trends and market signals. This keeps values accurate and responsive while maintaining stability through safety controls.

## Core Principles

1. **Weekly Evolution** - Dynasty values update weekly based on real performance
2. **Dual Signal Approach** - Blend performance stats with market movement
3. **Transparency** - Every adjustment is tracked with reasons
4. **Stability** - Safety caps prevent chaos from single-game swings
5. **Trust** - Historical tracking shows why values changed

## Architecture

### Database Schema

#### `dynasty_adjustments`
Tracks individual value adjustments by signal source.

```sql
- player_id (uuid) - References nfl_players
- as_of_date (date) - When adjustment was made
- signal_source (text) - 'performance', 'market', or 'blended'
- delta (integer) - Value change (-/+)
- reason (text) - Explanation for adjustment
- confidence (decimal) - 0 to 1 confidence score
- UNIQUE(player_id, as_of_date, signal_source)
```

#### `dynasty_value_snapshots`
Historical dynasty values with adjustment breakdown.

```sql
- player_id (uuid) - References nfl_players
- as_of_date (date) - Snapshot date
- dynasty_value (integer) - Final adjusted value (0-10000)
- base_dynasty_value (integer) - Base model value
- adjustment_total (integer) - Sum of recent adjustments
- UNIQUE(player_id, as_of_date)
```

#### `weekly_player_stats`
Performance data for trend analysis.

```sql
- player_id (uuid) - References nfl_players
- season (integer) - NFL season
- week (integer) - Week number (1-18)
- fantasy_points (decimal) - PPR fantasy points
- snap_share (decimal) - Optional snap percentage
- usage (decimal) - Targets + carries
- targets, carries, receptions (integer) - Usage stats
- PRIMARY KEY (player_id, season, week)
```

## How It Works

### Weekly Rebalance Flow

```
1. Sync weekly stats from Sleeper API
   ↓
2. For each rosterable player (Top 1000):
   ↓
3. Calculate Performance Trend Signal
   - Last 2 weeks vs season average
   - Detect breakouts/slumps
   - Check for injury/absence
   ↓
4. Calculate Market Trend Signal
   - Recent KTC value changes
   - Market momentum
   ↓
5. Blend Signals (weighted by season phase)
   - In-season: 65% performance, 35% market
   - Offseason: 35% performance, 65% market
   ↓
6. Apply Safety Caps
   - Weekly max: ±500
   - Monthly rolling max: ±1200
   - Retired player decay: -250/week
   ↓
7. Save Adjustment to dynasty_adjustments
   ↓
8. Calculate New Dynasty Value
   - Base + Sum(last 30 days adjustments)
   - Clamp to 0-10000
   ↓
9. Update player_values.fdp_value
   ↓
10. Save Snapshot to dynasty_value_snapshots
```

### Performance Signal Detection

**Breakout (Sustained)**
- Last 2-week avg ≥ season avg * 1.35
- All 4 weeks above season avg
- **Delta:** +650
- **Example:** "Sustained breakout: 22.5 PPG vs 16.2 season avg"

**Breakout (Recent)**
- Last 2-week avg ≥ season avg * 1.35
- Not sustained
- **Delta:** +400
- **Example:** "Recent breakout: 24.1 PPG vs 17.8 season avg"

**Trending Up**
- Last 2-week avg > season avg * 1.15
- **Delta:** +200
- **Example:** "Trending up: 18.3 PPG vs 15.8 season avg"

**Stable**
- Last 2-week avg within ±15% of season avg
- **Delta:** 0
- **Example:** "Stable performance: 16.2 PPG"

**Trending Down**
- Last 2-week avg < season avg * 0.85
- **Delta:** -200
- **Example:** "Trending down: 12.1 PPG vs 14.3 season avg"

**Slump**
- Last 2-week avg ≤ season avg * 0.65
- **Delta:** -400 to -650
- **Example:** "Recent slump: 8.2 PPG vs 15.5 season avg"

**Injury Concern**
- 2+ weeks with < 2 fantasy points
- **Delta:** -200
- **Example:** "2 low-scoring weeks (injury concern)"

### Market Signal Detection

**Significant Move**
- KTC value change ≥ 500
- **Delta:** 30% of market change (capped ±500)
- **Example:** "Market rising: 650 point move"

**Moderate Move**
- KTC value change ≥ 200
- **Delta:** 40% of market change (capped ±300)
- **Example:** "Market falling: 280 point move"

**Stable Market**
- KTC value change < 200
- **Delta:** 0
- **Example:** "Stable market value"

### Safety Controls

#### Weekly Cap
Maximum adjustment per week: **±500 points**

Prevents single-game overreactions.

#### Monthly Rolling Cap
Maximum total adjustments in 30 days: **±1200 points**

Prevents accumulated extreme swings.

#### Status Adjustments

**Retired Players**
- Gradual decay: -250/week
- Prevents instant crash to zero
- Natural decline over 4+ weeks

**Inactive/IR Players**
- Moderate decline: -150/week
- Accounts for missed games
- Preserves long-term value

**Missing Data**
- No adjustment applied
- Skips players without stats
- Prevents invented trends

## API Endpoints

### POST `/functions/v1/rebalance-dynasty`

Run weekly dynasty rebalance for all players.

**Auth:** Bearer token or secret parameter

**Query Parameters:**
- `secret` - CRON_SECRET for scheduled runs
- `player_id` - Optional: rebalance single player

**Response:**
```json
{
  "success": true,
  "stats_synced": 487,
  "players_rebalanced": 823,
  "snapshots_saved": 823,
  "message": "Rebalanced 823 players, synced 487 stats",
  "errors": []
}
```

**Single Player Response:**
```json
{
  "success": true,
  "dynasty_value": 8750,
  "adjustment_total": 450
}
```

### GET `/functions/v1/player-dynasty-history`

Get dynasty value history and adjustments for a player.

**Query Parameters:**
- `player_id` (required) - Player UUID
- `days` (optional) - Days of history (default: 30)

**Response:**
```json
{
  "player_id": "abc-123",
  "player_name": "Patrick Mahomes",
  "position": "QB",
  "current_dynasty_value": 11250,
  "base_dynasty_value": 11000,
  "total_adjustment": 250,
  "change_7d": 150,
  "change_30d": 450,
  "recent_adjustments": [
    {
      "adjustment_date": "2026-02-15",
      "signal_source": "blended",
      "delta": 200,
      "reason": "Performance: Trending up: 26.3 PPG vs 23.1 season avg",
      "confidence": 0.7
    }
  ],
  "value_history": [
    {
      "snapshot_date": "2026-02-15",
      "dynasty_value": 11250,
      "base_dynasty_value": 11000,
      "adjustment_total": 250,
      "value_change": 200
    }
  ]
}
```

## UI Integration

### Player Card Enhancement

```tsx
// Show current dynasty value with adjustment context
<div className="dynasty-value">
  <h3>Dynasty Value</h3>
  <div className="value-breakdown">
    <span className="current">{player.dynasty_value}</span>
    <span className="base">Base: {player.base_dynasty_value}</span>
    {player.adjustment_total !== 0 && (
      <span className={`adjustment ${player.adjustment_total > 0 ? 'positive' : 'negative'}`}>
        {player.adjustment_total > 0 ? '+' : ''}{player.adjustment_total} adjusted
      </span>
    )}
  </div>

  {/* Show recent changes */}
  <div className="changes">
    <span>7d: {player.change_7d > 0 ? '+' : ''}{player.change_7d}</span>
    <span>30d: {player.change_30d > 0 ? '+' : ''}{player.change_30d}</span>
  </div>
</div>
```

### Adjustment History

```tsx
// Show why value changed
<div className="adjustment-history">
  <h4>Recent Adjustments</h4>
  {adjustments.map((adj) => (
    <div key={adj.adjustment_date} className="adjustment-item">
      <span className="date">{adj.adjustment_date}</span>
      <span className={`delta ${adj.delta > 0 ? 'positive' : 'negative'}`}>
        {adj.delta > 0 ? '+' : ''}{adj.delta}
      </span>
      <span className="reason">{adj.reason}</span>
    </div>
  ))}
</div>
```

### Value Sparkline

```tsx
// Show value trend over time
<Sparkline
  data={history.map(h => h.dynasty_value)}
  width={100}
  height={20}
  stroke={trend > 0 ? 'green' : 'red'}
/>
```

### Top-1000 Rankings Table

Add columns for dynasty changes:

| Rank | Player | Dynasty Value | 7d Change | 30d Change | Trend |
|------|--------|---------------|-----------|------------|-------|
| 1 | Patrick Mahomes | 11,250 | +150 | +450 | ↗ |
| 2 | Ja'Marr Chase | 10,980 | -50 | +200 | ↗ |
| 3 | Brock Purdy | 10,750 | +200 | +650 | ⬆ |

## Cron Schedule

Add to your cron configuration:

```sql
-- Run every Tuesday at 10 AM (after weekly stats are available)
SELECT cron.schedule(
  'weekly-dynasty-rebalance',
  '0 10 * * 2',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/rebalance-dynasty?secret=' || current_setting('app.settings.cron_secret'),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

## Manual Triggers

### Via API
```bash
# Full rebalance
curl -X POST "https://your-project.supabase.co/functions/v1/rebalance-dynasty?secret=CRON_SECRET"

# Single player
curl -X POST "https://your-project.supabase.co/functions/v1/rebalance-dynasty?secret=CRON_SECRET&player_id=abc-123"
```

### Via Code
```typescript
import { runWeeklyDynastyRebalance, rebalanceSinglePlayer } from '@/lib/dynasty/runWeeklyRebalance';

// Full rebalance
const result = await runWeeklyDynastyRebalance();

// Single player
const playerResult = await rebalanceSinglePlayer('player-uuid');
```

## Monitoring

### Check Rebalance Health

```sql
-- Players rebalanced today
SELECT COUNT(*) as rebalanced_today
FROM dynasty_adjustments
WHERE as_of_date = CURRENT_DATE;

-- Average adjustment magnitude
SELECT AVG(ABS(delta)) as avg_adjustment
FROM dynasty_adjustments
WHERE as_of_date >= CURRENT_DATE - 7;

-- Largest adjustments this week
SELECT p.full_name, da.delta, da.reason
FROM dynasty_adjustments da
JOIN nfl_players p ON p.id = da.player_id
WHERE da.as_of_date >= CURRENT_DATE - 7
ORDER BY ABS(da.delta) DESC
LIMIT 10;
```

## Example Scenarios

### Breakout Performance
**Player:** Puka Nacua (rookie)
**Weeks 1-4:** 8.2 PPG (season avg)
**Weeks 5-6:** 18.7 PPG (last 2 weeks)

**Calculation:**
- 18.7 > 8.2 * 1.35 (11.1) ✓ Breakout threshold
- Not all 4 weeks above avg → Recent breakout
- Delta: +400
- Reason: "Recent breakout: 18.7 PPG vs 8.2 season avg"

**Result:**
- Base dynasty: 7,200
- Adjustment: +400
- New dynasty: 7,600

### Injury Decline
**Player:** Christian McCaffrey
**Weeks 1-8:** 22.5 PPG (season avg)
**Weeks 9-10:** 1.2 PPG (injury)

**Calculation:**
- 2 weeks < 2 points → Injury concern
- Delta: -200
- Reason: "2 low-scoring weeks (injury concern)"

**Safety:**
- Not a catastrophic drop
- Preserves long-term dynasty value
- Moderate response to injury

**Result:**
- Base dynasty: 9,800
- Adjustment: -200
- New dynasty: 9,600

### Monthly Cap Example
**Player:** Running hot streak
**Week 1:** +400 (breakout)
**Week 2:** +300 (sustained)
**Week 3:** +300 (sustained)
**Week 4:** Proposed +500

**Monthly total:** 400 + 300 + 300 + 500 = 1,500
**Cap:** 1,200

**Result:**
- Can only add: 1,200 - 1,000 = 200
- Delta capped to: +200
- Reason: "Monthly cap applied (1000 + 500 > 1200)"

## Best Practices

1. **Run weekly during season** - Tuesday after games are scored
2. **Monitor adjustment distribution** - Most should be ±200
3. **Review large adjustments** - Verify ±500 changes make sense
4. **Trust the system** - Don't manually override without cause
5. **Show transparency** - Always display why values changed

## Troubleshooting

### No adjustments being made
- Check if weekly stats are syncing
- Verify players exist in player_values
- Check if in-season (weights may differ)

### Adjustments too aggressive
- Review safety caps (weekly ±500, monthly ±1200)
- Check confidence thresholds
- Verify signal blending weights

### Missing player history
- Ensure dynasty_value_snapshots are saving
- Check RLS policies allow reads
- Verify player_id references are correct

## Future Enhancements

- **Age-based adjustments** - Integrate player ages into trends
- **Position-specific weights** - Different signals for QB vs RB
- **Injury status integration** - Connect to injury API
- **League-specific adjustments** - Custom weights per league
- **Machine learning signals** - Predictive models for breakouts
