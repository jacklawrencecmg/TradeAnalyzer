# Player Value System Fix

## Problem
Player values were displaying incorrectly for most/all players because the system was using two conflicting value calculation sources:

1. **SportsData.io** (via `playerValuesApi.syncPlayerValuesFromSportsData()`) - Using complex calculations based on fantasy projections that produced unrealistic values
2. **Fantasy Draft Prospects API** (via `syncPlayerValuesToDatabase()`) - Using industry-standard dynasty values normalized to a proper scale

## Root Cause
The PlayerValues and PowerRankings components were calling the wrong sync function, using SportsData.io's projection-based calculations instead of the FDP dynasty values.

## Changes Made

### 1. Updated Value Scale (`src/utils/syncPlayerValues.ts`)
- Changed normalization range from **0-100** to **0-10000**
- This matches Keep Trade Cut's value scale and provides better granularity
- Top-tier players now show values in the 8000-10000 range
- Mid-tier players in the 3000-6000 range
- Low-tier/backup players in the 0-1000 range

### 2. Fixed Sync Function Calls
**File: `src/components/PlayerValues.tsx`**
- Changed from `playerValuesApi.syncPlayerValuesFromSportsData(isSuperflex)`
- To: `syncPlayerValuesToDatabase(isSuperflex)`
- Updated success message to reflect FDP as the source

**File: `src/components/PowerRankings.tsx`**
- Changed from `playerValuesApi.syncPlayerValuesFromSportsData(false)`
- To: `syncPlayerValuesToDatabase(false)`
- Updated success message to reflect FDP as the source

### 3. Improved Value Precision
- Changed decimal precision from `.toFixed(1)` to `.toFixed(0)` for whole number values
- Updated base_value calculation from `0.9` multiplier to `0.95` multiplier for better accuracy

## How It Works Now

1. **Data Source**: Fantasy Draft Prospects API (with Keep Trade Cut as fallback)
2. **Normalization**: Raw API values are normalized to 0-10000 scale
3. **Adjustments Applied**:
   - Position-specific multipliers (QB, RB, WR, TE)
   - Superflex boost for QBs when applicable
   - Backup QB detection and severe downward adjustment
   - Injury status impact
   - Age-based adjustments
   - Tier-based bonuses (top 5, top 12, top 24)

## Expected Values After Sync

| Player Type | Approximate Value Range |
|------------|------------------------|
| Elite starters (Top 5) | 8000-10000 |
| Top tier (6-12) | 6000-8000 |
| Mid tier (13-24) | 4000-6000 |
| Flex/Bye week (25-48) | 2000-4000 |
| Depth players | 500-2000 |
| Backup QBs | 0-500 |

## Next Steps

To populate the database with correct values:
1. Go to the Player Values page
2. Click the "Sync Values" button
3. Wait for the sync to complete
4. Values should now reflect accurate dynasty rankings

## Notes

- The old `syncPlayerValuesFromSportsData` function is still available in the API but should no longer be used for dynasty leagues
- All values are now consistent across Trade Analyzer, Power Rankings, and Player Values
- The system automatically handles superflex vs standard scoring formats
