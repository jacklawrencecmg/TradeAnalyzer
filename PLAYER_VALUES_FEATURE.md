# Player Values Feature - Fantasy Draft Pros Custom Adjustments

## Overview

The Player Values feature provides Fantasy Draft Pros (FDP) player values with custom adjustments to provide you with a competitive edge in fantasy football trades and roster decisions.

## What Makes FDP Values Different?

FDP values apply intelligent adjustments based on:

### 1. **Playoff Schedule Strength**
- Analyzes strength of opponents in weeks 15-17
- Boosts value for players with favorable playoff matchups
- Discounts players facing tough defenses during playoffs

### 2. **Recent Performance Trends**
- Weights last 4 weeks more heavily than season averages
- Identifies breakout players and declining veterans
- Captures hot/cold streaks that standard values miss

### 3. **Team Situation Analysis**
- Factors in coaching changes and offensive scheme fits
- Considers opportunity changes (injuries to teammates, trades)
- Evaluates offensive line quality and target share trends

### 4. **Injury Risk Assessment**
- Applies discounts for injury-prone players
- Considers age and injury history
- Adjusts for current health status

### 5. **League-Specific Settings**
- Superflex leagues see QB value boosts
- Automatically adjusts for your league format
- Provides context-aware valuations

### 6. **Age Factor (Dynasty)**
- Adjusts player values based on age curve
- Discounts aging players in dynasty leagues
- Boosts young breakout candidates

## Features

### Player Value Browser
- **Search & Filter**: Find players by name, position, or team
- **Position Filters**: View QB, RB, WR, TE, or all positions
- **Trend Filters**: See rising, falling, or stable values
- **Key Differences Toggle**: Show only players with significant Base vs FDP differences

### Side-by-Side Comparison
- **Base Value**: Industry-standard baseline value
- **FDP Value**: Our adjusted value with custom factors
- **Difference Indicator**: Clear visualization of value gaps
- **Trend Arrows**: See which direction player value is moving

### Statistics Dashboard
- Total players displayed
- Count of rising value players
- Count of falling value players
- Real-time filtering updates

### Value Insights
The "Key Differences" filter highlights players where our FDP algorithm sees value differently than standard Base rankings. These are potential trade targets or sell opportunities.

## How to Use

1. **Navigate to Player Values**
   - From your dashboard, go to "Analytics & Insights" section
   - Click on "Player Values" (dollar sign icon)

2. **Search for Players**
   - Use the search bar to find specific players
   - Filter by position (QB, RB, WR, TE)
   - Filter by trend (Rising, Falling, Stable)

3. **Identify Value Opportunities**
   - Click "Key Differences" to see players with significant adjustments
   - Look for players where FDP value > Base value (undervalued in standard rankings)
   - Look for players where FDP value < Base value (potentially overvalued)

4. **Make Informed Trades**
   - Use FDP values in the Trade Analyzer
   - Target players your league-mates might undervalue
   - Sell players before value decline is widely recognized

## Database Structure

### Tables Created

#### `player_values`
Stores Base and FDP values for all fantasy-relevant players
- Includes position, team, trend indicators
- Updated regularly with latest values
- Public read access for all users

#### `value_adjustment_factors`
Stores the specific adjustment factors for each player
- Superflex boost percentage
- Playoff schedule rating
- Recent performance modifier
- Injury risk discount
- Age factor
- Team situation rating

#### `user_custom_values`
Allows users to set personal overrides
- Custom values for specific players
- Personal notes and analysis
- User-specific with full RLS protection

## API Integration

The system includes a complete API service (`playerValuesApi.ts`) with methods for:
- Fetching Base values from their API
- Calculating FDP adjustments
- Searching players
- Comparing values
- Tracking trends
- Managing user custom values

## Security

- Row Level Security (RLS) enabled on all tables
- Public read access for player values
- User-specific access for custom overrides
- Service role access for data updates

## Future Enhancements

Potential additions:
- Real-time value updates
- Historical value tracking charts
- Trade value calculator using FDP values
- Mobile push notifications for value changes
- Custom weighting for adjustment factors
- League-specific value adjustments based on scoring settings

## Technical Details

**New Files:**
- `/src/services/playerValuesApi.ts` - API service layer
- `/src/components/PlayerValues.tsx` - Main UI component
- Migration: `create_player_values_system.sql` - Database schema

**Modified Files:**
- `/src/components/Dashboard.tsx` - Added Values tab and navigation
- Integrated with existing league management system

**Dependencies:**
- Uses existing Supabase database
- Integrates with current authentication system
- Leverages existing UI component library

## Usage Notes

- The Player Values tab appears in the "Analytics & Insights" section
- Values automatically adjust based on your league's superflex setting
- All data is cached for performance
- Refresh the page to get latest value updates
