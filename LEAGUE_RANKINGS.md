# League-Wide Team Rankings Feature

## Overview

The Fantasy Football Trade Analyzer now includes comprehensive league-wide team rankings that compare all teams in your league based on roster value. Two ranking systems provide different perspectives on team strength:

1. **Players-Only Ranking** - Pure roster strength based on player values
2. **Players + Picks Ranking** - Complete team value including future draft capital

## Features

### 🏆 Players-Only Ranking

Ranks teams based solely on the total value of their rostered players.

#### What's Included
- **Total Player Value**: Sum of all adjusted player values on the roster
- **Top Players**: Shows top 3 players for each team with positions and values
- **League Position**: Your team is highlighted and expanded by default
- **Visual Charts**: Horizontal bar chart for easy comparison

#### Calculation Method
- Uses SportsDataIO projections as base values
- Applies VORP (Value Over Replacement Player) adjustments
- Accounts for age penalties (older players valued lower)
- Adjusts for league scoring format (PPR, IDP, etc.)
- Includes superflex bonuses if applicable
- Handles inactive/injured players with appropriate value adjustments

#### Use Cases
- Evaluate current competitive strength
- Compare roster quality independent of draft picks
- Identify teams ready to win now
- Find teams that should be rebuilding

### 👥+🎯 Players + Picks Ranking

Ranks teams based on combined value of players and future draft picks.

#### What's Included
- **Total Value**: Combined player value + pick value
- **Player Value**: Sum of all rostered players
- **Pick Value**: Estimated value of all future picks owned
- **Future Picks**: Detailed list of picks (e.g., "2026 1st, 2027 2nd (from Team X)")
- **Pick Count**: Number of future picks owned
- **Stacked Bar Chart**: Visual breakdown of players vs picks contribution

#### Pick Valuation
- Estimates picks at mid-round position (slot .06)
- Example values for 2026 (1QB league):
  - 1st round: ~5,000-6,000 pts
  - 2nd round: ~2,500-3,000 pts
  - 3rd round: ~1,000-1,500 pts
- Future year discounting:
  - 2026: 100% value
  - 2027: 70% value (30% discount)
  - 2028: 55% value (45% discount)
- Superflex leagues get 10% pick value boost
- Tracks pick origin (own picks vs acquired picks)

#### Use Cases
- Evaluate long-term team building
- Identify teams mortgaging the future
- Find teams stockpiling picks for rebuild
- Compare win-now vs rebuild strategies
- Assess trade deadline positioning

## Display Features

### Expandable Team Cards
Each team shown as an expandable card with:
- **Rank**: 1st (🏆), 2nd (🥈), 3rd (🥉), or 📊
- **Team Name**: Bold if it's your team
- **Total Value**: Points-based valuation
- **Top Players/Picks**: Quick summary of key assets

### Visual Charts

#### Horizontal Bar Chart
- **X-axis**: Total value in points
- **Y-axis**: Team names (sorted by value)
- **Color**: Your team highlighted in darker blue
- **Tooltips**: Hover for detailed values

#### Stacked Bar Chart (Players + Picks)
- **Green bars**: Player value contribution
- **Orange bars**: Pick value contribution
- **Sorting**: Teams sorted by total value (descending)
- **Tooltips**: Breakdown by value type

### Interactive Tables
- **Sortable columns**: Click headers to sort
- **Formatted values**: Numbers shown with commas (e.g., "45,000 pts")
- **Column types**:
  - Rank: Integer with # symbol
  - Values: Formatted as points
  - Picks: Count with "picks" suffix
- **Responsive**: Auto-width based on content

## Technical Implementation

### Data Sources
1. **Player Values**: From `all_rosters_df`
   - Uses 'AdjustedValue' column
   - Already includes all league-specific adjustments
2. **Future Picks**: From Sleeper API
   - `/v1/league/<league_id>/rosters` - roster ownership
   - `/v1/league/<league_id>/traded_picks` - pick transactions
3. **League Settings**: From `league_details`
   - Number of teams
   - Number of rounds
   - Superflex status

### Calculation Function

```python
@st.cache_data(ttl=1800)
def calculate_league_rankings(
    all_rosters_df: Dict,
    traded_picks: List[Dict],
    league_rosters: List[Dict],
    league_users: List[Dict],
    league_details: Dict,
    is_superflex: bool = False
) -> Tuple[pd.DataFrame, pd.DataFrame]:
```

**Caching**: Results cached for 30 minutes (1800 seconds)

**Returns**: Two DataFrames:
1. `players_only_df`: Columns: Rank, Team, Player Value, Top Players
2. `players_plus_picks_df`: Columns: Rank, Team, Total Value, Player Value, Pick Value, Future Picks, Pick Count

### Pick Ownership Logic

The function determines pick ownership by:
1. **Default ownership**: Each team owns their own picks initially
2. **Traded away**: Checks `traded_picks` for picks traded away (removes from original owner)
3. **Traded to**: Checks `traded_picks` for picks acquired (adds to new owner)
4. **Tracking origin**: Notes if pick is "Own" or "from {Team Name}"

### Edge Cases Handled
- **No picks**: Teams with zero future picks show "None" and 0 value
- **Inactive players**: Low/zero values automatically from valuation logic
- **Missing data**: Graceful fallback with warning message
- **Empty rosters**: Teams with no matched players excluded from rankings

## Usage Tips

### For Win-Now Teams
- Focus on **Players-Only ranking**
- Higher rank = better championship odds
- Consider trading picks to move up in rankings
- Monitor top 3-4 teams as main competition

### For Rebuilding Teams
- Focus on **Players + Picks ranking**
- Multiple 1st round picks provide rebuild foundation
- Trade older players for picks to move up
- Target undervalued young players

### For Competitive Analysis
- **Large gap between rankings**: Team is either heavily rebuilding (more picks than players) or heavily contending (more players than picks)
- **Similar rankings**: Balanced team with good players and picks
- **Your team position**: Determines trade strategy
  - Top 3: Go for championship, trade picks for upgrades
  - Middle: Hold or make strategic moves
  - Bottom 3: Rebuild, trade vets for picks

### For Trade Strategy
- **Targeting partners**:
  - If rebuilding: Target top teams with aging rosters
  - If contending: Target bottom teams with young talent
- **Value assessment**:
  - Use rankings to identify overvalued/undervalued teams
  - Teams with more picks than their ranking suggests may overvalue picks
  - Teams with fewer picks may undervalue draft capital

## Display Location

Rankings appear in a dedicated section after your individual roster display and before AI Trade Suggestions:

1. **League Overview** (basic settings, scoring, picks, activity)
2. **Your Roster** (individual team analysis)
3. **🏆 League Rankings** ← NEW SECTION
4. **AI Trade Suggestions**
5. **Manual Trade Analyzer**
6. (Additional sections...)

## Performance

- **Calculation time**: ~1-2 seconds for 12-team league
- **Caching**: 30-minute cache reduces repeated calculations
- **Data load**: Minimal - uses already-loaded roster and pick data
- **Chart rendering**: <1 second with Altair

## Customization

### Pick Valuation Adjustments
Pick values can be adjusted by modifying the `get_pick_value()` function's base value dictionaries:
- `first_round_2026_1qb`: Values for 1st round picks
- `second_round_2026_1qb`: Values for 2nd round picks
- Future year discounts: Modify discount multipliers

### Display Options
- Change number of top players shown (currently 3)
- Adjust chart height in `.properties(height=400)`
- Modify color schemes in `scale=alt.Scale(...)`
- Add/remove table columns in DataFrames

## FAQ

### Why are pick values estimated at mid-round?
Since we don't know the final draft position of future picks, we estimate at the middle of each round (slot .06 in a 12-team league). This provides a reasonable baseline. Once the season progresses and pick positions become clearer, teams can adjust mentally.

### Do pick values account for superflex?
Yes! If your league is detected as superflex (or you check the superflex box), all pick values automatically receive a 10% boost to reflect higher QB values in superflex formats.

### Why doesn't my ranking match other sites?
Rankings are based on SportsDataIO's player projections with custom adjustments for your league's specific scoring, roster settings, and format. Other sites may use different projection sources (FantasyPros, Yahoo, ESPN) or different valuation methodologies.

### Can I export rankings?
The interactive tables can be copied by selecting the data. For CSV export, you would need to add custom export functionality.

### How often do rankings update?
Rankings recalculate whenever you reload the page. Player values are cached for 30 minutes, and pick data is pulled fresh from Sleeper on each league load.

### What if a team has no players matched?
Teams without matched players are excluded from rankings. This typically happens if the team name doesn't match between Sleeper and the analyzer, or if fuzzy matching fails. Check that the league ID is correct.

## Examples

### Example 1: Balanced Contender
```
Rank: 2nd (🥈)
Team: Your Team
Total Value: 87,500 pts
Player Value: 75,000 pts
Pick Value: 12,500 pts
Future Picks: 2026 1st, 2026 2nd, 2027 1st
```
**Analysis**: Strong roster (2nd in players) with decent draft capital (3 picks worth 12.5k). Good position to compete now while maintaining future flexibility.

### Example 2: Rebuilding Team
```
Rank: 5th (📊)
Team: Rebuilding Roster
Total Value: 65,000 pts
Player Value: 35,000 pts
Pick Value: 30,000 pts
Future Picks: 2026 1st x2, 2026 2nd x2, 2027 1st x2 (from Team A, Team B)
```
**Analysis**: Lower player value (probably ranked 8-10th in players-only) but massive pick capital (6 picks worth 30k). Classic rebuild - trading vets for picks to build for future.

### Example 3: All-In Contender
```
Rank: 1st (🏆)
Team: Championship Roster
Total Value: 95,000 pts
Player Value: 92,000 pts
Pick Value: 3,000 pts
Future Picks: 2027 2nd, 2027 3rd
```
**Analysis**: Dominant roster value (1st in players by large margin) but traded away most picks. All-in for championship this year. If successful, worth it. If not, difficult rebuild ahead.

## Related Features

- **Future Picks Inventory** (League Overview tab): Detailed pick tracking by team
- **Manual Trade Analyzer**: Incorporates pick values into trade analysis
- **AI Trade Suggestions**: Considers roster rankings when suggesting trades
- **Roster Composition Analysis**: Positional strength breakdown

## Future Enhancements

Potential improvements:
- **Historical tracking**: Track ranking changes week-by-week
- **Projection confidence**: Show uncertainty bands on values
- **Trade impact**: "What-if" analysis for proposed trades
- **Comparative analytics**: Compare to league averages
- **Export functionality**: Download rankings as CSV/PDF
- **Mobile optimization**: Improve chart display on mobile
- **Custom weighting**: Allow users to adjust pick valuation formulas

## Troubleshooting

### Rankings not showing
- Ensure you've scrolled to view your roster (triggers `all_rosters_df` creation)
- Check that league data loaded successfully
- Verify traded picks data is available from Sleeper

### Pick values seem wrong
- Verify league format (1QB vs Superflex) is detected correctly
- Check number of teams and rounds in league settings
- Remember picks are valued at mid-round position

### Your team not highlighted
- Team name must match exactly between selectors
- Check for trailing spaces or special characters
- Verify team selection at top of page

### Charts not displaying
- Ensure Altair is installed (`altair==5.5.0`)
- Check browser compatibility (modern browsers only)
- Disable ad blockers if charts blocked

## Summary

The League Rankings feature provides comprehensive competitive analysis across your entire league, helping you:
- **Understand your position** relative to other teams
- **Identify trade partners** based on team building strategy
- **Evaluate long-term outlook** with pick capital factored in
- **Make strategic decisions** about win-now vs rebuild
- **Benchmark progress** as you make trades and acquisitions

Combined with the autocomplete system, Sleeper integration, and comprehensive trade analysis, you now have professional-grade tools for dominating your dynasty league!
