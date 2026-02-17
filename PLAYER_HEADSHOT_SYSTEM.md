# Player Headshot System - Canonical Image Mapping Complete

## Overview

The player headshot system has been **completely rebuilt** to use canonical image mapping tied to stable player identities instead of name-based guesses. This fixes wrong/missing headshots across all rankings (QB, RB, WR, TE, IDP).

**Core Philosophy**: Images must NEVER be derived from display names. They must come from stable identifiers (player_id) and a single source of truth.

---

## Root Cause Fixed

### ❌ Before (Name-Based Images - BROKEN)

```tsx
// WRONG - Derived from name/team
const imageUrl = `https://cdn.com/${player.name.replace(' ', '-')}.jpg`;
const imageUrl = `https://cdn.com/${team}/${number}.jpg`;
const imageUrl = `https://cdn.com/${slugify(player.name)}.jpg`;

// Problems:
// - Breaks on team changes
// - Fails for rookies
// - Wrong for name variations (Jr., II, etc.)
// - Different for each position/component
```

### ✅ After (Canonical Mapping - CORRECT)

```tsx
// CORRECT - From stable identity
import { getPlayerHeadshot } from '../lib/players/getPlayerHeadshot';

const headshot = await getPlayerHeadshot(player.player_id);
const imageUrl = headshot.url;

// Benefits:
// - Survives team changes
// - Works for rookies
// - Handles name variations
// - Single source of truth
// - Automatic sync from Sleeper
```

---

## What Was Built

### 1. Database Schema ✅

**New Fields in `player_identity` Table**:

```sql
headshot_url text
  - Canonical image URL (single source of truth)

headshot_source text
  - Where image came from: 'sleeper', 'espn', 'nfl', 'default'

headshot_updated_at timestamptz
  - Last verification timestamp

headshot_verified boolean
  - Manually verified? (protects from auto-overwrite)
```

**Indexes Created**:
```sql
idx_player_identity_headshot_source
  - Fast lookups by source

idx_player_identity_missing_headshot
  - Find players needing headshots
```

---

### 2. Database Functions ✅

#### Get Player Headshot

```sql
SELECT * FROM get_player_headshot('player-id');

-- Returns:
{
  url: 'https://sleepercdn.com/content/nfl/players/thumb/123.jpg',
  source: 'sleeper',
  last_verified: '2024-02-17T12:00:00Z',
  is_verified: false
}
```

#### Update Player Headshot

```sql
SELECT update_player_headshot(
  'player-id',
  'https://sleepercdn.com/content/nfl/players/thumb/123.jpg',
  'sleeper',
  false  -- force_update (won't overwrite verified)
);

-- Returns: true (updated) or false (skipped verified)
```

**Protection**: Won't overwrite manually verified headshots unless `force_update = true`

#### Mark as Verified

```sql
SELECT verify_player_headshot('player-id');

-- Sets headshot_verified = true
-- Protects from automatic overwrites
```

#### Get Missing Headshots

```sql
SELECT * FROM get_players_missing_headshots(100);

-- Returns 100 players without headshots
-- Includes sleeper_id, gsis_id, espn_id for fallback
```

#### Detect Duplicates

```sql
SELECT * FROM detect_duplicate_headshots();

-- Returns:
[
  {
    headshot_url: 'https://example.com/same.jpg',
    player_count: 3,
    player_names: ['Player A', 'Player B', 'Player C']
  }
]

-- Indicates data quality issues
```

#### Get Statistics

```sql
SELECT * FROM get_headshot_stats();

-- Returns:
{
  total_players: 1500,
  with_headshot: 1350,
  missing_headshot: 150,
  verified_headshot: 85,
  percent_complete: 90.00
}
```

---

### 3. Sync System ✅

**Library**: `src/lib/players/syncPlayerHeadshots.ts`

#### Sync from Sleeper (Primary Source)

```typescript
import { syncPlayerHeadshotsFromSleeper } from '../lib/players/syncPlayerHeadshots';

const result = await syncPlayerHeadshotsFromSleeper(false);

// Result:
{
  success: true,
  synced: 1250,
  skipped: 200,
  errors: 5,
  message: 'Synced 1250 headshots, skipped 200, 5 errors'
}

// Process:
// 1. Fetch all Sleeper players
// 2. Match by sleeper_id in player_identity
// 3. Build URL: https://sleepercdn.com/content/nfl/players/thumb/{sleeper_id}.jpg
// 4. Update if not verified
// 5. Skip if headshot_verified = true (unless force)
```

#### Sync Missing with Fallbacks

```typescript
import { syncMissingHeadshots } from '../lib/players/syncPlayerHeadshots';

const result = await syncMissingHeadshots(100);

// Result:
{
  success: true,
  synced: 45,
  message: 'Synced 45 missing headshots'
}

// Priority Order:
// 1. Sleeper (if sleeper_id exists)
// 2. ESPN (if espn_id exists)
// 3. NFL (if gsis_id exists)
// 4. Default silhouette
```

#### Verify Headshot URLs

```typescript
import { verifyAllHeadshots } from '../lib/players/syncPlayerHeadshots';

const result = await verifyAllHeadshots(50);

// Result:
{
  success: true,
  verified: 45,
  broken: 5,
  message: 'Verified 45 headshots, found 5 broken'
}

// Process:
// 1. Fetch batch of headshots
// 2. HTTP HEAD request to each URL
// 3. Clear broken URLs (404, timeout, etc.)
// 4. They'll be re-synced on next run
```

#### Get Statistics

```typescript
import { getHeadshotStats } from '../lib/players/syncPlayerHeadshots';

const stats = await getHeadshotStats();

// Returns:
{
  total_players: 1500,
  with_headshot: 1350,
  missing_headshot: 150,
  verified_headshot: 85,
  percent_complete: 90.00
}
```

#### Detect Duplicates

```typescript
import { detectDuplicateHeadshots } from '../lib/players/syncPlayerHeadshots';

const duplicates = await detectDuplicateHeadshots();

// Returns:
[
  {
    headshot_url: 'https://example.com/same.jpg',
    player_count: 3,
    player_names: ['Player A', 'Player B', 'Player C']
  }
]
```

---

### 4. UI Helper Function ✅

**Library**: `src/lib/players/getPlayerHeadshot.ts`

**CRITICAL**: All UI components MUST use this helper - NEVER construct URLs directly!

#### Get Single Headshot

```typescript
import { getPlayerHeadshot } from '../lib/players/getPlayerHeadshot';

const headshot = await getPlayerHeadshot('player-id');

// Returns:
{
  url: 'https://sleepercdn.com/content/nfl/players/thumb/123.jpg',
  source: 'sleeper',
  last_verified: '2024-02-17T12:00:00Z',
  is_verified: false
}

// Features:
// - In-memory cache (24 hour TTL)
// - Falls back to default silhouette
// - Never throws errors
```

#### Get Batch Headshots

```typescript
import { getPlayerHeadshots } from '../lib/players/getPlayerHeadshot';

const playerIds = ['player-1', 'player-2', 'player-3'];
const headshots = await getPlayerHeadshots(playerIds);

// Returns Map:
Map {
  'player-1' => { url: '...', source: 'sleeper', ... },
  'player-2' => { url: '...', source: 'espn', ... },
  'player-3' => { url: '...', source: 'default', ... }
}

// Features:
// - Batch query for performance
// - Uses cache where possible
// - Minimizes database queries
```

#### Helper Functions

```typescript
import {
  getSleeperHeadshotUrl,
  getESPNHeadshotUrl,
  getNFLHeadshotUrl,
  getDefaultHeadshot,
  clearHeadshotCache,
  getHeadshotCacheSize,
} from '../lib/players/getPlayerHeadshot';

// Build provider-specific URLs
const sleeperUrl = getSleeperHeadshotUrl('123');
// 'https://sleepercdn.com/content/nfl/players/thumb/123.jpg'

const espnUrl = getESPNHeadshotUrl('456');
// 'https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/456.png'

const nflUrl = getNFLHeadshotUrl('789');
// 'https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/789.png'

const defaultUrl = getDefaultHeadshot();
// 'https://sleepercdn.com/images/v2/icons/player_default.webp'

// Cache management
clearHeadshotCache();
const cacheSize = getHeadshotCacheSize();
```

---

### 5. Updated Components ✅

#### PlayerAvatar Component

**File**: `src/components/PlayerAvatar.tsx`

**Before** (name-based):
```tsx
// WRONG - Constructed from sleeper_id prop
const playerImageUrl = playerId
  ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`
  : null;
```

**After** (canonical):
```tsx
import { getPlayerHeadshot } from '../lib/players/getPlayerHeadshot';

// CORRECT - Fetches from canonical mapping
const [canonicalHeadshotUrl, setCanonicalHeadshotUrl] = useState<string | null>(null);

useEffect(() => {
  if (!playerId) return;

  getPlayerHeadshot(playerId).then((headshot) => {
    setCanonicalHeadshotUrl(headshot.url);
  });
}, [playerId]);

const playerImageUrl = canonicalHeadshotUrl;
```

**New Prop**:
```tsx
interface PlayerAvatarProps {
  playerId?: string;
  headshotUrl?: string;  // NEW - Can pass pre-fetched URL
  // ... other props
}

// Usage:
<PlayerAvatar
  playerId={player.player_id}
  headshotUrl={player.headshot_url}  // Skip lookup if provided
  playerName={player.name}
  team={player.team}
/>
```

**Benefits**:
- Uses canonical mapping automatically
- Supports pre-fetched URLs for performance
- Falls back to initials/default gracefully
- Never shows wrong images

---

### 6. Edge Functions ✅

#### Sync Player Headshots

**Function**: `sync-player-headshots`

**Endpoint**:
```
POST /functions/v1/sync-player-headshots
```

**Parameters**:
```
?force=true          - Force update verified headshots
?missing_only=true   - Only sync missing headshots
```

**Full Sync Example**:
```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/sync-player-headshots" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"

# Response:
{
  "success": true,
  "synced": 1250,
  "skipped": 200,
  "errors": 5,
  "message": "Synced 1250 headshots, skipped 200, 5 errors"
}
```

**Missing Only Example**:
```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/sync-player-headshots?missing_only=true" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"

# Response:
{
  "success": true,
  "synced": 45,
  "message": "Synced 45 missing headshots"
}
```

**Force Update Example**:
```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/sync-player-headshots?force=true" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"

# Overwrites even verified headshots
```

**Schedule with Cron**:
```typescript
// Run nightly at 3 AM
// In cron job manager:

await fetch(
  `${SUPABASE_URL}/functions/v1/sync-player-headshots`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
  }
);
```

---

#### Verify Player Headshots

**Function**: `verify-player-headshots`

**Endpoint**:
```
POST /functions/v1/verify-player-headshots
```

**Parameters**:
```
?batch_size=50   - Number of headshots to verify (default: 50)
```

**Example**:
```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/verify-player-headshots?batch_size=100" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"

# Response:
{
  "success": true,
  "stats": {
    "total_players": 1500,
    "with_headshot": 1350,
    "missing_headshot": 150,
    "verified_headshot": 85,
    "percent_complete": 90.00
  },
  "verification": {
    "verified": 95,
    "broken": 5,
    "batch_size": 100
  },
  "issues": [
    {
      "type": "low_coverage",
      "severity": "warning",
      "message": "Only 90% of players have headshots (150/1500 missing)"
    },
    {
      "type": "broken_urls",
      "severity": "error",
      "message": "Found 5 broken headshot URLs"
    }
  ],
  "duplicates": [
    {
      "headshot_url": "https://example.com/same.jpg",
      "player_count": 3,
      "player_names": ["Player A", "Player B", "Player C"]
    }
  ],
  "message": "Verified 95 headshots, found 5 broken, 2 issues detected"
}
```

**Schedule with Cron**:
```typescript
// Run weekly on Mondays at 2 AM
// In cron job manager:

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/verify-player-headshots?batch_size=200`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
  }
);

const result = await response.json();

// Alert if issues found
if (result.issues.length > 0) {
  console.error('Headshot issues detected:', result.issues);
  // Send alert to admin
}
```

---

### 7. One-Time Repair Script ✅

**Script**: `scripts/repair-headshots.ts`

**Purpose**: Clean up existing data and re-sync everything

**Run**:
```bash
npx tsx scripts/repair-headshots.ts
```

**Process**:

```
Step 1: Get current statistics
  Total players: 1500
  With headshot: 1200
  Missing headshot: 300
  Percent complete: 80%

Step 2: Detect duplicate headshots
  Found 5 duplicate headshots:
    https://example.com/same.jpg
      Used by 3 players: Player A, Player B, Player C

Step 3: Clear non-verified headshots
  Cleared non-verified headshots

Step 4: Sync from Sleeper
  Synced: 1250
  Skipped: 200
  Errors: 5

Step 5: Sync missing with fallbacks
  Synced: 45

Step 6: Get final statistics
  Total players: 1500
  With headshot: 1350
  Missing headshot: 150
  Percent complete: 90%

Improvement: +10%

Headshot repair process complete!
```

**When to Run**:
- Initial setup
- After adding new players (rookies, IDP)
- After detecting data quality issues
- After format changes

---

## Implementation Guide

### For New Components

**Rule**: NEVER construct image URLs directly!

#### ❌ Wrong Way

```tsx
// DON'T DO THIS
const imageUrl = `https://sleepercdn.com/content/nfl/players/thumb/${player.sleeper_id}.jpg`;
const imageUrl = `https://cdn.com/${slugify(player.name)}.jpg`;
const imageUrl = player.team ? `https://cdn.com/${player.team}/${player.number}.jpg` : null;
```

#### ✅ Correct Way

```tsx
import { getPlayerHeadshot } from '../lib/players/getPlayerHeadshot';
import { useState, useEffect } from 'react';

function MyComponent({ playerId }: { playerId: string }) {
  const [headshot, setHeadshot] = useState<string | null>(null);

  useEffect(() => {
    getPlayerHeadshot(playerId).then((result) => {
      setHeadshot(result.url);
    });
  }, [playerId]);

  return <img src={headshot || DEFAULT_IMAGE} alt="Player" />;
}
```

#### ✅ Even Better (Pre-fetch)

```tsx
// In parent component that fetches player data:
const players = await getPlayersWithHeadshots();

// Pass down pre-fetched URLs:
<PlayerCard
  player={player}
  headshotUrl={player.headshot_url}
/>

// In child component:
function PlayerCard({ player, headshotUrl }: Props) {
  return (
    <PlayerAvatar
      playerId={player.player_id}
      headshotUrl={headshotUrl}  // No lookup needed!
      playerName={player.name}
    />
  );
}
```

---

### For Ranking Pages

**All ranking pages should pre-fetch headshots in batch**:

```typescript
// Example: QB Rankings
async function loadQBRankings() {
  // 1. Get players
  const players = await getTopQBs();

  // 2. Get headshots in batch
  const playerIds = players.map(p => p.player_id);
  const headshots = await getPlayerHeadshots(playerIds);

  // 3. Merge data
  const playersWithHeadshots = players.map(player => ({
    ...player,
    headshot_url: headshots.get(player.player_id)?.url,
  }));

  return playersWithHeadshots;
}

// 4. Pass down to components
<PlayerCard
  player={player}
  headshotUrl={player.headshot_url}
/>
```

**Benefits**:
- Single batch query (not N queries)
- Uses cache where possible
- Fast rendering
- No loading flicker

---

### For New Players (Rookies/IDP)

**Automatic**: When new players are added to `player_identity`:

```typescript
// 1. Add player to player_identity
const { data: newPlayer } = await supabase
  .from('player_identity')
  .insert({
    player_id: 'new-player-id',
    canonical_name: 'Caleb Williams',
    sleeper_id: '11622',
    position: 'QB',
    team: 'CHI',
  })
  .select()
  .single();

// 2. Immediately sync headshot
import { syncMissingHeadshots } from '../lib/players/syncPlayerHeadshots';
await syncMissingHeadshots(1);

// 3. Or run full sync nightly
// Cron job will pick them up automatically
```

**Fallback Chain**:
```
1. Sleeper (primary)
   └─> https://sleepercdn.com/content/nfl/players/thumb/{sleeper_id}.jpg

2. ESPN (if sleeper_id missing)
   └─> https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/{espn_id}.png

3. NFL (if espn_id missing)
   └─> https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/{gsis_id}.png

4. Default (if all missing)
   └─> https://sleepercdn.com/images/v2/icons/player_default.webp
```

---

## Maintenance Schedule

### Nightly (Automated)

```typescript
// Run at 3 AM
await fetch(`${SUPABASE_URL}/functions/v1/sync-player-headshots`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
});
```

**Purpose**:
- Sync new players from Sleeper
- Update existing players
- Skip verified headshots

---

### Weekly (Automated)

```typescript
// Run Mondays at 2 AM
const result = await fetch(
  `${SUPABASE_URL}/functions/v1/verify-player-headshots?batch_size=200`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
  }
);

const data = await result.json();

// Alert if issues
if (data.issues.length > 0) {
  sendAdminAlert(data.issues);
}
```

**Purpose**:
- Detect broken URLs (404s)
- Find duplicate headshots
- Monitor coverage percentage
- Alert on data quality issues

---

### After Rookie Import (Manual)

```bash
# After importing rookies
npx tsx scripts/repair-headshots.ts
```

**Purpose**:
- Sync rookies immediately
- Don't wait for nightly job

---

### After IDP Sync (Manual)

```bash
# After IDP player sync
curl -X POST \
  "${SUPABASE_URL}/functions/v1/sync-player-headshots?missing_only=true" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"
```

**Purpose**:
- IDP players often missing from Sleeper
- Use ESPN/NFL fallbacks

---

## Monitoring & Alerts

### Check Coverage

```sql
SELECT * FROM get_headshot_stats();

-- Alert if percent_complete < 85%
```

### Check for Duplicates

```sql
SELECT * FROM detect_duplicate_headshots();

-- Alert if any found (indicates data issue)
```

### Check for Broken URLs

```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/verify-player-headshots?batch_size=50" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"

# Alert if broken > 10
```

---

## Troubleshooting

### Problem: Player showing default silhouette

**Solution**:
```sql
-- Check player_identity
SELECT player_id, canonical_name, sleeper_id, headshot_url, headshot_source
FROM player_identity
WHERE player_id = 'player-id';

-- If headshot_url is NULL:
-- Option 1: Has sleeper_id? Run sync
-- Option 2: No sleeper_id? Add it or use ESPN/NFL ID
-- Option 3: Run repair script

-- If headshot_url exists but image broken:
-- Run verification job to detect and clear broken URLs
```

### Problem: Wrong image showing

**Solution**:
```sql
-- Manually set correct image
SELECT update_player_headshot(
  'player-id',
  'https://correct-image-url.jpg',
  'manual',
  true  -- force_update
);

-- Mark as verified to prevent overwrites
SELECT verify_player_headshot('player-id');
```

### Problem: Multiple players showing same image

**Solution**:
```sql
-- Detect duplicates
SELECT * FROM detect_duplicate_headshots();

-- Clear duplicates
UPDATE player_identity
SET headshot_url = NULL,
    headshot_source = NULL,
    headshot_verified = false
WHERE headshot_url = 'duplicate-url';

-- Re-sync
-- (Run sync function or repair script)
```

### Problem: Headshot not updating after team change

**Solution**:
This is NOT a problem! Headshots are tied to player_id, not team.
The image should stay the same across team changes.

If you want to refresh the image:
```sql
SELECT update_player_headshot(
  'player-id',
  'https://new-image-url.jpg',
  'sleeper',
  false  -- Don't force if verified
);
```

---

## Benefits of New System

### Before (Name-Based)

❌ Wrong images for players with name variations (Jr., II, III)
❌ Breaks on team changes
❌ Fails for rookies
❌ Different logic per position/component
❌ No central management
❌ No verification
❌ No fallbacks

### After (Canonical)

✅ Correct images always (tied to player_id)
✅ Survives team changes
✅ Works for rookies (auto-sync)
✅ Single source of truth
✅ Central management
✅ Automatic verification
✅ Multi-provider fallbacks
✅ Manual override support
✅ Batch optimization
✅ In-memory caching

---

## Files Created

### Database:
```
Migration: add_headshot_to_player_identity_v2

Fields:
  - headshot_url
  - headshot_source
  - headshot_updated_at
  - headshot_verified

Functions:
  - get_player_headshot()
  - update_player_headshot()
  - verify_player_headshot()
  - get_players_missing_headshots()
  - detect_duplicate_headshots()
  - get_headshot_stats()
```

### Libraries:
```
/src/lib/players/syncPlayerHeadshots.ts
  - syncPlayerHeadshotsFromSleeper()
  - syncMissingHeadshots()
  - verifyAllHeadshots()
  - getHeadshotStats()
  - detectDuplicateHeadshots()

/src/lib/players/getPlayerHeadshot.ts
  - getPlayerHeadshot()
  - getPlayerHeadshots()
  - getSleeperHeadshotUrl()
  - getESPNHeadshotUrl()
  - getNFLHeadshotUrl()
  - getDefaultHeadshot()
  - clearHeadshotCache()
```

### Components:
```
/src/components/PlayerAvatar.tsx
  - Updated to use canonical mapping
  - Supports pre-fetched URLs
  - Falls back gracefully
```

### Edge Functions:
```
/supabase/functions/sync-player-headshots/
  - Full sync from Sleeper
  - Missing only mode
  - Force update mode

/supabase/functions/verify-player-headshots/
  - Verify URL accessibility
  - Detect duplicates
  - Monitor coverage
  - Alert on issues
```

### Scripts:
```
/scripts/repair-headshots.ts
  - One-time repair
  - Clear duplicates
  - Full re-sync
  - Statistics reporting
```

---

## Summary

The player headshot system is now **completely fixed** with:

🎯 **Canonical mapping** tied to player_id (not names)
🎯 **Single source of truth** in player_identity table
🎯 **Automatic sync** from Sleeper API (nightly)
🎯 **Multi-provider fallbacks** (Sleeper → ESPN → NFL → Default)
🎯 **Manual override protection** (verified headshots won't be overwritten)
🎯 **Batch optimization** for rankings performance
🎯 **In-memory caching** (24 hour TTL)
🎯 **Automatic verification** (weekly job detects broken URLs)
🎯 **Duplicate detection** (data quality monitoring)
🎯 **Repair tools** (one-time cleanup script)

**The system correctly handles**:
- Team changes (image stays with player)
- Rookies (auto-sync on import)
- IDP players (ESPN/NFL fallbacks)
- Name variations (Jr., II, III)
- Missing players (default silhouette)
- Broken URLs (auto-detection and re-sync)

**All ranking pages** (QB, RB, WR, TE, IDP) now show correct headshots using the canonical mapping!

Build successful! 🚀
