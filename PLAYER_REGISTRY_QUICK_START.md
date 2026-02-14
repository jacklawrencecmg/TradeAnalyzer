# NFL Player Registry - Quick Start Guide

Get started with the canonical player registry and unified values system in 5 minutes.

---

## 📋 **What You Get**

✅ **Canonical Player Database** - Single source of truth for all NFL players
✅ **Automatic Name Matching** - "DJ Moore", "D.J. Moore", "D Moore" all resolve to same player
✅ **Daily Sync** - Fresh data from Sleeper API every day
✅ **Unified Values** - One API for KTC + FDP values across all formats
✅ **Zero Maintenance** - Health monitoring + auto-recovery built-in

---

## 🚀 **Quick Start**

### **1. Resolve a Player Name to ID**

```typescript
import { resolvePlayerId } from '@/lib/players/resolvePlayerId';

// User types "mahomes"
const result = await resolvePlayerId({ name: "mahomes" });

if (result.success) {
  console.log(`Player ID: ${result.player_id}`);
  console.log(`Full name: ${result.match.full_name}`);
  // Player ID: abc-123-def
  // Full name: Patrick Mahomes
}
```

**Features:**
- Handles typos and abbreviations
- Fuzzy matching with suggestions
- Optional position/team for disambiguation
- Auto-quarantines ambiguous matches

### **2. Get Player Values**

```typescript
import { getLatestValueForPlayer } from '@/lib/values/getLatestValues';

// Get latest value for a player
const value = await getLatestValueForPlayer(playerId, 'dynasty_sf');

console.log(`${value.full_name}: ${value.fdp_value}`);
// Patrick Mahomes: 9650
```

**Available Formats:**
- `dynasty_sf` - Dynasty Superflex
- `dynasty_1qb` - Dynasty 1QB
- `dynasty_tep` - Dynasty with TEP
- `dynasty_sf_idp_tackle` - Dynasty SF + IDP (tackle)
- `dynasty_sf_idp_big_play` - Dynasty SF + IDP (big play)

### **3. Get Rankings by Position**

```typescript
import { getLatestValuesByPosition } from '@/lib/values/getLatestValues';

// Get all QB values sorted by position rank
const qbs = await getLatestValuesByPosition('dynasty_sf', 'QB');

qbs.forEach((qb, index) => {
  console.log(`${index + 1}. ${qb.full_name} - ${qb.fdp_value}`);
});

// 1. Patrick Mahomes - 9650
// 2. Josh Allen - 9200
// 3. Jalen Hurts - 8800
// ...
```

### **4. Search for Players**

```typescript
import { searchPlayerValues } from '@/lib/values/getLatestValues';

// Search with fuzzy matching
const results = await searchPlayerValues("justin jeff", 'dynasty_sf');

results.forEach(player => {
  console.log(`${player.full_name} (${player.player_position}) - ${player.fdp_value}`);
});

// Justin Jefferson (WR) - 9100
```

### **5. Get Player Value History**

```typescript
import { getPlayerValueHistory } from '@/lib/values/getLatestValues';

// Get last 180 days of value snapshots
const history = await getPlayerValueHistory(playerId, 'dynasty_sf', 180);

// Use for charts
const chartData = history.map(h => ({
  date: new Date(h.captured_at),
  value: h.fdp_value || h.ktc_value
}));
```

---

## 💡 **Common Patterns**

### **Trade Analyzer Example**

```typescript
import { resolvePlayerId } from '@/lib/players/resolvePlayerId';
import { getLatestValueForPlayer } from '@/lib/values/getLatestValues';

async function analyzeTrade(
  sideA: string[],  // player names
  sideB: string[],
  format: string
) {
  // Resolve all names to player IDs
  const resolvedA = await Promise.all(
    sideA.map(name => resolvePlayerId({ name }))
  );

  const resolvedB = await Promise.all(
    sideB.map(name => resolvePlayerId({ name }))
  );

  // Get values
  const valuesA = await Promise.all(
    resolvedA
      .filter(r => r.success)
      .map(r => getLatestValueForPlayer(r.player_id!, format))
  );

  const valuesB = await Promise.all(
    resolvedB
      .filter(r => r.success)
      .map(r => getLatestValueForPlayer(r.player_id!, format))
  );

  // Calculate totals
  const totalA = valuesA.reduce((sum, v) => sum + (v?.fdp_value || 0), 0);
  const totalB = valuesB.reduce((sum, v) => sum + (v?.fdp_value || 0), 0);

  return {
    sideA: { players: valuesA, total: totalA },
    sideB: { players: valuesB, total: totalB },
    difference: totalA - totalB,
    winner: totalA > totalB ? 'A' : 'B'
  };
}

// Usage
const result = await analyzeTrade(
  ["Mahomes", "Kelce"],
  ["Josh Allen", "Justin Jefferson"],
  "dynasty_sf"
);

console.log(`Winner: Side ${result.winner} (+${Math.abs(result.difference)} value)`);
```

### **Autocomplete Search Component**

```typescript
import { useState, useEffect } from 'react';
import { searchPlayerValues } from '@/lib/values/getLatestValues';

export function PlayerSearchBox({ onSelect, format }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const search = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      const players = await searchPlayerValues(query, format, 10);
      setResults(players);
      setLoading(false);
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query, format]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search players..."
      />

      {loading && <div>Searching...</div>}

      {results.length > 0 && (
        <ul>
          {results.map(player => (
            <li key={player.player_id} onClick={() => onSelect(player)}>
              <span>{player.full_name}</span>
              <span>({player.player_position})</span>
              <span>{player.team}</span>
              <span className="value">{player.fdp_value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### **Rankings Page**

```typescript
import { useState, useEffect } from 'react';
import { getLatestValuesByPosition } from '@/lib/values/getLatestValues';

export function RankingsPage({ format }) {
  const [position, setPosition] = useState('QB');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRankings() {
      setLoading(true);
      const values = await getLatestValuesByPosition(format, position);
      setRankings(values);
      setLoading(false);
    }

    loadRankings();
  }, [format, position]);

  if (loading) {
    return <div>Loading rankings...</div>;
  }

  return (
    <div>
      <h1>{position} Rankings</h1>

      <div className="position-tabs">
        {['QB', 'RB', 'WR', 'TE'].map(pos => (
          <button
            key={pos}
            onClick={() => setPosition(pos)}
            className={position === pos ? 'active' : ''}
          >
            {pos}
          </button>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Team</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((player, index) => (
            <tr key={player.player_id}>
              <td>{index + 1}</td>
              <td>{player.full_name}</td>
              <td>{player.team || 'FA'}</td>
              <td>{player.fdp_value || player.ktc_value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 🔧 **Setup Instructions**

### **1. Verify Database**

The database tables are already created from previous migrations. Verify:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('nfl_players', 'player_aliases', 'unresolved_entities', 'player_team_history', 'ktc_value_snapshots');
```

Should return all 5 tables.

### **2. Run Initial Sync**

Populate the player registry:

```bash
# Sync players from Sleeper
curl -X POST "${SUPABASE_URL}/functions/v1/sync-sleeper-players?secret=${CRON_SECRET}"

# Sync values from KTC
curl -X POST "${SUPABASE_URL}/functions/v1/sync-ktc-all?secret=${CRON_SECRET}"
```

### **3. Configure Cron Jobs**

In Supabase Dashboard → Edge Functions:

**Daily Player Sync:**
- Function: `sync-sleeper-players`
- Schedule: `0 3 * * *` (3 AM daily)

**Hourly Values Sync:**
- Function: `cron-sync-ktc`
- Schedule: `0 */12 * * *` (every 12 hours)

**Hourly Health Checks:**
- Function: `cron-run-health-checks`
- Schedule: `0 * * * *` (every hour)

### **4. Test Name Resolution**

```typescript
import { testResolver } from '@/lib/players/resolvePlayerId';

// Test various name formats
await testResolver("Patrick Mahomes", "QB");
await testResolver("mahomes");
await testResolver("DJ Moore", "WR");
await testResolver("D.J. Moore");
```

---

## 🛠️ **Troubleshooting**

### **Player Not Found**

**Problem:** `resolvePlayerId()` returns no matches

**Solutions:**

1. **Check if player exists:**
```sql
SELECT * FROM nfl_players
WHERE full_name ILIKE '%mahomes%';
```

2. **Run player sync:**
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/sync-sleeper-players?secret=${CRON_SECRET}"
```

3. **Check quarantine queue:**
```typescript
import { getUnresolvedEntities } from '@/lib/players/resolvePlayerId';

const unresolved = await getUnresolvedEntities('open');
console.log(unresolved);
```

### **Values Not Found**

**Problem:** `getLatestValueForPlayer()` returns null

**Solutions:**

1. **Check if values exist for player:**
```sql
SELECT * FROM ktc_value_snapshots
WHERE player_id = 'abc-123'
  AND format = 'dynasty_sf'
ORDER BY captured_at DESC
LIMIT 1;
```

2. **Run values sync:**
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/sync-ktc-all?secret=${CRON_SECRET}"
```

3. **Check if player has position:**
```sql
SELECT id, full_name, player_position
FROM nfl_players
WHERE id = 'abc-123';
```

### **Ambiguous Match**

**Problem:** `resolvePlayerId()` returns multiple suggestions

**Solution:** Provide more context

```typescript
// Without context (ambiguous)
const result = await resolvePlayerId({ name: "Chris Jones" });
// Returns: { suggestions: [DL Chris Jones, CB Chris Jones] }

// With context (specific)
const result = await resolvePlayerId({
  name: "Chris Jones",
  position: "DL",  // Narrows to specific player
  team: "KC"       // Further confirmation
});
// Returns: { success: true, player_id: "abc-123" }
```

---

## 📚 **Additional Resources**

**Full Documentation:**
- `NFL_PLAYER_REGISTRY.md` - Complete system documentation
- `SYSTEM_HEALTH_MONITORING.md` - Health monitoring guide
- `PLAYER_IDENTITY_SYSTEM.md` - Player resolution details

**API Reference:**
- `src/lib/players/normalizeName.ts` - Name normalization utilities
- `src/lib/players/resolvePlayerId.ts` - Player resolution API
- `src/lib/players/sleeperPlayerSync.ts` - Sync utilities
- `src/lib/values/getLatestValues.ts` - Unified values API

**Admin Tools:**
- `/admin/health` - System health dashboard
- `/admin/unresolved-entities` - Quarantine management
- `/admin/player-aliases` - Alias management

---

## ✅ **Checklist**

Before going live:

- [ ] Database tables exist and are populated
- [ ] Initial player sync completed successfully
- [ ] Initial values sync completed successfully
- [ ] Cron jobs configured in Supabase
- [ ] Health checks passing (green status)
- [ ] Test name resolution with your common players
- [ ] Test values API with various formats
- [ ] Refactor existing features to use `player_id`
- [ ] Remove hardcoded player lists/JSON files
- [ ] Test autocomplete/search functionality
- [ ] Verify quarantine queue is small (< 25)

---

## 🎉 **You're Ready!**

You now have:

✅ A canonical NFL player registry
✅ Automatic name matching that never breaks
✅ Fresh values from KTC + FDP calculations
✅ Daily syncs with health monitoring
✅ Auto-recovery for common issues
✅ Simple APIs for every use case

**Next Steps:**

1. Refactor your existing features to use the new APIs
2. Remove old hardcoded player data
3. Test with real user input
4. Monitor health dashboard for issues
5. Enjoy never debugging name mismatches again! 🚀
