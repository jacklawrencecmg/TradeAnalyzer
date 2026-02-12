# Player Values System

## Overview

The Fantasy Dynasty Pro player values system integrates real-time KeepTradeCut (KTC) values with custom adjustments for league-specific settings.

## KTC Integration

### Data Source
- **API**: KeepTradeCut Official API (`https://api.keeptradecut.com/bff/dynasty/players`)
- **Format**: Automatically fetches correct format based on league type:
  - Format 1: Standard 1QB leagues
  - Format 2: Superflex leagues
- **Cache Duration**: 24 hours for player data, 30 minutes for league data

### Superflex Adjustment

**QB values in Superflex leagues are automatically adjusted using KTC's native Superflex values** - no manual multiplier needed since KTC provides separate value sets for 1QB vs Superflex formats.

For example:
- Patrick Mahomes in 1QB: ~8,500 KTC value
- Patrick Mahomes in Superflex: ~11,500 KTC value (automatically fetched)

## Value Adjustments

### Position-Specific Multipliers
- **TE Premium**: 1.15x multiplier (applied on top of KTC values)
- **Superflex QB**: Uses native KTC Superflex values (no additional multiplier)

### Injury Impact
Values are adjusted down based on injury status:
- Questionable: 0.97x
- Doubtful: 0.90x
- Out: 0.85x
- PUP: 0.70x
- IR: 0.60x
- COV (COVID): 0.50x

### Player Status
- Inactive/Retired: 0.15x (essentially removes their value)

## IDP (Individual Defensive Players)

IDP player values use a custom calculation system since KTC doesn't track defensive players:

### Base Values by Position
- LB: 1,200
- DL: 800
- DB: 900
- DE: 900
- DT: 700
- CB: 850
- S: 850

### Age Adjustments for IDP
- Under 23: 0.95x
- 24-28 (prime): 1.20x
- 29-30: 1.10x
- 31-33: 0.80x
- Over 33: 0.60x

### Experience Adjustments for IDP
- Rookie: 0.70x
- 1 year: 0.85x
- 2-3 years: 1.15x
- 4-6 years: 1.25x
- 7-8 years: 1.15x
- 9-10 years: 0.95x
- 11+ years: 0.75x

## Draft Picks

Draft pick values use a custom calculation that considers:

### Base Values
- 1st Round: 7,000
- 2nd Round: 3,500
- 3rd Round: 1,500
- 4th Round: 600
- 5th+ Round: Diminishing returns

### Modifiers
- **Superflex**: +15% for rounds 1-2
- **IDP Leagues**: +10% for rounds 3+
- **Year Depreciation**: 15% reduction per year into the future
- **Current Year Picks**: +15% premium

## FAAB (Free Agent Acquisition Budget)

FAAB is converted to value based on:
```
Value = (FAAB Amount / League Max Budget) × Max Budget × 7
```

Example: $50 FAAB in a $100 league = (50/100) × 100 × 7 = 350 value

## Usage in Features

### Trade Analyzer
- Automatically detects league format
- Uses appropriate value set (1QB or Superflex)
- Includes draft picks and FAAB in calculations

### Power Rankings
- Sums total roster value using correct format
- Includes future draft picks
- Shows remaining FAAB value

### Lineup Optimizer
- Displays Superflex indicator when applicable
- Optimizes based on player values
- Highlights QB premium in Superflex leagues

### Player Values Dashboard
- Real-time KTC value display
- Trend indicators (up/down/stable)
- Custom adjustments based on league settings

## Data Refresh

- **Player Values**: Auto-refresh every 24 hours
- **League Data**: Auto-refresh every 30 minutes
- **Manual Refresh**: Available in each component

## Fallback System

If KTC API is unavailable, the system falls back to:
1. Cached values (if available and < 24 hours old)
2. Position-based estimates using base values and multipliers
3. Age/experience adjustments for additional context

## Future Enhancements

Planned improvements:
- User custom value overrides (database table exists)
- Historical value tracking
- Value trend analysis
- Playoff schedule adjustments
- Team situation factors
