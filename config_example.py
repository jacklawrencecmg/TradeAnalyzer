"""
Configuration Example for Fantasy Football Trade Analyzer
Copy this file to config.py and add your actual API keys.
"""

# SportsDataIO API Key
# Get your key at: https://sportsdata.io/
# Free tier includes: 1000 requests/month, updated daily
SPORTSDATAIO_API_KEY = "YOUR_SPORTSDATAIO_KEY_HERE"

# Scoring Configuration
# Adjust these weights to match your league's scoring system
CUSTOM_SCORING_WEIGHTS = {
    'projections': 0.60,      # Current season projections
    'historical': 0.20,       # Historical performance (3-year avg)
    'team_performance': 0.10, # Team offense/defense rankings
    'matchup_sos': 0.05,      # Strength of schedule
    'age_injury': 0.05        # Age and injury adjustments
}

# Position Baselines for VORP Calculation
# These represent the replacement-level rank for each position
CUSTOM_POSITION_BASELINES = {
    'QB': 12,   # 1 QB league (12 starters)
    'RB': 24,   # Top 24 RBs
    'WR': 30,   # Top 30 WRs
    'TE': 12,   # Top 12 TEs
    'K': 12,    # Top 12 Kickers
    'DEF': 12,  # Top 12 Defenses
    # IDP Positions
    'DL': 24,   # Defensive Line
    'LB': 30,   # Linebackers
    'DB': 24    # Defensive Backs
}

# Superflex League Settings
# Set to True if your league uses Superflex (QB in FLEX spot)
SUPERFLEX_LEAGUE = False

# PPR Settings
# Options: 'standard' (0 PPR), 'half' (0.5 PPR), 'full' (1 PPR)
PPR_SCORING = 'full'

# IDP Scoring Multipliers
# Adjust these if your league has custom IDP scoring
IDP_SCORING_MULTIPLIERS = {
    'tackle': 1.0,
    'assist': 0.5,
    'sack': 2.0,
    'interception': 3.0,
    'forced_fumble': 2.0,
    'fumble_recovery': 2.0,
    'defensive_td': 6.0,
    'pass_defended': 1.0,
    'safety': 2.0
}

# Trade Fairness Thresholds
TRADE_THRESHOLDS = {
    'fair_range': 5,          # ±5% is considered fair
    'good_deal': 10,          # >10% is a good deal
    'great_deal': 20,         # >20% is a great deal
    'unfavorable': -10,       # <-10% is unfavorable
    'very_unfavorable': -20   # <-20% is very unfavorable
}

# Age Adjustment Curve
# Customize how age affects player valuation
AGE_ADJUSTMENTS = {
    'rookie_discount': 0.90,   # <23 years old
    'breakout_age': 0.95,      # 23-24 years old
    'prime_start': 1.05,       # 25-27 years old (peak)
    'prime_end': 1.00,         # 28-29 years old
    'decline_start': 0.90,     # 30-31 years old
    'decline_steep': 0.80,     # 32+ years old
    'rb_age_penalty': 0.85     # Extra penalty for RBs 29+
}

# Injury Adjustments
INJURY_ADJUSTMENTS = {
    'Healthy': 1.00,
    'Probable': 1.00,
    'Questionable': 0.85,
    'Doubtful': 0.70,
    'Out': 0.50,
    'IR': 0.30,
    'PUP': 0.20
}

# Historical Data Settings
HISTORICAL_YEARS = 3  # Number of years to analyze for trends

# Trade Suggestion Settings
MAX_TRADE_SUGGESTIONS = 5      # Maximum number of AI suggestions
MIN_VORP_GAIN = 10             # Minimum VORP gain to suggest trade
MAX_VALUE_DIFFERENCE = 30      # Maximum value diff for fair trade

# Cache Settings (in seconds)
CACHE_TTL = {
    'player_data': 86400,      # 24 hours
    'projections': 3600,       # 1 hour
    'league_data': 3600,       # 1 hour
    'team_stats': 21600        # 6 hours
}

# Display Settings
SHOW_DETAILED_BREAKDOWNS = True  # Show component breakdowns in analysis
USE_COLOR_CODING = True          # Color code strength/weakness indicators
CHART_HEIGHT = 400               # Default chart height in pixels

# Advanced Features (requires additional setup)
ENABLE_MACHINE_LEARNING = False  # Use ML for enhanced predictions
ML_MODEL_PATH = 'models/prediction_model.pkl'

ENABLE_KEEPER_MODE = False       # Calculate dynasty/keeper values
KEEPER_YEARS = 3                 # Years to project for keeper value

# API Rate Limiting
API_REQUESTS_PER_MINUTE = 50     # Max requests to prevent throttling
API_RETRY_ATTEMPTS = 3           # Number of retries on failure

# Logging
ENABLE_LOGGING = True
LOG_LEVEL = 'INFO'  # DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FILE = 'fantasy_analyzer.log'

"""
Usage Instructions:
1. Copy this file to config.py
2. Add your SportsDataIO API key
3. Adjust settings to match your league
4. Import in app.py:
   from config import *
5. Restart the Streamlit app
"""
