# IDP (Individual Defensive Player) System

Comprehensive IDP support for FantasyDraftPros, enabling full defensive player tracking, rankings, valuations, and trade evaluation alongside offensive players.

## Overview

The IDP System extends FantasyDraftPros to support Individual Defensive Players (IDP) with the same sophistication as offensive players:

- **Three IDP Position Groups:** DL (Defensive Line), LB (Linebacker), DB (Defensive Back)
- **Sub-Position Tracking:** EDGE, DT, NT, ILB, OLB, MLB, CB, S, FS, SS
- **IDP-Specific Formats:** dynasty_sf_idp, dynasty_1qb_idp, dynasty_sf_idp123
- **Dynamic Value Calculation:** Position multipliers + context-based adjustments
- **Integrated Trade Evaluation:** Mixed offensive/defensive trades with separate totals
- **Full Rankings UI:** Position-specific rankings with tier classifications

## Architecture

### 1. Database Schema

**Enhanced Tables:**

**`player_values`** - Now supports both offensive and IDP players:
```sql
- position_group: 'OFF' | 'IDP' (auto-set based on position)
- sub_position: EDGE, DT, NT, ILB, OLB, MLB, CB, S, FS, SS (optional)
- position: QB, RB, WR, TE, DL, LB, DB
```

**`player_cache`** - Mirrors player_values structure for consistency

**`ktc_value_snapshots`** - Stores historical values for all players:
```sql
- format: Includes dynasty_sf_idp, dynasty_1qb_idp, dynasty_sf_idp123
- position: Supports DL, LB, DB
```

**Views:**
- `idp_players` - Filtered view of IDP players with latest values
- `offensive_players` - Filtered view of offensive players with latest values

**Indexes:** Optimized for IDP query performance:
- `idx_player_values_position_group`
- `idx_player_values_sub_position`
- `idx_ktc_snapshots_format_position_rank`
- `idx_ktc_snapshots_position_format_captured`

### 2. IDP Multipliers System

**File:** `src/lib/idp/idpMultipliers.ts`

**Format-Based Multipliers:**
```typescript
const idpMultipliers = {
  dynasty_sf_idp: {
    DL: 1.05,  // +5% for pass rushers
    LB: 1.10,  // +10% for tackle machines
    DB: 0.98,  // -2% for volatility
  },
  dynasty_1qb_idp: {
    DL: 1.05,
    LB: 1.10,
    DB: 0.98,
  },
  dynasty_sf_idp123: {
    DL: 1.08,  // +8% in tiered scoring
    LB: 1.12,  // +12% in tiered scoring
    DB: 0.95,  // -5% in tiered scoring
  },
};
```

**Scoring Style Multipliers:**
```typescript
const scoringStyleMultipliers = {
  tackle_heavy: {
    DL: 0.90,   // -10% (fewer tackles)
    LB: 1.25,   // +25% (most tackles)
    DB: 1.10,   // +10% (moderate tackles)
  },
  balanced: {
    DL: 1.00,
    LB: 1.00,
    DB: 1.00,
  },
  big_play: {
    DL: 1.15,   // +15% (sacks, pressures)
    LB: 0.95,   // -5% (fewer big plays)
    DB: 1.05,   // +5% (INTs, PBUs)
  },
};
```

**Combined Calculation:**
```
Final Multiplier = Format Multiplier × Scoring Style Multiplier
```

### 3. IDP Adjustments Engine

**File:** `src/lib/idp/idpAdjustments.ts`

**Position-Specific Bonuses/Penalties:**

**Linebackers (LB):**
- Base tackle volume bonus: +250 points
- Inside LB premium (ILB/MLB): +150 points
- Reasoning: LBs lead league in tackle opportunities

**Defensive Line (DL):**
- Sack potential premium: +200 points
- Edge rusher premium (EDGE): +180 points
- Reasoning: Pass rush production adds big play value

**Defensive Backs (DB):**
- Volatility penalty: -150 points
- Coverage specialist bonus (CB): +80 points
- Safety versatility bonus (S): +120 points
- Reasoning: DBs have inconsistent week-to-week scoring

**Age Curve Adjustments:**

**Linebackers:**
- Age ≤24: +100 (ascending)
- Age 25-27: +50 (prime)
- Age 28-30: 0 (peak)
- Age 31-32: -150 (decline)
- Age 33+: -350 (steep decline)

**Defensive Line:**
- Age ≤25: +80
- Age 26-28: +40
- Age 29-31: 0
- Age 32-33: -120
- Age 34+: -300

**Defensive Backs:**
- Age ≤26: +120 (ascending)
- Age 27-29: +60 (prime)
- Age 30-31: 0 (peak)
- Age 32-33: -180 (decline)
- Age 34+: -400 (steep decline)

**Team Defense Quality:**
- Top 5 defense: +150 to +200 (more opportunities)
- Top 10 defense: +75 to +100 (good situation)
- Bottom 6 defense: -80 to -120 (fewer impact plays)

**Snap Share Impact:**
- 90%+: +300 (workhorse)
- 80-89%: +200 (heavy usage)
- 70-79%: +100 (solid starter)
- 60-69%: +50 (starter)
- 50-59%: 0 (neutral)
- 40-49%: -100 (rotational)
- 30-39%: -250 (limited role)
- <30%: -400 (backup)

### 4. Value Calculation System

**File:** `src/lib/idp/calculateIDPValue.ts`

**Process:**
1. Start with base value (KTC equivalent or manual input)
2. Apply format multiplier (dynasty_sf_idp, etc.)
3. Apply scoring style multiplier (tackle_heavy, balanced, big_play)
4. Add position-specific adjustments (tackle volume, sack premium, etc.)
5. Add contextual adjustments (age, team defense, snap share)
6. Clamp final value to 0-10,000 range

**Example Calculation:**

```typescript
Player: Fred Warner (ILB, SF, Age 27, 95% snaps)
Base Value: 4000
Format: dynasty_sf_idp (LB: 1.10)
Scoring: balanced (LB: 1.00)

Step 1: Base × Format × Scoring
4000 × 1.10 × 1.00 = 4,400

Step 2: Position Adjustments
+ Tackle volume bonus: +250
+ Inside LB premium: +150
= +400

Step 3: Age Adjustment (27)
+ Prime age bonus: +50

Step 4: Team Defense (SF ranked #3)
+ Elite defense bonus: +180

Step 5: Snap Share (95%)
+ Workhorse bonus: +300

Final FDP Value: 4,400 + 400 + 50 + 180 + 300 = 5,330
```

### 5. Admin Upload Interface

**Component:** `src/components/IDPAdminUpload.tsx`

**Route:** Dashboard → Data Management → IDP Upload

**CSV Format:**
```csv
full_name,position,sub_position,team,base_value,rank
T.J. Watt,DL,EDGE,PIT,4500,1
Micah Parsons,LB,OLB,DAL,4800,1
Fred Warner,LB,ILB,SF,4300,2
Derwin James,DB,S,LAC,3800,1
```

**Required Columns:**
- `full_name` - Player name
- `position` - DL, LB, or DB
- `base_value` - Baseline value (0-10,000)
- `rank` - Position rank

**Optional Columns:**
- `sub_position` - EDGE, DT, NT, ILB, OLB, MLB, CB, S, FS, SS
- `team` - NFL team abbreviation

**Upload Process:**
1. Parse CSV and validate format
2. Generate unique `player_id` from name + position
3. Upsert player record into `player_values` table
   - Sets `position_group = 'IDP'`
   - Sets `sub_position` if provided
   - Sets tier based on base value
4. Calculate FDP value using IDP multipliers + adjustments
5. Create snapshot in `ktc_value_snapshots`
   - Source: `manual_seed`
   - Format: Selected format (dynasty_sf_idp or dynasty_1qb_idp)
   - Includes both KTC value and calculated FDP value
6. Return success statistics and any errors

**Features:**
- Template CSV download
- Batch upload support
- Duplicate handling (upserts existing players)
- Error reporting with details
- Success statistics display

### 6. IDP Rankings API

**Edge Function:** `supabase/functions/idp-rankings/index.ts`

**Endpoint:** `GET /functions/v1/idp-rankings`

**Query Parameters:**
- `position` - Required. DL, LB, or DB
- `format` - Optional. Default: dynasty_sf_idp
- `limit` - Optional. Default: 100

**Response:**
```json
{
  "ok": true,
  "position": "LB",
  "format": "dynasty_sf_idp",
  "count": 50,
  "players": [
    {
      "player_id": "fred_warner_lb",
      "full_name": "Fred Warner",
      "position": "LB",
      "team": "SF",
      "position_rank": 2,
      "ktc_value": 4300,
      "fdp_value": 5330,
      "captured_at": "2026-02-14T12:00:00Z",
      "fdp_rank": 1
    }
  ]
}
```

**Caching:** 5 minutes (public cache)

**Process:**
1. Validate position parameter (DL, LB, DB)
2. Query `ktc_value_snapshots` for position + format
3. Get latest snapshot per player (most recent captured_at)
4. Sort by FDP value descending
5. Add FDP rank based on sorted order
6. Limit results
7. Return with cache headers

### 7. IDP Rankings UI

**Component:** `src/components/IDPRankings.tsx`

**Route:** Dashboard → Data Management → IDP Rankings

**Features:**

**Position Tabs:**
- Defensive Line (DL) 🛡️
- Linebacker (LB) ⚔️
- Defensive Back (DB) 🎯

**Settings Panel:**
- Format selector (Dynasty SF+IDP, Dynasty 1QB+IDP, Tiered)
- Scoring style selector (Tackle Heavy, Balanced, Big Play)

**Search:**
- Filter by player name
- Filter by team

**Rankings Table:**
- Rank (FDP-based)
- Player (with avatar)
- Position badge (color-coded by position)
- Team
- FDP Value (color-coded by tier)
- KTC Value (reference)
- Tier badge (Elite, Strong Starter, Solid Starter, etc.)

**Tier System:**
- **Elite:** 4000+ (gold)
- **Strong Starter:** 3000+ (cyan)
- **Solid Starter:** 2000+ (green)
- **Flex/Low-End Starter:** 1000+ (blue)
- **Depth/Backup:** 500+ (gray)
- **Streamer/Waiver:** <500 (dark gray)

**Position-Specific Colors:**
- DL: Red theme
- LB: Blue theme
- DB: Green theme

### 8. Trade Calculator Integration

**Modified:** `supabase/functions/trade-eval/index.ts`

**Enhancements:**

**Player Lookup:**
- Now searches across all positions: QB, RB, WR, TE, DL, LB, DB
- Identifies position group (OFF vs IDP)
- Returns position group in lookup results

**Value Totals:**
- `sideA_total` - Overall total (offense + IDP + picks)
- `sideB_total` - Overall total (offense + IDP + picks)
- `sideA_offense_total` - Offensive players only
- `sideA_idp_total` - Defensive players only
- `sideB_offense_total` - Offensive players only
- `sideB_idp_total` - Defensive players only

**Response Structure:**
```json
{
  "ok": true,
  "sideA_total": 15000,
  "sideB_total": 14500,
  "sideA_offense_total": 10000,
  "sideA_idp_total": 5000,
  "sideB_offense_total": 9500,
  "sideB_idp_total": 5000,
  "difference": 500,
  "fairness_percentage": 97,
  "recommendation": "Fair trade - slight value difference",
  "sideA_details": [
    {
      "name": "Josh Allen",
      "pos": "QB",
      "value": 10000,
      "positionGroup": "OFF"
    },
    {
      "name": "Fred Warner",
      "pos": "LB",
      "value": 5000,
      "positionGroup": "IDP"
    }
  ],
  "sideB_details": [...]
}
```

**Trade Evaluation:**
- Treats IDP players identically to offensive players in value calculation
- Fairness percentage based on total value
- Recommendation considers combined value
- Breakdown shows offensive vs IDP contribution

### 9. FDP Value Calculation Integration

**File:** `src/lib/fdp/calcFdpValue.ts`

**Enhanced Function:**
```typescript
export function calcFdpValueFromKtc({
  ktcValue,
  position,
  format,
  ctx,
  positionGroup,  // NEW: 'OFF' or 'IDP'
  subPosition,    // NEW: EDGE, ILB, CB, etc.
  age,            // NEW: For age curve adjustments
}): number
```

**Logic:**
1. Check if `positionGroup === 'IDP'` and position is valid IDP position
2. If IDP: Route to `calcIDPFdpValue()`
3. If offensive: Use existing offensive calculation
4. IDP calculation applies multipliers + adjustments
5. Clamps result to 0-10,000 range

**Format Conversion:**
- `dynasty_sf_idp` → Use IDP multipliers for IDP positions
- `dynasty_1qb_idp` → Use IDP multipliers for IDP positions
- `dynasty_sf_idp123` → Use tiered IDP multipliers

### 10. Player Detail Pages (Future Enhancement)

**Planned Support:**

**Player Profile:**
- Position group badge (Offense/Defense)
- Sub-position display (EDGE, ILB, CB, etc.)
- Latest FDP value with IDP tier
- Value history chart (same as offensive players)

**IDP-Specific Metrics:**
- Age curve visualization
- Snap share tracking
- Team defense ranking
- Position-specific stats (tackles, sacks, INTs)

**Adjustment Breakdown:**
- Show all IDP adjustments applied
- Explain bonus/penalty reasoning
- Display multiplier effects

## User Workflows

### Admin: Upload IDP Players

1. Navigate to **Dashboard** → **Data Management** → **IDP Upload**
2. Download template CSV (optional)
3. Prepare CSV with player data (name, position, sub_position, team, base_value, rank)
4. Select format (Dynasty SF+IDP or Dynasty 1QB+IDP)
5. Upload CSV file
6. Click **Upload** button
7. Review success statistics
8. Check for any errors
9. Navigate to **IDP Rankings** to verify uploads

### Admin/User: View IDP Rankings

1. Navigate to **Dashboard** → **Data Management** → **IDP Rankings**
2. Select position tab (DL, LB, or DB)
3. Optionally click settings icon
4. Select format and scoring style
5. Use search to filter by name or team
6. View rankings table with FDP values and tiers
7. Compare FDP values to KTC values
8. Identify value discrepancies

### User: Evaluate Mixed IDP Trade

1. Navigate to **Trade Analyzer**
2. Add offensive players to trade (e.g., "Josh Allen", "Derrick Henry")
3. Add IDP players to trade (e.g., "Fred Warner", "T.J. Watt")
4. Add draft picks if applicable
5. Click **Analyze Trade**
6. View total values (offense + IDP + picks)
7. See breakdown:
   - Side A Offense Total
   - Side A IDP Total
   - Side B Offense Total
   - Side B IDP Total
8. Review fairness percentage and recommendation
9. Use offense/IDP breakdown to assess balance

### User: Search for IDP Players

1. Navigate to **Trade Analyzer** or **Player Search**
2. Type IDP player name (e.g., "Micah Parsons")
3. Specify position if needed (LB, DL, DB)
4. Player lookup includes IDP players
5. See FDP value calculated with IDP multipliers
6. Add to trade for evaluation

## Value Tiers & Benchmarks

### Linebacker (LB) Tiers

| Tier | FDP Value | Description | Examples |
|------|-----------|-------------|----------|
| Elite LB1 | 4500+ | Elite tackle machine | Fred Warner, Roquan Smith |
| Strong LB1 | 3500+ | High-volume starter | Bobby Wagner, C.J. Mosley |
| Mid LB1/LB2 | 2500+ | Solid starter | Tremaine Edmunds, Zaire Franklin |
| LB2/Flex | 1500+ | Flex option | Cody Barton, Jerome Baker |
| Deep LB3 | 800+ | Depth/streamer | Various backups |

### Defensive Line (DL) Tiers

| Tier | FDP Value | Description | Examples |
|------|-----------|-------------|----------|
| Elite DL1 | 4200+ | Elite pass rusher | T.J. Watt, Myles Garrett |
| Strong DL1 | 3200+ | Strong pass rush | Danielle Hunter, Nick Bosa |
| Mid DL1/DL2 | 2200+ | Solid starter | Brian Burns, Josh Allen |
| DL2/Flex | 1200+ | Flex option | Marcus Davenport, Various |
| Deep DL3 | 600+ | Depth/streamer | Rotational players |

### Defensive Back (DB) Tiers

| Tier | FDP Value | Description | Examples |
|------|-----------|-------------|----------|
| Elite DB1 | 3800+ | Elite playmaker | Derwin James, Antoine Winfield Jr. |
| Strong DB1 | 2800+ | Strong starter | Jalen Ramsey, Minkah Fitzpatrick |
| Mid DB1/DB2 | 1800+ | Solid starter | Jessie Bates, Kyle Hamilton |
| DB2/Flex | 1000+ | Flex option | Various starters |
| Deep DB3 | 500+ | Depth/streamer | Rotational players |

## Format Differences

### Dynasty SF + IDP (dynasty_sf_idp)

**Philosophy:** Balanced IDP values aligned with offensive counterparts

**Multipliers:**
- DL: 1.05 (slight premium for scarcity)
- LB: 1.10 (premium for tackle volume)
- DB: 0.98 (slight discount for volatility)

**Use Case:** Standard IDP dynasty leagues with superflex

### Dynasty 1QB + IDP (dynasty_1qb_idp)

**Philosophy:** Similar to SF+IDP, QB values slightly lower

**Multipliers:**
- DL: 1.05
- LB: 1.10
- DB: 0.98

**Use Case:** IDP dynasty leagues without superflex

### Dynasty SF + IDP Tiered (dynasty_sf_idp123)

**Philosophy:** Enhanced IDP values for tiered scoring systems

**Multipliers:**
- DL: 1.08 (higher premium)
- LB: 1.12 (strongest premium)
- DB: 0.95 (larger discount)

**Use Case:** Leagues with big play bonuses and tackle penalties

## Scoring Style Impact

### Tackle Heavy

**Philosophy:** Rewards consistent tackle production

**Effect:**
- LB: +25% (biggest winner)
- DB: +10% (moderate winner)
- DL: -10% (loser - fewer tackles)

**Best For:** Leagues with 1 point per tackle, no big play bonuses

### Balanced

**Philosophy:** Neutral weighting across all stat categories

**Effect:**
- All positions: ±0% (baseline)

**Best For:** Standard IDP scoring with balanced categories

### Big Play

**Philosophy:** Rewards sacks, INTs, forced fumbles

**Effect:**
- DL: +15% (biggest winner - sack specialists)
- DB: +5% (moderate winner - INT opportunities)
- LB: -5% (slight loser - fewer big plays)

**Best For:** Leagues with heavy sack/INT bonuses, low tackle points

## API Reference

### Query IDP Rankings

```bash
GET /functions/v1/idp-rankings?position=LB&format=dynasty_sf_idp&limit=50

Response:
{
  "ok": true,
  "position": "LB",
  "format": "dynasty_sf_idp",
  "count": 50,
  "players": [...]
}
```

### Trade Evaluation with IDP

```bash
POST /functions/v1/trade-eval
Content-Type: application/json

{
  "format": "dynasty_sf_idp",
  "sideA": ["Josh Allen", "Fred Warner"],
  "sideB": ["Patrick Mahomes", "T.J. Watt"]
}

Response:
{
  "ok": true,
  "sideA_total": 15000,
  "sideB_total": 14800,
  "sideA_offense_total": 10000,
  "sideA_idp_total": 5000,
  "sideB_offense_total": 9800,
  "sideB_idp_total": 5000,
  "fairness_percentage": 99,
  "recommendation": "Fair trade - values are very close"
}
```

### Calculate IDP Value

```typescript
import { calculateIDPValue } from './lib/idp/calculateIDPValue';

const player = {
  player_id: 'fred_warner_lb',
  full_name: 'Fred Warner',
  position: 'LB',
  sub_position: 'ILB',
  team: 'SF',
  age: 27,
  base_value: 4000,
};

const result = calculateIDPValue(
  player,
  'dynasty_sf_idp',
  'balanced',
  3, // team defense rank
  95 // snap share percentage
);

// Returns:
// {
//   player_id: 'fred_warner_lb',
//   base_value: 4000,
//   total_multiplier: 1.10,
//   idp_adjustments: 930,
//   fdp_value: 5330,
//   breakdown: [...]
// }
```

## File Structure

```
src/
├── lib/
│   ├── idp/
│   │   ├── idpMultipliers.ts          # Format & scoring multipliers
│   │   ├── idpAdjustments.ts          # Context-based adjustments
│   │   └── calculateIDPValue.ts       # Value calculation engine
│   └── fdp/
│       └── calcFdpValue.ts            # Enhanced with IDP support
├── components/
│   ├── IDPRankings.tsx                # Rankings UI
│   ├── IDPAdminUpload.tsx             # CSV upload interface
│   └── Dashboard.tsx                  # Enhanced with IDP tabs
└── ...

supabase/
├── functions/
│   ├── idp-rankings/                  # Rankings API
│   └── trade-eval/                    # Enhanced with IDP support
└── migrations/
    └── add_idp_support_to_player_values.sql
```

## Testing Checklist

- [x] Database migration applied successfully
- [x] IDP players can be uploaded via CSV
- [x] IDP rankings display correctly per position
- [x] IDP players appear in trade calculator
- [x] Trade evaluation includes offense/IDP breakdown
- [x] FDP values calculated with multipliers + adjustments
- [x] Position groups (OFF/IDP) auto-set correctly
- [x] Sub-positions stored and displayed
- [x] Age curve adjustments apply correctly
- [x] Tier classifications accurate
- [x] API endpoints return proper data
- [x] UI components render without errors
- [x] Build completes successfully

## Future Enhancements

### Phase 1 (Completed)
- ✅ Database schema for IDP
- ✅ Value calculation system
- ✅ Admin upload interface
- ✅ Rankings UI
- ✅ Trade calculator integration
- ✅ API endpoints

### Phase 2 (Future)
- [ ] Sleeper roster import (include IDP players)
- [ ] Player detail pages (IDP-specific metrics)
- [ ] Team analyzer (offense vs IDP strength breakdown)
- [ ] Historical value charts (IDP trends)
- [ ] Automated scraping (IDP ranking sources)
- [ ] Waiver recommendations (IDP players)
- [ ] Lineup optimizer (IDP roster slots)

### Phase 3 (Advanced)
- [ ] Real-time stat integration (tackles, sacks, INTs)
- [ ] Weekly projections (IDP scoring)
- [ ] Matchup analysis (vs offensive lines, QBs)
- [ ] Injury impact tracking (IDP-specific)
- [ ] Draft kit (IDP rankings + ADP)
- [ ] Dynasty startup draft assistant (IDP rounds)

## Summary

The IDP System brings comprehensive defensive player support to FantasyDraftPros:

✅ **Complete Position Coverage** - DL, LB, DB with sub-positions
✅ **Sophisticated Valuation** - Multipliers + context-based adjustments
✅ **Easy Data Management** - CSV upload for quick seeding
✅ **Integrated Trade Analysis** - Mixed offensive/defensive trades
✅ **Beautiful UI** - Position-specific rankings with tiers
✅ **API-First Design** - Scalable endpoints for future integrations
✅ **Production Ready** - Tested, deployed, documented

IDP leagues now have the same analytical depth as offensive-only formats, enabling strategic roster building, accurate trade evaluation, and comprehensive player analysis across all positions.
