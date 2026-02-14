# IDP Scoring Presets System

Configurable IDP scoring systems that adjust player valuations based on your league's specific scoring philosophy.

## Overview

FantasyDraftPros now understands that not all IDP leagues score the same. A linebacker in a tackle-heavy league (1pt/tackle, minimal sack bonuses) has fundamentally different value than the same linebacker in a big-play league (0.5pt/tackle, 4pts/sack).

The IDP Scoring Presets system automatically adjusts player values based on three distinct scoring philosophies:

- **Tackle Heavy (📊):** Rewards consistent tackle production (LB premium)
- **Balanced (⚖️):** Standard IDP scoring (neutral weights)
- **Big Play (💥):** Rewards sacks, INTs, forced fumbles (DL premium)

## Scoring Presets Explained

### 1. Tackle Heavy (📊)

**Philosophy:** Volume over volatility

**Best For:**
- Leagues with 1pt per tackle
- Minimal big play bonuses (≤2pts for sacks)
- Low INT/forced fumble bonuses

**Position Impact:**
- **LB:** +30% value (biggest winner)
- **DB:** +5% value (moderate winner)
- **DL:** -5% value (loser)

**Why:**
- Linebackers lead the league in tackle volume
- ILB/MLB positions get 8-12 tackles per game
- DL typically only get 2-4 tackles per game
- DBs (especially safeties) contribute 4-7 tackles

**Target Players:**
- Fred Warner (ILB) - Elite tackle machine
- Roquan Smith (ILB) - Consistent volume
- Bobby Wagner (ILB) - High floor
- Derwin James (S) - Versatile safety with tackle upside

**Avoid:**
- Pure pass rush specialists with low tackle floors
- Coverage CBs with minimal tackle opportunities

**Example Scoring:**
```
1pt per tackle
0.5pts per assist
2pts per sack
4pts per INT
2pts per forced fumble
```

### 2. Balanced (⚖️)

**Philosophy:** Equal weight across all defensive stats

**Best For:**
- Standard IDP leagues
- Balanced scoring across categories
- Default settings in most platforms

**Position Impact:**
- **LB:** +15% value (moderate premium)
- **DL:** +5% value (slight premium)
- **DB:** ±0% value (neutral)

**Why:**
- Rewards well-rounded defensive players
- Values consistency and big plays equally
- Reflects typical Sleeper/ESPN default scoring

**Target Players:**
- All positions remain viable
- Target versatile players with multiple stat categories
- Elite players at any position hold premium

**Example Scoring:**
```
1pt per tackle
0.5pts per assist
3pts per sack
5pts per INT
3pts per forced fumble
2pts per fumble recovery
```

### 3. Big Play (💥)

**Philosophy:** Explosive plays over volume

**Best For:**
- Leagues with heavy sack bonuses (≥4pts)
- High INT bonuses (≥6pts)
- Low tackle points (≤0.5pts)

**Position Impact:**
- **DL:** +25% value (biggest winner)
- **LB:** -5% value (loser)
- **DB:** -10% value (biggest loser)

**Why:**
- Pass rushers create sacks at elite rates (10-15+ per season)
- EDGE position dominates big play production
- Tackles become less valuable (lower points per tackle)
- LBs lose value despite tackle volume

**Target Players:**
- T.J. Watt (EDGE) - Elite sack production
- Micah Parsons (EDGE/LB) - Versatile pass rusher
- Myles Garrett (EDGE) - Consistent pressure
- Nick Bosa (EDGE) - High sack rate

**Avoid:**
- Tackle-heavy LBs without pass rush upside
- Pure coverage DBs
- Interior DL without sack production

**Example Scoring:**
```
0.5pts per tackle
4-5pts per sack
6pts per INT
4pts per forced fumble
2pts per pass defended
```

## Format Strings

The system uses format strings to combine league type with scoring preset:

### Dynasty Superflex + IDP
- `dynasty_sf_idp_tackle` - Tackle Heavy
- `dynasty_sf_idp_balanced` - Balanced
- `dynasty_sf_idp_bigplay` - Big Play

### Dynasty 1QB + IDP
- `dynasty_1qb_idp_tackle` - Tackle Heavy
- `dynasty_1qb_idp_balanced` - Balanced
- `dynasty_1qb_idp_bigplay` - Big Play

## Preset Multipliers

### Base Multipliers

```typescript
const idpPresetMultipliers = {
  tackle_heavy: {
    LB: 1.30,  // +30%
    DL: 0.95,  // -5%
    DB: 1.05,  // +5%
  },
  balanced: {
    LB: 1.15,  // +15%
    DL: 1.05,  // +5%
    DB: 1.00,  // ±0%
  },
  big_play: {
    LB: 0.95,  // -5%
    DL: 1.25,  // +25%
    DB: 0.90,  // -10%
  },
};
```

### How Multipliers Work

**Step 1: Base Calculation**
```
Base FDP Value = KTC Value × Format Multiplier
```

**Step 2: Context Adjustments**
```
Adjusted Value = Base FDP Value + IDP Adjustments
```

**Step 3: Preset Multiplier**
```
Final FDP Value = Adjusted Value × Preset Multiplier
```

**Step 4: Clamp**
```
Final FDP Value = clamp(0, 10000)
```

### Example: Fred Warner in Different Presets

**Player:** Fred Warner (ILB, SF, Age 27)
**Base Value:** 4,000

**Tackle Heavy:**
```
4,000 × 1.10 (format) = 4,400
4,400 + 930 (adjustments) = 5,330
5,330 × 1.30 (tackle_heavy LB) = 6,929
Final: 6,929
```

**Balanced:**
```
4,000 × 1.10 (format) = 4,400
4,400 + 930 (adjustments) = 5,330
5,330 × 1.15 (balanced LB) = 6,130
Final: 6,130
```

**Big Play:**
```
4,000 × 1.10 (format) = 4,400
4,400 + 930 (adjustments) = 5,330
5,330 × 0.95 (big_play LB) = 5,064
Final: 5,064
```

**Impact:** Fred Warner's value swings by **1,865 points** (37%) between tackle-heavy and big-play scoring!

### Example: T.J. Watt in Different Presets

**Player:** T.J. Watt (EDGE, PIT, Age 30)
**Base Value:** 4,500

**Tackle Heavy:**
```
4,500 × 1.05 (format) = 4,725
4,725 + 380 (adjustments) = 5,105
5,105 × 0.95 (tackle_heavy DL) = 4,850
Final: 4,850
```

**Balanced:**
```
4,500 × 1.05 (format) = 4,725
4,725 + 380 (adjustments) = 5,105
5,105 × 1.05 (balanced DL) = 5,360
Final: 5,360
```

**Big Play:**
```
4,500 × 1.05 (format) = 4,725
4,725 + 380 (adjustments) = 5,105
5,105 × 1.25 (big_play DL) = 6,381
Final: 6,381
```

**Impact:** T.J. Watt's value swings by **1,531 points** (32%) between tackle-heavy and big-play scoring!

## UI Integration

### Rankings Page

**Settings Panel:**
- Format selector (Dynasty SF/1QB + IDP)
- Scoring preset selector (Tackle Heavy/Balanced/Big Play)
- Real-time impact display showing % change per position

**Impact Display:**
```
Current Preset: Big Play (💥)
Rewards sacks, INTs, forced fumbles

DL: +25% (1.25x)
LB: -5% (0.95x)
DB: -10% (0.90x)
```

**Preset Indicators:**
- Color-coded borders on preset selector
- Icons: 📊 Tackle Heavy, ⚖️ Balanced, 💥 Big Play
- Colored text: Blue (Tackle Heavy), Green (Balanced), Orange (Big Play)

### Admin Upload

**Preset Selection:**
```
League Format: [Dynasty Superflex + IDP]
Scoring Preset: [⚖️ Balanced]

Format: dynasty_sf_idp_balanced
Values will be calculated using Balanced scoring
```

**CSV Upload:**
- Select both format and preset before upload
- All uploaded players calculated with chosen preset
- Snapshots stored with `scoring_preset` column
- Format string includes preset suffix

### Player Detail Pages

**IDP Preset Impact Component:**

Displays three cards comparing player value across all presets:

```
Tackle Heavy (📊)
6,929 value
1.30x multiplier
+13% vs balanced
Best

Balanced (⚖️)
6,130 value
1.15x multiplier
Baseline
Baseline

Big Play (💥)
5,064 value
0.95x multiplier
-17% vs balanced
Below Avg
```

**Strategy Tips:**
- Position-specific recommendations
- Best preset for player type
- What to target/avoid

### Trade Calculator

**Automatic Preset Support:**

When evaluating trades:
1. Use format string with preset (e.g., `dynasty_sf_idp_bigplay`)
2. All IDP players valued with preset multipliers
3. Returns breakdown:
   - Side A Offense Total
   - Side A IDP Total
   - Side B Offense Total
   - Side B IDP Total
   - Overall fairness

**Preset Explanation:**
```
"Big-Play scoring increases EDGE value and decreases tackle LBs"
```

## Database Schema

### ktc_value_snapshots

**New Column:**
```sql
scoring_preset text DEFAULT 'balanced'
CHECK (scoring_preset IN ('tackle_heavy', 'balanced', 'big_play'))
```

**Indexes:**
```sql
idx_ktc_snapshots_preset_position (scoring_preset, position, captured_at DESC)
idx_ktc_snapshots_format_preset (format, scoring_preset, position)
```

**Auto-Set Trigger:**
```sql
CREATE TRIGGER set_scoring_preset_trigger
BEFORE INSERT OR UPDATE OF format ON ktc_value_snapshots
FOR EACH ROW
EXECUTE FUNCTION set_scoring_preset();
```

**Function:**
```sql
CREATE FUNCTION get_scoring_preset_from_format(fmt text)
RETURNS text AS $$
BEGIN
  IF fmt LIKE '%bigplay%' OR fmt LIKE '%big_play%' THEN
    RETURN 'big_play';
  ELSIF fmt LIKE '%balanced%' THEN
    RETURN 'balanced';
  ELSIF fmt LIKE '%tackle%' THEN
    RETURN 'tackle_heavy';
  ELSE
    RETURN 'balanced';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Views

**idp_preset_comparison:**
```sql
SELECT
  player_id,
  full_name,
  position,
  MAX(CASE WHEN scoring_preset = 'tackle_heavy' THEN fdp_value END) as tackle_heavy_value,
  MAX(CASE WHEN scoring_preset = 'balanced' THEN fdp_value END) as balanced_value,
  MAX(CASE WHEN scoring_preset = 'big_play' THEN fdp_value END) as big_play_value
FROM ktc_value_snapshots
WHERE position IN ('DL', 'LB', 'DB')
GROUP BY player_id, full_name, position;
```

**latest_idp_values_by_preset:**
```sql
SELECT DISTINCT ON (player_id, scoring_preset)
  player_id,
  full_name,
  position,
  scoring_preset,
  ktc_value,
  fdp_value,
  captured_at
FROM ktc_value_snapshots
WHERE position IN ('DL', 'LB', 'DB')
ORDER BY player_id, scoring_preset, captured_at DESC;
```

## API Integration

### Rankings API

**Endpoint:** `GET /functions/v1/idp-rankings`

**Query Parameters:**
- `position` - DL, LB, or DB
- `format` - Full format string with preset (e.g., `dynasty_sf_idp_bigplay`)
- `limit` - Number of results

**Response:**
```json
{
  "ok": true,
  "position": "LB",
  "format": "dynasty_sf_idp_tackle",
  "preset": "tackle_heavy",
  "count": 50,
  "players": [...]
}
```

### Trade Evaluation API

**Endpoint:** `POST /functions/v1/trade-eval`

**Request:**
```json
{
  "format": "dynasty_sf_idp_bigplay",
  "sideA": ["T.J. Watt", "Justin Jefferson"],
  "sideB": ["Fred Warner", "Ja'Marr Chase"]
}
```

**Response:**
```json
{
  "ok": true,
  "sideA_total": 16381,
  "sideB_total": 16130,
  "sideA_offense_total": 10000,
  "sideA_idp_total": 6381,
  "sideB_offense_total": 10000,
  "sideB_idp_total": 6130,
  "difference": 251,
  "fairness_percentage": 98,
  "recommendation": "Fair trade - slight value difference",
  "preset_explanation": "Big-Play scoring increases EDGE value (T.J. Watt +25%) and decreases tackle LBs (Fred Warner -5%)"
}
```

## Use Cases & Workflows

### Use Case 1: League Setup

**Scenario:** Commissioner setting up new IDP league

**Steps:**
1. Determine league scoring settings
2. Identify which preset matches:
   - 1pt/tackle, low sack bonuses = Tackle Heavy
   - Balanced points across categories = Balanced
   - High sack/INT bonuses, low tackles = Big Play
3. Navigate to IDP Rankings
4. Open Settings panel
5. Select format + preset
6. Review position impacts
7. Share rankings with league

**Result:** All league members use values calibrated to their specific scoring

### Use Case 2: Trade Evaluation

**Scenario:** User receiving trade offer with IDP players

**Steps:**
1. Navigate to Trade Analyzer
2. Enter players from both sides
3. Select league format with preset
4. Analyze trade
5. View offense vs IDP breakdown
6. Read preset explanation
7. Counter-offer if needed

**Result:** Accurate valuation accounting for league scoring philosophy

### Use Case 3: Draft Prep

**Scenario:** User preparing for dynasty startup draft with IDP

**Steps:**
1. Open IDP Rankings
2. Select tackle_heavy preset (league has 1pt/tackle)
3. Note LB premium (+30%)
4. Review top LBs (Fred Warner, Roquan Smith)
5. Compare to DL values (reduced -5%)
6. Build draft strategy:
   - Target elite LBs early
   - Wait on pass rush specialists
   - Target versatile safeties over pure CBs

**Result:** Optimized draft strategy for league's specific scoring

### Use Case 4: Mid-Season Trade Target

**Scenario:** Contender looking to upgrade IDP in big-play league

**Steps:**
1. Open IDP Rankings with big_play preset
2. See DL values boosted +25%
3. Identify undervalued EDGE rushers
4. Use Trade Finder
5. Target teams with weak DL depth
6. Offer tackle-heavy LB for EDGE rusher
7. League manager undervalues EDGE (using tackle_heavy mentally)
8. Win trade

**Result:** Exploit preset knowledge gap for trade advantage

### Use Case 5: Admin Data Upload

**Scenario:** Admin seeding IDP values for custom league

**Steps:**
1. Navigate to IDP Upload
2. Download template CSV
3. Fill with player data
4. Select Dynasty SF + IDP format
5. Select Big Play preset
6. Upload CSV
7. System calculates FDP values with big_play multipliers
8. Creates snapshots with `scoring_preset = 'big_play'`
9. Values immediately available in rankings

**Result:** Custom values perfectly calibrated to league scoring

## Strategy Guide

### Tackle Heavy Leagues

**Priority Order:**
1. Elite LBs (Fred Warner, Roquan Smith, Bobby Wagner)
2. Versatile safeties (Derwin James, Antoine Winfield Jr.)
3. Interior DL with tackle upside (Aaron Donald, Chris Jones)
4. Avoid: Pure pass rush specialists

**Draft Strategy:**
- Target ILB/MLB positions aggressively
- Safeties > cornerbacks
- DTs with tackle volume > EDGE rushers
- Wait on coverage specialists

**Trade Strategy:**
- Sell EDGE rushers at premium (others overvalue them)
- Buy tackle-heavy LBs from rebuilders
- Target aging LBs still producing tackles
- Avoid volatile big-play DBs

### Balanced Leagues

**Priority Order:**
1. Versatile LBs (Micah Parsons, Roquan Smith)
2. Elite EDGE rushers (T.J. Watt, Myles Garrett)
3. Playmaking safeties (Derwin James, Kyle Hamilton)
4. Well-rounded DBs

**Draft Strategy:**
- Best player available approach works
- Target multi-category producers
- Value consistency over boom/bust
- Don't overdraft specialists

**Trade Strategy:**
- Market efficiency - fair values for all
- Focus on team needs
- Age/contract concerns matter most
- Target undervalued due to injury/slump

### Big Play Leagues

**Priority Order:**
1. Elite EDGE rushers (T.J. Watt, Micah Parsons, Myles Garrett)
2. Sack-productive OLBs (Montez Sweat, Josh Allen)
3. Ball-hawking safeties (Kevin Byard, Jessie Bates)
4. Avoid: Tackle-only LBs

**Draft Strategy:**
- Prioritize EDGE rushers early
- Target OLBs with pass rush role
- CBs with INT upside > pure tacklers
- Fade pure run-stuffers

**Trade Strategy:**
- Sell tackle-heavy LBs at premium (others overvalue them)
- Buy EDGE rushers from tackle-heavy mentality owners
- Target young pass rushers ascending
- Avoid aging LBs relying on tackles

## Position-Specific Tips

### Linebacker (LB)

**Tackle Heavy (Best):**
- Target: ILB, MLB positions
- Examples: Fred Warner, Roquan Smith, C.J. Mosley
- Why: 8-12 tackles/game = massive point floors
- Value: +30% boost

**Balanced:**
- Target: Versatile LBs with tackle + big play upside
- Examples: Micah Parsons, Tremaine Edmunds
- Why: Rewarded for all production types
- Value: +15% boost

**Big Play (Worst):**
- Target: OLBs with pass rush role
- Examples: Micah Parsons (as EDGE), Montez Sweat
- Why: Sacks matter more than tackles
- Value: -5% penalty
- Avoid: Pure tackle LBs (Zaire Franklin, Bobby Wagner)

### Defensive Line (DL)

**Big Play (Best):**
- Target: EDGE rushers
- Examples: T.J. Watt, Myles Garrett, Nick Bosa
- Why: Elite sack production (10-15+/season)
- Value: +25% boost

**Balanced:**
- Target: Well-rounded DL
- Examples: Chris Jones, Maxx Crosby
- Why: Sacks + TFLs + tackles valued
- Value: +5% boost

**Tackle Heavy (Worst):**
- Target: Interior DL with tackle volume
- Examples: Dexter Lawrence, Grover Stewart
- Why: Interior DTs get more tackles than EDGE
- Value: -5% penalty
- Avoid: Pure pass rush specialists

### Defensive Back (DB)

**Tackle Heavy (Best):**
- Target: Box safeties
- Examples: Derwin James, Antoine Winfield Jr., Budda Baker
- Why: Safeties contribute 4-7 tackles/game
- Value: +5% boost

**Balanced:**
- Target: Versatile DBs
- Examples: Kyle Hamilton, Jessie Bates
- Why: Tackles + INTs + PBUs all valued
- Value: Neutral (0%)

**Big Play (Worst):**
- Target: Ball-hawking CBs (if you must)
- Examples: Trevon Diggs (when healthy)
- Why: INTs valued but tackle floor hurts
- Value: -10% penalty
- Avoid: Coverage specialists, tackle-only safeties

## Preset Detection (Future)

### Auto-Detect from Sleeper Import

**Planned Feature:**

When importing Sleeper league:
1. Read scoring settings from Sleeper API
2. Calculate tackle:sack:INT point ratios
3. Map to closest preset:
   - Tackle:Sack ratio > 0.4 = Tackle Heavy
   - Tackle:Sack ratio 0.25-0.4 = Balanced
   - Tackle:Sack ratio < 0.25 = Big Play
4. Set league default format automatically
5. Notify user: "Detected Big Play IDP scoring"

**Example Detection:**
```
Scoring Settings:
- 1pt per tackle
- 5pts per sack
- 6pts per INT

Ratio: 1:5:6
Tackle:Sack = 1/5 = 0.20 (< 0.25)
Detected: Big Play
Format: dynasty_sf_idp_bigplay
```

## Comparison Table

| Feature | Tackle Heavy | Balanced | Big Play |
|---------|-------------|----------|----------|
| **Best For** | High tackle points | Standard scoring | High sack/INT bonuses |
| **LB Multiplier** | 1.30x (+30%) | 1.15x (+15%) | 0.95x (-5%) |
| **DL Multiplier** | 0.95x (-5%) | 1.05x (+5%) | 1.25x (+25%) |
| **DB Multiplier** | 1.05x (+5%) | 1.00x (±0%) | 0.90x (-10%) |
| **Top Position** | LB | LB | DL |
| **Target** | ILB/MLB | Versatile players | EDGE rushers |
| **Avoid** | EDGE specialists | One-dimensional | Tackle-only LBs |
| **Icon** | 📊 | ⚖️ | 💥 |
| **Color** | Blue | Green | Orange |

## Testing Checklist

- [x] Database migration applied (scoring_preset column)
- [x] Preset multipliers created
- [x] Helper functions created (getIdpPreset, applyIdpPreset)
- [x] FDP calculation integrates presets
- [x] Rankings UI shows preset toggle
- [x] Admin upload supports presets
- [x] Format strings include preset suffix
- [x] Trade calculator uses preset values
- [x] Player detail components created
- [x] Build completes successfully

## Summary

The IDP Scoring Presets system transforms FantasyDraftPros from a generic IDP calculator into a sophisticated, league-specific valuation engine:

✅ **Three Distinct Presets** - Tackle Heavy, Balanced, Big Play
✅ **Position-Specific Impact** - LB/DL/DB affected differently
✅ **Automatic Integration** - Applied to all value calculations
✅ **UI Transparency** - Shows impact clearly in rankings
✅ **Database Tracking** - Stores preset with each snapshot
✅ **Trade Calculator Support** - Evaluates mixed trades accurately
✅ **Admin Flexibility** - Upload values for any preset
✅ **Strategy Insights** - Player pages show preset comparisons

**Value Swing Examples:**
- Fred Warner: 5,064 (Big Play) → 6,929 (Tackle Heavy) = **+37%**
- T.J. Watt: 4,850 (Tackle Heavy) → 6,381 (Big Play) = **+32%**

This isn't a toy calculator anymore. This is the difference between treating all IDP leagues the same (wrong) versus understanding that a linebacker in a tackle-heavy league is fundamentally more valuable than in a big-play league (correct).

Your calculator now understands:
- ✅ Offensive positional value
- ✅ Positional scarcity
- ✅ Offseason pick economics
- ✅ **Defensive scoring philosophy**

That's the difference between a generic calculator and a serious one.
