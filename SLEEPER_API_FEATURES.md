# Comprehensive Sleeper API Integration

The Fantasy Football Trade Analyzer now pulls complete data from the Sleeper API, providing deep insights into your league, rosters, picks, transactions, and matchups.

## Overview

All Sleeper API data is fetched and cached for optimal performance. The app intelligently uses your league's specific settings to provide accurate, contextual trade valuations.

## Features

### 📋 League Overview Dashboard

After entering your Sleeper League ID, you'll see a comprehensive **League Overview** with four tabs:

#### ⚙️ League Settings Tab
- **League Information**: Name, season, number of teams, status
- **Roster Configuration**: Complete breakdown of starter positions and bench slots
  - Example: "1 QB, 2 RB, 3 WR, 1 TE, 2 FLEX, 1 SUPER_FLEX + 15 Bench"
- **League Settings**:
  - Waiver type and FAAB budget
  - Playoff teams and start week
  - Trade deadline
  - Taxi squad slots (if applicable)
- **Format Detection**: Automatic Superflex/1QB identification with value adjustments

#### 📊 Scoring Tab
- **Complete Scoring Rules**: All scoring settings organized by category:
  - Passing (yards, TDs, INTs, 2pts, completions)
  - Rushing (yards, TDs, 2pts, attempts)
  - Receiving (receptions, yards, TDs, 2pts)
  - Fumbles
  - Defense/Special Teams
  - IDP (tackles, sacks, INTs, passes defended, etc.)
  - Kicking
- **PPR Status**: Clear indication of Full PPR, Half PPR, or Standard
- **Custom Adjustments**: Values automatically adjusted based on your league's unique scoring

#### 🎯 Future Picks Tab
- **Complete Pick Inventory**: All future draft picks for every team
- **Traded Pick Tracking**: Shows which picks have been traded and to whom
  - Example: "✅ 2026 Round 1 (from Team A)"
- **Pick Summary**: Breakdown of total picks by season
- **Team-by-Team View**: Expandable list showing each team's future picks
- Tracks picks up to 3 years in the future

#### 📈 Recent Activity Tab
- **Transaction Summary**: Last 4 weeks of league activity
  - Total trades completed
  - Waiver claims processed
  - Total FAAB spent
  - Number of active teams making moves
- **Draft History**: List of completed and in-progress drafts

### 🎯 League-Specific Valuations

Player values are now adjusted based on YOUR league's specific scoring:

#### Scoring Adjustments
- **6pt Passing TDs**: QB values boosted 15%
- **Full PPR**: WR/TE values boosted 10%
- **Half PPR**: WR/TE values boosted 5%
- **TE Premium**: Additional boost for TE-premium scoring
- **IDP Scoring**: DL/LB/DB values adjusted for sack/tackle points

#### Example
In a league with:
- 6pt passing TDs
- Full PPR
- TE Premium (0.5 bonus per reception)

A player like Justin Jefferson gets:
- Base dynasty value: 250 pts
- Full PPR adjustment: +10% = 275 pts
- Final value: 275 pts

A QB like Patrick Mahomes gets:
- Base dynasty value: 180 pts
- 6pt TD adjustment: +15% = 207 pts
- Final value: 207 pts

### 🤖 Enhanced AI Trade Suggestions

Trade suggestions now include league-specific context:

#### League Context Integration
Each trade suggestion shows:
- "This trade fits your **Superflex** league format"
- "Values adjusted for **Full PPR** scoring"
- Roster configuration considerations
- Optimal starter counts for your league

#### Example Output
```
🤖 AI Analysis:
Rationale: You have surplus RB depth but need WR help for your flex spots.
Impact: This trade improves your starting lineup strength by 23 points.

League Context: This trade fits your Superflex league format | Values adjusted for Full PPR scoring
```

### 📦 Comprehensive Data Fetching

The app fetches the following data automatically:

#### Core League Data (Cached 30 minutes)
- `/v1/league/<league_id>` - League details, scoring, roster positions
- `/v1/league/<league_id>/rosters` - All team rosters with starters and bench
- `/v1/league/<league_id>/users` - Team owners and display names

#### Picks & Drafts (Cached 30 minutes)
- `/v1/league/<league_id>/traded_picks` - All traded picks including future years
- `/v1/league/<league_id>/drafts` - Draft history and settings
- `/v1/draft/<draft_id>/picks` - Individual draft pick history
- `/v1/draft/<draft_id>/traded_picks` - Draft-specific traded picks

#### Transactions & Activity (Cached 10 minutes)
- `/v1/league/<league_id>/transactions/<round>` - Trades, waivers, FAAB
- `/v1/league/<league_id>/matchups/<week>` - Weekly scoring and lineups

### 🔄 Smart Caching

All API calls are cached for optimal performance:
- **League Details**: 30 minutes (infrequent changes)
- **Rosters & Picks**: 30 minutes (changes weekly/biweekly)
- **Transactions**: 10 minutes (more frequent updates)
- **Matchups**: 10 minutes (weekly updates)

You can refresh the page to force reload data if needed.

### 🎮 Usage Flow

1. **Login** with your account
2. **Select/Add League** from sidebar
3. **View League Overview** - See complete league setup
4. **Check Scoring** - Verify your league's unique scoring rules
5. **Review Future Picks** - See your pick inventory vs other teams
6. **Analyze Trades** - Values automatically adjusted for your league
7. **Get Suggestions** - AI uses your league context for recommendations

### 📊 Integration with Existing Features

All existing features now use league-specific data:

#### Manual Trade Analyzer
- Values adjusted for league scoring
- Future picks available in pick selector
- FAAB budget from league settings

#### AI Trade Suggestions
- Roster needs based on league roster configuration
- Suggestions include league format context
- Values reflect league scoring rules

#### Saved Trades
- Trade history includes league-specific valuations
- Future review shows accurate context

### 🛠️ Technical Details

#### Data Structures

**League Details:**
```python
{
  'name': 'My Dynasty League',
  'season': '2026',
  'status': 'in_season',
  'scoring_settings': {
    'rec': 1.0,  # Full PPR
    'pass_td': 6,  # 6pt passing TDs
    'bonus_rec_te': 0.5  # TE Premium
  },
  'roster_positions': ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'SUPER_FLEX', 'BN', 'BN', ...],
  'settings': {
    'waiver_type': 'faab',
    'waiver_budget': 300,
    'playoff_teams': 6,
    'trade_deadline': 12
  }
}
```

**Traded Picks:**
```python
[
  {
    'season': '2026',
    'round': 1,
    'roster_id': 3,
    'owner_id': 7,  # Current owner
    'previous_owner_id': 3  # Original owner
  }
]
```

#### Key Functions

- `fetch_league_details()` - Get complete league configuration
- `fetch_traded_picks()` - Get all traded picks across all years
- `get_future_picks_inventory()` - Build complete pick inventory
- `adjust_value_for_league_scoring()` - Apply league-specific multipliers
- `is_superflex_league()` - Detect Superflex format
- `get_scoring_summary()` - Parse scoring into readable format

### ⚠️ Error Handling

The app gracefully handles missing data:
- If league details unavailable: Shows warning, uses default values
- If no traded picks: Shows "All teams have original picks"
- If no recent transactions: Shows zero activity
- All fetch functions return empty arrays/None on error

### 🔐 Privacy & Performance

- All API calls go directly to Sleeper (no third-party storage)
- Data cached in Streamlit session (not persisted)
- User leagues stored securely in Supabase with RLS
- No sensitive data logged or shared

### 📈 Future Enhancements

Potential additions:
- **Matchup Analysis**: Use weekly matchup data for strength-of-schedule
- **Transaction Trends**: Analyze FAAB spending patterns
- **Draft Analytics**: Historical draft performance by team
- **Keeper/Dynasty Mode**: Track multi-year roster evolution
- **Custom Scoring Import**: Upload custom scoring rules
- **Comparative League Analysis**: Compare settings across your leagues

## Troubleshooting

### "League details not available"
- Verify Sleeper League ID is correct
- Check that league is active (not archived)
- Try refreshing the page

### Future picks not showing
- League must have traded picks to display
- Some leagues don't enable future pick trading
- Draft must be snake or linear (not auction)

### Scoring looks wrong
- Verify league scoring settings in Sleeper app
- Check that league is using standard scoring categories
- Custom IDP scoring may require manual verification

### Values seem off
- Values are calibrated for dynasty leagues
- Redraft leagues may have different relative values
- Scoring adjustments are multiplicative (not additive)

## API Rate Limits

Sleeper API is public and has no authentication required. However:
- Be respectful of rate limits (caching helps)
- Don't spam refresh - data updates every 30 min
- If you hit limits, wait a few minutes

## Support

For Sleeper API questions:
- Sleeper API Docs: https://docs.sleeper.com/
- Report issues with specific league IDs
- Check Sleeper app for data accuracy

For app-specific questions:
- Review `AUTH_SETUP.md` for account setup
- Check browser console for errors
- Verify `.env` credentials are correct
