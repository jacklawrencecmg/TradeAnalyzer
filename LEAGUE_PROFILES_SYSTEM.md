# League Profiles System

## Overview

The League Profiles System enables the platform to produce correct values per league while maintaining a single source of truth. Values remain consistent everywhere by continuing to read from the canonical `value_snapshots` table (exposed via `latest_player_values` view), but now keyed by `league_profile_id` so different leagues get different "latest" values without drift.

**Key Innovation:** Same player can have different values in different league formats (1QB vs SF, Standard vs TEP, etc.) while maintaining consistency for leagues with identical settings.

## Architecture

```
League Settings (Sleeper/ESPN/Yahoo/Manual)
    ↓
League Profile Resolver
    ↓
league_profile_id (Settings Fingerprint)
    ↓
value_snapshots (keyed by player_id + league_profile_id + format)
    ↓
latest_player_values VIEW (latest snapshot per profile)
    ↓
All Rankings, Trade Calcs, Player Pages
```

**Critical Rule:** ALL value reads MUST include `league_profile_id`. No reads without a profile.

## Database Schema

### league_profiles Table

Stores the "settings fingerprint" for each unique league configuration.

```sql
CREATE TABLE league_profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL,                    -- "Dynasty Superflex", "Redraft 1QB PPR"
  format_key text UNIQUE NOT NULL,       -- "dynasty_sf", "redraft_1qb_ppr"

  -- Core format
  is_dynasty boolean NOT NULL,
  is_superflex boolean NOT NULL,

  -- Scoring
  te_premium numeric NOT NULL DEFAULT 0, -- 0.5 = +0.5 PPR for TE
  ppr numeric NOT NULL DEFAULT 1,        -- 0, 0.5, or 1
  ppc numeric NOT NULL DEFAULT 0,        -- Points per carry

  -- IDP
  idp_enabled boolean NOT NULL DEFAULT false,
  idp_scoring_preset text,               -- 'balanced' | 'tackleheavy' | 'bigplay'

  -- Roster
  starting_slots jsonb NOT NULL,         -- {"QB":1, "RB":2, ...}
  bench_slots int NOT NULL DEFAULT 10,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Examples:**

| format_key | name | is_dynasty | is_superflex | te_premium | ppr |
|------------|------|------------|--------------|------------|-----|
| dynasty_sf | Dynasty Superflex | true | true | 0 | 1 |
| dynasty_1qb | Dynasty 1QB | true | false | 0 | 1 |
| dynasty_sf_tep | Dynasty SF TEP | true | true | 0.5 | 1 |
| redraft_1qb_standard | Redraft 1QB Standard | false | false | 0 | 0 |

### league_profile_multipliers Table

Stores position-specific value multipliers for each profile.

```sql
CREATE TABLE league_profile_multipliers (
  id uuid PRIMARY KEY,
  league_profile_id uuid REFERENCES league_profiles(id),
  position text NOT NULL,
  multiplier numeric NOT NULL DEFAULT 1.0,
  reason text,

  UNIQUE(league_profile_id, position)
);
```

**Example Multipliers:**

| Profile | Position | Multiplier | Reason |
|---------|----------|------------|--------|
| dynasty_sf | QB | 1.25 | Superflex scarcity boost |
| dynasty_sf | RB | 1.05 | Position scarcity |
| dynasty_sf | WR | 1.00 | Baseline position |
| dynasty_sf | TE | 1.00 | Standard TE |
| dynasty_sf_tep | TE | 1.15 | TE premium boost (0.5 PPR) |
| dynasty_sf_idp_tackleheavy | LB | 1.10 | IDP: Tackle-heavy scoring favors LBs |

### value_snapshots Table (Modified)

Added `league_profile_id` column to make values league-aware.

```sql
ALTER TABLE value_snapshots
  ADD COLUMN league_profile_id uuid REFERENCES league_profiles(id);

CREATE INDEX idx_value_snapshots_player_league
  ON value_snapshots(player_id, league_profile_id, format, captured_at DESC);
```

**Key Change:** Values are now unique per `(player_id, league_profile_id, format)`.

### latest_player_values VIEW (Updated)

Now includes `league_profile_id` and uses it in `DISTINCT ON`.

```sql
CREATE VIEW latest_player_values AS
  SELECT DISTINCT ON (vs.player_id, vs.league_profile_id, vs.format)
    vs.id AS snapshot_id,
    vs.player_id,
    vs.league_profile_id,  -- NEW
    vs.source,
    vs.format,
    vs.position,
    vs.position_rank,
    vs.market_value,
    vs.fdp_value,
    vs.dynasty_value,
    vs.redraft_value,
    vs.value_epoch,
    vs.notes,
    vs.captured_at,
    np.full_name,
    ...
  FROM value_snapshots vs
  JOIN nfl_players np ON vs.player_id = np.id
  ORDER BY vs.player_id, vs.league_profile_id, vs.format, vs.captured_at DESC;
```

**Result:** Each `(player, profile, format)` combination gets its own "latest" value.

### leagues Table (Modified)

Added `league_profile_id` to link leagues to their profile.

```sql
ALTER TABLE leagues
  ADD COLUMN league_profile_id uuid REFERENCES league_profiles(id);

CREATE INDEX idx_leagues_league_profile_id
  ON leagues(league_profile_id);
```

## Format Key Generation

The `format_key` is a deterministic string computed from settings.

### Algorithm

```typescript
function generateFormatKey(settings: LeagueSettings): string {
  let key = settings.is_dynasty ? 'dynasty' : 'redraft';

  // Add QB format
  key += settings.is_superflex ? '_sf' : '_1qb';

  // Add PPR format
  if (settings.ppr === 0) key += '_standard';
  else if (settings.ppr === 0.5) key += '_halfppr';
  else if (settings.ppr === 1) key += '_ppr';
  else key += `_ppr${settings.ppr.toString().replace('.', '_')}`;

  // Add TE premium
  if (settings.te_premium > 0) key += '_tep';

  // Add IDP
  if (settings.idp_enabled && settings.idp_scoring_preset) {
    key += `_idp_${settings.idp_scoring_preset}`;
  }

  return key;
}
```

### Examples

| Settings | format_key |
|----------|------------|
| Dynasty, SF, PPR | `dynasty_sf_ppr` |
| Dynasty, 1QB, PPR | `dynasty_1qb_ppr` |
| Dynasty, SF, PPR, TEP (0.5) | `dynasty_sf_ppr_tep` |
| Dynasty, SF, PPR, IDP Balanced | `dynasty_sf_ppr_idp_balanced` |
| Redraft, 1QB, Standard | `redraft_1qb_standard` |
| Redraft, SF, Half PPR | `redraft_sf_halfppr` |

**Important:** Format key is computed using a deterministic algorithm, so leagues with identical settings always produce the same format_key and thus share the same profile.

## League Profile Resolver

### Purpose

Convert raw league settings (from Sleeper, ESPN, Yahoo, or manual input) into a `league_profile_id`.

### Flow

```
Raw League Settings
    ↓
1. Compute format_key
    ↓
2. Check if profile exists
    ↓
3. If not, create profile (upsert)
    ↓
4. Populate multipliers
    ↓
5. Return profile_id
```

### Usage

```typescript
import { resolveLeagueProfile } from './lib/league/resolveLeagueProfile';

const profileId = await resolveLeagueProfile({
  is_dynasty: true,
  is_superflex: true,
  te_premium: 0.5,
  ppr: 1,
  ppc: 0,
  idp_enabled: false,
  idp_scoring_preset: null,
  starting_slots: {
    QB: 1,
    RB: 2,
    WR: 3,
    TE: 1,
    FLEX: 1,
    SF: 1,
  },
  bench_slots: 20,
});

// Use profileId in all subsequent value queries
```

### Provider-Specific Resolvers

```typescript
// Sleeper
const profileId = await resolveSleeperLeagueProfile(sleeperLeagueSettings);

// ESPN
const profileId = await resolveESPNLeagueProfile(espnLeagueSettings);

// Yahoo
const profileId = await resolveYahooLeagueProfile(yahooLeagueSettings);
```

## Value Multipliers System

### Purpose

Apply position-specific multipliers based on league settings to adjust player values.

### Multiplier Rules

#### 1. Superflex QB Boost

```
QB Multiplier:
  1QB:  1.00 (standard)
  SF:   1.25 (25% boost for scarcity)
```

**Reasoning:** In superflex leagues, QBs are significantly more valuable because you can start 2 QBs.

#### 2. TE Premium

```
TE Multiplier:
  Standard:      1.00
  TEP (0.5):     1.15 (1.0 + 0.5 × 0.30)
  TEP (1.0):     1.25 (1.0 + 1.0 × 0.30, capped at +25%)
```

**Formula:** `1.0 + min(te_premium × 0.30, 0.25)`

**Reasoning:** TE premium scoring makes tight ends more valuable relative to other positions.

#### 3. RB Scarcity

```
RB Multiplier:
  Base:          1.05
  Deep lineups:  1.10 (if starting 3+ RBs)
```

**Reasoning:** RBs are scarce. Deep starting lineups (3+ RB slots) increase scarcity.

#### 4. WR Baseline

```
WR Multiplier:
  Standard:      1.00 (baseline)
  Deep lineups:  1.05 (if starting 4+ WRs)
```

**Reasoning:** WRs are the baseline position. Deep lineups slightly increase value.

#### 5. IDP Scoring Presets

**Tackle Heavy:**
- LB: 1.10 (LBs get most tackles)
- DL: 1.00
- DB: 0.95

**Big Play:**
- LB: 0.95
- DL: 1.15 (pass rushers get sacks)
- DB: 0.90

**Balanced:**
- LB: 1.00
- DL: 1.00
- DB: 1.00

### When Multipliers Are Applied

**CRITICAL:** Multipliers are applied DURING value generation, NOT at query time.

```
Base Value (from KTC/FP)
    ↓
Apply Profile Multipliers
    ↓
Adjusted Value (stored in value_snapshots)
    ↓
Displayed to Users
```

**Example:**

| Player | Position | Base Value | Profile | Multiplier | Adjusted Value |
|--------|----------|------------|---------|------------|----------------|
| Mahomes | QB | 10000 | dynasty_1qb | 1.00 | 10000 |
| Mahomes | QB | 10000 | dynasty_sf | 1.25 | 12500 |
| Kelce | TE | 7000 | dynasty_sf | 1.00 | 7000 |
| Kelce | TE | 7000 | dynasty_sf_tep | 1.15 | 8050 |

## Rebuild Pipeline

### Overview

The rebuild pipeline must now generate values for ALL league profiles, not just one.

### Flow

```
1. Load all league_profiles
2. For each profile:
   a. Load base values (KTC, FantasyPros, etc.)
   b. Get profile multipliers
   c. Apply multipliers to each player
   d. Calculate rankings (overall_rank, position_rank, tiers)
   e. Write to value_snapshots with league_profile_id
3. Validate row counts per profile
4. Atomic swap staging -> live (if using staging table)
```

### Pseudocode

```typescript
async function buildLatestValuesForAllProfiles() {
  const profiles = await listLeagueProfiles();

  for (const profile of profiles) {
    await buildLatestValuesForProfile(profile);
  }
}

async function buildLatestValuesForProfile(profile: LeagueProfile) {
  // 1. Load base values (same source for all profiles)
  const baseValues = await loadBaseValues();

  // 2. Get profile multipliers
  const multipliers = await getProfileMultipliers(profile.id);

  // 3. Apply multipliers
  const adjustedValues = baseValues.map(player => ({
    ...player,
    adjusted_value: applyMultiplier(
      player.base_value,
      player.position,
      multipliers
    ),
  }));

  // 4. Calculate rankings
  const rankedValues = calculateRankings(adjustedValues, profile.format);

  // 5. Write to value_snapshots
  for (const player of rankedValues) {
    await supabase.from('value_snapshots').insert({
      player_id: player.player_id,
      league_profile_id: profile.id,
      format: profile.is_dynasty ? 'dynasty' : 'redraft',
      position: player.position,
      position_rank: player.position_rank,
      market_value: player.adjusted_value,
      fdp_value: player.adjusted_value, // Or calculate separately
      dynasty_value: profile.is_dynasty ? player.adjusted_value : null,
      redraft_value: !profile.is_dynasty ? player.adjusted_value : null,
      source: 'rebuilt',
      captured_at: new Date(),
      value_epoch: getCurrentEpoch(),
    });
  }
}
```

### Validation

After rebuild, verify:

```sql
-- Check all profiles have values
SELECT
  lp.format_key,
  lp.name,
  COUNT(DISTINCT lpv.player_id) as player_count
FROM league_profiles lp
LEFT JOIN latest_player_values lpv ON lp.id = lpv.league_profile_id
GROUP BY lp.id, lp.format_key, lp.name
ORDER BY lp.name;
```

Expected: Each profile should have ~500-1000+ players (depending on format).

## API Endpoints

ALL endpoints that return or accept player values MUST support `league_profile_id`.

### Query Pattern

```typescript
// OLD (DEPRECATED):
const { data } = await supabase
  .from('latest_player_values')
  .select('*')
  .eq('format', 'dynasty');

// NEW (REQUIRED):
const { data } = await supabase
  .from('latest_player_values')
  .select('*')
  .eq('league_profile_id', profileId)
  .eq('format', 'dynasty');
```

### Endpoint Examples

#### GET /api/values/latest

```
GET /api/values/latest?league_profile_id=<uuid>&format=dynasty&pos=WR
```

Returns latest player values for the specified profile.

#### GET /api/player/[id]

```
GET /api/player/abc123?league_profile_id=<uuid>&format=dynasty
```

Returns player detail with values for the specified profile.

#### POST /api/trade-eval

```json
{
  "league_profile_id": "uuid",
  "teamA": [...],
  "teamB": [...]
}
```

Evaluates trade using values from the specified profile.

#### GET /api/export/top1000.csv

```
GET /api/export/top1000.csv?league_profile_id=<uuid>&format=dynasty
```

Exports rankings for the specified profile.

### Default Behavior

If `league_profile_id` not provided:
- Default to `dynasty_sf` profile (or configured default)
- Log warning for monitoring

```typescript
async function getProfileId(requestedProfileId?: string): Promise<string> {
  if (requestedProfileId) {
    return requestedProfileId;
  }

  console.warn('No league_profile_id provided, using default');
  return await getDefaultLeagueProfileId(); // Returns dynasty_sf
}
```

## League Integration

### Importing a League

When importing a league from Sleeper/ESPN/Yahoo:

```typescript
async function importLeague(provider: string, leagueId: string, userId: string) {
  // 1. Fetch league settings from provider
  const settings = await fetchLeagueSettings(provider, leagueId);

  // 2. Resolve to profile
  const profileId = await resolveLeagueProfile(settings);

  // 3. Store league
  const { data: league } = await supabase.from('leagues').insert({
    provider,
    provider_league_id: leagueId,
    name: settings.name,
    league_profile_id: profileId,
    user_id: userId,
    settings_cache: settings, // Denormalized for quick access
  }).select('*').single();

  return league;
}
```

### Using League Values

When displaying values for a league:

```typescript
async function getLeaguePlayerValues(leagueId: string, format: string) {
  // 1. Get league
  const { data: league } = await supabase
    .from('leagues')
    .select('league_profile_id')
    .eq('id', leagueId)
    .single();

  // 2. Get values for that profile
  const { data: values } = await supabase
    .from('latest_player_values')
    .select('*')
    .eq('league_profile_id', league.league_profile_id)
    .eq('format', format)
    .order('overall_rank');

  return values;
}
```

## UI Components

### League Selector

Add a league selector in the header or settings:

```typescript
function LeagueSelector() {
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);

  useEffect(() => {
    loadUserLeagues();
  }, []);

  async function loadUserLeagues() {
    const { data } = await supabase
      .from('leagues')
      .select('*, league_profiles(*)')
      .eq('user_id', user.id);

    setLeagues(data);
  }

  return (
    <select onChange={(e) => setSelectedLeague(e.target.value)}>
      {leagues.map(league => (
        <option key={league.id} value={league.id}>
          {league.name} ({league.league_profiles.name})
        </option>
      ))}
    </select>
  );
}
```

### Profile Display

Show active profile and settings:

```typescript
function ProfileBadge({ profileId }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    loadProfile();
  }, [profileId]);

  async function loadProfile() {
    const { data } = await supabase
      .from('league_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    setProfile(data);
  }

  if (!profile) return null;

  return (
    <div className="profile-badge">
      <span className="profile-name">{profile.name}</span>
      <div className="profile-details">
        {profile.is_superflex && <span>SF</span>}
        {profile.te_premium > 0 && <span>TEP</span>}
        {profile.idp_enabled && <span>IDP</span>}
        {profile.ppr === 0 && <span>Standard</span>}
        {profile.ppr === 0.5 && <span>Half PPR</span>}
        {profile.ppr === 1 && <span>PPR</span>}
      </div>
    </div>
  );
}
```

### Value Breakdown

Show multiplier breakdown on player pages:

```typescript
function ValueBreakdown({ playerId, profileId }) {
  const [breakdown, setBreakdown] = useState(null);

  useEffect(() => {
    loadBreakdown();
  }, [playerId, profileId]);

  async function loadBreakdown() {
    // Get player value
    const { data: player } = await supabase
      .from('latest_player_values')
      .select('*')
      .eq('player_id', playerId)
      .eq('league_profile_id', profileId)
      .single();

    // Get multiplier
    const { data: multiplier } = await supabase
      .from('league_profile_multipliers')
      .select('*')
      .eq('league_profile_id', profileId)
      .eq('position', player.position)
      .single();

    // Calculate base value (reverse multiplier)
    const baseValue = multiplier
      ? Math.round(player.market_value / multiplier.multiplier)
      : player.market_value;

    setBreakdown({
      baseValue,
      multiplier: multiplier?.multiplier || 1.0,
      adjustedValue: player.market_value,
      reason: multiplier?.reason || 'No adjustment',
    });
  }

  if (!breakdown) return null;

  return (
    <div className="value-breakdown">
      <div className="value-row">
        <span>Base Value:</span>
        <span>{breakdown.baseValue}</span>
      </div>
      <div className="value-row">
        <span>Multiplier:</span>
        <span>{breakdown.multiplier}x ({breakdown.reason})</span>
      </div>
      <div className="value-row total">
        <span>Final Value:</span>
        <span>{breakdown.adjustedValue}</span>
      </div>
    </div>
  );
}
```

## Safety Checks

### Profile-League Mismatch

Prevent queries with mismatched league_id and league_profile_id:

```typescript
async function validateLeagueProfile(leagueId: string, profileId: string): Promise<boolean> {
  const { data: league } = await supabase
    .from('leagues')
    .select('league_profile_id')
    .eq('id', leagueId)
    .single();

  if (league.league_profile_id !== profileId) {
    throw new Error(
      `Profile mismatch: League ${leagueId} uses profile ${league.league_profile_id}, ` +
      `but ${profileId} was requested`
    );
  }

  return true;
}
```

### Test Cases

```typescript
describe('League Profiles System', () => {
  it('should produce different QB values for 1QB vs SF', async () => {
    const profile1QB = await resolveLeagueProfile({
      is_dynasty: true,
      is_superflex: false,
      ppr: 1,
    });

    const profileSF = await resolveLeagueProfile({
      is_dynasty: true,
      is_superflex: true,
      ppr: 1,
    });

    const qb1QBValue = await getPlayerValue('mahomes_id', profile1QB, 'dynasty');
    const qbSFValue = await getPlayerValue('mahomes_id', profileSF, 'dynasty');

    expect(qbSFValue).toBeGreaterThan(qb1QBValue);
    expect(qbSFValue / qb1QBValue).toBeCloseTo(1.25); // 25% boost
  });

  it('should produce higher TE values with TE premium', async () => {
    const profileStandard = await resolveLeagueProfile({
      is_dynasty: true,
      is_superflex: true,
      te_premium: 0,
      ppr: 1,
    });

    const profileTEP = await resolveLeagueProfile({
      is_dynasty: true,
      is_superflex: true,
      te_premium: 0.5,
      ppr: 1,
    });

    const teStandardValue = await getPlayerValue('kelce_id', profileStandard, 'dynasty');
    const teTEPValue = await getPlayerValue('kelce_id', profileTEP, 'dynasty');

    expect(teTEPValue).toBeGreaterThan(teStandardValue);
  });

  it('should share values for leagues with identical settings', async () => {
    const profile1 = await resolveLeagueProfile({
      is_dynasty: true,
      is_superflex: true,
      ppr: 1,
    });

    const profile2 = await resolveLeagueProfile({
      is_dynasty: true,
      is_superflex: true,
      ppr: 1,
    });

    expect(profile1).toBe(profile2); // Same profile ID
  });
});
```

## Migration Path

### For Existing Data

If you have existing values without league_profile_id:

```sql
-- 1. Get default profile ID
SELECT id FROM league_profiles WHERE format_key = 'dynasty_sf';
-- Copy this UUID

-- 2. Backfill existing values
UPDATE value_snapshots
SET league_profile_id = '<default-profile-uuid>'
WHERE league_profile_id IS NULL;
```

### For Existing Leagues

```sql
-- Backfill existing leagues with default profile
UPDATE leagues
SET league_profile_id = (
  SELECT id FROM league_profiles WHERE format_key = 'dynasty_sf' LIMIT 1
)
WHERE league_profile_id IS NULL;
```

## Summary

**Benefits:**
- ✅ Correct values per league format
- ✅ No value drift (same settings = same values)
- ✅ Single source of truth maintained
- ✅ Scalable (add new formats easily)
- ✅ Transparent (users see why values differ)

**Key Rules:**
1. ALL value queries MUST include `league_profile_id`
2. Values are generated per profile during rebuild
3. Leagues with identical settings share the same profile
4. Multipliers are applied at generation time, not query time
5. Format key is deterministic (same settings = same key)

**Next Steps:**
1. Update rebuild pipeline to generate values for all profiles
2. Update all API endpoints to accept/require league_profile_id
3. Build UI league selector
4. Add monitoring for profile usage
5. Create admin tools for managing profiles

