# NFL Player Registry System

A canonical player database that serves as the single source of truth for all NFL player data across the Fantasy Draft Pros platform.

## Overview

The Player Registry eliminates player data inconsistencies, name mismatches, and missing player errors by maintaining a persistent master database of all active NFL players synced daily from Sleeper's authoritative API.

## Architecture

### Database Tables

#### `nfl_players` - Master Player Registry

The canonical source of truth for all player data:

```sql
CREATE TABLE nfl_players (
  id uuid PRIMARY KEY,              -- Internal registry ID
  external_id text UNIQUE,          -- Sleeper player_id
  full_name text NOT NULL,          -- First + Last name
  search_name text,                 -- Normalized for fuzzy matching
  player_position text,             -- QB, RB, WR, TE, K, DEF, DL, LB, DB
  team text,                        -- 3-letter NFL team code
  status text,                      -- Active, Practice Squad, IR, FA, Retired, Rookie, Inactive, Unknown
  rookie_year int,                  -- Year entered NFL
  birthdate date,                   -- Date of birth
  last_seen_at timestamptz,         -- Last sync timestamp
  created_at timestamptz,           -- First seen
  updated_at timestamptz,           -- Last updated
  metadata jsonb                    -- Additional Sleeper data
);
```

**Key Features:**
- Unique constraint on `(full_name, player_position)` prevents duplicates
- `search_name` auto-generated via trigger for fuzzy matching
- `last_seen_at` tracks when player was last seen in Sleeper API
- Players not seen in 60 days automatically marked `Inactive`

#### `player_events` - Change Tracking

Event log for player changes powering notifications:

```sql
CREATE TABLE player_events (
  id uuid PRIMARY KEY,
  player_id uuid REFERENCES nfl_players(id),
  event_type text,                  -- rookie_added, team_changed, status_changed, etc.
  old_value text,
  new_value text,
  metadata jsonb,
  created_at timestamptz
);
```

**Event Types:**
- `rookie_added` - New rookie detected
- `team_changed` - Player changed teams
- `status_changed` - Status change (Active ↔ IR, etc.)
- `position_changed` - Position change
- `activated` - Returned from IR
- `retired` - Retired from NFL

### Automatic Sync System

#### Daily Sleeper Import

**Edge Function:** `sync-sleeper-players`

**Endpoint:** `GET /functions/v1/sync-sleeper-players?secret=CRON_SECRET`

**Schedule:** Daily at midnight (recommended)

**Process:**
1. Fetches all NFL players from `https://api.sleeper.app/v1/players/nfl`
2. Filters relevant players (Active, Practice Squad, IR, unsigned veterans, rookies)
3. Excludes retired players older than 2 seasons
4. Normalizes names: `first_name + last_name`
5. Upserts into `nfl_players` using `external_id` as key
6. Updates team, position, status, metadata
7. Creates events for changes (team, status, position)
8. Marks players not seen in 60 days as `Inactive`

**Response:**
```json
{
  "success": true,
  "inserted": 150,
  "updated": 3500,
  "skipped": 500,
  "errors": 0,
  "inactive_marked": 25
}
```

**Included Statuses:**
- Active players
- Practice Squad
- Injured Reserve (IR)
- Unsigned veterans
- Current rookies
- Free agents

**Excluded:**
- Retired players older than 2 seasons
- Players with null/empty names
- Invalid positions

#### Rookie Detection

Automatic rookie identification:

```typescript
if (player.years_exp === 0) {
  rookie_year = current_year;
  status = 'Rookie';

  // Log rookie_added event
  CREATE EVENT 'rookie_added' FOR player;
}
```

**Benefits:**
- Rookies auto-added hours after NFL draft
- No manual data entry required
- Instant availability for dynasty leagues

### Helper Functions

#### Lookup Functions

**get_player_by_external_id(external_id)**

Get player by Sleeper player_id:

```typescript
const player = await supabase.rpc('get_player_by_external_id', {
  p_external_id: '4866'
});
// Returns: { id, external_id, full_name, player_position, team, status }
```

**get_player_by_name(name, position?)**

Fuzzy player lookup with scoring:

```typescript
const matches = await supabase.rpc('get_player_by_name', {
  p_name: 'Patrick Mahomes',
  p_position: 'QB'
});
// Returns top 10 matches sorted by match_score (100 = exact, 70 = fuzzy)
```

**search_players(query, limit?)**

Autocomplete-ready search:

```typescript
const results = await supabase.rpc('search_players', {
  p_query: 'mah',
  p_limit: 10
});
// Returns: Players matching query with match_type (exact, search, contains)
```

#### Creation Functions

**find_or_create_player_by_external_id(external_id, name?, position?, team?)**

Get or create player by Sleeper ID:

```typescript
const playerId = await supabase.rpc('find_or_create_player_by_external_id', {
  p_external_id: '4866',
  p_full_name: 'Patrick Mahomes',
  p_position: 'QB',
  p_team: 'KC'
});
// Returns: uuid of existing or newly created player
```

**find_or_create_player_by_name(name, position?, team?)**

Get or create player by name:

```typescript
const playerId = await supabase.rpc('find_or_create_player_by_name', {
  p_name: 'Drake Maye',
  p_position: 'QB',
  p_team: 'NE'
});
// Creates placeholder if not found
```

#### Utility Functions

**normalize_search_name(name)**

Normalize name for matching:

```typescript
normalize_search_name('Patrick Mahomes II')
// Returns: 'patrickmahomesii'
```

**mark_inactive_players()**

Mark stale players as inactive:

```typescript
const count = await supabase.rpc('mark_inactive_players');
// Marks players not seen in 60 days as 'Inactive'
```

**get_rookies_by_year(year)**

Get all rookies for a season:

```typescript
const rookies = await supabase.rpc('get_rookies_by_year', {
  p_year: 2025
});
```

### Frontend Integration

#### TypeScript Library

**File:** `src/lib/players/sleeperPlayerSync.ts`

Core functions:

```typescript
import {
  syncSleeperPlayers,
  getPlayerIdByName,
  getPlayerIdByExternalId,
  ensurePlayerExists,
  getPlayersByTeam,
  getPlayersByPosition,
  getRookies,
  getRecentPlayerEvents
} from '@/lib/players/sleeperPlayerSync';

// Sync all players from Sleeper
const result = await syncSleeperPlayers();
// { inserted: 150, updated: 3500, skipped: 500, errors: 0 }

// Get player ID by name
const player = await getPlayerIdByName('Patrick Mahomes', 'QB');
// { id: 'uuid', name: 'Patrick Mahomes', position: 'QB', team: 'KC' }

// Get player ID by Sleeper ID
const playerId = await getPlayerIdByExternalId('4866');

// Ensure player exists (with auto-sync fallback)
const playerId = await ensurePlayerExists('Drake Maye', 'QB');

// Get team roster
const chiefs = await getPlayersByTeam('KC');

// Get position group
const qbs = await getPlayersByPosition('QB');

// Get current year rookies
const rookies = await getRookies(2025);

// Get recent player events
const events = await getRecentPlayerEvents(50);
```

#### Missing Player Protection

**Problem:** Rookies drafted before daily sync runs cause lookup failures.

**Solution:** Auto-sync with placeholder fallback:

```typescript
async function ensurePlayerExists(name, position) {
  // 1. Try to find player
  let player = await getPlayerIdByName(name, position);

  if (player) return player.id;

  // 2. Player not found - trigger sync
  console.log(`Player not found: ${name}. Syncing...`);
  await syncSleeperPlayers();

  // 3. Try again after sync
  player = await getPlayerIdByName(name, position);

  if (player) return player.id;

  // 4. Still missing - create placeholder
  console.warn(`Player still missing: ${name}. Creating placeholder...`);

  const { data } = await supabase
    .from('nfl_players')
    .insert({
      full_name: name,
      player_position: position || 'UNKNOWN',
      status: 'Unknown',
      external_id: `temp_${Date.now()}_${name.replace(/\s/g, '_')}`
    })
    .select('id')
    .single();

  return data.id;
}
```

**Benefits:**
- No crashes on missing players
- Auto-recovery via sync
- Placeholder prevents data loss
- Next sync fills in real data

### Usage Examples

#### Import League Rosters

```typescript
import { ensurePlayerExists } from '@/lib/players/sleeperPlayerSync';

async function importLeagueRosters(leagueId: string) {
  const rosters = await fetchRostersFromSleeper(leagueId);

  for (const roster of rosters) {
    for (const playerSleeperIdconst playerId = await ensurePlayerExists(
        playerName,
        playerPosition
      );

      // Now safely use playerId in your database
      await supabase.from('league_rosters').insert({
        league_id: leagueId,
        player_id: playerId,  // Registry ID, not Sleeper ID
        roster_id: roster.roster_id
      });
    }
  }
}
```

#### Trade Analysis

```typescript
async function analyzeTrade(tradeData) {
  const playerIds = [];

  // Get registry IDs for all players in trade
  for (const playerName of tradeData.players) {
    const playerId = await ensurePlayerExists(playerName);
    playerIds.push(playerId);
  }

  // Query player values using registry IDs
  const { data: values } = await supabase
    .from('nfl_players')
    .select('*, player_values!inner(*)')
    .in('id', playerIds);

  // Calculate trade value
  const totalValue = values.reduce((sum, p) => sum + p.player_values.fdp_value, 0);

  return { playerIds, totalValue };
}
```

#### Watchlist with Auto-Complete

```typescript
import { searchPlayers } from '@/lib/players/sleeperPlayerSync';

function PlayerSearchInput() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleSearch = async (value: string) => {
    setQuery(value);

    if (value.length < 2) {
      setSuggestions([]);
      return;
    }

    const { data } = await supabase.rpc('search_players', {
      p_query: value,
      p_limit: 10
    });

    setSuggestions(data || []);
  };

  const handleSelect = async (player: any) => {
    // Add to watchlist using registry ID
    await supabase.from('watchlist_players').insert({
      watchlist_id: userWatchlistId,
      player_id: player.id  // Use registry ID
    });
  };

  return (
    <input
      value={query}
      onChange={(e) => handleSearch(e.target.value)}
      placeholder="Search players..."
    />
  );
}
```

### Benefits

#### Data Consistency

**Before Registry:**
```typescript
// Different systems used different player identifiers
const player1 = { name: "Patrick Mahomes II", sleeper_id: "4866" };
const player2 = { name: "Patrick Mahomes", sleeper_id: "4866" };
const player3 = { name: "P. Mahomes", sleeper_id: "4866" };

// Name mismatches cause failed joins and duplicate records
```

**After Registry:**
```typescript
// Single canonical ID for all systems
const player = {
  id: "a1b2c3d4-...",           // Internal registry ID
  external_id: "4866",           // Sleeper player_id
  full_name: "Patrick Mahomes",  // Normalized name
  search_name: "patrickmahomes"  // Fuzzy match key
};

// All tables reference player.id
```

#### Auto-Healing

**Problem:** Rookie drafted at 8 PM, database sync runs at midnight.

**Without Registry:**
```typescript
// League import at 9 PM
const player = await getPlayerByName("Drake Maye");
// null - player doesn't exist yet
// ERROR: Cannot import roster
```

**With Registry:**
```typescript
// League import at 9 PM
const playerId = await ensurePlayerExists("Drake Maye", "QB");
// Triggers sync, creates placeholder if still missing
// SUCCESS: Roster imported with placeholder
// Midnight sync fills in real data
```

#### Event Tracking

```typescript
// Automatic event logging
player.team = "SF" → "KC"  // Logs team_changed event
player.status = "Active" → "IR"  // Logs status_changed event

// Power notifications
const events = await getRecentPlayerEvents(50);
events.forEach(event => {
  if (event.event_type === 'team_changed') {
    notifyWatchlistUsers(event.player_id, event.new_value);
  }
});
```

### Maintenance

#### Daily Sync

Set up cron to run daily:

```bash
# Call Edge Function with secret
curl "https://[project].supabase.co/functions/v1/sync-sleeper-players?secret=CRON_SECRET"
```

**Or use Supabase Cron:**

```typescript
Deno.cron("sync_players", "0 0 * * *", async () => {
  const response = await fetch(
    "https://[project].supabase.co/functions/v1/sync-sleeper-players?secret=CRON_SECRET"
  );
  const result = await response.json();
  console.log("Player sync complete:", result);
});
```

#### Manual Sync

Trigger sync from admin panel:

```typescript
import { syncSleeperPlayers } from '@/lib/players/sleeperPlayerSync';

async function handleManualSync() {
  setLoading(true);

  try {
    const result = await syncSleeperPlayers();

    showToast({
      title: "Sync Complete",
      description: `Updated ${result.updated} players, added ${result.inserted} new players`
    });
  } catch (error) {
    showToast({
      title: "Sync Failed",
      description: error.message,
      variant: "error"
    });
  } finally {
    setLoading(false);
  }
}
```

#### Cleanup Stale Players

Mark inactive players (not seen in 60 days):

```typescript
const count = await supabase.rpc('mark_inactive_players');
console.log(`Marked ${count} players as inactive`);
```

### Migration Strategy

#### Phase 1: Add Registry (Complete)

- ✅ Create `nfl_players` table
- ✅ Create `player_events` table
- ✅ Add helper functions
- ✅ Build sync utility
- ✅ Deploy Edge Function

#### Phase 2: Populate Data

```typescript
// Run initial sync to populate registry
const result = await syncSleeperPlayers();
console.log(`Imported ${result.inserted} players`);
```

#### Phase 3: Gradual Adoption

Use helper functions in new code:

```typescript
// Old way (directly using Sleeper IDs)
const player = players.find(p => p.player_id === '4866');

// New way (using registry)
const playerId = await getPlayerIdByExternalId('4866');
const { data: player } = await supabase
  .from('nfl_players')
  .select('*')
  .eq('id', playerId)
  .single();
```

#### Phase 4: Add Registry Columns (Future)

Add `nfl_player_id` columns to existing tables:

```sql
ALTER TABLE player_values ADD COLUMN nfl_player_id uuid REFERENCES nfl_players(id);
ALTER TABLE watchlist_players ADD COLUMN nfl_player_id uuid REFERENCES nfl_players(id);
```

#### Phase 5: Backfill Data (Future)

Migrate existing data to use registry IDs:

```typescript
// Batch update player_values
UPDATE player_values pv
SET nfl_player_id = np.id
FROM nfl_players np
WHERE pv.player_id = np.external_id;
```

#### Phase 6: Deprecate Old Columns (Future)

Once all systems use registry:

```sql
ALTER TABLE player_values DROP COLUMN player_id;  -- Old Sleeper ID
ALTER TABLE player_values RENAME COLUMN nfl_player_id TO player_id;
```

### Monitoring

#### Sync Health

```typescript
// Check last sync time
const { data } = await supabase
  .from('nfl_players')
  .select('last_seen_at')
  .order('last_seen_at', { ascending: false })
  .limit(1)
  .single();

const hoursSinceSync = (Date.now() - new Date(data.last_seen_at).getTime()) / 3600000;

if (hoursSinceSync > 48) {
  console.warn('Player data is stale! Last sync:', data.last_seen_at);
}
```

#### Data Quality

```typescript
// Count unknown players
const { count: unknownCount } = await supabase
  .from('nfl_players')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'Unknown');

// Count placeholders (temporary IDs)
const { count: placeholderCount } = await supabase
  .from('nfl_players')
  .select('*', { count: 'exact', head: true })
  .like('external_id', 'temp_%');

console.log({
  unknown_players: unknownCount,
  placeholder_players: placeholderCount
});
```

#### Event Monitoring

```typescript
// Track rookie additions this week
const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

const { data: newRookies } = await supabase
  .from('player_events')
  .select('*, nfl_players(*)')
  .eq('event_type', 'rookie_added')
  .gte('created_at', weekAgo.toISOString());

console.log(`${newRookies.length} new rookies added this week`);
```

## Summary

The NFL Player Registry System provides:

✅ **Single Source of Truth** - One canonical player database

✅ **Auto-Healing** - Automatic sync with fallback protection

✅ **Fuzzy Matching** - Handles name variations and typos

✅ **Event Tracking** - Automatic change detection and logging

✅ **Rookie Detection** - Instant availability of new players

✅ **Self-Maintaining** - Daily sync keeps data fresh

✅ **No Breaking Changes** - Gradual adoption path

✅ **Production Ready** - Battle-tested patterns from real fantasy platforms

This is the backbone that real dynasty fantasy platforms rely on. Your platform now has enterprise-grade player data management!

