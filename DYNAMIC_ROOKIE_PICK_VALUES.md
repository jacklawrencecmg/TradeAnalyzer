# Dynamic Rookie Pick Valuation System

A sophisticated, calendar-driven rookie pick valuation system that automatically adjusts pick values based on NFL calendar phases, simulating real-world market psychology and hype cycles.

## Overview

The Dynamic Rookie Pick Valuation System brings realistic market dynamics to fantasy football trades by automatically adjusting rookie pick values throughout the year. Values fluctuate based on the current phase of the NFL calendar:

- **Playoffs (Jan-Mid Feb)**: Contenders prioritize proven players → picks discounted (-8%)
- **Pre-Draft Hype (Late Feb-Mar)**: Rising rookie buzz → picks climbing (+8%)
- **Rookie Fever (April)**: Peak draft hype → maximum pick values (+18%)
- **Post-Draft Correction (May-Jun)**: Landing spots known → slight premium (+2%)
- **Camp Battles (Jul-Aug)**: Training camp optimism → moderate inflation (+5%)
- **Regular Season (Sep-Oct)**: Focus on winning now → picks decline (-5%)
- **Trade Deadline Push (Nov-Dec)**: Balanced market → baseline values (±0%)

## Architecture

### 1. Database Schema

**Table:** `rookie_pick_values`

Stores dynamic pick valuations with automatic phase adjustments:

```sql
CREATE TABLE rookie_pick_values (
  id uuid PRIMARY KEY,
  season int NOT NULL,                -- Draft year (2025, 2026, etc.)
  pick text NOT NULL,                 -- Pick type (early_1st, mid_1st, late_1st, etc.)
  base_value int NOT NULL,            -- Baseline year-round value
  adjusted_value int NOT NULL,        -- Current phase-adjusted value
  phase text NOT NULL,                -- Current NFL calendar phase
  manual_override boolean DEFAULT false,  -- Admin override flag
  override_value int,                 -- Manual override value
  created_at timestamptz,
  updated_at timestamptz,
  CONSTRAINT unique_season_pick UNIQUE(season, pick)
);
```

**Pick Types:**
- `early_1st` - Picks 1.01-1.04 (6,500 base)
- `mid_1st` - Picks 1.05-1.08 (5,500 base)
- `late_1st` - Picks 1.09-1.12 (4,800 base)
- `early_2nd` - Picks 2.01-2.06 (3,200 base)
- `late_2nd` - Picks 2.07-2.12 (2,600 base)
- `3rd` - Third round picks (1,200 base)

**Seeded Data:** Initial values for 2025-2027 seasons automatically populated.

### 2. Season Phase Detection

**File:** `src/lib/picks/seasonPhase.ts`

Automatically detects current NFL calendar phase based on date:

```typescript
export type SeasonPhase =
  | 'playoffs'
  | 'pre_draft_hype'
  | 'rookie_fever'
  | 'post_draft_correction'
  | 'camp_battles'
  | 'season'
  | 'trade_deadline_push';

export function getSeasonPhase(date: Date = new Date()): SeasonPhase {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 1 || (month === 2 && day <= 15)) return 'playoffs';
  if (month === 2 || month === 3) return 'pre_draft_hype';
  if (month === 4 && day <= 30) return 'rookie_fever';
  if (month === 5 || month === 6) return 'post_draft_correction';
  if (month === 7 || month === 8) return 'camp_battles';
  if (month === 9 || month === 10) return 'season';
  return 'trade_deadline_push';
}
```

**Phase Information:**
- Label (user-friendly name)
- Description (market psychology explanation)
- Month range
- Emoji indicator

### 3. Base Pick Values

**File:** `src/lib/picks/basePickValues.ts`

Defines baseline values for each pick tier:

```typescript
export const basePickValues: Record<PickType, number> = {
  early_1st: 6500,   // Elite prospect access
  mid_1st: 5500,     // Quality starter potential
  late_1st: 4800,    // Solid contributor upside
  early_2nd: 3200,   // High-upside dart throw
  late_2nd: 2600,    // Depth piece or lottery ticket
  '3rd': 1200,       // Long-term stash
};
```

**Pick Labels:**
- `early_1st` → "Early 1st (1.01-1.04)"
- `mid_1st` → "Mid 1st (1.05-1.08)"
- `late_1st` → "Late 1st (1.09-1.12)"
- `early_2nd` → "Early 2nd (2.01-2.06)"
- `late_2nd` → "Late 2nd (2.07-2.12)"
- `3rd` → "3rd Round (3.01+)"

**Pick Parser:** Intelligently parses various pick input formats:
- "2026 early 1st"
- "early first"
- "1.03"
- "mid 1st"
- "late 2nd round"

### 4. Phase Multipliers

**File:** `src/lib/picks/phaseMultipliers.ts`

Multipliers simulate market psychology throughout the year:

```typescript
export const phaseMultipliers: Record<SeasonPhase, number> = {
  playoffs: 0.92,                    // -8% (Proven talent prioritized)
  pre_draft_hype: 1.08,             // +8% (Rising buzz)
  rookie_fever: 1.18,               // +18% (Peak hype)
  post_draft_correction: 1.02,      // +2% (Landing spots known)
  camp_battles: 1.05,               // +5% (Training camp optimism)
  season: 0.95,                     // -5% (Focus on current season)
  trade_deadline_push: 1.00,        // ±0% (Balanced market)
};
```

**Psychology Behind Multipliers:**

**Playoffs (-8%):**
- Contenders buying proven players to make championship runs
- Picks devalued as rebuilders seek immediate help
- Win-now mentality dominates

**Pre-Draft Hype (+8%):**
- Combine results generating buzz
- Mock drafts creating excitement
- Anticipation building for rookie class

**Rookie Fever (+18%):**
- Draft day peak excitement
- Landing spots driving speculation
- Maximum hype for new prospects
- Fear of missing out (FOMO) at its peak

**Post-Draft Correction (+2%):**
- Reality setting in after landing spots revealed
- Some disappointment in situations
- Slight premium remains for draft capital

**Camp Battles (+5%):**
- Training camp reports creating optimism
- Depth chart news moving values
- Preseason hype building

**Regular Season (-5%):**
- Focus shifts to current year performance
- Future picks less appealing during playoff push
- Present > future mentality

**Trade Deadline Push (±0%):**
- Balanced market as season winds down
- Some buyers, some sellers
- Baseline equilibrium

### 5. Pick Value Calculation

**File:** `src/lib/picks/calcPickValue.ts`

Core calculation logic with priority system:

```typescript
export function getAdjustedPickValue(
  pick: PickType,
  phase?: SeasonPhase
): number {
  const currentPhase = phase || getSeasonPhase();
  const baseValue = basePickValues[pick] || 0;
  const multiplier = getPhaseMultiplier(currentPhase);

  return Math.round(baseValue * multiplier);
}
```

**Priority System:**
1. **Manual Override** (highest priority)
   - Admin-set custom value
   - Ignores all phase adjustments
   - Used for special circumstances

2. **Phase-Adjusted Value** (automatic)
   - Base value × current phase multiplier
   - Updated automatically with calendar
   - Default for most picks

3. **Static Specific Picks** (fallback)
   - Exact pick numbers (1.01, 1.02, etc.)
   - Fixed values regardless of phase
   - For precision scenarios

**Example Calculations:**

Early 1st in April (Rookie Fever):
```
Base: 6,500
Multiplier: 1.18
Adjusted: 6,500 × 1.18 = 7,670
```

Early 1st in January (Playoffs):
```
Base: 6,500
Multiplier: 0.92
Adjusted: 6,500 × 0.92 = 5,980
```

### 6. Trade Calculator Integration

**Modified:** `supabase/functions/trade-eval/index.ts`

Picks now use dynamic values in trade evaluation:

**Process:**
1. Detect if trade item is a pick (using pattern matching)
2. Parse pick type from string input
3. Query `rookie_pick_values` table for current season
4. Check for manual override first
5. Use adjusted value if no override
6. Fall back to static chart if needed

**Response Enhancement:**
```json
{
  "sideA_details": [
    {
      "name": "2026 early 1st",
      "value": 7670,
      "isPick": true,
      "pickPhase": "rookie_fever",
      "pickAdjustment": 1170,
      "baseValue": 6500
    }
  ],
  "pick_phase": "rookie_fever",
  "pick_adjustment_applied": true
}
```

**Pick Detection:**
- "early 1st", "mid 1st", "late 1st"
- "early 2nd", "late 2nd", "3rd"
- "1.01" through "1.12"
- "2nd round", "third round"
- "2026 early first"

### 7. Admin UI - Pick Values Manager

**Component:** `RookiePickValues.tsx`

**Route:** Dashboard → Data Management → Rookie Pick Values

**Features:**

#### Season Selector
Toggle between draft years (2025, 2026, 2027)

#### Current Phase Display
Prominent banner showing:
- Phase emoji (🏆, 📈, 🔥, etc.)
- Phase name and description
- Month range
- Current adjustment percentage

Example:
```
🔥 Rookie Fever (April)
Peak draft hype; rookie picks at maximum value
Current Adjustment: +18%
Rookie picks inflated due to draft hype
```

#### Pick Values Table

| Pick Type | Base Value | Phase Adj | Adjusted Value | Current Value | Source | Actions |
|-----------|------------|-----------|----------------|---------------|--------|---------|
| Early 1st (1.01-1.04) | 6.5K | +1.2K | 7.7K | **7.7K** | Auto | Edit ✏️ |
| Mid 1st (1.05-1.08) | 5.5K | +990 | 6.5K | **6.5K** | Auto | Edit ✏️ |
| Late 1st (1.09-1.12) | 4.8K | +864 | 5.7K | **5.7K** | Manual | Edit ✏️ Remove ❌ |

**Columns Explained:**
- **Pick Type**: Pick tier with range
- **Base Value**: Year-round baseline
- **Phase Adj**: Current phase adjustment (+/- points)
- **Adjusted Value**: Base × phase multiplier
- **Current Value**: Final value used (adjusted or override)
- **Source**: Auto (phase-based) or Manual (admin override)
- **Actions**: Edit override, Remove override

#### Manual Override
1. Click Edit icon
2. Enter custom value
3. Click checkmark to save
4. Source changes to "Manual"
5. Override persists until removed
6. Click X icon to remove override

#### Recalculate Button
Manually triggers phase adjustment update:
- Detects current NFL calendar phase
- Applies appropriate multiplier
- Updates all non-overridden picks
- Refreshes table display

#### Info Section
Educational content explaining:
- Base value concept
- Phase adjustment mechanics
- Manual override system
- Current phase details

### 8. Recalculation Function

**Edge Function:** `recalc-pick-values`

**Endpoint:** `POST /functions/v1/recalc-pick-values`

**Process:**
1. Detect current season phase
2. Get appropriate phase multiplier
3. Fetch all pick values from database
4. Skip picks with manual overrides
5. Calculate adjusted value (base × multiplier)
6. Update database with new values
7. Return statistics

**Response:**
```json
{
  "ok": true,
  "updated_count": 18,
  "total_picks": 18,
  "current_phase": "rookie_fever",
  "multiplier": 1.18,
  "timestamp": "2026-04-15T12:00:00Z"
}
```

**Triggers:**
- Manual: Admin clicks "Recalculate" button
- Automatic: Nightly cron job after KTC sync
- On-demand: When phase changes

### 9. UI Transparency - Trade Analyzer

**Component:** `TradeAnalyzer.tsx`

**Phase Indicator Banner:**

When any picks are included in trade, displays prominent banner:

```
🔥 Rookie Fever: Rookie picks currently inflated (+18%)
Peak draft hype; rookie picks at maximum value
```

**Visual Design:**
- Blue gradient background
- Phase emoji
- Bold phase name
- Adjustment percentage (color-coded: green for +, red for -)
- Phase description

**Example Variations:**

April (Rookie Fever):
```
🔥 Rookie Fever: Rookie picks currently inflated (+18%)
```

January (Playoffs):
```
🏆 Playoffs: Rookie picks currently discounted (-8%)
```

November (Trade Deadline):
```
⏰ Trade Deadline Push: Rookie picks at baseline (±0%)
```

**Pick Value Display:**
In trade evaluation results, picks show:
- Full pick name with year
- Current adjusted value
- Phase-adjusted notation if applicable

### 10. Automatic Refresh System

**Modified:** `supabase/functions/cron-sync-ktc/index.ts`

Pick values automatically recalculated after nightly KTC sync:

```typescript
try {
  const recalcPickValuesUrl = `${supabaseUrl}/functions/v1/recalc-pick-values`;
  fetch(recalcPickValuesUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
  }).catch(err => {
    console.error('Background pick values recalc failed:', err);
  });
} catch (err) {
  console.error('Failed to trigger pick values recalc:', err);
}
```

**Refresh Cadence:**
- **Daily**: Automatic refresh during nightly cron (checks for phase changes)
- **On-Demand**: Manual recalculate button
- **Phase Transitions**: Values update when calendar phase changes

**Non-Blocking:** Recalculation runs in background, doesn't slow down main sync

## User Workflows

### Admin: View Current Pick Values

1. Navigate to **Dashboard** → **Data Management** → **Rookie Pick Values**
2. View current phase banner at top
3. See table of all pick values with phase adjustments
4. Toggle between seasons (2025, 2026, 2027)
5. Observe color-coded adjustments (green = positive, red = negative)

### Admin: Set Manual Override

1. Navigate to **Rookie Pick Values** page
2. Find pick to override in table
3. Click **Edit** icon (✏️)
4. Enter custom value in input field
5. Click **Checkmark** to save
6. Source column changes to "Manual"
7. Pick now uses override value in all trades
8. Override persists until manually removed

### Admin: Remove Manual Override

1. Navigate to **Rookie Pick Values** page
2. Find pick with manual override (Source = "Manual")
3. Click **X** icon in Actions column
4. Confirm removal
5. Source changes to "Auto"
6. Pick returns to phase-adjusted value

### Admin: Force Recalculation

1. Navigate to **Rookie Pick Values** page
2. Click **Recalculate** button at top right
3. Wait for update to complete
4. Success message displays updated count
5. Table refreshes with new phase-adjusted values
6. Manual overrides remain unchanged

### User: Evaluate Trade with Picks

1. Navigate to **Trade Analyzer**
2. Add players and/or picks to both sides
3. Include picks in format: "2026 early 1st", "mid 1st", "1.03"
4. Click **Analyze Trade**
5. See phase indicator banner if picks included
6. Banner explains current market conditions
7. Pick values automatically adjusted in totals
8. Trade evaluation accounts for phase multipliers

### User: Understanding Phase Impact

**Example Scenario: Early 1st Round Pick**

**January (Playoffs):**
- Base: 6,500
- Multiplier: 0.92
- Current: 5,980
- Message: "Contenders prioritize proven talent"

**April (Rookie Fever):**
- Base: 6,500
- Multiplier: 1.18
- Current: 7,670
- Message: "Peak hype at draft time"

**Value Swing:** 1,690 points (28% increase from Jan → Apr)

**Strategic Implications:**
- Sell picks during rookie fever (April) for maximum value
- Buy picks during playoffs (January) at discount
- Hold picks if current phase undervalues them
- Trade timing matters significantly

## API Reference

### Query Pick Values

```typescript
// Get all pick values for a season
const { data } = await supabase
  .from('rookie_pick_values')
  .select('*')
  .eq('season', 2026)
  .order('base_value', { ascending: false });
```

### Get Current Phase

```typescript
import { getSeasonPhase, getCurrentPhaseInfo } from './lib/picks/seasonPhase';

const phase = getSeasonPhase(); // 'rookie_fever'
const info = getCurrentPhaseInfo();
// {
//   phase: 'rookie_fever',
//   label: 'Rookie Fever',
//   description: 'Peak draft hype...',
//   monthRange: 'April'
// }
```

### Calculate Pick Value

```typescript
import { getAdjustedPickValue } from './lib/picks/calcPickValue';

const value = getAdjustedPickValue('early_1st'); // 7670 (in April)
```

### Recalculate All Picks

```bash
POST /functions/v1/recalc-pick-values
Authorization: Bearer {SUPABASE_KEY}

Response:
{
  "ok": true,
  "updated_count": 18,
  "current_phase": "rookie_fever",
  "multiplier": 1.18
}
```

### Trade Evaluation with Picks

```bash
POST /functions/v1/trade-eval
{
  "format": "dynasty_sf",
  "sideA": ["Josh Allen", "2026 early 1st"],
  "sideB": ["Justin Jefferson", "2026 late 1st"]
}

Response includes:
{
  "sideA_details": [
    { "name": "Josh Allen", "value": 8500, "isPick": false },
    {
      "name": "2026 early 1st",
      "value": 7670,
      "isPick": true,
      "pickPhase": "rookie_fever",
      "pickAdjustment": 1170
    }
  ],
  "pick_phase": "rookie_fever",
  "pick_adjustment_applied": true
}
```

## Phase Transition Examples

### Transition: Pre-Draft Hype → Rookie Fever (March 31 → April 1)

**Before (March 31 - Pre-Draft Hype):**
```
Early 1st: 6,500 × 1.08 = 7,020
Mid 1st: 5,500 × 1.08 = 5,940
Late 1st: 4,800 × 1.08 = 5,184
```

**After (April 1 - Rookie Fever):**
```
Early 1st: 6,500 × 1.18 = 7,670 (+650)
Mid 1st: 5,500 × 1.18 = 6,490 (+550)
Late 1st: 4,800 × 1.18 = 5,664 (+480)
```

**Impact:** 10% additional inflation as draft arrives

### Transition: Rookie Fever → Post-Draft Correction (April 30 → May 1)

**Before (April 30 - Rookie Fever):**
```
Early 1st: 7,670
Mid 1st: 6,490
Late 1st: 5,664
```

**After (May 1 - Post-Draft Correction):**
```
Early 1st: 6,500 × 1.02 = 6,630 (-1,040)
Mid 1st: 5,500 × 1.02 = 5,610 (-880)
Late 1st: 4,800 × 1.02 = 4,896 (-768)
```

**Impact:** 14% crash as hype fades and reality sets in

### Transition: Season → Trade Deadline (October 31 → November 1)

**Before (October 31 - Season):**
```
Early 1st: 6,500 × 0.95 = 6,175
Mid 1st: 5,500 × 0.95 = 5,225
Late 1st: 4,800 × 0.95 = 4,560
```

**After (November 1 - Trade Deadline Push):**
```
Early 1st: 6,500 × 1.00 = 6,500 (+325)
Mid 1st: 5,500 × 1.00 = 5,500 (+275)
Late 1st: 4,800 × 1.00 = 4,800 (+240)
```

**Impact:** 5% increase as market returns to baseline

## Best Practices

### For Admins

**Regular Maintenance:**
- Check pick values monthly to ensure phase transitions occurred
- Review manual overrides quarterly
- Remove obsolete overrides after draft
- Monitor phase transition dates

**Manual Overrides:**
- Use sparingly for special circumstances
- Document reason for override
- Remove after circumstance resolves
- Prefer phase adjustments over overrides

**Season Management:**
- Add new season picks early (December)
- Archive old season picks after draft
- Keep 3 years of data (current + 2 future)

### For Users

**Trading Strategy:**
- Sell picks during Rookie Fever (April) - maximum value
- Buy picks during Playoffs (January) - best discount
- Hold if phase undervalues your picks
- Time trades around phase transitions

**Phase Awareness:**
- Check current phase before trading picks
- Understand if picks are inflated or discounted
- Consider waiting for better phase if not urgent
- Use phase indicator in trade analyzer

**Value Interpretation:**
- Phase adjustments are market psychology, not intrinsic value
- Draft class strength may override phase effects
- Landing spots matter more than calendar
- Use phase as timing guide, not absolute truth

## Technical Details

### Database Indexes

```sql
CREATE INDEX idx_rookie_pick_values_season ON rookie_pick_values(season);
CREATE INDEX idx_rookie_pick_values_pick ON rookie_pick_values(pick);
CREATE INDEX idx_rookie_pick_values_phase ON rookie_pick_values(phase);
```

### RLS Policies

```sql
-- Anyone can read (public trade calculator access)
CREATE POLICY "Anyone can read pick values"
  ON rookie_pick_values FOR SELECT USING (true);

-- Authenticated users can modify (admin access)
CREATE POLICY "Authenticated users can update pick values"
  ON rookie_pick_values FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
```

### Edge Function Deployment

All functions deployed via Supabase:
- ✅ `trade-eval` - Enhanced with pick value lookup
- ✅ `recalc-pick-values` - Phase adjustment calculator
- ✅ `cron-sync-ktc` - Triggers nightly pick recalculation

### File Structure

```
src/lib/picks/
├── seasonPhase.ts          # Phase detection logic
├── basePickValues.ts       # Base value definitions
├── phaseMultipliers.ts     # Phase multiplier system
└── calcPickValue.ts        # Pick value calculations

src/components/
└── RookiePickValues.tsx    # Admin UI

supabase/functions/
├── trade-eval/             # Enhanced with pick support
├── recalc-pick-values/     # Recalculation function
└── cron-sync-ktc/          # Auto-refresh trigger
```

## Future Enhancements

### Potential Improvements

1. **Draft Class Strength Modifier**
   - Adjust base values by perceived class strength
   - Strong class: +500 base value
   - Weak class: -500 base value
   - Admin-configurable per season

2. **Historical Phase Tracking**
   - Chart showing value changes over time
   - Phase transition visualization
   - Historical average by phase

3. **Pick Value Alerts**
   - Notify when pick enters favorable phase
   - Alert on major phase transitions
   - Suggested buy/sell timing

4. **Landing Spot Multipliers**
   - Post-draft team situation adjustments
   - Bad landing spot: -10%
   - Great landing spot: +15%
   - Per-pick customization

5. **Market Sentiment Override**
   - Community voting on draft class strength
   - Real-time market sentiment tracking
   - Crowdsourced adjustments

6. **Multi-Sport Support**
   - NBA draft pick values
   - MLB prospect system
   - Hockey draft picks
   - Sport-specific phases

## Summary

The Dynamic Rookie Pick Valuation System transforms static pick values into a living, breathing market that responds to the NFL calendar. Key benefits:

✅ **Realistic Market Dynamics** - Values mirror real-world trading patterns
✅ **Automatic Adjustments** - No manual updates needed for phase changes
✅ **Strategic Depth** - Trade timing becomes critical decision
✅ **Admin Control** - Manual overrides when needed
✅ **User Transparency** - Clear indication of phase impact
✅ **Calendar-Driven** - Synchronized with NFL events
✅ **Database-Backed** - Persistent, reliable, fast
✅ **Integration Complete** - Works seamlessly with trade calculator
✅ **Production Ready** - Tested, deployed, documented

The system makes rookie pick trading more strategic, realistic, and engaging. Trade timing matters. Market psychology is simulated. The offseason economy feels alive year-round.
