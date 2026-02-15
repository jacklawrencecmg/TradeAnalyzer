# Team Data Sync System

## Overview

The Dynasty Doctor now ensures that player team data is always current by using the database (`nfl_players` table) as the source of truth, merged with Sleeper API data.

## Problem Solved

**Before:** Sleeper API player data was cached for 24 hours, causing stale team information when players were traded or changed teams.

**After:**
- Database stores current team data (synced from Sleeper)
- Cache reduced from 24 hours to 1 hour
- Database team data merged with Sleeper API on every fetch
- Cache automatically cleared after admin syncs

## Architecture

### Data Flow

```
Sleeper API → Database (nfl_players) → Enriched Merge → Cache (1 hour) → All Features

STEP 1: Admin Sync
├── Fetch latest from Sleeper API
├── Update nfl_players table
├── Track team changes in team_history
└── Clear all player caches

STEP 2: User Request
├── Check 1-hour cache
├── If expired: Fetch Sleeper API
├── Merge with database team data
└── Return enriched player data

STEP 3: Features Use Current Data
├── Power Rankings
├── Trade Analyzer
├── Lineup Optimizer
└── All other features
```

## Key Files

### 1. getEnrichedPlayers.ts

**Purpose:** Fetches current player data from database with 5-minute cache

**Functions:**
- `getEnrichedPlayers()` - Loads all active players from database
- `getEnrichedPlayer(playerId)` - Gets single player by ID
- `mergeSleeperWithDatabase()` - Merges Sleeper API with database team data
- `invalidateEnrichedPlayersCache()` - Clears the enriched cache

**Cache:** 5 minutes (much shorter than Sleeper's 1 hour)

**Query:** Fetches from `nfl_players` table:
```sql
SELECT external_id, full_name, player_position, team, status, rookie_year, metadata
FROM nfl_players
WHERE status IN ('Active', 'Rookie', 'Practice Squad', 'Injured Reserve', 'IR', 'Free Agent')
AND external_id IS NOT NULL
```

### 2. sleeperApi.ts - Updated

**Changes:**
- Reduced `PLAYER_CACHE_DURATION` from 24 hours to 1 hour
- `fetchAllPlayers()` now merges with database team data
- Added `clearPlayerCache()` function
- Imports `getEnrichedPlayers` utilities

**Key Function:**
```typescript
export async function fetchAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  // Check 1-hour cache first
  const cached = getCachedData(cacheKey, PLAYER_CACHE_DURATION);
  if (cached) return cached;

  // Fetch from Sleeper API
  const sleeperData = await fetch(`${SLEEPER_API_BASE}/players/nfl`).json();

  // Merge with database (database team data is authoritative)
  const merged = await mergeSleeperWithDatabase(sleeperData);

  // Cache for 1 hour
  setCachedData(cacheKey, merged);
  return merged;
}
```

### 3. sleeperPlayerSync.ts - Existing

**Purpose:** Syncs Sleeper API → Database

Already handles:
- Upserting players to `nfl_players`
- Tracking team changes in `team_history`
- Recording player events
- Creating aliases for fuzzy matching

**Team Change Detection:**
```typescript
await supabase.rpc('record_team_change', {
  p_player_id: playerUuid,
  p_new_team: player.team,
  p_source: 'sleeper',
  p_change_date: new Date().toISOString(),
});
```

### 4. AdminSyncHub.tsx - Updated

**Changes:**
- Imports `clearPlayerCache()` and `invalidateEnrichedPlayersCache()`
- Auto-clears caches after player sync
- Updated button text: "Update rosters, teams, and status"

**Auto Cache Clear:**
```typescript
if (type === 'players' || type === 'full') {
  clearPlayerCache();
  invalidateEnrichedPlayersCache();
  console.log('Player caches cleared - team data refreshed');
}
```

## How Team Data Updates

### Automatic Update Flow

1. **Admin clicks "Sync Players"** in Admin → Sync Hub
2. Edge function `sync-sleeper-players` runs
3. Fetches all players from Sleeper API
4. For each player:
   - Upserts to `nfl_players` table
   - If team changed: Records in `team_history`
   - If team changed: Creates `player_events` entry
5. After sync completes:
   - Clears Sleeper API cache (1 hour)
   - Clears enriched players cache (5 minutes)
6. Next request:
   - Fetches fresh from Sleeper API
   - Merges with updated database team data
   - Users see current teams immediately

### Manual Cache Refresh

If you need to force a refresh without running full sync:

```typescript
import { clearPlayerCache } from '../services/sleeperApi';
import { invalidateEnrichedPlayersCache } from '../lib/players/getEnrichedPlayers';

// Clear both caches
clearPlayerCache();
invalidateEnrichedPlayersCache();

// Next fetchAllPlayers() will fetch fresh data
```

## Cache Hierarchy

### 3-Tier Caching System

**Tier 1: Enriched Players (5 minutes)**
- Source: Database query
- Purpose: Current team data
- Invalidation: Manual or after sync

**Tier 2: Sleeper API (1 hour)**
- Source: Sleeper API fetch + database merge
- Purpose: Full player data with current teams
- Invalidation: After sync or manual

**Tier 3: Database (Persistent)**
- Source: Sleeper sync
- Purpose: Source of truth for teams
- Update: Admin sync or edge function

### Why This Works

1. **Database is authoritative** for team data
2. **Short caches** (5 min, 1 hour) keep data fresh
3. **Auto-invalidation** after sync ensures consistency
4. **Merge strategy** combines best of both sources:
   - Sleeper API: Comprehensive player data
   - Database: Current team assignments

## Usage in Features

### Power Rankings

```typescript
const players = await fetchAllPlayers();
// players[playerId].team ← from database (current)
const player = players[roster.players[0]];
console.log(player.team); // Current team!
```

### Trade Analyzer

```typescript
const players = await fetchAllPlayers();
// Enriched with current team data
const playerValue = getPlayerValue(players[playerId], settings);
```

### Lineup Optimizer

```typescript
const allPlayers = await fetchAllPlayers();
// Team data is current
const rosterPlayers = roster.players.map(id => allPlayers[id]);
```

## Admin Workflow

### When to Sync

**During Season:**
- Daily (Monday morning after games)
- After major trades (within 30 minutes)
- Before important decisions
- When users report stale data

**Off-Season:**
- Weekly is sufficient
- After free agency signings
- After draft

### How to Sync

1. Navigate to **Admin → Sync Hub**
2. Click **"Sync Players"** button
3. Wait for completion (30-60 seconds)
4. Caches automatically cleared
5. Confirm success in result panel
6. All features now use current team data

### Verify Success

Check these indicators:
- "Last Sync" shows recent time
- No errors in result panel
- Player count updated
- Position coverage correct
- Console shows: "Player caches cleared"

## Team Change Tracking

### Team History Table

Every team change is tracked:
```sql
CREATE TABLE team_history (
  player_id uuid REFERENCES nfl_players(id),
  team text NOT NULL,
  joined_at timestamptz NOT NULL,
  left_at timestamptz,
  source text,
  verified boolean DEFAULT false
);
```

### Player Events

Team changes create events:
```json
{
  "event_type": "team_changed",
  "metadata": {
    "old_team": "LAC",
    "new_team": "LV",
    "source": "sleeper"
  }
}
```

### Historical Queries

Get player's team history:
```typescript
const { data } = await supabase
  .from('team_history')
  .select('*')
  .eq('player_id', playerId)
  .order('joined_at', { ascending: false });
```

Get recent trades:
```typescript
const { data } = await supabase
  .from('player_events')
  .select('*, nfl_players(full_name, player_position)')
  .eq('event_type', 'team_changed')
  .order('created_at', { ascending: false })
  .limit(50);
```

## Troubleshooting

### Problem: Power Rankings showing old teams

**Symptoms:**
- Player listed with former team
- Team totals incorrect
- Recent trades not reflected

**Solution:**
1. Admin → Sync Hub
2. Click "Sync Players"
3. Wait for completion
4. Refresh Power Rankings page
5. Teams now current

**Prevention:**
- Run daily syncs during season
- Set up automated cron job (future)

### Problem: Some players have current teams, others don't

**Symptoms:**
- Inconsistent team data
- Mix of old and new teams

**Cause:**
- Cache not fully cleared
- Partial sync completion

**Solution:**
```typescript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

Then re-run sync.

### Problem: Database team differs from Sleeper

**Symptoms:**
- Sync runs but teams still wrong
- Database has incorrect team

**Cause:**
- Sleeper API delay
- Data corruption

**Solution:**
1. Check Sleeper.app website for player's current team
2. If Sleeper is correct but database is wrong:
   ```sql
   UPDATE nfl_players
   SET team = 'NEW_TEAM'
   WHERE external_id = 'sleeper_player_id';
   ```
3. Clear caches
4. Re-run sync

### Problem: Cache seems stuck at 1 hour

**Symptoms:**
- Changes not appearing for 1 hour
- Manual refreshes don't help

**Solution:**
- Cache is working as designed (1 hour)
- For immediate refresh: Run admin sync
- Sync auto-clears cache instantly

## Performance Considerations

### Why 1 Hour Cache?

Balance between:
- **Freshness:** Team changes during games
- **Performance:** Reduce Sleeper API calls
- **Load:** Don't hammer Sleeper or database

### Why 5 Minute Database Cache?

- Database queries are fast
- Team data changes infrequently
- 5 minutes keeps load minimal
- Still fresh enough for real-time needs

### Request Flow

**Cold Cache (worst case):**
1. Fetch Sleeper API: ~2 seconds
2. Query database: ~200ms
3. Merge data: ~50ms
4. **Total: ~2.5 seconds**

**Warm Cache (typical):**
1. Return from memory: <1ms
2. **Total: <1ms**

**After Sync:**
1. First request: 2.5 seconds (cold)
2. Next requests: <1ms (warm for 1 hour)

## Future Enhancements

### Potential Improvements

1. **Real-Time Updates**
   - WebSocket connection to Sleeper
   - Push notifications for trades
   - Instant cache invalidation

2. **Automated Syncing**
   - Cron job every hour during season
   - Trigger on NFL.com trade alerts
   - Slack notifications for admins

3. **User-Reported Updates**
   - "Report incorrect team" button
   - Admin moderation queue
   - Crowd-sourced data accuracy

4. **Smart Cache Invalidation**
   - Invalidate single player, not all
   - TTL per player based on activity
   - Predictive pre-fetching

5. **Trade Feed**
   - Public feed of recent trades
   - Team change timeline
   - Historical trade analysis

## API Reference

### getEnrichedPlayers()

```typescript
import { getEnrichedPlayers } from '../lib/players/getEnrichedPlayers';

const players = await getEnrichedPlayers();
// Returns: Map<string, EnrichedPlayer>

interface EnrichedPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;        // ← Current from database
  status: string;
  age: number | null;
  years_exp: number | null;
  injury_status: string | null;
  rookie_year: number | null;
}
```

### mergeSleeperWithDatabase()

```typescript
import { mergeSleeperWithDatabase } from '../lib/players/getEnrichedPlayers';

const sleeperData = await fetch('https://api.sleeper.app/v1/players/nfl').json();
const merged = await mergeSleeperWithDatabase(sleeperData);

// merged[playerId].team ← from database (current)
// merged[playerId].* ← from Sleeper (comprehensive)
```

### clearPlayerCache()

```typescript
import { clearPlayerCache } from '../services/sleeperApi';

clearPlayerCache();
// Next fetchAllPlayers() will fetch fresh from Sleeper + database
```

### invalidateEnrichedPlayersCache()

```typescript
import { invalidateEnrichedPlayersCache } from '../lib/players/getEnrichedPlayers';

invalidateEnrichedPlayersCache();
// Next getEnrichedPlayers() will query database fresh
```

## Best Practices

### For Admins

1. **Sync daily during season** - Set a reminder
2. **Sync after big trades** - Within 30 minutes
3. **Monitor sync status** - Check dashboard regularly
4. **Verify team changes** - Spot-check major players
5. **Clear browser cache** - If issues persist

### For Developers

1. **Always use fetchAllPlayers()** - Don't cache separately
2. **Trust the team data** - Database is authoritative
3. **Don't override team field** - Let sync handle it
4. **Use enriched players for pure team queries** - Faster
5. **Invalidate after manual updates** - Keep consistent

### For Users

1. **Refresh after trades** - Wait 5-60 minutes
2. **Report issues** - If teams seem wrong
3. **Clear browser cache** - If very stale
4. **Check Sleeper.app** - Verify truth source
5. **Be patient** - Caches refresh automatically

## Conclusion

The team data sync system ensures that Sleeper imports always show current teams by:

1. **Database as source of truth** for team assignments
2. **Short cache durations** (5 min, 1 hour) for freshness
3. **Auto-merge strategy** combining Sleeper + database
4. **Auto-invalidation** after admin syncs
5. **Team change tracking** for historical analysis

**Key Takeaway:** Admin sync → Caches cleared → Fresh team data everywhere within 1 hour maximum (or instantly after sync).
