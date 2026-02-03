# Quick Start Guide

Get your Fantasy Football Trade Analyzer running in 5 minutes!

## 🚀 Fast Setup

### Option 1: Using the Run Script (Recommended)

```bash
# Make the script executable (Linux/Mac)
chmod +x run_app.sh

# Run the app
./run_app.sh
```

### Option 2: Manual Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
streamlit run app.py
```

The app will open automatically in your browser at `http://localhost:8501`

## 📝 Step-by-Step First Use

### 1. Get Your Sleeper League ID

1. Go to [sleeper.app](https://sleeper.app)
2. Open your league
3. Look at the URL: `https://sleeper.app/leagues/YOUR_LEAGUE_ID/team`
4. Copy the `YOUR_LEAGUE_ID` portion

### 2. Enter League ID

1. In the sidebar, paste your League ID
2. Click outside the input box
3. Wait for league data to load (5-10 seconds)

### 3. Select Your Team

1. Choose your team name from the dropdown
2. View your roster with enhanced valuations

### 4. Explore Features

**AI Trade Suggestions:**
- Automatically generated based on your team needs
- Shows potential gains/losses
- Considers positional balance

**Manual Trade Analyzer:**
- Enter custom trades
- Get instant fairness verdicts
- See detailed value breakdowns

**League Overview:**
- Power rankings
- Compare against other teams
- Identify trading partners

## 🎯 Demo Mode (No API Key Required)

The app works out-of-the-box with mock data:
- 200+ players with realistic projections
- All positions including IDP
- Full feature set available

**Demo limitations:**
- Synthetic data (not real NFL data)
- No historical trends
- Generic player details

## 🔑 Add Real Data (Optional)

For real NFL data, get a free SportsDataIO API key:

1. Sign up at [sportsdata.io](https://sportsdata.io)
2. Free tier: 1000 requests/month
3. Open `app.py`
4. Replace `API_KEY = "YOUR_SPORTSDATAIO_KEY_HERE"` with your key
5. Restart the app

**Benefits of real data:**
- Actual NFL projections
- Historical performance (3 years)
- Real player ages and injury status
- Team performance metrics
- Strength of schedule analysis

## 📊 Understanding the Analysis

### Player Valuations

Each player gets an "Adjusted Value" based on:

```
60% - Current projections (2026 season)
20% - Historical average (past 3 years)
10% - Team performance impact
5%  - Strength of schedule
5%  - Age & injury adjustments
```

### VORP (Value Over Replacement)

Shows how much better a player is than a "replacement level" player:
- QB: Top 12
- RB: Top 24
- WR: Top 30
- TE: Top 12
- IDP varies by position

Higher VORP = more valuable player

### Trade Fairness

Trades are evaluated as:
- ✅ **Fair**: Within ±5% value
- 🎉 **Great for You**: +10% or more
- ⚠️ **Unfavorable**: -10% or less
- ⚖️ **Slightly Imbalanced**: Between ±5-10%

## 🏆 Best Practices

### Finding Good Trades

1. **Check AI Suggestions First**
   - Pre-analyzed for mutual benefit
   - Based on roster construction
   - Considers positional needs

2. **Look for Complementary Needs**
   - Your strength = their weakness
   - Their strength = your weakness
   - Win-win scenarios

3. **Don't Overpay**
   - Aim for positive or neutral value
   - Consider injury risk and age
   - Think about playoffs

4. **Position Scarcity**
   - RBs and TEs are often scarce
   - May need to "overpay" slightly
   - Balance is key

### Using IDP Leagues

The analyzer fully supports IDP with:
- Tackles, sacks, interceptions
- Position-specific baselines
- Defensive player projections

**IDP Positions:**
- **DL** (Defensive Line): Prioritize sacks
- **LB** (Linebackers): High tackle volume
- **DB** (Defensive Backs): Interceptions + tackles

## 🔧 Troubleshooting

**"Error fetching Sleeper users"**
- Double-check your League ID
- Ensure the league is active
- Try refreshing the page

**"Using mock data" warning**
- This is normal without an API key
- All features still work
- Add API key for real data

**Players not showing up**
- Some players may not match between databases
- Fuzzy matching attempts to find closest match
- Very new players may be missing

**Slow loading**
- First load caches data (slower)
- Subsequent loads are faster
- API calls may take 10-30 seconds

## 💡 Pro Tips

1. **Compare Multiple Trades**
   - Use manual analyzer for variations
   - Try 2-for-1, 1-for-2 scenarios
   - Consider package deals

2. **Think Long-Term**
   - Age matters for ROS and beyond
   - Injury history compounds risk
   - Schedule gets easier/harder

3. **League Context Matters**
   - Are you competing now or rebuilding?
   - Do you need a specific position?
   - Who else might trade with you?

4. **Use Charts**
   - Position distribution shows balance
   - Power rankings show standing
   - Visual insights help decisions

5. **Re-analyze Weekly**
   - Projections change
   - Injuries happen
   - New opportunities emerge

## 📚 Next Steps

Once comfortable with basics:

1. **Customize Scoring** - Edit `SCORING_WEIGHTS` in app.py
2. **Adjust Baselines** - Match your league size
3. **Add ML Predictions** - Train models on historical data
4. **Export Analysis** - Save trade history and results
5. **Multi-League** - Analyze multiple leagues

## 🤝 Share Insights

Use the analysis to:
- Propose trades to league mates
- Justify your trade offers
- Counter-offer with data
- Build trade packages

## ❓ Common Questions

**Q: Does this work for dynasty leagues?**
A: Yes! Age adjustments help with dynasty valuation. Future versions will add explicit keeper/dynasty modes.

**Q: Can I use this for DFS?**
A: Not directly - this is designed for season-long leagues. But projections could inform DFS decisions.

**Q: How accurate are the projections?**
A: With real API data, projections are from SportsDataIO (used by NFL teams). No projection is perfect, but these are industry-standard.

**Q: Can I analyze trades that already happened?**
A: Yes! Use the manual analyzer to evaluate past trades and learn.

**Q: Does it work for other platforms (ESPN, Yahoo)?**
A: Currently only Sleeper API is integrated. Manual entry works for any platform.

## 🎓 Learn More

- Read `README_STREAMLIT.md` for detailed documentation
- Check `config_example.py` for customization options
- Review `app.py` code comments for technical details

---

**Ready to dominate your league? Let's analyze some trades! 🏈**
