# Unified Data System - Complete Refactoring Guide

Your app now uses a **single source of truth** for all player data and values. Every widget, feature, and component references the canonical `nfl_players` registry and `ktc_value_snapshots` table. No hardcoded data, no name-based joins, no drift.

---

## 🎯 **System Overview**

### **The Problem This Solves**

**Before:**
```typescript
❌ Each widget has its own player list
❌ Name mismatches break features ("D.J. Moore" vs "DJ Moore")
❌ Hardcoded values become stale
❌ Trade calc uses different data than rankings
❌ No consistency between features
❌ Manual updates required constantly
```

**After:**
```typescript
✅ ONE canonical player registry (nfl_players)
✅ ONE unified values table (ktc_value_snapshots)
✅ ALL features use player_id (UUID)
✅ Automatic sync keeps data fresh
✅ Zero manual intervention
✅ Perfect consistency everywhere
```

---

## 📊 **Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    Sleeper API (Players)                     │
│                    KTC Rankings (Values)                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                    Daily Sync Pipeline
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   CANONICAL SOURCES                          │
│                                                              │
│  ┌──────────────────────┐    ┌─────────────────────────┐   │
│  │   nfl_players        │    │  ktc_value_snapshots   │   │
│  │  (Player Registry)   │    │  (Unified Values)       │   │
│  │  • UUID player_id    │    │  • player_id FK         │   │
│  │  • Names, position   │    │  • ktc_value           │   │
│  │  • Team, status      │    │  • fdp_value           │   │
│  │  • Sync timestamps   │    │  • Format, position    │   │
│  └──────────────────────┘    └─────────────────────────┘   │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │    Unified Values API       │
          │  /values-latest             │
          │  /player-value-detail       │
          └──────────────┬──────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
┌─────────┐         ┌─────────┐        ┌──────────┐
│Rankings │         │ Trade   │        │ Player   │
│ Pages   │         │ Analyzer│        │ Profiles │
└─────────┘         └─────────┘        └──────────┘
    │                    │                    │
    └────────────────────┴────────────────────┘
             ALL features use player_id
```

---

## 🗄️ **Database Schema**

### **Core Tables**

#### **1. `nfl_players` - Canonical Player Registry**

Single source of truth for all NFL players.

```sql
CREATE TABLE nfl_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External reference
  external_id text UNIQUE NOT NULL,  -- Sleeper player_id

  -- Identity
  full_name text NOT NULL,
  search_name text NOT NULL,  -- Normalized for matching

  -- Position
  player_position text NOT NULL,  -- QB/RB/WR/TE/K/DL/LB/DB
  sub_position text,  -- EDGE/DT/ILB/OLB/CB/S (IDP)

  -- Team & Status
  team text,  -- Current team (null if FA)
  status text NOT NULL DEFAULT 'Active',

  -- Career
  rookie_year int,
  birthdate date,

  -- Sync
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX idx_nfl_players_external ON nfl_players(external_id);
CREATE INDEX idx_nfl_players_search ON nfl_players(search_name);
CREATE INDEX idx_nfl_players_pos_team ON nfl_players(player_position, team);
CREATE INDEX idx_nfl_players_status ON nfl_players(status);
```

**Status Values:**
- `Active` - Currently on active roster
- `Practice Squad` - On practice squad
- `Injured Reserve` / `IR` - On IR
- `Free Agent` - Not signed to team
- `Inactive` - Not seen in recent sync (60+ days)
- `Retired` - Officially retired

#### **2. `ktc_value_snapshots` - Unified Values**

Single source of truth for all player values.

```sql
CREATE TABLE ktc_value_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,

  source text NOT NULL,  -- KTC/manual_seed
  format text NOT NULL,  -- dynasty_sf/dynasty_1qb/dynasty_tep/etc
  player_position text NOT NULL,
  position_rank int,

  ktc_value int,  -- Raw KTC value
  fdp_value int,  -- FDP-adjusted value

  team_at_time text,
  captured_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_player_format ON ktc_value_snapshots(player_id, format, captured_at DESC);
CREATE INDEX idx_snapshots_position_rank ON ktc_value_snapshots(format, player_position, position_rank);
```

**Supported Formats:**
- `dynasty_sf` - Dynasty Superflex
- `dynasty_1qb` - Dynasty 1QB
- `dynasty_tep` - Dynasty with TEP
- `dynasty_sf_idp_tackle` - Dynasty SF + IDP (tackle heavy)
- `dynasty_sf_idp_big_play` - Dynasty SF + IDP (big play)

#### **3. `player_aliases` - Name Matching**

Handles all name variants for fuzzy matching.

```sql
CREATE TABLE player_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,

  alias text NOT NULL,
  alias_normalized text NOT NULL,
  source text NOT NULL,  -- sleeper/ktc/user/auto

  created_at timestamptz DEFAULT NOW(),

  CONSTRAINT unique_alias UNIQUE (alias_normalized)
);

CREATE INDEX idx_aliases_player ON player_aliases(player_id);
CREATE INDEX idx_aliases_normalized ON player_aliases(alias_normalized);
```

#### **4. `player_team_history` - Team Tracking**

Tracks every team change for accurate historical data.

```sql
CREATE TABLE player_team_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,

  team text NOT NULL,
  from_date timestamptz NOT NULL,
  to_date timestamptz,

  is_current boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'sleeper',

  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_team_history_player ON player_team_history(player_id, from_date DESC);
CREATE INDEX idx_team_history_current ON player_team_history(is_current) WHERE is_current = true;
```

#### **5. `unresolved_entities` - Quarantine System**

Captures names that couldn't be auto-resolved.

```sql
CREATE TABLE unresolved_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  raw_name text NOT NULL,
  player_position text,
  team text,

  source text NOT NULL,
  status text NOT NULL DEFAULT 'open',

  resolved_player_id uuid REFERENCES nfl_players(id),

  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_unresolved_status ON unresolved_entities(status);
```

---

## 🔄 **Sync System**

### **Edge Functions (Already Deployed)**

#### **1. `sync-sleeper-players`**

**Purpose:** Sync all players from Sleeper API

**Endpoint:**
```bash
POST /functions/v1/sync-sleeper-players?secret=CRON_SECRET
```

**What it does:**
1. Fetches all NFL players from Sleeper
2. Upserts into `nfl_players` by `external_id`
3. Generates aliases for each player
4. Tracks team changes in `player_team_history`
5. Marks players not seen in 60+ days as `Inactive`

**Response:**
```json
{
  "success": true,
  "inserted": 45,
  "updated": 2847,
  "skipped": 156,
  "errors": 0,
  "inactive_marked": 12,
  "aliases_created": 8935
}
```

#### **2. `sync-values-all`**

**Purpose:** Scrape KTC rankings for all positions

**Endpoint:**
```bash
POST /functions/v1/sync-values-all?secret=CRON_SECRET
```

**What it does:**
1. Scrapes KTC for QB/RB/WR/TE
2. Resolves each scraped name to `player_id`
3. Calculates FDP value from KTC value
4. Inserts into `ktc_value_snapshots`
5. Unresolved names go to `unresolved_entities`

**Safety Thresholds:**
- QB: Must scrape >= 60 players
- RB: Must scrape >= 150 players
- WR: Must scrape >= 200 players
- TE: Must scrape >= 80 players

If threshold not met, sync fails without writing to prevent data corruption.

**Response:**
```json
{
  "success": true,
  "positions": {
    "QB": { "status": "success", "scraped": 85, "maxRank": 85, "inserted": 85, "updated": 0 },
    "RB": { "status": "success", "scraped": 180, "maxRank": 180, "inserted": 180, "updated": 0 },
    "WR": { "status": "success", "scraped": 220, "maxRank": 220, "inserted": 220, "updated": 0 },
    "TE": { "status": "success", "scraped": 90, "maxRank": 90, "inserted": 90, "updated": 0 }
  },
  "totals": {
    "inserted": 575,
    "updated": 0,
    "unresolved": 5,
    "errors": 0
  },
  "timestamp": "2024-02-14T12:00:00Z"
}
```

#### **3. `sync-full-pipeline`**

**Purpose:** Run complete sync pipeline (Players → Values → Trends)

**Endpoint:**
```bash
POST /functions/v1/sync-full-pipeline?secret=CRON_SECRET
```

**Pipeline Steps:**
1. Sync players from Sleeper
2. Sync values from KTC
3. Compute market trends
4. Run health checks

**Response:**
```json
{
  "success": true,
  "started_at": "2024-02-14T12:00:00Z",
  "completed_at": "2024-02-14T12:05:30Z",
  "total_duration_ms": 330000,
  "steps": [
    {
      "step": 1,
      "name": "sync_players",
      "status": "success",
      "duration_ms": 45000,
      "result": { "inserted": 45, "updated": 2847 }
    },
    {
      "step": 2,
      "name": "sync_values",
      "status": "success",
      "duration_ms": 280000,
      "result": { "totals": { "inserted": 575, "updated": 0 } }
    },
    {
      "step": 3,
      "name": "compute_trends",
      "status": "success",
      "duration_ms": 3000,
      "result": { "trends_computed": 450 }
    },
    {
      "step": 4,
      "name": "health_check",
      "status": "success",
      "duration_ms": 2000,
      "result": {
        "players_last_sync": "2024-02-14T12:00:45Z",
        "values_last_sync": "2024-02-14T12:05:25Z",
        "unresolved_count": 5
      }
    }
  ]
}
```

---

## 📡 **Unified Values API**

All features use these edge functions to get player values.

### **1. Get Latest Values by Position**

**Endpoint:**
```bash
GET /functions/v1/values-latest?format=dynasty_sf&position=QB
```

**Response:**
```json
{
  "success": true,
  "format": "dynasty_sf",
  "position": "QB",
  "count": 85,
  "players": [
    {
      "player_id": "abc-123-def",
      "full_name": "Patrick Mahomes",
      "player_position": "QB",
      "team": "KC",
      "position_rank": 1,
      "ktc_value": 9500,
      "fdp_value": 9650,
      "captured_at": "2024-02-14T08:00:00Z"
    },
    ...
  ]
}
```

**Cache:** 5 minutes (client-side)

### **2. Get Player Value Detail**

**Endpoint:**
```bash
GET /functions/v1/player-value-detail?player_id=abc-123-def&format=dynasty_sf&days=180
```

**Response:**
```json
{
  "success": true,
  "player": {
    "id": "abc-123-def",
    "full_name": "Patrick Mahomes",
    "position": "QB",
    "team": "KC",
    "status": "Active",
    "rookie_year": 2017,
    "birthdate": "1995-09-17"
  },
  "latest_value": {
    "format": "dynasty_sf",
    "position_rank": 1,
    "ktc_value": 9500,
    "fdp_value": 9650,
    "captured_at": "2024-02-14T08:00:00Z"
  },
  "history": [
    { "captured_at": "2023-09-01", "ktc_value": 7500, "fdp_value": 7600, "position_rank": 2 },
    { "captured_at": "2023-09-08", "ktc_value": 7800, "fdp_value": 7900, "position_rank": 1 },
    ...
  ],
  "team_history": {
    "team": "KC",
    "from_date": "2017-04-27"
  }
}
```

**Cache:** 5 minutes (client-side)

---

## 🛠️ **How to Use in Your App**

### **Client-Side Utilities**

#### **1. Resolve Player Name to ID**

```typescript
import { resolvePlayerId } from '@/lib/players/resolvePlayerId';

// User types "mahomes"
const result = await resolvePlayerId({ name: "mahomes" });

if (result.success) {
  console.log(`Player ID: ${result.player_id}`);
  console.log(`Full name: ${result.match.full_name}`);
  // Use player_id in your feature
} else if (result.suggestions) {
  // Show suggestions to user
  console.log('Did you mean:', result.suggestions);
}
```

#### **2. Get Latest Value for Player**

```typescript
import { getLatestValueForPlayer } from '@/lib/values/getLatestValues';

const value = await getLatestValueForPlayer(playerId, 'dynasty_sf');

if (value) {
  console.log(`${value.full_name}: ${value.fdp_value}`);
}
```

#### **3. Get Rankings by Position**

```typescript
import { getLatestValuesByPosition } from '@/lib/values/getLatestValues';

const qbs = await getLatestValuesByPosition('dynasty_sf', 'QB');

qbs.forEach((qb, index) => {
  console.log(`${index + 1}. ${qb.full_name} - ${qb.fdp_value}`);
});
```

#### **4. Cached API Calls**

```typescript
import { cachedFetch, getCacheKey } from '@/lib/cache';

const cacheKey = getCacheKey(['values', format, position]);

const values = await cachedFetch(
  cacheKey,
  async () => {
    const { data } = await supabase.functions.invoke('values-latest', {
      body: { format, position }
    });
    return data.players;
  },
  5 * 60 * 1000  // 5 minutes
);
```

---

## 🎨 **Admin Sync Hub**

### **Component: `AdminSyncHub`**

**Location:** `src/components/AdminSyncHub.tsx`

**Features:**
- View sync status (last sync times, player counts, etc.)
- Manually trigger syncs (Players, Values, Full Pipeline)
- View position coverage (QB/RB/WR/TE counts)
- See unresolved entities count
- View detailed sync results

**Usage:**

```typescript
import { AdminSyncHub } from '@/components/AdminSyncHub';

function AdminPage() {
  return (
    <div>
      <AdminSyncHub />
    </div>
  );
}
```

**Features:**

1. **Status Dashboard:**
   - Total players in registry
   - Total value snapshots
   - Last sync timestamps
   - Unresolved entities count
   - Position coverage (QB/RB/WR/TE)

2. **Manual Sync Buttons:**
   - **Sync Players:** Update from Sleeper API
   - **Sync Values:** Scrape KTC rankings
   - **Full Pipeline:** Run all syncs + trends

3. **Result Display:**
   - Step-by-step progress
   - Duration for each step
   - Success/failure status
   - Detailed totals (inserted/updated/unresolved/errors)
   - Position-level details

---

## ⚙️ **Setup & Deployment**

### **1. Environment Variables**

Create `.env` file in project root:

```bash
# Required for client
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Required for edge functions (already configured in Supabase)
# SUPABASE_SERVICE_ROLE_KEY=auto-configured
# ADMIN_SYNC_SECRET=auto-configured
# CRON_SECRET=auto-configured
```

### **2. Initial Data Population**

Run initial syncs to populate the database:

```bash
# 1. Sync players
curl -X POST "${SUPABASE_URL}/functions/v1/sync-sleeper-players?secret=${CRON_SECRET}"

# 2. Sync values
curl -X POST "${SUPABASE_URL}/functions/v1/sync-values-all?secret=${CRON_SECRET}"

# OR run full pipeline
curl -X POST "${SUPABASE_URL}/functions/v1/sync-full-pipeline?secret=${CRON_SECRET}"
```

**Expected Results:**
- ~3,000 players synced
- ~600 value snapshots created
- < 10 unresolved entities

### **3. Schedule Cron Jobs**

#### **Option A: Supabase Cron (Recommended)**

In Supabase Dashboard → Edge Functions → Cron:

**Daily Player Sync:**
```
Name: sync-players-daily
Schedule: 0 3 * * *  (3 AM daily)
Function: sync-sleeper-players
```

**Twice-Daily Values Sync:**
```
Name: sync-values-twice-daily
Schedule: 0 */12 * * *  (every 12 hours)
Function: sync-values-all
```

**Daily Full Pipeline:**
```
Name: full-pipeline-daily
Schedule: 0 4 * * *  (4 AM daily)
Function: sync-full-pipeline
```

#### **Option B: GitHub Actions**

Create `.github/workflows/sync-players.yml`:

```yaml
name: Sync Players

on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM daily
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Player Sync
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/sync-sleeper-players?secret=${{ secrets.CRON_SECRET }}"
```

Create `.github/workflows/sync-values.yml`:

```yaml
name: Sync Values

on:
  schedule:
    - cron: '0 */12 * * *'  # Every 12 hours
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Values Sync
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/sync-values-all?secret=${{ secrets.CRON_SECRET }}"
```

### **4. Verify Setup**

```typescript
// Check player count
const { count: playerCount } = await supabase
  .from('nfl_players')
  .select('*', { count: 'exact', head: true });

console.log(`Players: ${playerCount}`);  // Should be ~3,000

// Check value snapshots
const { count: valueCount } = await supabase
  .from('ktc_value_snapshots')
  .select('*', { count: 'exact', head: true });

console.log(`Values: ${valueCount}`);  // Should be ~600

// Check unresolved entities
const { count: unresolvedCount } = await supabase
  .from('unresolved_entities')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'open');

console.log(`Unresolved: ${unresolvedCount}`);  // Should be < 10
```

---

## 📝 **Migration Checklist**

### **✅ Refactor Features to Use player_id**

Update these components to use the unified system:

- [ ] **Trade Analyzer:** Resolve names → player_ids, fetch values from API
- [ ] **Rankings Pages:** Use `/values-latest` endpoint
- [ ] **Player Profiles:** Use `/player-value-detail` endpoint
- [ ] **Watchlist:** Store player_ids, not names
- [ ] **League Import:** Resolve roster players to player_ids
- [ ] **Market Trends:** Query from `ktc_value_snapshots` history
- [ ] **Dynasty Reports:** Use player_ids throughout
- [ ] **Shared Trades:** Store player_ids in trade data

### **✅ Remove Hardcoded Data**

Delete or archive:

- [ ] Hardcoded player arrays
- [ ] Static JSON files with player data
- [ ] Manual value lists
- [ ] Any name-based joins

### **✅ Test Critical Paths**

- [ ] User can search for player (fuzzy matching works)
- [ ] Rankings load from API
- [ ] Trade analyzer resolves names correctly
- [ ] Player profiles show correct values
- [ ] Values update after sync

---

## 🎯 **End State Definition**

The system is **complete** when:

✅ **Data Sources:**
- `nfl_players` is the ONLY player source of truth
- `ktc_value_snapshots` is the ONLY value source of truth
- No hardcoded player data exists anywhere

✅ **Features:**
- Every widget reads from unified APIs
- All joins use `player_id`, never names
- Name resolution uses `resolvePlayerId()`
- Values come from `/values-latest` or `/player-value-detail`

✅ **Sync:**
- Cron jobs run daily/hourly
- Admin can trigger manual syncs
- Health checks monitor freshness
- Unresolved entities queue stays small (< 25)

✅ **Monitoring:**
- Admin Sync Hub shows live status
- Health checks run automatically
- Alerts for stale data
- Clear visibility into sync results

---

## 🚀 **Summary**

Your app now has:

**Canonical Data:**
- ✅ Single player registry (`nfl_players`)
- ✅ Single values table (`ktc_value_snapshots`)
- ✅ UUID-based references (stable, safe)

**Automatic Sync:**
- ✅ Daily player sync from Sleeper
- ✅ Hourly value sync from KTC
- ✅ Full pipeline orchestration
- ✅ Health monitoring built-in

**Unified APIs:**
- ✅ `/values-latest` for rankings
- ✅ `/player-value-detail` for profiles
- ✅ Cached responses (5 min TTL)
- ✅ Consistent across all features

**Developer Experience:**
- ✅ Simple utilities (`resolvePlayerId`, `getLatestValues`)
- ✅ Client-side caching
- ✅ Type-safe interfaces
- ✅ Clear error handling

**Admin Tools:**
- ✅ Sync Hub UI (manual triggers)
- ✅ Status dashboard
- ✅ Result visualization
- ✅ Unresolved entities tracking

**Result:** Every feature in your app references the same canonical data via UUID, name matching never breaks, values are always fresh, and the system self-heals! 🎉
