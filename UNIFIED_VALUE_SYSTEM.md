# Unified Value System

## Overview

The Dynasty Doctor now uses a **single, unified value system** across all features. FantasyPros Top 1000 values are the canonical source for Power Rankings, Sleeper imports, trade analysis, and all player valuations.

## Key Principle

**Power Rankings and Sleeper import values MUST match.**

All player values come from the same source and are synchronized to the database, ensuring consistency across:
- Power Rankings
- Sleeper league imports
- Trade analyzer
- Player search
- Draft kit
- Keeper calculator

## Architecture

### Data Flow

```
FantasyPros Import → Database Sync → All Features

STEP 1: Build Top 1000
├── Dynasty values (from FP Dynasty + IDP)
├── Redraft PPR values (from FP ADP + Rankings)
└── Redraft Half values (from FP ADP + Rankings)

STEP 2: Sync to Database
├── Match FP names to Sleeper player IDs
├── Store in player_values table
│   ├── fdp_value = dynasty value
│   ├── ktc_value = dynasty value (for compatibility)
│   └── metadata = {redraft_ppr, redraft_half, sources}
└── All features now use these values

STEP 3: Features Consume
├── Power Rankings uses fdp_value
├── Sleeper Import uses fdp_value
├── Trade Analyzer uses fdp_value
└── All features stay in sync
```

## Database Schema

### player_values Table

Primary value storage for all features:

```sql
CREATE TABLE player_values (
  id uuid PRIMARY KEY,
  player_id text UNIQUE NOT NULL,        -- Sleeper ID
  player_name text NOT NULL,
  position text NOT NULL,
  team text,
  base_value integer DEFAULT 0,          -- 95% of fdp_value
  fdp_value integer DEFAULT 0,           -- Primary value (dynasty)
  ktc_value integer DEFAULT 0,           -- Same as fdp_value
  trend text DEFAULT 'stable',
  last_updated timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
```

### Metadata Schema

Each player's metadata stores full value provenance:

```json
{
  "source": "fantasypros_unified_top1000",
  "fp_rank": 42,
  "dynasty_value": 8500,
  "redraft_ppr": 7200,
  "redraft_half": 7100,
  "dynasty_source": "fp_dynasty_sf",
  "redraft_source_ppr": "fp_adp_ppr",
  "redraft_source_half": "fp_adp_half",
  "original_fp_name": "Ja'Marr Chase",
  "synced_at": "2026-02-15T12:00:00Z"
}
```

## Sync Process

### syncFantasyProsToDatabase()

**File:** `src/lib/build/syncFantasyProsToDatabase.ts`

Matches FantasyPros players to Sleeper IDs and syncs to database.

**Process:**
1. Fetch all Sleeper players (QB, RB, WR, TE, DL, LB, DB)
2. For each FantasyPros player:
   - Normalize name (remove suffixes, punctuation)
   - Match by: exact name + pos + team (best)
   - Fallback: name + pos (good)
   - Fallback: name only (acceptable)
3. Create player_values records with:
   - Sleeper player_id
   - Dynasty value in fdp_value
   - Redraft values in metadata
   - Full provenance tracking
4. Upsert to database (updates existing)

**Match Quality:**
- Exact match (name + pos + team): 100% confidence
- Name + pos: 90% confidence
- Name only: 80% confidence
- < 80%: Skip (unmatched)

**Typical Results:**
- Matched: ~950-980 of 1000 players
- Unmatched: ~20-50 players (rookies, backups, name variations)

### Usage

```typescript
import { syncFantasyProsToDatabase } from '../lib/build/syncFantasyProsToDatabase';

// After building Top 1000 with redraft values:
const result = await syncFantasyProsToDatabase(top1000Players);

console.log(`Synced ${result.synced_count} players`);
console.log(`Matched ${result.matched_count} / ${top1000Players.length}`);
```

## Integration Points

### Power Rankings

**File:** `src/components/PowerRankings.tsx`

Power Rankings fetches values from database:

```typescript
// Uses calculatePowerRankings from sleeperApi
// Which calls fetchPlayerValues()
// Which loads from player_values table
// Using fdp_value as primary value

const rankings = await calculatePowerRankings(leagueId);
// Each team's value = sum of roster fdp_values
```

### Sleeper Import

**File:** `src/services/sleeperApi.ts`

Sleeper imports use the same database values:

```typescript
// fetchPlayerValues() pulls from player_values
const dbValues = await playerValuesApi.getPlayerValues();
dbPlayerValues = new Map(dbValues.map(v => [v.player_id, v]));

// All roster valuations use fdp_value
const playerValue = dbPlayerValues.get(playerId)?.fdp_value || 0;
```

### Trade Analyzer

**File:** `src/components/TradeAnalyzer.tsx`

Trade analysis uses database values via getLatestValues:

```typescript
import { getMultiplePlayerValues } from '../lib/values/getLatestValues';

// Fetches from player_values table
const values = await getMultiplePlayerValues(playerIds, format);

// Uses fdp_value for calculations
const tradeValue = calculateTradeValue(values);
```

### Player Search

All player lookups use the unified value system:

```typescript
import { searchPlayerValues } from '../lib/values/getLatestValues';

const results = await searchPlayerValues(searchTerm, format);
// Returns PlayerValue[] with fdp_value
```

## Consistency Guarantees

### ✅ Single Source of Truth

All values originate from FantasyPros Top 1000:
- No conflicting KTC vs FDP sources
- No mixed value systems
- No synchronization issues

### ✅ Automatic Updates

When you sync FantasyPros to database:
- Power Rankings immediately use new values
- Sleeper imports immediately use new values
- Trade analyzer immediately use new values
- No cache invalidation needed

### ✅ Full Provenance

Every value tracks its source:
- Which FantasyPros list (dynasty_sf, idp, adp_ppr, etc.)
- Original rank
- Sync timestamp
- Original player name from FP

### ✅ Graceful Degradation

If FantasyPros sync hasn't run:
- Falls back to KTC values
- Warns user about sync status
- Continues functioning

## Admin Workflow

### Complete Value Update

**Path:** Admin → Top 1000 Builder

**Steps:**
1. **Build Dynasty Base**
   - Downloads 6 FantasyPros sources
   - Creates Top 750 offense + 250 IDP
   - Calculates dynasty values

2. **Fill Redraft Values**
   - Downloads 4 redraft sources (PPR + Half ADP/Rankings)
   - Matches each player to PPR and Half values
   - Tracks source for each value

3. **Sync to Database** ← **CRITICAL STEP**
   - Matches FP names to Sleeper IDs
   - Writes to player_values table
   - **Powers Rankings and imports now use these values**

4. **Export CSVs** (Optional)
   - Export for external use
   - Share with league members
   - Archive for historical tracking

### Sync Button

The "Sync to Database" button:
- Appears after Step 2 (Fill Redraft Values)
- Matches ~950-980 players automatically
- Shows match quality stats
- Confirms when Power Rankings will use new values

**Visual Confirmation:**
```
Database Sync Results
━━━━━━━━━━━━━━━━━━━━
   968        968         32
Synced to DB  Matched  Unmatched

✓ Power Rankings and Sleeper imports will now use these values
```

## Value Format

### Dynasty Values

Used for all dynasty league features:

**Range:** 0-10,000
**Curve:** Exponential decay (k=0.0045)

```
Rank 1   → 10,000
Rank 10  →  9,560
Rank 50  →  8,004
Rank 100 →  6,397
Rank 500 →    906
```

**IDP Scaling:**
- LB: 45% of offense equivalent
- DL: 35% of offense equivalent
- DB: 35% of offense equivalent

### Redraft Values

Stored in metadata for future redraft support:

**Range:** 0-10,000
**Curve:** Exponential decay (k=0.005)

```
Rank 1   → 10,000
Rank 10  →  9,512
Rank 50  →  7,788
Rank 100 →  6,065
```

**IDP Scaling:**
- LB: 35% of offense equivalent
- DL: 25% of offense equivalent
- DB: 25% of offense equivalent

## Troubleshooting

### Power Rankings show different values than expected

**Cause:** Database not synced with latest FantasyPros import

**Solution:**
1. Go to Admin → Top 1000 Builder
2. Build Dynasty Base
3. Fill Redraft Values
4. **Click "Sync to Database"**
5. Refresh Power Rankings

### Sleeper Import values don't match Power Rankings

**Cause:** Should never happen if both use player_values table

**Solution:**
1. Check sync status in Top 1000 Builder
2. Verify both features query player_values table
3. Clear browser cache
4. Re-sync from FantasyPros

### Some players missing values

**Cause:** Player name mismatch or not in Top 1000

**Solution:**
1. Check unmatched players list after sync
2. Most common: rookies, backups, name variations
3. These players will use KTC fallback values
4. Manually add to player_values if critical

### Values seem outdated

**Cause:** Haven't synced recently

**Solution:**
1. FantasyPros values update weekly
2. Re-import and sync at least weekly
3. Check "Last Updated" in Power Rankings
4. Sync after major trades or injuries

## Migration from Old System

### Before (Legacy)

**Multiple Value Sources:**
- Power Rankings used FDP API + KTC fallback
- Sleeper imports used FDP API + KTC fallback
- Trade analyzer had separate value system
- Values often inconsistent between features

**Problems:**
- FDP vs KTC conflicts
- Synchronization delays
- Cache inconsistencies
- Different value scales

### After (Unified)

**Single Value Source:**
- All features use player_values table
- Table populated from FantasyPros Top 1000
- One sync updates all features
- Full provenance tracking

**Benefits:**
- ✅ Guaranteed consistency
- ✅ Single sync point
- ✅ Full transparency
- ✅ Easy updates
- ✅ Historical tracking

## API Reference

### Core Sync Function

```typescript
syncFantasyProsToDatabase(
  players: Top1000PlayerWithRedraft[]
): Promise<SyncResult>

interface SyncResult {
  success: boolean;
  synced_count: number;
  matched_count: number;
  unmatched_count: number;
  errors: string[];
}
```

### Sync Status

```typescript
getFantasyProsSyncStatus(): Promise<{
  last_sync: string | null;
  player_count: number;
  source: string | null;
}>
```

### Value Retrieval

```typescript
// Get single player value
getLatestValueForPlayer(
  playerId: string,
  format: string
): Promise<PlayerValue | null>

// Get multiple player values
getMultiplePlayerValues(
  playerIds: string[],
  format: string
): Promise<Map<string, PlayerValue>>

// Search player values
searchPlayerValues(
  searchTerm: string,
  format: string,
  limit: number
): Promise<PlayerValue[]>
```

## Best Practices

### 1. Weekly Sync

Sync FantasyPros values weekly during the season:
- Monday morning (after games)
- After major trades
- Before important waiver decisions
- Weekly market reports

### 2. Verify Match Quality

After sync, check unmatched players:
- Should be < 50 unmatched
- Review unmatched list for important players
- Consider manual entries for key rookies

### 3. Communicate to Users

Let league members know when values update:
- "Values updated from FantasyPros"
- "Synced 968 players to database"
- "Power Rankings using latest values"

### 4. Archive Exports

Export CSVs after each sync:
- Historical value tracking
- Compare value changes
- Share with league
- Backup data

### 5. Monitor Sync Health

Watch for sync issues:
- Low match rate (< 900)
- High error count (> 5)
- Failed downloads
- Network timeouts

## Future Enhancements

### Potential Additions

1. **Automatic Scheduling**
   - Daily/weekly auto-sync via cron
   - Notification on value changes
   - Auto-export to S3

2. **Redraft Mode**
   - Switch between dynasty/redraft values
   - PPR vs Half-PPR selection
   - Format-specific power rankings

3. **Value Change Alerts**
   - Track value deltas
   - Alert on > 10% changes
   - Weekly value movers report

4. **Historical Charts**
   - Plot value over time
   - Compare vs KTC/other sources
   - Identify trends

5. **Manual Overrides**
   - User-specific value adjustments
   - League-specific customization
   - Position multipliers

## Conclusion

The Unified Value System ensures that **Power Rankings and Sleeper import values always match** by using a single source of truth: the FantasyPros Top 1000 synced to the database.

**Key Takeaway:**
- Build → Fill → **Sync** → All Features Use Same Values

The "Sync to Database" button is the critical step that updates all features simultaneously, guaranteeing consistency across the entire application.
