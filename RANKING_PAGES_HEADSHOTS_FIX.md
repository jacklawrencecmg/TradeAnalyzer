# Ranking Pages - Headshots & Values Fixed

## Summary

All ranking pages (QB, RB, WR, TE, IDP) now display **correct headshots** from the canonical player identity system and **correct FDP values** from the unified value system.

---

## What Was Fixed

### 1. QB Rankings (`KTCQBRankings.tsx`) ✅

**Headshots**:
- Added `headshot_url` to interface
- Batch fetch headshots from `player_identity` table
- Pass pre-fetched URLs to `PlayerAvatar` component

**Values**:
- Already displaying correct FDP values from `get_latest_values` RPC
- Shows `fdp_value` (falls back to `ktc_value` if missing)

**Changes**:
```typescript
// Interface updated
interface QBValue {
  // ... existing fields
  headshot_url?: string;  // NEW
}

// Fetch updated
const { data: identities } = await supabase
  .from('player_identity')
  .select('player_id, headshot_url')
  .in('player_id', playerIds);

// Component updated
<PlayerAvatar
  playerId={qb.player_id}
  headshotUrl={qb.headshot_url}  // NEW - pre-fetched
  playerName={qb.full_name}
  team={qb.team}
  position="QB"
/>
```

---

### 2. RB Rankings (`KTCRBRankings.tsx`) ✅

**Headshots**:
- Added `headshot_url` to interface
- Batch fetch headshots from `player_identity` table
- Pass pre-fetched URLs to `PlayerAvatar` component

**Values**:
- Already displaying correct FDP values from `get_latest_values` RPC
- Shows `fdp_value` (includes RB context adjustments)

**Changes**:
```typescript
// Interface updated
interface RBValue {
  // ... existing fields
  headshot_url?: string;  // NEW
  metadata?: {
    age?: number;
    depth_role?: string;  // Used for RB context
    // ... other metadata
  };
}

// Fetch updated (same pattern as QB)
const { data: identities } = await supabase
  .from('player_identity')
  .select('player_id, headshot_url')
  .in('player_id', playerIds);

// Component updated
<PlayerAvatar
  playerId={rb.player_id}
  headshotUrl={rb.headshot_url}  // NEW - pre-fetched
  playerName={rb.full_name}
  team={rb.team}
  position="RB"
/>
```

**Special Features**:
- Displays RB depth role badges (Feature, Lead, Committee, Handcuff, Backup)
- Shows age cliff warnings (26+)
- FDP values include RB context adjustments

---

### 3. WR Rankings (`KTCWRRankings.tsx`) ✅

**Headshots**:
- Added `headshot_url` to interface
- Batch fetch headshots from `player_identity` table
- Pass pre-fetched URLs to `PlayerAvatar` component

**Values**:
- Already displaying correct FDP values from `get_latest_values` RPC
- Shows `fdp_value` (falls back to `ktc_value` if missing)

**Changes**:
```typescript
// Interface updated
interface WRValue {
  // ... existing fields
  headshot_url?: string;  // NEW
}

// Fetch updated (same pattern)
const { data: identities } = await supabase
  .from('player_identity')
  .select('player_id, headshot_url')
  .in('player_id', playerIds);

// Component updated
<PlayerAvatar
  playerId={wr.player_id}
  headshotUrl={wr.headshot_url}  // NEW - pre-fetched
  playerName={wr.full_name}
  team={wr.team}
  position="WR"
/>
```

---

### 4. TE Rankings (`KTCTERankings.tsx`) ✅

**Headshots**:
- Added `headshot_url` to interface
- Batch fetch headshots from `player_identity` table
- Pass pre-fetched URLs to `PlayerAvatar` component

**Values**:
- Already displaying correct FDP values from `get_latest_values` RPC
- Shows `fdp_value` (falls back to `ktc_value` if missing)

**Changes**:
```typescript
// Interface updated
interface TEValue {
  // ... existing fields
  headshot_url?: string;  // NEW
}

// Fetch updated (same pattern)
const { data: identities } = await supabase
  .from('player_identity')
  .select('player_id, headshot_url')
  .in('player_id', playerIds);

// Component updated
<PlayerAvatar
  playerId={te.player_id}
  headshotUrl={te.headshot_url}  // NEW - pre-fetched
  playerName={te.full_name}
  team={te.team}
  position="TE"
/>
```

**Special Features**:
- Premium TE indicator (Top 6)
- Tier labels (Elite TE, TE1, TE2, Depth)
- Orange highlighting for elite TEs

---

### 5. IDP Rankings (`IDPRankings.tsx`) ✅

**Headshots**:
- Added `headshot_url` to interface
- Updated Edge Function to fetch headshots
- Pass pre-fetched URLs to `PlayerAvatar` component

**Values**:
- Already displaying correct FDP values from `idp-rankings` Edge Function
- Shows `fdp_value` with IDP preset multipliers applied
- Displays both FDP value (adjusted) and base value

**Changes**:

**Frontend**:
```typescript
// Interface updated
interface IDPPlayer {
  // ... existing fields
  headshot_url?: string;  // NEW
}

// Component updated
<PlayerAvatar
  playerId={player.player_id}
  headshotUrl={player.headshot_url}  // NEW - from API
  playerName={player.full_name}
  size="sm"
/>
```

**Backend** (`supabase/functions/idp-rankings/index.ts`):
```typescript
// Fetch headshots after getting players
const playerIds = (players || []).map(p => p.player_id).filter(Boolean);

const { data: identities } = await supabase
  .from('player_identity')
  .select('player_id, headshot_url')
  .in('player_id', playerIds);

const headshotMap = new Map(
  (identities || []).map(identity => [identity.player_id, identity.headshot_url])
);

// Add to response
const rankings = (players || []).map((player, index) => ({
  // ... existing fields
  headshot_url: headshotMap.get(player.player_id),  // NEW
}));
```

**Special Features**:
- Position-specific filtering (DL, LB, DB)
- IDP scoring preset selection (Tackle Heavy, Balanced, Big Play)
- Preset impact display (multiplier visualization)
- Color-coded value tiers

---

## Technical Implementation

### Batch Headshot Fetching Pattern

All ranking pages now use the same efficient pattern:

```typescript
// 1. Get player values from RPC/API
const { data, error } = await supabase.rpc('get_latest_values', {
  p_format: 'dynasty_sf',
  p_position: 'QB',
  p_limit: null
});

// 2. Extract player IDs
const playerIds = data
  .map((player) => player.player_id)
  .filter((id): id is string => !!id);

// 3. Batch fetch headshots
const { data: identities } = await supabase
  .from('player_identity')
  .select('player_id, headshot_url')
  .in('player_id', playerIds);

// 4. Create lookup map
const headshotMap = new Map(
  (identities || []).map((identity) => [identity.player_id, identity.headshot_url])
);

// 5. Merge data
const playersWithHeadshots = data.map((player) => ({
  ...player,
  headshot_url: player.player_id ? headshotMap.get(player.player_id) : undefined,
}));
```

**Benefits**:
- Single batch query (not N queries)
- Fast rendering (no loading flicker)
- Efficient caching
- Pre-fetched URLs passed to PlayerAvatar

---

### Value Display

All ranking pages correctly display **FDP values** (adjusted values):

```typescript
// Primary display
<span className="text-lg font-bold text-gray-900">
  {player.fdp_value || player.ktc_value}
</span>

// FDP value priority:
// 1. fdp_value (adjusted with all multipliers)
// 2. ktc_value (fallback if FDP not calculated)
```

**FDP Values Include**:
- Base market value (from KTC/FantasyPros)
- League profile multipliers (Superflex, TE Premium, IDP)
- Position-specific adjustments (RB context, IDP presets)
- Scarcity adjustments
- Market consensus anchoring

---

## Value Sources

### QB, RB, WR, TE Rankings

**Source**: `get_latest_values` RPC function

**Returns**:
```sql
{
  player_id: text,
  full_name: text,
  position: text,
  team: text,
  position_rank: integer,
  ktc_value: integer,      -- Base market value
  fdp_value: integer,      -- Adjusted FDP value ✅
  captured_at: timestamptz
}
```

**RPC Call**:
```typescript
const { data } = await supabase.rpc('get_latest_values', {
  p_format: 'dynasty_sf',      // or 'dynasty_1qb'
  p_position: 'QB',            // or 'RB', 'WR', 'TE'
  p_limit: null                // All players
});
```

---

### IDP Rankings

**Source**: `idp-rankings` Edge Function

**API**: `POST /functions/v1/idp-rankings?position=LB&format=dynasty_sf_idp`

**Returns**:
```json
{
  "ok": true,
  "position": "LB",
  "format": "dynasty_sf_idp",
  "count": 100,
  "players": [
    {
      "player_id": "...",
      "full_name": "...",
      "position": "LB",
      "team": "...",
      "position_rank": 1,
      "ktc_value": 500,        // Base value
      "fdp_value": 650,        // Adjusted with IDP preset ✅
      "headshot_url": "...",   // NEW ✅
      "captured_at": "...",
      "fdp_rank": 1
    }
  ]
}
```

**IDP Presets**:
- `tackle_heavy` - LB +30%, DL +10%, DB +5%
- `balanced` - LB +20%, DL +15%, DB +10% (default)
- `big_play` - LB +10%, DL +20%, DB +25%

---

## Headshot Sources

### Priority Order (Fallback Chain)

1. **Sleeper** (primary)
   - `https://sleepercdn.com/content/nfl/players/thumb/{sleeper_id}.jpg`
   - Covers most offensive players

2. **ESPN** (fallback)
   - `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/{espn_id}.png`
   - Good coverage for IDP players

3. **NFL** (fallback)
   - `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/{gsis_id}.png`
   - Alternative for IDP players

4. **Default Silhouette** (final fallback)
   - `https://sleepercdn.com/images/v2/icons/player_default.webp`
   - Shown when no image available

### Automatic Sync

Headshots are automatically synced:
- **Nightly**: Full Sleeper sync (3 AM)
- **Weekly**: Verification job (Mondays 2 AM)
- **On-demand**: After rookie/IDP imports

---

## PlayerAvatar Component

The `PlayerAvatar` component now supports pre-fetched headshots:

```typescript
interface PlayerAvatarProps {
  playerId?: string;
  playerName: string;
  team?: string;
  position?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  headshotUrl?: string;    // NEW - Skip lookup if provided
  // ... other props
}

// Usage in rankings:
<PlayerAvatar
  playerId={player.player_id}
  headshotUrl={player.headshot_url}  // Pre-fetched from batch query
  playerName={player.full_name}
  team={player.team}
  position={player.position}
/>
```

**Behavior**:
- If `headshotUrl` provided → Use it immediately
- If no `headshotUrl` → Fetch from `getPlayerHeadshot(playerId)`
- Falls back to initials if image fails to load
- Shows team logo badge in corner

---

## Performance Optimization

### Before (Slow)

```typescript
// Each PlayerAvatar made individual query
<PlayerAvatar playerId={player.player_id} />
// ❌ 50 players = 50 database queries
```

### After (Fast)

```typescript
// Single batch query for all players
const { data: identities } = await supabase
  .from('player_identity')
  .select('player_id, headshot_url')
  .in('player_id', playerIds);

// Pass pre-fetched URLs
<PlayerAvatar
  playerId={player.player_id}
  headshotUrl={player.headshot_url}
/>
// ✅ 50 players = 1 database query + in-memory map
```

**Result**:
- 50x fewer database queries
- Instant rendering (no loading states)
- Better UX (no image pop-in)

---

## Testing

### Verify Headshots

1. **QB Rankings**: Open page → Should see correct QB headshots
2. **RB Rankings**: Open page → Should see correct RB headshots
3. **WR Rankings**: Open page → Should see correct WR headshots
4. **TE Rankings**: Open page → Should see correct TE headshots
5. **IDP Rankings**: Open page → Toggle DL/LB/DB → Should see correct defensive player headshots

### Verify Values

1. **All Rankings**: Values should be **FDP values** (adjusted)
2. **RB Rankings**: Check RB context adjustments (depth role badges)
3. **IDP Rankings**: Change preset → Values should update
4. **All Rankings**: Values should match `fdp_value` from database

### Verify Fallbacks

1. **Missing Headshot**: Should show default silhouette (not broken image)
2. **Missing Player ID**: Should show initials
3. **Missing FDP Value**: Should fall back to `ktc_value`

---

## Files Modified

### Frontend Components

1. **`src/components/KTCQBRankings.tsx`**
   - Added `headshot_url` to interface
   - Batch fetch headshots from `player_identity`
   - Pass pre-fetched URLs to `PlayerAvatar`

2. **`src/components/KTCRBRankings.tsx`**
   - Added `headshot_url` to interface
   - Batch fetch headshots from `player_identity`
   - Pass pre-fetched URLs to `PlayerAvatar`

3. **`src/components/KTCWRRankings.tsx`**
   - Added `headshot_url` to interface
   - Batch fetch headshots from `player_identity`
   - Pass pre-fetched URLs to `PlayerAvatar`

4. **`src/components/KTCTERankings.tsx`**
   - Added `headshot_url` to interface
   - Batch fetch headshots from `player_identity`
   - Pass pre-fetched URLs to `PlayerAvatar`

5. **`src/components/IDPRankings.tsx`**
   - Added `headshot_url` to interface
   - Receive headshots from API response

### Backend

6. **`supabase/functions/idp-rankings/index.ts`**
   - Batch fetch headshots from `player_identity`
   - Add `headshot_url` to response
   - Deployed to production ✅

---

## Summary

**Headshots**: All ranking pages now show **correct headshots** from canonical player identity
**Values**: All ranking pages now show **correct FDP values** with proper adjustments
**Performance**: Single batch query per page load (not N queries)
**Fallbacks**: Graceful degradation (default silhouette, initials, base values)
**Consistency**: Same pattern across all 5 ranking pages

Build successful! 🚀
