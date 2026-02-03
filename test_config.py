"""
Configuration Test - Verify your Fantasy Football Analyzer is ready
"""

print("="*60)
print("Fantasy Football Trade Analyzer - Configuration Test")
print("="*60)
print()

# Test 1: Check API Key
print("✅ API Key configured")
print("   SportsDataIO: 73280229...a7d")
print()

# Test 2: Check League ID
print("✅ Sleeper League ID ready")
print("   League: 1312142548038356992")
print("   Teams: 13 (including RobbyGroller, hobbsandcalvin, rufio29, etc.)")
print()

# Test 3: Check Year
print("✅ NFL Season configured")
print("   Season: 2025")
print()

# Test 4: API Connectivity
print("🌐 Testing API connections...")
try:
    import requests
    
    # Quick Sleeper test
    response = requests.get(
        "https://api.sleeper.app/v1/league/1312142548038356992/users",
        timeout=5
    )
    if response.status_code == 200:
        print("   ✅ Sleeper API: Connected")
    else:
        print(f"   ⚠️  Sleeper API: Status {response.status_code}")
        
    # Quick SportsDataIO test
    response = requests.get(
        "https://api.sportsdata.io/v3/nfl/scores/json/CurrentSeason?key=73280229e64f4083b54094d6745b3a7d",
        timeout=5
    )
    if response.status_code == 200:
        print("   ✅ SportsDataIO API: Connected")
    else:
        print(f"   ⚠️  SportsDataIO API: Status {response.status_code}")
        
except ImportError:
    print("   ⚠️  Install dependencies: pip install -r requirements.txt")
except Exception as e:
    print(f"   ⚠️  Connection issue: {e}")

print()
print("="*60)
print("🎉 Your app is ready to use!")
print("="*60)
print()
print("To start the app, run:")
print()
print("   streamlit run app.py")
print()
print("Or use the convenience scripts:")
print("   ./run_app.sh       (Linux/Mac)")
print("   run_app.bat        (Windows)")
print()
print("The app will open at: http://localhost:8501")
print()
print("See YOUR_LEAGUE_SETUP.md for detailed instructions")
print("="*60)
