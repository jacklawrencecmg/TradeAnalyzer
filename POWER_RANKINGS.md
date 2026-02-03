# Power Rankings Dashboard

## Overview

The Power Rankings Dashboard provides a comprehensive view of true team strength by combining multiple performance factors into a single, dynamic ranking system. Unlike simple roster value or standings, power rankings account for current form, playoff trajectory, and schedule difficulty to give you the complete picture.

## Features

### ⚡ **Dynamic Power Score Calculation**

Power rankings use a weighted formula that considers:
- **40% Roster Value** - Long-term roster strength
- **30% Playoff Odds** - Championship probability
- **20% Recent Performance** - Current form (last 4 weeks)
- **10% Strength of Schedule** - Difficulty adjustment

### 📊 **Interactive Visualizations**

Three comprehensive views:
1. **Rankings Table** - Current rankings with expandable team details
2. **Power Score Trends** - Line charts tracking score and rank over time
3. **Component Breakdown** - Stacked bar charts showing score composition

### 📈 **Historical Tracking**

- Automatic tracking of rankings week-over-week
- Rank change indicators (🔺 up, 🔻 down, ➖ no change)
- Score change deltas
- Visual trend lines across multiple weeks

### 🎯 **Strength of Schedule (SOS)**

- Past opponent strength analysis
- Future schedule difficulty projections
- Overall SOS ranking (1 = hardest schedule)
- Color-coded difficulty indicators

### 🔥 **Recent Form Tracking**

- Last 4 weeks performance analysis
- Points per game average
- Win-loss record
- Trend detection (📈 up, 📉 down, ➡️ stable)

## How It Works

### Power Score Formula

The power score is calculated using a weighted combination of normalized factors:

```
Power Score = (Roster × 0.40) + (Playoff Odds × 0.30) + (Recent Form × 0.20) + (SOS × 0.10)

Where:
- Roster = Normalized roster value (0-100 scale)
- Playoff Odds = (Playoff % × 0.7 + Championship % × 0.3)
- Recent Form = (Recent PPG × 0.6 + Recent Win % × 0.4), normalized
- SOS = Inverse of SOS rank, normalized (easier schedule = higher score)
```

### Component Details

#### 1. Roster Value (40% weight)

**What it measures:** Long-term roster strength based on player projections

**How it's calculated:**
- Uses SportsDataIO projections with all league adjustments
- Includes VORP (Value Over Replacement Player)
- Accounts for age adjustments
- Factors in injury status
- Normalized to 0-100 scale relative to best roster

**Why 40%:** Roster quality is the strongest predictor of long-term success

**Example:**
```
Team A: Roster value 2,500 pts
Team B: Roster value 2,000 pts
Max in league: 2,500 pts

Team A normalized: (2500/2500) × 100 = 100
Team B normalized: (2000/2500) × 100 = 80

Team A contribution: 100 × 0.40 = 40.0
Team B contribution: 80 × 0.40 = 32.0
```

#### 2. Playoff Odds (30% weight)

**What it measures:** Championship probability from Monte Carlo simulations

**How it's calculated:**
- Takes Playoff % from simulation (70% weight)
- Takes Championship % from simulation (30% weight)
- Combined score represents title trajectory

**Why 30%:** Win probability is highly predictive but volatile week-to-week

**Example:**
```
Team A: 85% playoff, 18% title
Team B: 45% playoff, 3% title

Team A score: (85 × 0.7 + 18 × 0.3) = 64.9
Team B score: (45 × 0.7 + 3 × 0.3) = 32.4

Team A contribution: 64.9 × 0.30 = 19.5
Team B contribution: 32.4 × 0.30 = 9.7
```

#### 3. Recent Performance (20% weight)

**What it measures:** Current form based on last 4 weeks

**How it's calculated:**
- Average points per game (60% weight)
- Win percentage (40% weight)
- Detects trend: up (improving), down (declining), stable
- Normalized to 0-100 scale

**Why 20%:** Recent form matters but shouldn't override long-term quality

**Example:**
```
Team A: Last 4 weeks: 125, 130, 128, 132 (3-1 record)
Team B: Last 4 weeks: 95, 100, 98, 102 (1-3 record)

Team A avg PPG: 128.75, Win %: 75%
Team A score: (128.75 × 0.6 + 75 × 0.4) = 107.25

Team B avg PPG: 98.75, Win %: 25%
Team B score: (98.75 × 0.6 + 25 × 0.4) = 69.25

Max recent: 107.25
Team A normalized: (107.25/107.25) × 100 = 100
Team B normalized: (69.25/107.25) × 100 = 64.6

Team A contribution: 100 × 0.20 = 20.0
Team B contribution: 64.6 × 0.20 = 12.9
```

#### 4. Strength of Schedule (10% weight)

**What it measures:** Difficulty of past and future opponents

**How it's calculated:**
- Average opponent roster value for past games
- Average opponent roster value for future games
- Weighted average of both
- Ranked 1 (hardest) to N (easiest)
- Inverted and normalized (easier schedule = bonus)

**Why 10%:** Schedule matters but less than team quality

**Example:**
```
12-team league
Team A: SOS Rank #2 (very hard schedule)
Team B: SOS Rank #10 (easy schedule)

Team A score: ((12 - 2 + 1) / 12) × 100 = 91.7
Team B score: ((12 - 10 + 1) / 12) × 100 = 25.0

Team A contribution: 91.7 × 0.10 = 9.2
Team B contribution: 25.0 × 0.10 = 2.5
```

### Strength of Schedule Calculation

**Past SOS:**
```
past_sos = average(opponent_roster_values for completed games)
```

**Future SOS:**
```
future_sos = average(opponent_roster_values for remaining games)
```

**Overall SOS:**
```
overall_sos = (past_sos × past_games + future_sos × future_games) / total_games
```

**SOS Ranking:**
Teams are ranked by overall_sos (higher value = harder schedule)

**Interpretation:**
- **Rank 1-4:** 🔴 Very hard schedule
- **Rank 5-8:** 🟡 Medium schedule
- **Rank 9+:** 🟢 Easy schedule

### Recent Form Trend Detection

Analyzes the last 4 weeks of scoring to detect trends:

```
first_half = weeks 1-2 of last 4
second_half = weeks 3-4 of last 4

avg_first = average(first_half points)
avg_second = average(second_half points)

if avg_second > avg_first × 1.05:
    trend = 'up' (📈)
elif avg_second < avg_first × 0.95:
    trend = 'down' (📉)
else:
    trend = 'stable' (➡️)
```

**5% threshold prevents noise from triggering trend changes**

### Historical Tracking

Power rankings are tracked week-over-week in session state:

**Storage format:**
```python
{
    'Week': 10,
    'Team': 'Championship Roster',
    'Rank': 2,
    'Power Score': 78.5
}
```

**Rank change calculation:**
```
Δ Rank = previous_rank - current_rank
Δ Score = current_score - previous_score

Positive Δ Rank = moved up (better)
Negative Δ Rank = moved down (worse)
```

## Using the Dashboard

### Location

Power Rankings appear immediately after Playoff Odds Simulator:
```
Playoff Odds Simulator
    ↓
⚡ Power Rankings ← YOU ARE HERE
    ↓
Trade Suggestions
```

### Prerequisites

**You must run the Playoff Odds Simulator first** because power rankings depend on:
- Playoff odds data
- Championship probability
- Team projections
- Matchup schedule

If you haven't run the simulator, you'll see:
```
⚡ Run the Playoff Odds Simulator above to unlock Power Rankings analysis.
```

### Your Team Dashboard

Four key metrics displayed at the top:

#### Your Rank
```
Example: #3 (🔺+2)

Interpretation:
- #3: Current power ranking (3rd best team)
- 🔺+2: Moved up 2 spots from last week

Delta colors:
- Green (🔺): Moved up (good)
- Red (🔻): Moved down (bad)
- Gray (➖): No change
```

#### Power Score
```
Example: 76.3 (+4.2)

Interpretation:
- 76.3: Current power score out of 100
- +4.2: Score increased by 4.2 points from last week

Higher score = better overall team strength
```

#### Recent Form
```
Example: 📈 125.3 PPG

Interpretation:
- 📈: Trending upward (improving)
- 125.3: Average points per game (last 4 weeks)

Trend indicators:
- 📈 Up: Improving performance
- 📉 Down: Declining performance
- ➡️ Stable: Consistent performance
```

#### Schedule
```
Example: Easy (#11)

Interpretation:
- Easy: Schedule difficulty
- #11: SOS rank (11th hardest out of 12)

Difficulty levels:
- Hard: Rank 1-4 (tough opponents)
- Medium: Rank 5-8 (average opponents)
- Easy: Rank 9+ (weak opponents)
```

### Tab 1: Rankings Table

#### Team Expandables

Each team is shown as an expandable card:

**Header format:**
```
#3 (🔺2) ⭐ Championship Roster - Score: 76.3 📈
```

Breaking it down:
- `#3`: Current rank
- `🔺2`: Moved up 2 spots
- `⭐`: Your team indicator
- `Championship Roster`: Team name
- `Score: 76.3`: Power score
- `📈`: Recent form trend

**Expanded view shows three columns:**

**Column 1: Roster & Odds**
```
Roster Value: 2,450
Playoff %: 87.3%
Title %: 18.2%
```

**Column 2: Recent Performance**
```
Last 4 Weeks: 3-1
Avg PPG: 125.3
Trend: 📈 Up
```

**Column 3: Schedule**
```
SOS Rank: 🟢 #11
Future SOS: 2,100
Power Score: 76.3
```

#### Detailed Rankings Table

Sortable table with all teams:

| Rank | Team | Power Score | Δ | Score Δ | Trend | Recent PPG | SOS |
|------|------|-------------|---|---------|-------|------------|-----|
| 1 | Elite Team | 82.5 | 0 | +1.2 | 📈 | 132.1 | #2 |
| 2 | Strong Team | 78.9 | +1 | +3.5 | ➡️ | 128.4 | #5 |
| 3 | ⭐ Your Team | 76.3 | +2 | +4.2 | 📈 | 125.3 | #11 |

**Click headers to sort:**
- Sort by Rank: See current hierarchy
- Sort by Power Score: Raw strength
- Sort by Δ: Biggest movers
- Sort by Trend: Hot/cold teams
- Sort by SOS: Schedule difficulty

### Tab 2: Power Score Trends

#### Power Score Progression Chart

**Line chart showing score over time:**
- X-axis: Week number
- Y-axis: Power score (0-100)
- Each team = one line
- Your team = thick bold line (opacity 1.0)
- Other teams = thin faint lines (opacity 0.3)

**Interactive features:**
- Hover for tooltips (Week, Team, Score, Rank)
- Click legend to toggle teams
- Zoom and pan enabled

**What to look for:**
- **Upward slope:** Team improving
- **Downward slope:** Team declining
- **Flat line:** Stable team
- **Crossing lines:** Rank changes
- **Volatility:** Inconsistent team

#### Rank Movement Chart

**Line chart showing rank over time:**
- X-axis: Week number
- Y-axis: Power rank (inverted - #1 at top)
- Each team = one line
- Your team = thick bold line

**Key difference from score chart:**
Rank is **relative** (you can improve but still drop if others improve more)

**What to look for:**
- **Moving up:** Improving relative to league
- **Moving down:** Falling behind league
- **Clusters:** Groups of similar-strength teams
- **Separation:** Clear tier breaks

#### Your Team's Journey

**Week-by-week metrics displayed as cards:**

```
Week 8         Week 9         Week 10
#5             #4 🔺+1        #3 🔺+1
72.1 pts       74.8 pts       76.3 pts
```

**Shows progression across recent weeks:**
- Current rank each week
- Rank change from previous week
- Power score each week

**Useful for:**
- Spotting trends early
- Understanding trajectory
- Validating trade impacts
- Season narrative

### Tab 3: Component Breakdown

#### Formula Display

Shows the weighted formula:
```
Power Score Formula:
- 40% Roster Value (long-term strength)
- 30% Playoff Odds (championship probability)
- 20% Recent Performance (current form)
- 10% Strength of Schedule (difficulty adjustment)
```

#### Component Breakdown Chart

**Stacked horizontal bar chart:**
- Y-axis: Teams (sorted by total score)
- X-axis: Power score contribution (0-100)
- Colors: One per component
- Bars: Stacked to show total
- Your team: Full opacity (others faded)

**Reading the chart:**

```
Team A: [████Roster████][██Playoff██][█Recent█][▪SOS▪]
        (40.0)          (25.0)       (15.0)    (8.0) = 88.0

Team B: [███Roster███][████Playoff████][██Recent██][▪SOS▪]
        (32.0)       (28.0)           (18.0)     (5.0) = 83.0
```

**Insights to extract:**
- **Wide roster bar:** Elite roster
- **Wide playoff bar:** Win-now mode
- **Wide recent bar:** Hot team
- **Narrow recent bar:** Cold team
- **Different patterns:** Team archetypes

**Example interpretations:**

**Team A: Large Roster, Small Recent**
```
[████████Roster████████][██Playoff██][▪Recent▪][▪SOS▪]
```
- **Archetype:** Underperforming contender
- **Situation:** Great roster, struggling recently
- **Opportunity:** Buy low if they panic

**Team B: Small Roster, Large Recent**
```
[██Roster██][█Playoff█][████████Recent████████][▪SOS▪]
```
- **Archetype:** Overperforming underdog
- **Situation:** Weak roster, hot streak
- **Risk:** Sell high before regression

**Team C: Balanced**
```
[████Roster████][███Playoff███][██Recent██][█SOS█]
```
- **Archetype:** True contender
- **Situation:** Strong in all areas
- **Assessment:** Legitimate threat

#### Your Team's Component Analysis

**Four metric cards showing exact contributions:**

```
Roster (40%)          Playoff Odds (30%)
38.2                  21.5

Recent Form (20%)     Schedule (10%)
16.1                  7.5
```

**What each metric means:**

**Roster contribution:**
- High (35-40): Elite roster, contender strength
- Medium (25-35): Solid roster, playoff team
- Low (<25): Weak roster, rebuilding

**Playoff Odds contribution:**
- High (25-30): Championship favorite
- Medium (15-25): Playoff contender
- Low (<15): Longshot or eliminated

**Recent Form contribution:**
- High (15-20): Hot streak, trending up
- Medium (10-15): Steady performance
- Low (<10): Cold streak, struggling

**Schedule contribution:**
- High (8-10): Easy schedule, favorable
- Medium (5-8): Average schedule
- Low (<5): Hard schedule, uphill battle

## Strategic Applications

### Identifying Buy-Low Candidates

**Look for teams with:**
- High roster value contribution (35-40)
- Low recent form contribution (<10)
- Downward trend (📉)
- Falling rank (🔻)

**Strategy:**
These teams have talent but are underperforming. Owners may panic-sell elite players at discount.

**Example:**
```
Team X: Rank #7 (🔻-3)
- Roster: 38.5 (strong)
- Recent Form: 8.2 (struggling)
- Trend: 📉 Down

Action: Target their RB1/WR1 before they rebound
```

### Identifying Sell-High Candidates

**Look for teams with:**
- Low roster value contribution (<25)
- High recent form contribution (>15)
- Upward trend (📈)
- Rising rank (🔺)

**Strategy:**
These teams are overperforming. Sell players before inevitable regression.

**Example:**
```
Your Team: Rank #3 (🔺+5)
- Roster: 28.3 (mediocre)
- Recent Form: 19.1 (hot)
- Trend: 📈 Up

Action: Sell depth pieces while value is inflated
```

### Evaluating True Contenders

**Look for teams with:**
- Balanced components (all >20)
- Stable or rising rank
- High playoff odds contribution (>25)
- Easy remaining schedule (🟢)

**Characteristics of TRUE contenders:**
```
Elite Team:
- Roster: 39.5 (top talent)
- Playoff Odds: 27.8 (high probability)
- Recent Form: 16.2 (consistent)
- Schedule: 8.5 (favorable)
- Total: 92.0

Rank: #1, Trend: 📈 Up
```

**Characteristics of FALSE contenders (pretenders):**
```
Lucky Team:
- Roster: 24.2 (weak)
- Playoff Odds: 18.5 (moderate)
- Recent Form: 18.9 (very hot)
- Schedule: 9.2 (very easy)
- Total: 70.8

Rank: #4, Trend: 📈 Up (but unsustainable)
```

### Planning Trade Timing

**Best times to make moves:**

**Week 6-8 (Early-Mid Season):**
- Rankings starting to stabilize
- Panic from slow starters
- Opportunity to buy low

**Week 10-12 (Trade Deadline):**
- Clear contenders vs rebuilders
- Maximum trade leverage
- Use power rankings to justify offers

**Strategy by ranking:**

**Rank 1-3 (Championship Favorite):**
- Consolidate: 2-for-1, 3-for-2 trades
- Upgrade starters
- Target bye week help
- Don't sacrifice future unless odds >20%

**Rank 4-6 (Bubble Team):**
- Targeted upgrades
- Address weaknesses shown in components
- Balance present vs future
- Consider schedule difficulty

**Rank 7-9 (Fringe Contender):**
- Carefully evaluate ceiling
- Is 15%+ title odds realistic?
- If no: Start pivoting to next year
- If yes: Make calculated push

**Rank 10-12 (Rebuilder):**
- Full sell mode
- Target 2026+ picks
- Acquire young players (<26)
- Exit before market crashes

### Using Component Breakdown

**Strong Roster, Weak Form:**
```
Action: Stay patient, variance evens out
Message: "Don't panic sell, regression to mean coming"
```

**Weak Roster, Strong Form:**
```
Action: Sell immediately, capitalize on luck
Message: "Sell high while market overvalues"
```

**Strong Playoff Odds, Weak Recent:**
```
Action: Investigate cause (injuries, matchups?)
Message: "One bad month doesn't sink season"
```

**Weak Playoff Odds, Strong Recent:**
```
Action: Not a contender despite hot streak
Message: "Don't buy false hope"
```

### Leveraging Schedule Data

**Easy remaining schedule (🟢):**
- **If contending:** Boost playoff odds
- **If rebuilding:** Inflates value, good time to sell
- **In trades:** Discount opponent's hot streak

**Hard remaining schedule (🔴):**
- **If contending:** Make moves now, harder path ahead
- **If rebuilding:** Accelerate teardown
- **In trades:** Target teams who may crater

**Schedule strength insight:**

Teams with hard past schedules who still rank high are truly elite (battle-tested).

Teams with easy past schedules may be paper tigers (beware).

## Interpreting Rank Changes

### Big Movers (Δ ≥ 3 spots)

**Moving Up (🔺🔺🔺):**

**Possible causes:**
- Hot streak (4-0 last 4 weeks)
- Key acquisitions via trade
- Returning from injuries
- Weak schedule paying off

**What to do:**
- If it's you: Consider selling high on depth
- If it's not: Evaluate sustainability
- Check component breakdown for cause

**Moving Down (🔻🔻🔻):**

**Possible causes:**
- Cold streak (0-4 last 4 weeks)
- Injuries to key players
- Tough schedule stretch
- Lost key trade

**What to do:**
- If it's you: Don't panic, check components
- If it's not: Buy-low opportunity?
- Assess if decline is temporary or permanent

### Small Movers (Δ = 1-2 spots)

**Normal weekly variance:**
- One good/bad week
- Opponent difficulty changes
- Small simulation variance

**Usually not actionable:**
Wait for clearer trends before making moves

### No Movement (Δ = 0)

**Stable team:**
- Performance matches expectations
- Roster quality unchanged
- Schedule difficulty average

**Interpretation:**
- If ranked high: Consistent contender
- If ranked low: Consistently weak
- Confirms current trajectory

## Advanced Insights

### Power Score Volatility

**Low volatility (score changes <5 per week):**
- Consistent team
- Predictable output
- Reliable for playoffs
- Good trade target if strong

**High volatility (score changes >10 per week):**
- Boom/bust team
- Unpredictable
- Risky playoff team
- Avoid if possible

**Measure volatility:**
Look at score progression chart for smoothness

### Rank Stability

**Stable rank (±1 for 4+ weeks):**
- True power level identified
- Market has correct valuation
- Hard to buy low or sell high

**Volatile rank (±3+ each week):**
- Power level uncertain
- Market confusion
- Trade opportunity

### Correlation Analysis

**High correlation between components:**
- All components moving same direction
- Team on clear trajectory
- Easy to evaluate

**Low correlation between components:**
- Mixed signals (good roster, bad form)
- Harder to evaluate
- Deeper analysis needed

### Historical Context

**Compare current vs peak/trough:**

```
Your Team:
Current: #3 (76.3 pts)
Peak: #2 (79.1 pts) in Week 8
Trough: #7 (68.2 pts) in Week 5

Analysis: Trending toward peak again
```

**Season arc patterns:**

**Contender Arc:**
```
Start: #8 → Mid: #3 → Current: #2
Pattern: Steady improvement
Outlook: Championship threat
```

**Pretender Arc:**
```
Start: #3 → Mid: #5 → Current: #8
Pattern: Steady decline
Outlook: Regression underway
```

**Volatile Arc:**
```
Start: #7 → Mid: #2 → Current: #6
Pattern: Boom/bust swings
Outlook: Unreliable
```

## Tips & Best Practices

### 1. Run Simulations Weekly

**Why:**
Power rankings update based on latest performance and playoff odds

**When:**
After each week's games complete

**How:**
1. Update "Current Week" in Playoff Odds Simulator
2. Run simulation
3. Review power rankings changes
4. Track trends

### 2. Focus on Trends, Not Single Week

**Don't overreact to:**
- One week rank change
- Small score fluctuations
- Isolated bad matchup

**Do pay attention to:**
- 3+ week trends
- Multiple components declining
- Large rank changes (±3+)

### 3. Use Component Breakdown

**Always check components when:**
- Evaluating trade targets
- Assessing your team
- Making lineup decisions
- Planning strategy

**Components reveal true situation:**
- Strong roster + weak form = temporary dip
- Weak roster + strong form = unsustainable
- All strong = legitimate contender
- All weak = full rebuild

### 4. Compare vs Expectations

**Ask yourself:**
- Should I be ranked higher/lower?
- Do rankings match my perception?
- What's different than expected?

**Gaps between expectation and reality = opportunities**

### 5. Cross-Reference with Other Tools

**Power Rankings + Playoff Odds:**
Check if rank aligns with playoff probability

**Power Rankings + League Rankings:**
Does power rank match overall roster value rank?

**Power Rankings + Trade Analyzer:**
Use rank to evaluate trade partner strength

### 6. Schedule Awareness

**Check SOS when:**
- Evaluating playoff odds
- Timing trades
- Assessing hot/cold streaks

**Easy schedule coming up:**
- Buy teams before they heat up
- Hold if it's you

**Hard schedule coming up:**
- Sell before the crash
- Brace for impact if it's you

### 7. Track History

**Benefits of multi-week tracking:**
- See long-term trends
- Validate strategies
- Learn team patterns
- Improve future decisions

**Review journey tab:**
Shows your progression visually

### 8. Share with League

**Use power rankings in negotiations:**

```
"My team is ranked #2 in power rankings with an 82% playoff chance.
Your team is #9 with a 15% chance. This trade helps us both - I get
win-now help, you get future value."
```

**Data-driven arguments are more persuasive**

## Troubleshooting

### Rankings Seem Off

**Possible causes:**
1. Haven't run playoff odds simulator
2. Wrong current week set
3. Recent matchups not in system
4. Unusual variance in recent games

**Solutions:**
- Re-run playoff odds with correct week
- Verify matchup data loaded
- Check if injuries affecting projections
- Review component breakdown for anomalies

### No Historical Data

**Cause:**
First time running rankings, or session cleared

**Solution:**
Run rankings multiple weeks to build history. Session state persists in browser.

**Note:**
History stored in browser, not database. Clear cache = lose history.

### Your Team Not Highlighted

**Cause:**
Team name mismatch between selection and rankings

**Solution:**
Verify correct team selected in dropdown. Rankings use exact name match.

### Trend Indicators Not Accurate

**Cause:**
Not enough games in recent period (need 4+ weeks)

**Solution:**
Rankings work best after week 4+. Early season trends less reliable.

### SOS Ranks Surprising

**Possible reasons:**
- Actual opponent strength differs from perception
- Schedule front-loaded or back-loaded
- Recent trades changed opponent rosters

**Validation:**
Check "Future SOS" value to see objective opponent strength measure

## FAQ

**Q: How often should I check power rankings?**
A: Weekly after games complete. More frequent checking doesn't add value.

**Q: Which is more important: power rank or playoff odds?**
A: Different purposes. Playoff odds = probability. Power rank = overall strength. Both matter.

**Q: My rank is low but playoff odds are high. Why?**
A: Possible reasons: easy schedule, lucky record, weak league. Check components.

**Q: Should I trade based on power rankings alone?**
A: No. Use rankings as ONE input along with roster fit, picks, age, etc.

**Q: Can power rankings predict playoffs?**
A: Yes, better than just wins or roster value alone. But not perfect - variance exists.

**Q: What's a good power score?**
A: 80+ = elite, 70-80 = strong, 60-70 = average, <60 = weak. Relative to your league.

**Q: Do power rankings account for injuries?**
A: Yes, indirectly. Injured players have reduced projections, lowering roster value.

**Q: How far back is historical data stored?**
A: All weeks in current browser session. Clears if you clear browser data.

**Q: Can I export power rankings data?**
A: Not currently, but you can screenshot or manually record key metrics.

**Q: Why don't rankings match my gut feeling?**
A: Data often contradicts intuition. Check components to understand the gap.

## Summary

The Power Rankings Dashboard provides a sophisticated, multi-factor view of team strength:

✅ **40% Roster Value** - Long-term foundation
✅ **30% Playoff Odds** - Win probability
✅ **20% Recent Performance** - Current form
✅ **10% Strength of Schedule** - Difficulty adjustment

Combined with **historical tracking**, **trend visualization**, and **component breakdown**, you gain unprecedented insight into your league's true hierarchy.

Use power rankings to:
- Identify buy-low and sell-high opportunities
- Time trades optimally
- Evaluate your championship odds
- Make data-driven decisions

Remember: **Ranks are descriptive, not prescriptive**. They show current state but don't dictate actions. Use them as one tool in your fantasy football arsenal, alongside playoff odds, trade analysis, and your own judgment.

---

**Pro Tip:** The most valuable insight comes from comparing power rank to market perception. If your league overvalues a team with low power rank, exploit that gap!
