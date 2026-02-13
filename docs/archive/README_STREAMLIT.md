# Ultimate Fantasy Football Trade Analyzer

An advanced fantasy football trade analysis tool with IDP support, historical data analysis, and comprehensive trade evaluation.

## Features

### 🏈 Core Functionality
- **IDP Support**: Full support for Individual Defensive Players (DL, LB, DB) with defensive stats
- **Historical Analysis**: 3-5 year trend analysis for player performance
- **Multi-Factor Valuation**: Enhanced VORP calculations with:
  - 60% current season projections
  - 20% historical performance
  - 10% team performance impact
  - 5% strength of schedule
  - 5% age and injury adjustments

### 📥 League Integration
- **Sleeper API**: Import leagues directly from Sleeper
- **Automatic Mapping**: Roster and owner mapping
- **Player Database**: Comprehensive NFL player data

### 💡 Analysis Tools
- **AI Trade Suggestions**: Get 3-5 AI-generated trade suggestions based on team needs
- **Manual Trade Analyzer**: Evaluate custom trades with detailed breakdowns
- **Roster Analysis**: Identify strengths and weaknesses by position
- **League Power Rankings**: Compare your team against the league

### 📊 Visualizations
- Position value distribution charts
- League power rankings
- Detailed player statistics tables

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. (Optional) Add your SportsDataIO API key:
   - Open `app.py`
   - Replace `API_KEY = "YOUR_SPORTSDATAIO_KEY_HERE"` with your actual key
   - Get an API key at: https://sportsdata.io/

## Usage

1. Run the Streamlit app:
```bash
streamlit run app.py
```

2. Enter your Sleeper League ID in the sidebar

3. Select your team from the dropdown

4. Explore:
   - View your roster with enhanced valuations
   - Check AI trade suggestions
   - Analyze custom trades manually
   - Compare against league power rankings

## How It Works

### Enhanced Valuation Formula

Each player receives an adjusted value based on:

```
Adjusted Value = (
  Base Projection × 0.60 +
  Historical Avg × 0.20 +
  Team Performance × 0.10 +
  Matchup SOS × 0.05
) × Age Factor × Injury Factor
```

**Age Adjustments:**
- Under 25: 1.0x (baseline)
- 25-27: 1.05x (prime years)
- 28-29: 1.0x
- 30-31: 0.9x (slight decline)
- 32+: 0.8x (significant risk)

**Injury Adjustments:**
- Healthy/Probable: 1.0x
- Questionable/Doubtful: 0.85x
- Out/IR: 0.6x

### VORP Calculation

Value Over Replacement Player (VORP) uses position-specific baselines:
- QB: Top 12
- RB: Top 24
- WR: Top 30
- TE: Top 12
- K: Top 12
- DL/LB/DB: Top 24-30

Players are compared against the replacement-level player at their position.

### Trade Suggestions

The AI analyzes:
1. Your roster strengths and weaknesses
2. Other teams' complementary needs
3. Value fairness (within 30 points)
4. Minimum gain threshold (10+ points ROS)

Suggestions prioritize trades that:
- Address your weaknesses
- Trade from your strengths
- Provide mutual benefit
- Have realistic value alignment

## Data Sources

### With SportsDataIO API Key:
- Player projections and stats
- Historical game data (3 years)
- Player details (age, injury status)
- Team performance metrics
- NFL schedules for matchup analysis

### Without API Key (Demo Mode):
- Mock projections for 200+ players
- Simulated team stats
- Representative player details
- All features work with synthetic data

## Extension Ideas

### Machine Learning
Add predictive models using scikit-learn:
```python
from sklearn.ensemble import RandomForestRegressor

# Train on historical data
model = RandomForestRegressor()
model.fit(historical_features, actual_points)

# Enhance projections
enhanced_projection = model.predict(current_features)
```

### Custom Scoring
Modify `SCORING_WEIGHTS` in `app.py`:
```python
SCORING_WEIGHTS = {
    'projections': 0.50,  # Reduce projection weight
    'historical': 0.30,   # Increase historical weight
    'team_performance': 0.10,
    'matchup_sos': 0.05,
    'age_injury': 0.05
}
```

### Advanced Metrics
Add snap count and usage data:
```python
def calculate_usage_factor(snap_percentage, target_share):
    if snap_percentage > 80 and target_share > 25:
        return 1.15  # High usage boost
    elif snap_percentage < 50:
        return 0.85  # Limited role penalty
    return 1.0
```

### Keeper/Dynasty Mode
Add long-term value calculations:
```python
def calculate_dynasty_value(player_age, current_value):
    years_left = max(0, 34 - player_age)
    decay_rate = 0.95  # 5% annual decline

    total_value = sum(
        current_value * (decay_rate ** year)
        for year in range(years_left)
    )
    return total_value
```

## Troubleshooting

**Issue: "Error fetching Sleeper users"**
- Verify your League ID is correct
- Check internet connection
- Ensure Sleeper API is accessible

**Issue: Mock data being used**
- Add your SportsDataIO API key in `app.py`
- Verify the API key is valid
- Check API rate limits

**Issue: Players not matching**
- Fuzzy matching may miss some players
- Check player name variations
- Manual matching may be needed for some players

## Technical Architecture

```
app.py
├── API Integration Layer
│   ├── Sleeper API (league data)
│   ├── SportsDataIO API (stats/projections)
│   └── Mock Data Generators (fallback)
│
├── Data Processing Layer
│   ├── Enhanced Valuation Engine
│   ├── VORP Calculator
│   └── Historical Analysis
│
├── Analysis Layer
│   ├── Roster Strength Analyzer
│   ├── Trade Suggestion Engine
│   └── Trade Evaluator
│
└── Presentation Layer
    ├── Streamlit UI
    ├── Altair Charts
    └── Interactive Tables
```

## License

This is a demonstration project for fantasy football analysis. Use at your own discretion.

## Credits

Built with:
- Streamlit
- Pandas
- Altair
- FuzzyWuzzy
- Sleeper API
- SportsDataIO API
