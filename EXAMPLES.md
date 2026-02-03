# Usage Examples

Real-world scenarios and examples for the Fantasy Football Trade Analyzer.

## 📖 Table of Contents

1. [Basic League Analysis](#basic-league-analysis)
2. [Finding Trade Partners](#finding-trade-partners)
3. [Evaluating Specific Trades](#evaluating-specific-trades)
4. [IDP League Analysis](#idp-league-analysis)
5. [Advanced Scenarios](#advanced-scenarios)

---

## Basic League Analysis

### Scenario 1: First Time Setup

**Goal:** Import your league and analyze your roster

**Steps:**
1. Get your Sleeper League ID: `987654321`
2. Enter it in the sidebar
3. Select your team: "Team Thunder"

**Expected Results:**
```
Your Roster: Team Thunder
├── QB: Patrick Mahomes (285.3 pts)
├── RB: Christian McCaffrey (245.8 pts)
├── RB: Josh Jacobs (198.4 pts)
├── WR: Tyreek Hill (234.6 pts)
├── WR: CeeDee Lamb (228.3 pts)
└── TE: Travis Kelce (165.2 pts)

Position Analysis:
QB: Strong 💪 (1 player, avg 285.3)
RB: Average 👍 (2 players, avg 222.1)
WR: Strong 💪 (3 players, avg 231.4)
TE: Weak ⚠️ (1 player, avg 165.2)
```

**Insights:**
- Strong at QB and WR
- Could use RB depth
- TE is a weakness if Kelce gets injured

---

## Finding Trade Partners

### Scenario 2: Using AI Suggestions

**Your Situation:**
- Deep at WR (5 startable players)
- Weak at RB (only 2 starters)
- Mid-season, fighting for playoffs

**AI Suggestion #1:**
```
Trade with: Team Lightning
Rationale: Upgrade RB by trading surplus WR

You Give:
- Amari Cooper (WR) - 178.5 pts

You Receive:
- Aaron Jones (RB) - 192.3 pts

Net Gain: +13.8 points ROS
Verdict: ✅ Good for both teams
```

**Why This Works:**
- You have 5 WRs, losing one doesn't hurt
- Aaron Jones fills your RB2 need
- Team Lightning is weak at WR and deep at RB
- Fair value exchange (+13.8 pts is meaningful but not lopsided)

**AI Suggestion #2:**
```
Trade with: Team Storm
Rationale: Address TE weakness

You Give:
- Chris Olave (WR) - 168.2 pts
- Pat Freiermuth (TE) - 98.4 pts

You Receive:
- Travis Etienne (RB) - 185.6 pts
- Kyle Pitts (TE) - 125.8 pts

Net Gain: +44.8 points ROS
Verdict: 🎉 Great Deal
```

**Why This Works:**
- 2-for-2 package deal
- Upgrades both RB and TE
- You're giving WR depth (which you have)
- Significant point gain

---

## Evaluating Specific Trades

### Scenario 3: Someone Offers You a Trade

**The Offer:**
```
You Give: Justin Jefferson (WR) - 256.8 pts
You Receive: Saquon Barkley (RB) - 228.4 pts
```

**Manual Analysis:**

1. Enter Jefferson in "You Give"
2. Enter Barkley in "You Receive"
3. Click "Analyze Trade"

**Results:**
```
⚠️ Slightly Unfavorable

You Give: 256.8 pts
You Receive: 228.4 pts
Net Change: -28.4 pts (-11.1%)

Breakdown:
Justin Jefferson (WR):
- Base Projection: 1,650 rec yards, 12 TDs
- Age Factor: 1.05 (prime years, age 26)
- Injury Factor: 1.0 (healthy)
- Team Factor: 1.05 (strong offense)
- Adjusted Value: 256.8

Saquon Barkley (RB):
- Base Projection: 1,450 rush yards, 11 TDs
- Age Factor: 0.95 (age 28, slight decline)
- Injury Factor: 0.85 (injury history)
- Team Factor: 1.0 (average offense)
- Adjusted Value: 228.4
```

**Decision:** Counter-offer or decline
- You're losing 28 points in value
- Jefferson is younger and safer
- Unless you're desperate at RB, ask for more

**Counter-Offer:**
```
You Give: Justin Jefferson (WR) - 256.8 pts
You Receive:
- Saquon Barkley (RB) - 228.4 pts
- Tyler Lockett (WR) - 145.2 pts

Total Received: 373.6 pts
Net Change: +116.8 pts (+45.5%)
Verdict: 🎉 Great for You
```

---

## IDP League Analysis

### Scenario 4: Trading Defensive Players

**Your IDP Roster:**
```
DL: Micah Parsons (125.8 pts) - Strong
DL: Myles Garrett (112.4 pts) - Strong
LB: Fred Warner (138.2 pts) - Strong
LB: Roquan Smith (128.6 pts) - Strong
LB: Bobby Wagner (95.4 pts) - Weak
DB: Jessie Bates (98.7 pts) - Average
DB: Justin Simmons (92.3 pts) - Average
```

**Position Analysis:**
```
DL: Strong 💪 (Avg: 119.1 pts)
LB: Average 👍 (Avg: 120.7 pts, but Bobby Wagner drags down)
DB: Weak ⚠️ (Avg: 95.5 pts)
```

**AI Suggestion:**
```
Trade with: Team Blitz
Rationale: Upgrade DB by trading surplus LB

You Give:
- Bobby Wagner (LB) - 95.4 pts

You Receive:
- Derwin James (DB) - 108.6 pts

Net Gain: +13.2 points ROS
```

**Why This Works:**
- You have 3 LBs, Warner and Smith are starters
- Wagner is your bench/bye week player
- Derwin James is a top-5 DB
- Team Blitz is thin at LB

**IDP Scoring Breakdown:**
```
Bobby Wagner:
- Tackles: 120 (120 pts)
- Assists: 40 (20 pts)
- Sacks: 2 (4 pts)
- Total: 144 pts → Adjusted: 95.4

Derwin James:
- Tackles: 95 (95 pts)
- Assists: 35 (17.5 pts)
- Sacks: 3.5 (7 pts)
- INTs: 4 (12 pts)
- Pass Def: 10 (10 pts)
- Total: 141.5 pts → Adjusted: 108.6
```

---

## Advanced Scenarios

### Scenario 5: 3-Team Trade Analysis

**The Proposal:**
```
You Give: Davante Adams (WR) - 218.4 pts
You Receive: Josh Allen (QB) - 295.7 pts

Team B Gives: Josh Allen (QB) - 295.7 pts
Team B Receives: Derrick Henry (RB) - 212.8 pts

Team C Gives: Derrick Henry (RB) - 212.8 pts
Team C Receives: Davante Adams (WR) - 218.4 pts
```

**Analysis for You:**
```
Current QB: Dak Prescott - 248.2 pts
Net QB Upgrade: +47.5 pts

Current WR2: Davante Adams - 218.4 pts
Replacement WR2: Garrett Wilson - 165.8 pts
WR Downgrade: -52.6 pts

Total Impact: -5.1 pts

Verdict: ⚖️ Slightly Unfavorable (but depends on roster construction)
```

**Deeper Dive:**
- If you're weak at QB and deep at WR, this could work
- Check your WR depth before accepting
- Consider asking Team C to throw in a WR3

---

### Scenario 6: Buy Low on Injured Player

**Situation:** Star RB is out 4 weeks with injury

**The Player:**
```
Jonathan Taylor (RB)
- Pre-Injury Value: 245.8 pts (12 games)
- Current Asking Price: ~180 pts (perceived value)
- Post-Return Value: ~195 pts (8 games)

Injury Adjustment: -15% during recovery weeks
Age: 25 (prime)
Team: Strong offense
```

**Your Offer:**
```
You Give:
- DeAndre Hopkins (WR) - 156.4 pts
- Darrell Henderson (RB) - 118.2 pts
Total: 274.6 pts

You Receive:
- Jonathan Taylor (RB) - 195.0 pts (post-injury adjusted)
```

**Analysis:**
```
Immediate Impact: -79.6 pts (during injury)
ROS Impact (8 games left): -79.6 pts
Total Season Impact: -79.6 pts

BUT: Next season value
- Taylor: 245+ pts (healthy)
- Hopkins: 145 pts (age 32)
- Henderson: 95 pts (backup role)

Dynasty/Keeper Value: +5 pts/year for 3 years
```

**Decision Factors:**
- Are you contending THIS year? (Don't do it)
- Building for next year? (Great buy-low)
- Keeper league? (Excellent value)
- Can you survive 4 weeks? (Need depth)

---

### Scenario 7: Selling High

**Situation:** Your RB has 3 great games, value is inflated

**The Player:**
```
James Cook (RB)
- Current 3-Game Avg: 25 pts/game
- Season Projection: 185 pts
- Perceived Value: ~220 pts (inflated)
- True Value: ~175 pts (regression expected)

Factors:
- Easy schedule last 3 games (ranks 28, 30, 32)
- Upcoming schedule harder (ranks 5, 8, 12)
- TD rate unsustainable (3.2 TDs/game vs. 1.2 career)
```

**Your Strategy:**
```
Sell at 220 pts value (perceived)
Target players valued at 200-210 pts (true)
Capture 15-20 pts of excess value
```

**Proposed Trade:**
```
You Give: James Cook (RB) - 220 pts (perceived) / 175 pts (true)
You Receive: DK Metcalf (WR) - 205 pts (true value)

Net Change (perceived): -15 pts
Net Change (actual): +30 pts

Verdict: 🎉 Sell High Success
```

---

### Scenario 8: Playoff Push Trade

**Week 10, Your Situation:**
```
Current Record: 6-4 (playoffs likely)
Position: 4th place (top 6 make playoffs)
Strength: Strong RB corps
Weakness: Inconsistent WR2
```

**Strategy:** Trade future value for immediate impact

**The Trade:**
```
You Give:
- Breece Hall (RB) - 215.4 pts ROS
- 2027 2nd Round Pick - ~80 pts value

You Receive:
- Tyreek Hill (WR) - 234.6 pts ROS
```

**Win-Now Analysis:**
```
Current WR2: Jerry Jeudy - 148.2 pts
Upgrade to Hill: +86.4 pts

Current RB2: Breece Hall - 215.4 pts
Replacement (James Conner): -35.2 pts

Net Impact: +51.2 pts over 7 weeks
= +7.3 pts/week average

Playoff Impact: +21.9 pts over 3 playoff weeks
```

**Championship Probability:**
```
Before Trade: 14% championship probability
After Trade: 24% championship probability
Difference: +10% (worth the cost)
```

---

## 💡 Pro Tips From Examples

### Timing Matters
- **Buy Low:** After bad games, injuries (if not serious)
- **Sell High:** After great games, easy schedule stretch
- **Playoffs:** Week 10-11 are prime trade deadline

### Context is King
- Contending? Trade picks/youth for veterans
- Rebuilding? Sell vets for picks/youth
- Middle? Stay patient or buy low

### Use the Numbers
- Trust the adjusted values
- Don't ignore age/injury factors
- SOS matters for playoffs

### Negotiation Tactics
1. Start with AI suggestions (fair baseline)
2. Add sweeteners (bench players, picks)
3. Package deals (2-for-2, 3-for-2)
4. Create urgency (other offers, waiver wire)

### Red Flags
- Trades that seem "too good" (check injury news)
- Giving up multiple starters (depth matters)
- Trading draft picks in redraft (hold value)
- Panic trades after one bad week

---

## 📊 Summary

The Trade Analyzer excels at:
- ✅ Quantifying player value objectively
- ✅ Identifying roster imbalances
- ✅ Finding win-win trades
- ✅ Factoring in age, injury, matchups
- ✅ Supporting IDP leagues

Use it to:
- Make data-driven decisions
- Justify offers to league mates
- Avoid bad trades
- Win your championship! 🏆
