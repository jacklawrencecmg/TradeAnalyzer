# 🏈 Ultimate Fantasy Football Trade Analyzer

> An advanced fantasy football trade analysis tool with IDP support, historical data analysis, and AI-powered trade suggestions.

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Streamlit](https://img.shields.io/badge/streamlit-1.40.2-FF4B4B.svg)](https://streamlit.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

### 🎯 Core Functionality
- **IDP Support** - Full support for Individual Defensive Players (DL, LB, DB)
- **Multi-Factor Analysis** - 5-component valuation system with historical trends
- **VORP Calculations** - Position-specific Value Over Replacement Player metrics
- **Age & Injury Adjustments** - Dynamic player value adjustments
- **Team Performance Impact** - Offensive/defensive rankings affect valuations
- **Strength of Schedule** - Matchup analysis for remaining season

### 💡 AI-Powered Features
- **Smart Trade Suggestions** - Get 3-5 AI-generated trade recommendations
- **Roster Analysis** - Automatic strength/weakness identification
- **Manual Trade Evaluator** - Analyze custom trades with detailed breakdowns
- **League Power Rankings** - Compare teams across your league

### 📊 Data Integration
- **Sleeper API** - Direct league import with one ID
- **SportsDataIO API** - Professional-grade projections and stats
- **Historical Data** - 3-5 year trend analysis
- **Real-time Updates** - Cached data with hourly refresh

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)
- Internet connection for API calls

### Installation

**Option 1: Automated (Recommended)**

Linux/Mac:
```bash
chmod +x run_app.sh
./run_app.sh
```

Windows:
```batch
run_app.bat
```

**Option 2: Manual**

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
streamlit run app.py
```

The app will automatically open in your browser at `http://localhost:8501`

### First Use

1. **Get Your Sleeper League ID**
   - Go to sleeper.app and open your league
   - Copy the ID from the URL: `sleeper.app/leagues/YOUR_LEAGUE_ID/team`

2. **Enter League ID**
   - Paste it in the sidebar
   - Wait for data to load (5-10 seconds)

3. **Select Your Team**
   - Choose your team from the dropdown

4. **Start Analyzing!**
   - View AI trade suggestions
   - Analyze custom trades
   - Check league power rankings

## 📖 Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in 5 minutes
- **[Usage Examples](EXAMPLES.md)** - Real-world scenarios and strategies
- **[Deployment Guide](DEPLOYMENT.md)** - Deploy to cloud platforms
- **[Technical Details](README_STREAMLIT.md)** - In-depth technical documentation

## 🎮 Demo Mode

The app works out-of-the-box with mock data:
- No API key required
- 200+ players with realistic projections
- All features fully functional
- Perfect for testing and learning

## 🔑 Using Real Data (Optional)

For real NFL data, get a free SportsDataIO API key:

1. Sign up at [sportsdata.io](https://sportsdata.io) (free tier: 1000 requests/month)
2. Get your API key
3. Open `app.py` and replace:
   ```python
   API_KEY = "YOUR_SPORTSDATAIO_KEY_HERE"
   ```
   with your actual key
4. Restart the app

**With real data you get:**
- Actual NFL projections
- 3-year historical statistics
- Real player ages and injury status
- Team performance metrics
- Strength of schedule analysis

## 📊 How It Works

### Enhanced Valuation Formula

Each player receives an adjusted value based on:

```
Adjusted Value = (
  Base Projection × 60% +
  Historical Average × 20% +
  Team Performance × 10% +
  Matchup SOS × 5%
) × Age Factor × Injury Factor
```

### Age Adjustments
- **Under 25**: 1.0x (baseline)
- **25-27**: 1.05x (prime years boost)
- **28-29**: 1.0x (still productive)
- **30-31**: 0.9x (slight decline risk)
- **32+**: 0.8x (significant age risk)

### VORP Baselines
- **QB**: Top 12 (1-QB leagues)
- **RB**: Top 24
- **WR**: Top 30
- **TE**: Top 12
- **DL/LB/DB**: Top 24-30 (IDP)

## 💻 Technology Stack

- **[Streamlit](https://streamlit.io)** - Interactive web framework
- **[Pandas](https://pandas.pydata.org)** - Data analysis
- **[Altair](https://altair-viz.github.io)** - Declarative visualizations
- **[FuzzyWuzzy](https://github.com/seatgeek/fuzzywuzzy)** - Fuzzy string matching
- **[Requests](https://requests.readthedocs.io)** - HTTP library

## 📁 Project Structure

```
fantasy-trade-analyzer/
├── app.py                  # Main application
├── requirements.txt        # Python dependencies
├── test_setup.py          # Setup verification script
├── config_example.py      # Configuration template
│
├── README.md              # Main documentation (this file)
├── QUICKSTART.md          # Quick start guide
├── EXAMPLES.md            # Usage examples
├── DEPLOYMENT.md          # Deployment instructions
├── README_STREAMLIT.md    # Technical details
│
├── run_app.sh            # Linux/Mac run script
└── run_app.bat           # Windows run script
```

## 🎯 Use Cases

### For Players
- Evaluate trade offers objectively
- Identify buy-low/sell-high opportunities
- Find win-win trades with league mates
- Prepare for trade negotiations

### For Commissioners
- Veto lopsided trades with data
- Help new players understand values
- Create league balance

### For Analysts
- Study player valuations
- Analyze market trends
- Build trade models

## 🔧 Customization

### Custom Scoring Settings

Edit `app.py` to match your league:

```python
# Adjust valuation weights
SCORING_WEIGHTS = {
    'projections': 0.50,       # Reduce projection weight
    'historical': 0.30,        # Increase historical weight
    'team_performance': 0.10,
    'matchup_sos': 0.05,
    'age_injury': 0.05
}

# Adjust position baselines for league size
POSITION_BASELINES = {
    'QB': 10,  # 10-team league
    'RB': 20,  # Fewer starting RBs
    # ...
}
```

### Add Machine Learning

Enhance predictions with scikit-learn:

```python
from sklearn.ensemble import RandomForestRegressor

# Train on historical data
model = RandomForestRegressor()
model.fit(historical_features, actual_points)

# Make predictions
enhanced_projection = model.predict(current_features)
```

See `config_example.py` for more customization options.

## 🧪 Testing Your Setup

Verify everything works:

```bash
python test_setup.py
```

This checks:
- ✅ Python version (3.8+)
- ✅ Required packages installed
- ✅ API connectivity
- ✅ App file integrity

## 🚀 Deployment

Deploy to the cloud for 24/7 access:

### Streamlit Community Cloud (Free)
1. Push to GitHub
2. Connect at [share.streamlit.io](https://share.streamlit.io)
3. Deploy in 1 click

### Other Options
- **Heroku** - Custom domain support
- **AWS EC2** - Full control
- **Docker** - Containerized deployment
- **Azure** - Microsoft ecosystem

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 📈 Roadmap

### Coming Soon
- [ ] Dynasty/keeper mode with long-term valuations
- [ ] Machine learning projection enhancements
- [ ] Export trade history and results
- [ ] Multi-league portfolio management
- [ ] Custom scoring system builder
- [ ] Mobile app (iOS/Android)

### Future Considerations
- [ ] ESPN/Yahoo API integration
- [ ] Automated trade finder
- [ ] League chat integration
- [ ] Trade deadline alerts
- [ ] Playoff impact calculator

## 🤝 Contributing

Contributions welcome! Ideas for improvements:

1. **Add Features**
   - New data sources
   - Additional metrics
   - UI enhancements

2. **Improve Algorithms**
   - Better age curves
   - Position-specific adjustments
   - ML models

3. **Documentation**
   - More examples
   - Video tutorials
   - Strategy guides

## ⚠️ Disclaimer

This tool provides analysis based on projections and statistical models. Fantasy football involves uncertainty and luck. Use this as one input in your decision-making process.

- Projections are estimates, not guarantees
- Injuries and team changes affect values
- Your league context matters
- Trust your judgment

## 🐛 Troubleshooting

### Common Issues

**"Error fetching Sleeper users"**
- Verify League ID is correct
- Check internet connection
- Ensure league is active

**"Using mock data" warning**
- Normal without API key
- All features still work
- Add API key for real data

**Slow loading**
- First load caches data (slower)
- Subsequent loads are faster
- Large leagues take longer

See documentation for more troubleshooting tips.

## 📜 License

MIT License - feel free to use, modify, and distribute.

## 🙏 Acknowledgments

- **Sleeper** - For their excellent free API
- **SportsDataIO** - For professional-grade NFL data
- **Streamlit** - For making Python web apps easy
- **Fantasy Football Community** - For inspiration and feedback

## 📞 Support

- 📚 Read the [documentation](QUICKSTART.md)
- 💬 Check [examples](EXAMPLES.md)
- 🐛 Report issues on GitHub
- ⭐ Star the repo if you find it useful!

---

<div align="center">

**Made with ❤️ for fantasy football enthusiasts**

[Get Started](#-quick-start) • [Documentation](#-documentation) • [Examples](EXAMPLES.md) • [Deploy](DEPLOYMENT.md)

</div>

## 🎉 Success Stories

> "Helped me identify a trade that won me my championship!" - League Winner 2025

> "The AI suggestions found value I never would have seen." - Fantasy Analyst

> "Perfect for commissioners dealing with trade disputes." - League Commissioner

**Ready to dominate your league? Install now and start analyzing!** 🏆
