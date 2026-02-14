# Rookie & Backup QB Value Fix

## Problem
Rookies and backup QBs were showing incorrect values because:
1. **Backup QBs**: Detection logic only existed in database sync, not in real-time Trade Analyzer calculations
2. **Rookies**: No specific adjustments were being applied for unproven rookies

## Solution Applied

### 1. Added Backup QB Detection to Trade Analyzer

**Location**: `src/services/sleeperApi.ts`

**Logic Added**:
- List of known backup QBs (Trey Lance, Sam Howell, Tyler Huntley, etc.)
- Relative value calculation compared to top QBs
- Aggressive downward adjustments:
  - Known backups or <5% of top QB: **98% reduction** (2% of original value)
  - Very low value QBs (<10%): **95% reduction** (5% of original value)
  - Low value QBs (<20%): **85% reduction** (15% of original value)

**Applied in Both**:
- Database values (if not already adjusted via metadata)
- KTC API values (real-time calculations)

### 2. Added Rookie Penalty for Non-Elite Rookies

**Logic**:
- Rookies (years_exp === 0) who are NOT in the top 20% of all players
- Apply 15% reduction (85% of original value)
- Excludes QBs (they have separate backup logic)

## Example Value Changes

### Backup QBs (Before → After)
| Player | Before | After | Change |
|--------|--------|-------|--------|
| Trey Lance | 2400 | 48 | -98% |
| Sam Howell | 1800 | 36 | -98% |
| Cooper Rush | 1500 | 30 | -98% |
| Jarrett Stidham | 1200 | 24 | -98% |

### Non-Elite Rookies (Before → After)
| Player | Position | Before | After | Change |
|--------|----------|--------|-------|--------|
| Random 4th rounder | RB | 1200 | 1020 | -15% |
| Late-round WR | WR | 800 | 680 | -15% |

### Elite Rookies (Unchanged)
| Player | Position | Value | Notes |
|--------|----------|-------|-------|
| Top RB prospect | RB | 8500 | No penalty (top 20%) |
| Top WR prospect | WR | 8200 | No penalty (top 20%) |
| 1.01 QB | QB | 7800 | Separate QB logic applies |

## Known Backup QBs List

The following QBs are automatically identified as backups and receive the maximum penalty:
- Joe Milton / Joe Milton III
- Trey Lance
- Sam Howell
- Tyler Huntley
- Jake Browning
- Easton Stick
- Cooper Rush
- Taylor Heinicke
- Jarrett Stidham
- Mitch Trubisky
- Tyson Bagent
- Joshua Dobbs
- Clayton Tune
- Davis Mills
- Aidan O'Connell
- Jaren Hall
- Stetson Bennett
- Dorian Thompson-Robinson
- Malik Willis

## How It Works

### For Every QB Value Calculation:
1. Check if player name matches known backup list
2. Calculate relative value vs top QB (top QB = 100%)
3. Apply appropriate penalty based on relative value
4. Only applies if not already adjusted in database metadata

### For Every Non-QB Rookie:
1. Check if years_exp === 0
2. Calculate relative value vs all players
3. If below 20%, apply 15% penalty
4. Elite rookies (top 20%) keep full value

## Testing Recommendations

1. **Test a known backup QB** (e.g., Trey Lance)
   - Should show very low value (~50 or less)

2. **Test an elite QB** (e.g., Josh Allen, Patrick Mahomes)
   - Should show high value (7000-9000+)

3. **Test a rookie WR from late rounds**
   - Should show slightly reduced value vs their KTC ranking

4. **Test an elite rookie** (e.g., top 5 pick)
   - Should maintain full value

## Build Status

✅ Build successful with no errors
- All value calculations updated
- Backup QB detection active
- Rookie penalties active
