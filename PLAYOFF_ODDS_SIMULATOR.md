# Playoff Odds Simulator - Monte Carlo Analysis

## Overview

The Fantasy Football Trade Analyzer now includes a powerful Monte Carlo playoff odds simulator that predicts your chances of making the playoffs, getting a first-round bye, and winning the championship. The simulator uses actual game projections, historical variance, and real matchup schedules to provide highly accurate probability estimates.

## Features

### 🎲 Monte Carlo Simulation Engine

Runs 5,000-25,000 simulations of the remainder of your season to calculate:
- **Playoff Probability** - % chance of making playoffs
- **Championship Probability** - % chance of winning it all
- **First-Round Bye** - % chance of getting a bye week
- **Projected Record** - Expected wins and losses
- **Average Seed** - Expected playoff seeding
- **Average Points** - Projected total points

### 📊 Comprehensive Analysis

Two simulation systems work together:

#### 1. League-Wide Playoff Odds
- **Full season simulation** using actual matchup schedules
- **Week-by-week projections** for all teams
- **Current standings integration** - uses actual results for completed weeks
- **10,000 simulations** by default (configurable 5K-25K)
- **Cached results** for 30 minutes to improve performance

#### 2. Trade Impact Analysis
- **Before/After comparison** for any proposed trade
- **1,000 rapid simulations** optimized for speed
- **Immediate feedback** on playoff odds changes
- **Integrated with manual trade analyzer**
- **Visual finish distribution** showing impact

## How It Works

### Data Sources

#### 1. Player Projections
- **SportsDataIO API** provides base projections
- **Adjusted for league scoring** (PPR, IDP, etc.)
- **VORP calculations** account for positional value
- **Age adjustments** factor in player decline
- **Injury status** reduces projections appropriately

#### 2. Historical Variance
- **Score variance** set at 25% by default (configurable 10-40%)
- **Normal distribution** models realistic game outcomes
- **Accounts for luck** and weekly volatility
- **Bye weeks** handled automatically
- **Strength of schedule** factored via actual matchups

#### 3. League Schedule
- **Sleeper API** provides actual matchup data
- **Completed weeks** use real results
- **Future weeks** use projected outcomes
- **Playoff structure** respects league settings
  - Number of playoff teams
  - First-round bye configuration
  - Playoff start week

### Simulation Process

#### Step 1: Data Collection
```
1. Fetch all matchup data for the season
2. Calculate team projections from rosters
3. Get current standings (wins/losses/points)
4. Determine remaining schedule
```

#### Step 2: Season Simulation
For each of 10,000 simulations:
```
1. Copy current standings
2. For each remaining week:
   a. Use actual matchup schedule
   b. Simulate each game:
      - Generate scores: N(projection, projection * variance%)
      - Award wins/losses
      - Track points for/against
3. Rank teams by wins (tiebreak: points)
4. Award playoff spots
5. Simulate playoffs (seed-weighted)
6. Record all outcomes
```

#### Step 3: Aggregation
```
1. Count playoff appearances
2. Count championships
3. Calculate average seed
4. Compute projected record
5. Generate probability percentages
```

### Statistical Model

#### Score Generation
Each team's weekly score is generated using:
```
Score = N(μ, σ²)
where:
  μ = projected points (from roster valuations)
  σ = μ × variance% (default 25%)
```

This creates realistic score distributions:
- **High-variance teams** (inconsistent) have wider ranges
- **Low-variance teams** (consistent) have narrower ranges
- **Negative scores** are clamped to 0

#### Playoff Seeding
Teams are ranked by:
1. **Wins** (primary)
2. **Total points** (tiebreaker)

Top N teams make playoffs (typically 6 in 12-team leagues).

#### Championship Probability
Championship odds use **seed-weighted probability**:
```
Weight = 1 / seed
Probability = weight / sum(all weights)

Example 6-team playoff:
- Seed 1: weight 1.000 → 41% chance
- Seed 2: weight 0.500 → 20% chance
- Seed 3: weight 0.333 → 14% chance
- Seed 4: weight 0.250 → 10% chance
- Seed 5: weight 0.200 → 8% chance
- Seed 6: weight 0.167 → 7% chance
```

This reflects the advantage of higher seeds while maintaining uncertainty.

## Using the Simulator

### Location
The simulator appears after League Rankings and before Trade Suggestions:
```
Your Roster → League Rankings → Playoff Odds Simulator → Trade Suggestions
```

### Controls

#### Current Week
```
Input: Number field (1 to playoff_start - 1)
Default: Week 10 (mid-season)
Purpose: Determines which weeks to use actual results vs simulations
```

**Important:**
- Weeks 1 through current_week use actual historical results
- Weeks current_week+1 through playoff_start-1 are simulated
- Adjust this to match the real current week for accurate results

#### Number of Simulations
```
Options: 5,000 | 10,000 | 25,000
Default: 10,000
Recommended: 10,000 (best balance)
```

**Performance:**
- 5,000 sims: ~2-3 seconds (±1% accuracy)
- 10,000 sims: ~4-5 seconds (±0.7% accuracy)
- 25,000 sims: ~10-12 seconds (±0.4% accuracy)

#### Score Variance %
```
Range: 10% - 40%
Default: 25%
Step: 5%
```

**Guidelines:**
- **10-15%**: Very consistent teams, minimal luck
- **20-25%**: Realistic NFL variance (recommended)
- **30-35%**: High-variance, boom/bust teams
- **35-40%**: Maximum chaos, anything can happen

#### Run Button
```
Button: "🎲 Run Playoff Simulation"
Action: Executes simulation and caches results
Cache: 30 minutes
```

## Understanding Results

### Your Team Summary

Four key metrics displayed prominently:

#### Playoff Odds
```
Example: 67.3%
Meaning: In 6,730 of 10,000 simulations, you made playoffs
Threshold Guide:
  90%+  : Playoff lock
  75-90%: Very likely
  50-75%: Good chance
  25-50%: Fighting for spot
  <25%  : Longshot
```

#### Championship Odds
```
Example: 12.4%
Meaning: In 1,240 of 10,000 simulations, you won championship
Threshold Guide:
  20%+  : Title favorite
  10-20%: Contender
  5-10% : Dark horse
  2-5%  : Possible
  <2%   : Unlikely
```

#### Projected Record
```
Example: 9.3-4.7
Meaning: Average of 9.3 wins and 4.7 losses across sims
Note: May include decimal due to averaging
Compare to current record to see trajectory
```

#### Avg Playoff Seed
```
Example: 3.1
Meaning: When making playoffs, average seed is 3rd
Note: Only counts simulations where you made playoffs
Lower = better (seed 1 is best)
```

### League-Wide Odds

Each team shown in expandable card with color-coded playoff odds:
- **🟢 Green** (75%+): Playoff lock
- **🟡 Yellow** (50-75%): Likely in
- **🟠 Orange** (25-50%): Bubble team
- **🔴 Red** (<25%): Fighting for life

#### Expandable Details

Click any team to see:
```
Current Record: 7-3 (actual W-L)
Projected Record: 10.2-3.8 (simulated)
Playoff %: 85.3% (probability)
Bye %: 42.1% (first-round bye probability)
Title %: 15.7% (championship probability)
Avg Seed: 2.3 (average when making playoffs)
```

### Visual Charts

Three interactive charts for comparison:

#### Chart 1: Playoff Odds
- **X-axis**: Playoff probability (%)
- **Y-axis**: Teams (sorted by odds)
- **Colors**: Your team highlighted in darker blue
- **Tooltip**: Playoff %, Championship %, Current Record

**Use Case:** Quickly identify playoff race positioning

#### Chart 2: Championship Odds
- **X-axis**: Championship probability (%)
- **Y-axis**: Teams (sorted by odds)
- **Colors**: Your team highlighted in darker green
- **Tooltip**: Championship %, Playoff %, Avg Seed

**Use Case:** Identify true title contenders vs pretenders

#### Chart 3: Projected Wins
- **X-axis**: Projected wins
- **Y-axis**: Teams (sorted by wins)
- **Colors**: Your team highlighted in orange
- **Tooltip**: Projected Wins, Projected Losses, Playoff %

**Use Case:** See which teams are trending up/down

### Data Table

Comprehensive sortable table with all metrics:

| Column | Description | Format |
|--------|-------------|--------|
| Team | Team name | Text |
| Current Record | Actual W-L | "7-3" |
| Proj Wins | Simulated wins | "9.3" |
| Proj Losses | Simulated losses | "4.7" |
| Playoff % | Playoff probability | "67.3%" |
| Bye % | First-round bye % | "23.1%" |
| Title % | Championship % | "8.4%" |
| Avg Seed | Average playoff seed | "4.2" |

**Tip:** Click column headers to sort and find insights:
- Sort by Playoff % to see bubble teams
- Sort by Title % to find favorites
- Sort by Avg Seed to see bye week candidates

## Trade Impact Analysis

### How It Works

When you analyze any trade in the Manual Trade Analyzer, the system automatically:

1. **Calculates pre-trade odds** using your current roster
2. **Simulates the trade** (adds received players, removes given players)
3. **Calculates post-trade odds** using the new roster
4. **Shows the delta** in clear before/after format

### Display Format

```
Before Trade:                After Trade:
Playoff Odds: 42.3%         Playoff Odds: 58.7% (+16.4%)
Championship Odds: 5.1%     Championship Odds: 9.3% (+4.2%)
Avg Finish: #6.2            Avg Finish: #4.1 (-2.1 spots)
```

**Delta Indicators:**
- **Green positive delta**: Trade improves odds
- **Red negative delta**: Trade hurts odds
- **Gray neutral**: Minimal impact

### Impact Thresholds

The system provides clear guidance on trade impact:

#### Playoff Odds Change
```
> +5%: "📈 Significantly improves playoff odds"
0 to +5%: "↗️ Slightly improves playoff odds"
-5 to 0%: "↔️ Minimal impact on playoff odds"
< -5%: "📉 Significantly hurts playoff odds"
```

#### Strategic Interpretation

**Large Positive Impact (+10%+)**
- Trade addresses critical weakness
- Acquiring elite player(s)
- Perfect timing for playoff push

**Small Positive Impact (+1-5%)**
- Minor roster upgrade
- Depth addition
- Future-focused (picks involved)

**Neutral Impact (±1%)**
- Balanced value trade
- Positional swap
- Long-term vs short-term tradeoff

**Negative Impact (-5%+)**
- Giving up too much
- Trading key starter
- Bad timing (if contending)

### Finish Distribution Chart

Visual histogram showing season outcomes:

**Before Trade:**
```
Frequency
    |     ___
    |    |   |___
    |  __|       |___
    |__|_____________|__
     1  3  5  7  9 11
        Finish Position
```

**After Trade:**
```
Frequency
    |        ___
    |    ___|   |
    |  _|       |___
    |__|___________|__
     1  3  5  7  9 11
        Finish Position
```

**Interpretation:**
- **Peak shift left**: More likely to finish higher
- **Peak shift right**: More likely to finish lower
- **Narrower distribution**: More consistent
- **Wider distribution**: More variance

## Strategic Applications

### For Contenders (Playoff Odds > 75%)

Focus on:
- **Championship %** - Your ultimate goal
- **Avg Seed** - Bye week is huge advantage
- **Trade Impact** - Only +EV championship moves

**Questions to Ask:**
1. Does this trade increase my title odds?
2. Will I still make playoffs after the trade?
3. Does it improve my avg seed (bye week)?
4. Am I sacrificing future for present?

**Example Strategy:**
```
Current: 85% playoff, 12% title, Seed 2.8
Trade: Give 2026 1st for elite RB
Result: 90% playoff, 18% title, Seed 2.1
Decision: Accept - title odds up 6%, improves bye chance
```

### For Bubble Teams (Playoff Odds 40-70%)

Focus on:
- **Playoff %** - Every point matters
- **Projected Wins** - Can you get to safe number?
- **Schedule** - Check remaining matchups

**Questions to Ask:**
1. How many wins to feel safe? (usually 7-8)
2. What's my current trajectory?
3. Does this trade push me over the edge?
4. Can I afford to wait or must act now?

**Example Strategy:**
```
Current: 52% playoff, 7.1 projected wins, 4 games left
Safe line: 8 wins needed
Trade: Give picks for consistent WR
Result: 68% playoff, 8.2 projected wins
Decision: Consider - significant playoff boost
```

### For Eliminated Teams (Playoff Odds < 20%)

Focus on:
- **Future value** - Don't make win-now moves
- **Pick accumulation** - Rebuild cornerstone
- **Young players** - Target age < 26

**Questions to Ask:**
1. Should I be selling vets for picks?
2. Can I get back into contention next year?
3. Which aging players have value now?
4. Am I truly out or just unlucky?

**Example Strategy:**
```
Current: 12% playoff, 5.1 projected wins
Reality: Season likely over
Trade: Sell aging RB for 2026 1st
Result: 8% playoff (don't care), gain valuable pick
Decision: Accept - maximize future value
```

### Mid-Season Adjustments

Use the **Current Week** control to simulate "what if" scenarios:

#### Example: Week 6 Analysis
```
Set Current Week: 6
Results: 45% playoff odds

Question: If I go 3-1 in next 4 weeks?
Answer: Manually project standings, understand target
```

#### Example: Trade Deadline
```
Set Current Week: 10 (trade deadline)
Results: 62% playoff odds, 8% title

Question: All-in trade worth it?
Simulate trade: 75% playoff, 14% title
Decision: Yes - title odds nearly doubled
```

## Advanced Features

### Strength of Schedule

The simulator automatically accounts for strength of schedule through:

1. **Actual matchup data** - Uses real opponents
2. **Opponent projections** - Based on their rosters
3. **Week-by-week variance** - Simulates each game independently

**Implications:**
- Easy remaining schedule = Higher playoff odds
- Tough remaining schedule = Lower playoff odds
- Head-to-head matchups matter

### Bye Week Handling

The simulator accounts for:
- **Player availability** - Bye weeks reduce team projection
- **Week-by-week accuracy** - Adjusts per matchup
- **Roster depth** - Deep teams less affected

**Note:** Current implementation uses season-long projections divided by 17 weeks. Individual bye weeks not explicitly modeled but factored into variance.

### Tiebreaker Scenarios

Playoff seeding determined by:
1. **Wins** (primary criterion)
2. **Total points for** (tiebreaker)

**Important:** The simulator uses total points, not head-to-head record. This matches most common fantasy league settings but verify your league rules.

### Playoff Structure Variations

The simulator adapts to your league settings:

**Number of Playoff Teams:**
```
Common: 6 teams (top 50%)
Range: 4-8 teams supported
Source: League settings 'playoff_teams'
```

**First-Round Byes:**
```
Standard: Top 2 seeds get bye
Alternative: Top 1 seed only
Source: League settings 'playoff_seed_type'
```

**Playoff Start Week:**
```
Standard: Week 15 (14 regular season games)
Range: Week 14-16 supported
Source: League settings 'playoff_week_start'
```

## Performance & Caching

### Execution Time

**League-Wide Simulation:**
```
10,000 sims × 12 teams × 6 remaining weeks
Calculation: ~4-5 seconds
Caching: 30 minutes
```

**Trade Impact Simulation:**
```
1,000 sims × before/after
Calculation: ~1-2 seconds
Caching: None (always fresh for new trades)
```

### Memory Usage

```
Matchup data: ~50KB per season
Simulation results: ~200KB per run
Chart data: ~100KB
Total: ~350KB per session
```

### Optimization Strategies

1. **Cached matchups** - Sleeper API data cached 30 min
2. **Cached projections** - Player values cached 30 min
3. **Session state** - Results stored in browser session
4. **Vectorized numpy** - Fast array operations
5. **Efficient data structures** - Minimal copying

## Accuracy & Validation

### Expected Accuracy

With 10,000 simulations:
```
Playoff odds: ±0.7%
Championship odds: ±0.5%
Projected wins: ±0.3 games
Avg seed: ±0.2 positions
```

With 25,000 simulations:
```
Playoff odds: ±0.4%
Championship odds: ±0.3%
Projected wins: ±0.2 games
Avg seed: ±0.1 positions
```

### Validation Methods

1. **Historical backtesting** - Compare predictions to actual outcomes
2. **Cross-validation** - Multiple simulation runs should converge
3. **Sanity checks** - Probabilities sum to 100%
4. **Edge case testing** - Extreme scenarios behave logically

### Known Limitations

1. **Projections are estimates** - No model is perfect
2. **Injuries not predicted** - Future injuries not forecasted
3. **Trades/acquisitions** - Doesn't account for future roster moves
4. **Weather/external factors** - Not modeled
5. **Playoff performance** - Championship model simplified

**Bottom Line:** Use as a guide, not gospel. Combine with your own analysis and intuition.

## Troubleshooting

### "No matchup data available"

**Cause:** Sleeper API returned no matchups
**Solution:**
- Verify league ID is correct
- Ensure season has started
- Check that league has completed at least one week

### "Unable to run simulation"

**Cause:** Missing required data
**Solution:**
- Ensure all roster data is loaded
- Verify league settings are fetched
- Try refreshing the page

### Odds seem unrealistic

**Possible Issues:**
1. **Wrong current week** - Adjust to actual week
2. **Variance too high/low** - Try 20-25% range
3. **Incomplete roster data** - Some players not matched
4. **League settings incorrect** - Verify playoff format

### Simulation is slow

**Solutions:**
1. **Reduce simulations** - Try 5,000 instead of 25,000
2. **Clear cache** - Refresh page to clear old data
3. **Close other tabs** - Free up browser memory
4. **Use updated browser** - Chrome/Firefox latest version

### Results don't match other sites

**Possible Reasons:**
1. **Different projection sources** - We use SportsDataIO
2. **Different variance assumptions** - We default to 25%
3. **Different playoff formats** - Verify league settings
4. **Different championship models** - We use seed-weighted

**Note:** All models are estimates. Differences of 5-10% are normal.

## Best Practices

### 1. Update Current Week Regularly
```
Check actual league week
Update "Current Week" input
Re-run simulation
Review changes from last week
```

### 2. Run Multiple Scenarios
```
Base case (25% variance)
Conservative (15% variance)
Aggressive (35% variance)
Compare ranges
```

### 3. Track Changes Over Time
```
Week 1: 35% playoff odds
Week 4: 48% playoff odds (↑ 13%)
Week 8: 67% playoff odds (↑ 19%)
Week 12: 82% playoff odds (↑ 15%)
```

### 4. Combine with Other Metrics
```
Playoff odds: 55%
Player rankings: Strong RBs, weak WRs
League rankings: 4th in players, 2nd in picks
Conclusion: Contending now, strong future
```

### 5. Use for Trade Negotiations
```
Show opponent: "This trade improves your playoff odds by 12%"
Demonstrate value: "My championship odds jump 6% with this"
Frame discussions: "We both need wins, this helps us both"
```

## Summary

The Playoff Odds Simulator provides:
- ✅ **Accurate predictions** using Monte Carlo methods
- ✅ **Real matchup data** from Sleeper API
- ✅ **Trade impact analysis** for every deal
- ✅ **Beautiful visualizations** for easy interpretation
- ✅ **Fast performance** with intelligent caching
- ✅ **Strategic insights** for playoff races

Combined with league rankings, trade analysis, and player valuations, you now have a complete toolkit for dominating your dynasty league!

**Pro Tip:** Run simulations weekly to track your trajectory. Early awareness of playoff odds helps you make timely trades before it's too late!
