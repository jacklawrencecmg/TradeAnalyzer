# Player Values Data Population Guide

## Overview
The Fantasy Draft Pros-style enhancements add many new player data fields. This guide explains how to populate them.

## Required Data Population

### 1. Historical Value Snapshots
**Purpose**: Enable value change tracking and trend analysis

**How to Populate**:
```javascript
// Run daily (automated via cron job recommended)
await playerValuesApi.saveValueSnapshot();
```

**Database Function** (run after snapshots exist):
```sql
SELECT calculate_player_value_changes();
```

This should be run:
- Daily after saving snapshots
- Can be automated via pg_cron extension
- Or called from your backend on a schedule

### 2. Player Age & Experience
**Data Needed**: Birth date or age, NFL debut year

**Recommended APIs**:
- ESPN API
- Sleeper API (has age data)
- SportsData.io

**Update Query Example**:
```sql
UPDATE player_values
SET
  age = 26.5,
  years_experience = 4
WHERE player_id = 'sleeper_id_here';
```

**Bulk Update** (if you have the data):
```javascript
const updates = players.map(p => ({
  player_id: p.sleeperId,
  age: p.age,
  years_experience: p.yearsExp
}));

await supabase
  .from('player_values')
  .upsert(updates, { onConflict: 'player_id' });
```

### 3. Injury Status
**Data Needed**: Current injury reports

**Recommended APIs**:
- ESPN Fantasy API (has injury status)
- Sleeper API (`injury_status` field)
- NFL.com API

**Status Values**:
- `'healthy'` - No injury
- `'questionable'` - Q designation
- `'doubtful'` - D designation
- `'out'` - Out for game
- `'ir'` - Injured reserve

**Sleeper API Example**:
```javascript
// Fetch from Sleeper
const response = await fetch('https://api.sleeper.app/v1/players/nfl');
const players = await response.json();

// Update in database
for (const [playerId, player] of Object.entries(players)) {
  if (player.injury_status) {
    await supabase
      .from('player_values')
      .update({
        injury_status: player.injury_status.toLowerCase()
      })
      .eq('player_id', playerId);
  }
}
```

### 4. Bye Weeks
**Data Needed**: 2024/2025 NFL schedule

**Source**: NFL.com, ESPN, or hardcoded from schedule

**Update Example**:
```sql
-- AFC East
UPDATE player_values SET bye_week = 12 WHERE team = 'BUF';
UPDATE player_values SET bye_week = 12 WHERE team = 'MIA';
UPDATE player_values SET bye_week = 11 WHERE team = 'NE';
UPDATE player_values SET bye_week = 12 WHERE team = 'NYJ';

-- Continue for all teams...
```

### 5. Draft Information
**Data Needed**: NFL Draft year, round, pick number, college

**Recommended Sources**:
- Pro Football Reference
- Sleeper API (has draft data)
- ESPN API

**Sleeper API has this data**:
```javascript
const players = await fetch('https://api.sleeper.app/v1/players/nfl')
  .then(r => r.json());

for (const [playerId, player] of Object.entries(players)) {
  await supabase
    .from('player_values')
    .update({
      draft_year: player.years_exp ? new Date().getFullYear() - player.years_exp : null,
      college: player.college,
      // Sleeper doesn't have round/pick, would need another source
    })
    .eq('player_id', playerId);
}
```

### 6. Player Tiers
**Data Needed**: Classification logic

**Recommended Approach**: Calculate based on FDP value ranges

```sql
-- Example tier assignments based on value
UPDATE player_values SET tier = 'elite' WHERE fdp_value >= 9000;
UPDATE player_values SET tier = 'tier1' WHERE fdp_value >= 7000 AND fdp_value < 9000;
UPDATE player_values SET tier = 'tier2' WHERE fdp_value >= 5000 AND fdp_value < 7000;
UPDATE player_values SET tier = 'tier3' WHERE fdp_value >= 3000 AND fdp_value < 5000;
UPDATE player_values SET tier = 'flex' WHERE fdp_value >= 1000 AND fdp_value < 3000;
UPDATE player_values SET tier = 'depth' WHERE fdp_value < 1000;
```

Or position-specific tiers:
```sql
-- QB tiers
UPDATE player_values SET tier = 'elite'
WHERE position = 'QB' AND fdp_value >= 9000;

UPDATE player_values SET tier = 'tier1'
WHERE position = 'QB' AND fdp_value >= 7000 AND fdp_value < 9000;

-- Continue for RB, WR, TE...
```

### 7. Contract Years Remaining
**Data Needed**: NFL contract information

**Source**:
- Over The Cap (overthecap.com)
- Spotrac (spotrac.com)
- Would require web scraping or paid API

**Note**: This is dynasty-specific and mostly for keeper leagues. Can be left NULL for redraft.

### 8. Volatility Score
**Data Needed**: Historical value variance

**Calculation** (run after you have enough history):
```sql
-- Calculate standard deviation of value changes
UPDATE player_values pv
SET volatility_score = (
  SELECT COALESCE(STDDEV(value), 0)
  FROM player_value_history
  WHERE player_id = pv.player_id
    AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
);
```

## Automated Data Pipeline Example

### Complete Sync Function
```typescript
async function fullDataSync() {
  // 1. Sync Fantasy Draft Pros values (already implemented)
  await playerValuesApi.syncPlayerValuesFromSportsData(isSuperflex);

  // 2. Fetch Sleeper player data
  const sleeperPlayers = await fetch('https://api.sleeper.app/v1/players/nfl')
    .then(r => r.json());

  // 3. Update player metadata
  const updates = [];
  for (const [playerId, player] of Object.entries(sleeperPlayers)) {
    updates.push({
      player_id: playerId,
      age: player.age,
      years_experience: player.years_exp,
      injury_status: player.injury_status?.toLowerCase() || 'healthy',
      college: player.college,
      team: player.team,
      // Add more fields as available
    });
  }

  // 4. Bulk update
  await supabase
    .from('player_values')
    .upsert(updates, { onConflict: 'player_id' });

  // 5. Update bye weeks (from hardcoded schedule)
  await updateByeWeeks();

  // 6. Recalculate tiers
  await recalculateTiers();

  // 7. Save value snapshot
  await playerValuesApi.saveValueSnapshot();

  // 8. Calculate value changes
  await supabase.rpc('calculate_player_value_changes');

  console.log('Full data sync complete');
}
```

## Recommended Update Schedule

| Data Type | Frequency | Method |
|-----------|-----------|--------|
| Player Values | Daily | Automated cron |
| Injury Status | Daily | API sync |
| Value Snapshots | Daily | After value sync |
| Value Changes | Daily | After snapshots |
| Bye Weeks | Weekly | Manual/API |
| Tiers | Daily | After values |
| Age/Experience | Weekly | API sync |
| Draft Info | Once/season | Manual |
| Volatility | Weekly | Calculated |

## Minimal Viable Setup

If you want to get started quickly, focus on:

1. **Player Values** - Already syncing from Fantasy Draft Pros ✅
2. **Value Snapshots** - Run daily
3. **Value Changes** - Calculate after snapshots
4. **Injury Status** - Sync from Sleeper API
5. **Tiers** - Auto-calculate from values

The rest can be populated gradually or left as enhancements.

## Sleeper API Quick Reference

```javascript
// Get all NFL players (includes metadata)
const players = await fetch('https://api.sleeper.app/v1/players/nfl')
  .then(r => r.json());

// Player object includes:
// - age
// - years_exp
// - injury_status
// - college
// - team
// - position
// - status (Active, Inactive, etc.)
```

## Testing Your Data

```sql
-- Check how many players have each field populated
SELECT
  COUNT(*) as total_players,
  COUNT(age) as has_age,
  COUNT(injury_status) as has_injury,
  COUNT(tier) as has_tier,
  COUNT(bye_week) as has_bye,
  COUNT(college) as has_college
FROM player_values;

-- Check value change coverage
SELECT COUNT(DISTINCT player_id) as players_with_history
FROM player_value_history;

-- Check if snapshots are being saved
SELECT snapshot_date, COUNT(*) as player_count
FROM player_value_history
GROUP BY snapshot_date
ORDER BY snapshot_date DESC
LIMIT 10;
```

## Edge Function for Automation

Create a Supabase Edge Function that runs on a schedule:

```typescript
// supabase/functions/sync-player-data/index.ts
import { serve } from 'std/server.ts';

serve(async (req) => {
  // 1. Fetch Sleeper data
  const sleeperData = await fetch('https://api.sleeper.app/v1/players/nfl')
    .then(r => r.json());

  // 2. Update database
  // ... sync logic ...

  // 3. Save snapshot
  // ... snapshot logic ...

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

Then trigger via cron or webhook daily.
