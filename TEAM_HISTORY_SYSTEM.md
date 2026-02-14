# Team History & Transaction Tracking System

A comprehensive system that tracks player team changes over time to prevent historical data corruption when players change teams via trades, free agency, or practice squad moves.

## 🎯 **Problem Solved**

### **Before: Data Corruption on Team Changes**
```typescript
// Player traded from DET to NYJ in Week 8
// Old system just updates nfl_players.team = 'NYJ'
// Result: Historical data is CORRUPTED!

// Week 1-7 league rankings now show:
❌ "Patrick Mahomes (NYJ)" - WRONG! He was on DET then!

// Value snapshots get rewritten:
❌ Week 3 snapshot: "Player X - Team: NYJ" - WRONG! He was on DET!

// Historical trade analysis breaks:
❌ "You traded for a NYJ player" - NO! It was a DET player at the time!
```

### **After: Perfect Historical Accuracy**
```typescript
// Player traded from DET to NYJ in Week 8
// New system:
✅ Creates team_history record: DET (Week 1-7), NYJ (Week 8-now)
✅ Logs transaction: "Traded from DET to NYJ"
✅ Week 1-7 rankings show correct team: DET
✅ Week 8+ rankings show correct team: NYJ
✅ Value snapshots preserve historical team
✅ Trade analysis shows accurate context
```

---

## 📊 **Architecture**

### **1. Database Tables**

#### **`player_team_history`**
Tracks every team a player has been on with date ranges.

```sql
CREATE TABLE player_team_history (
  id uuid PRIMARY KEY,
  player_id uuid REFERENCES nfl_players(id),
  team text NOT NULL,                    -- Team abbreviation (KC, SF, etc.)
  from_date timestamptz NOT NULL,        -- When this assignment started
  to_date timestamptz,                   -- When it ended (NULL = current)
  is_current boolean DEFAULT true,       -- Only ONE row per player can be true
  source text NOT NULL,                  -- sleeper/manual/league_import
  created_at timestamptz DEFAULT now()
);
```

**Key Features:**
- Only ONE row per player can have `is_current = true`
- Date ranges enable time-travel queries
- `to_date = NULL` means currently on that team
- Append-only (never delete history)

#### **`player_transactions`**
League-level transaction log for player movements.

```sql
CREATE TABLE player_transactions (
  id uuid PRIMARY KEY,
  player_id uuid REFERENCES nfl_players(id),
  transaction_type text NOT NULL,        -- signed/released/traded/etc.
  team_from text,                        -- Previous team
  team_to text,                          -- New team
  transaction_date timestamptz NOT NULL,
  source text NOT NULL,                  -- sleeper/manual/league_import
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

**Transaction Types:**
- `team_changed` - Generic team change
- `signed` - Signed with new team
- `released` - Released by team
- `traded` - Traded between teams
- `practice_squad` - Added to practice squad
- `activated` - Activated from reserve
- `injured_reserve` - Placed on IR
- `waived` - Waived by team
- `claimed` - Claimed off waivers

---

## 🔄 **Automatic Team Change Detection**

### **During Player Sync**

When `syncSleeperPlayers()` runs:

```typescript
// 1. Player data updated in nfl_players
await supabase.rpc('upsert_player_from_sync', {
  p_external_id: sleeperPlayerId,
  p_full_name: fullName,
  p_team: newTeam,
  // ...
});

// 2. Check for team change
const { data: teamChangeResult } = await supabase.rpc('record_team_change', {
  p_player_id: playerId,
  p_new_team: newTeam,
  p_source: 'sleeper',
  p_change_date: new Date().toISOString(),
});

// 3. If team changed, log event
if (teamChangeResult.changed) {
  await supabase.from('player_events').insert({
    player_id: playerId,
    event_type: 'team_changed',
    metadata: {
      old_team: teamChangeResult.old_team,
      new_team: teamChangeResult.new_team,
      source: 'sleeper',
    },
  });
}
```

### **Smart Change Detection**

The `record_team_change()` function:

```sql
CREATE FUNCTION record_team_change(
  p_player_id uuid,
  p_new_team text,
  p_source text,
  p_change_date timestamptz
)
RETURNS jsonb
AS $$
BEGIN
  -- 1. Get current team
  SELECT team INTO v_old_team
  FROM player_team_history
  WHERE player_id = p_player_id AND is_current = true;

  -- 2. If same team, do nothing
  IF v_old_team = p_new_team THEN
    RETURN jsonb_build_object('changed', false);
  END IF;

  -- 3. Close old team record
  UPDATE player_team_history
  SET to_date = p_change_date, is_current = false
  WHERE player_id = p_player_id AND is_current = true;

  -- 4. Create new team record
  INSERT INTO player_team_history (...) VALUES (...);

  -- 5. Log transaction
  INSERT INTO player_transactions (...) VALUES (...);

  -- 6. Return result
  RETURN jsonb_build_object('changed', true, 'old_team', v_old_team, ...);
END;
$$;
```

**Result:**
- ✅ Zero duplicates (only one `is_current = true`)
- ✅ Atomic operation (all-or-nothing)
- ✅ Automatic transaction logging
- ✅ Idempotent (safe to call multiple times)

---

## 🕰️ **Time-Travel Queries**

### **Helper Function: `get_player_team_at_date()`**

```sql
CREATE FUNCTION get_player_team_at_date(
  p_player_id uuid,
  p_date timestamptz
)
RETURNS text
AS $$
  SELECT team
  FROM player_team_history
  WHERE player_id = p_player_id
    AND from_date <= p_date
    AND (to_date IS NULL OR to_date >= p_date)
  ORDER BY from_date DESC
  LIMIT 1;
$$;
```

### **Client-Side Usage**

```typescript
import { getPlayerTeamAtDate } from '@/lib/players/getPlayerTeamAtDate';

// Get team at specific date
const team = await getPlayerTeamAtDate(playerId, new Date('2024-10-15'));
// Returns: "DET" (even if player is now on NYJ)

// Get current team
const currentTeam = await getPlayerTeamAtDate(playerId);
// Returns: "NYJ"
```

### **Use Cases**

#### **1. Historical League Rankings**
```typescript
// Display Week 5 rankings with correct teams
const week5Date = new Date('2024-10-05');

for (const player of roster) {
  const teamAtWeek5 = await getPlayerTeamAtDate(player.id, week5Date);
  // Shows team player was ACTUALLY on during Week 5
}
```

#### **2. Value Snapshots**
```typescript
// When creating value snapshot, store team at that moment
const capturedAt = new Date();
const teamAtCapture = await getPlayerTeamAtDate(playerId, capturedAt);

await supabase.from('ktc_value_snapshots').insert({
  player_id: playerId,
  team: teamAtCapture,  // ✅ Never changes after insert
  captured_at: capturedAt,
  // ...
});
```

#### **3. Trade Analysis**
```typescript
// Analyze trade that happened in Week 6
const tradeDate = new Date('2024-10-10');
const teamAtTrade = await getPlayerTeamAtDate(playerId, tradeDate);

// Shows: "You traded for a DET RB"
// Even though player is now on NYJ!
```

---

## 📱 **User-Facing Features**

### **1. Player Career Timeline**

Component: `PlayerCareerTimeline.tsx`

**Shows:**
- All team changes with dates
- Transaction types (signed, traded, released, etc.)
- Source of data (Sleeper, manual, etc.)
- Visual timeline with icons
- Team history summary badges

**Location:** Player detail page (`/player/[id]`)

**Example:**
```
Career Timeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

● Sep 2024 - Traded from DET to NYJ
  Source: sleeper

● Mar 2024 - Signed with DET
  Source: sleeper

● Dec 2023 - Released by KC
  Source: sleeper

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Team History: [NYJ (Current)] [DET] [KC]
```

### **2. Recent Team Changes Widget**

```typescript
import { getRecentTeamChanges } from '@/lib/players/getPlayerTeamAtDate';

const recentChanges = await getRecentTeamChanges(20);

// Returns:
[
  {
    player_name: "Christian McCaffrey",
    from: "CAR",
    to: "SF",
    date: "2024-09-15",
  },
  // ...
]
```

**Use in:**
- Dashboard "What's New" section
- News feed
- Market trends alerts

---

## 🔧 **Admin Tools**

### **Component: `PlayerTeamHistoryAdmin.tsx`**

**Features:**

1. **Search Players**
   - Fuzzy search with player identity resolver
   - Shows current team and status

2. **View History**
   - All team assignments with date ranges
   - Current team highlighted
   - Data source labels

3. **Record Team Change**
   - Manual team change entry
   - Custom date selection
   - Automatic transaction logging

4. **Delete Records**
   - Remove incorrect history entries
   - Delete duplicate transactions
   - Confirmation prompts

5. **Edit History**
   - Correct misreported teams
   - Fix date ranges
   - Merge duplicate events

**Access:** `/admin/player-history`

**Use Cases:**
- Fix API errors (Sleeper occasionally misreports)
- Correct retroactive data
- Merge duplicate events
- Handle edge cases

---

## 🛡️ **Safety Rules**

### **1. Append-Only System**
```typescript
// ✅ CORRECT: Close old record, add new record
UPDATE player_team_history
SET to_date = now(), is_current = false
WHERE player_id = X AND is_current = true;

INSERT INTO player_team_history (player_id, team, from_date, is_current)
VALUES (X, 'NYJ', now(), true);

// ❌ WRONG: Never delete history
DELETE FROM player_team_history WHERE player_id = X;  // NO!
```

### **2. Never Rewrite Past Snapshots**
```typescript
// ✅ CORRECT: Snapshots are immutable
const snapshot = {
  player_id: playerId,
  team: 'DET',           // Locked forever
  captured_at: '2024-10-01',
  ktc_value: 5000,
};

// ❌ WRONG: Never update snapshot team
UPDATE ktc_value_snapshots
SET team = 'NYJ'  // NO! This rewrites history!
WHERE player_id = X;
```

### **3. Always Use `record_team_change()`**
```typescript
// ✅ CORRECT: Use helper function
await supabase.rpc('record_team_change', {
  p_player_id: playerId,
  p_new_team: 'NYJ',
  p_source: 'manual',
});

// ❌ WRONG: Direct INSERT bypasses logic
await supabase.from('player_team_history').insert({
  player_id: playerId,
  team: 'NYJ',
  is_current: true,  // Could create duplicates!
});
```

### **4. Only ONE Current Team**
```sql
-- Constraint enforced by function logic
SELECT COUNT(*)
FROM player_team_history
WHERE player_id = X AND is_current = true;
-- Must ALWAYS return 1 or 0
```

---

## 📊 **Monitoring Queries**

### **Check for Data Integrity Issues**

```sql
-- Players with multiple current teams (should be empty!)
SELECT player_id, COUNT(*) as current_count
FROM player_team_history
WHERE is_current = true
GROUP BY player_id
HAVING COUNT(*) > 1;

-- Players with gaps in history
SELECT
  h1.player_id,
  h1.to_date as gap_start,
  h2.from_date as gap_end,
  (h2.from_date - h1.to_date) as gap_duration
FROM player_team_history h1
JOIN player_team_history h2
  ON h1.player_id = h2.player_id
WHERE h1.to_date < h2.from_date
  AND NOT EXISTS (
    SELECT 1 FROM player_team_history h3
    WHERE h3.player_id = h1.player_id
      AND h3.from_date >= h1.to_date
      AND h3.from_date < h2.from_date
  )
ORDER BY gap_duration DESC;

-- Recent team changes
SELECT
  np.full_name,
  pt.team_from,
  pt.team_to,
  pt.transaction_date
FROM player_transactions pt
JOIN nfl_players np ON np.id = pt.player_id
WHERE pt.transaction_type = 'team_changed'
  AND pt.transaction_date >= NOW() - INTERVAL '7 days'
ORDER BY pt.transaction_date DESC;
```

### **Performance Stats**

```sql
-- Team history coverage
SELECT
  COUNT(DISTINCT player_id) as players_with_history,
  COUNT(*) as total_history_records,
  COUNT(*) FILTER (WHERE is_current = true) as current_assignments
FROM player_team_history;

-- Transaction breakdown
SELECT
  transaction_type,
  COUNT(*) as count,
  MIN(transaction_date) as earliest,
  MAX(transaction_date) as latest
FROM player_transactions
GROUP BY transaction_type
ORDER BY count DESC;
```

---

## 🚀 **Integration Examples**

### **1. League Roster Historical View**

```typescript
async function getRosterAtDate(leagueId: string, date: Date) {
  const { data: roster } = await supabase
    .from('league_rosters')
    .select('player_id, user_id')
    .eq('league_id', leagueId);

  const enriched = await Promise.all(
    roster.map(async (entry) => {
      const team = await getPlayerTeamAtDate(entry.player_id, date);
      const { data: player } = await supabase
        .from('nfl_players')
        .select('full_name, player_position')
        .eq('id', entry.player_id)
        .single();

      return {
        ...entry,
        player_name: player.full_name,
        position: player.player_position,
        team: team,  // ✅ Correct team for that date!
      };
    })
  );

  return enriched;
}
```

### **2. Trade Alert System**

```typescript
// Watch for trade transactions
const subscription = supabase
  .channel('trade_alerts')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'player_transactions',
      filter: 'transaction_type=eq.traded',
    },
    async (payload) => {
      const tx = payload.new;

      // Get player details
      const { data: player } = await supabase
        .from('nfl_players')
        .select('full_name, player_position')
        .eq('id', tx.player_id)
        .single();

      // Send alert
      sendNotification({
        title: 'Trade Alert',
        message: `${player.full_name} traded from ${tx.team_from} to ${tx.team_to}`,
        type: 'trade',
      });
    }
  )
  .subscribe();
```

### **3. Market Trends Analysis**

```typescript
// Analyze how trades affect player value
async function getTradeImpactOnValue(playerId: string) {
  const [transactions, snapshots] = await Promise.all([
    getPlayerTransactions(playerId),
    getValueSnapshots(playerId),
  ]);

  const trades = transactions.filter(t => t.transaction_type === 'traded');

  const impacts = trades.map(trade => {
    const tradeDate = new Date(trade.transaction_date);

    // Value before trade (7 days prior)
    const beforeDate = new Date(tradeDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const beforeSnapshot = snapshots.find(s =>
      new Date(s.captured_at) >= beforeDate &&
      new Date(s.captured_at) < tradeDate
    );

    // Value after trade (7 days later)
    const afterDate = new Date(tradeDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const afterSnapshot = snapshots.find(s =>
      new Date(s.captured_at) >= tradeDate &&
      new Date(s.captured_at) <= afterDate
    );

    return {
      from_team: trade.team_from,
      to_team: trade.team_to,
      date: trade.transaction_date,
      value_before: beforeSnapshot?.fdp_value || 0,
      value_after: afterSnapshot?.fdp_value || 0,
      delta: (afterSnapshot?.fdp_value || 0) - (beforeSnapshot?.fdp_value || 0),
    };
  });

  return impacts;
}
```

---

## ✅ **Benefits**

### **Data Integrity**
- ✅ Historical rankings never change teams retroactively
- ✅ Value charts preserve original team context
- ✅ Trade analysis shows accurate team at time of trade
- ✅ No "time traveling" data corruption

### **Professional Features**
- ✅ Career timeline like real sports sites
- ✅ Transaction log like ESPN/Yahoo
- ✅ Historical accuracy for past seasons
- ✅ Trade alerts and notifications

### **Admin Control**
- ✅ Fix API errors without data loss
- ✅ Correct misreported teams
- ✅ Audit trail for all changes
- ✅ Easy cleanup of duplicates

### **Future-Proof**
- ✅ Supports multi-season history
- ✅ Enables advanced analytics
- ✅ Foundation for news feed features
- ✅ Ready for real-time alerts

---

## 🎯 **Quick Reference**

### **Get Team at Date**
```typescript
import { getPlayerTeamAtDate } from '@/lib/players/getPlayerTeamAtDate';
const team = await getPlayerTeamAtDate(playerId, date);
```

### **Record Manual Team Change**
```typescript
import { recordManualTeamChange } from '@/lib/players/getPlayerTeamAtDate';
await recordManualTeamChange(playerId, 'NYJ', new Date());
```

### **Get Full History**
```typescript
import { getPlayerTeamHistory } from '@/lib/players/getPlayerTeamAtDate';
const history = await getPlayerTeamHistory(playerId);
```

### **Get Transactions**
```typescript
import { getPlayerTransactions } from '@/lib/players/getPlayerTeamAtDate';
const transactions = await getPlayerTransactions(playerId);
```

---

## 📝 **Summary**

The team history system provides enterprise-grade tracking of player team assignments with:

- **Perfect Historical Accuracy** - Data never gets corrupted by team changes
- **Time-Travel Queries** - Get player team at any point in history
- **Automatic Detection** - Syncs automatically detect and log changes
- **Transaction Log** - Complete audit trail of all movements
- **Professional UI** - Career timelines like real sports sites
- **Admin Tools** - Easy correction of errors and duplicates
- **Safety Rules** - Append-only, immutable snapshots, atomic operations

**Result:** Your platform maintains perfect data integrity across seasons, trades, and free agency - just like the pros! 🚀
