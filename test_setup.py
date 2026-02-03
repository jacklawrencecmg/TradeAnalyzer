"""
Setup Test Script for Fantasy Football Trade Analyzer
Run this to verify your environment is properly configured.
"""

import sys

def test_python_version():
    """Check Python version."""
    print("🐍 Testing Python version...")
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print(f"   ✅ Python {version.major}.{version.minor}.{version.micro} (OK)")
        return True
    else:
        print(f"   ❌ Python {version.major}.{version.minor}.{version.micro} (Need 3.8+)")
        return False

def test_imports():
    """Test all required imports."""
    print("\n📦 Testing package imports...")
    required_packages = {
        'streamlit': 'Streamlit',
        'requests': 'Requests',
        'pandas': 'Pandas',
        'fuzzywuzzy': 'FuzzyWuzzy',
        'Levenshtein': 'python-Levenshtein',
        'altair': 'Altair'
    }

    all_passed = True
    for module, name in required_packages.items():
        try:
            __import__(module)
            print(f"   ✅ {name}")
        except ImportError:
            print(f"   ❌ {name} (Not installed)")
            all_passed = False

    return all_passed

def test_api_connection():
    """Test connection to Sleeper API."""
    print("\n🌐 Testing Sleeper API connection...")
    try:
        import requests
        response = requests.get("https://api.sleeper.app/v1/state/nfl", timeout=5)
        if response.status_code == 200:
            print("   ✅ Sleeper API accessible")
            return True
        else:
            print(f"   ⚠️ Sleeper API returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Cannot reach Sleeper API: {e}")
        return False

def test_app_file():
    """Check if app.py exists and is readable."""
    print("\n📄 Testing app.py...")
    try:
        with open('app.py', 'r') as f:
            content = f.read()
            if 'streamlit' in content and 'Fantasy Football' in content:
                print("   ✅ app.py found and valid")
                return True
            else:
                print("   ⚠️ app.py found but may be modified")
                return False
    except FileNotFoundError:
        print("   ❌ app.py not found")
        return False
    except Exception as e:
        print(f"   ❌ Error reading app.py: {e}")
        return False

def main():
    """Run all tests."""
    print("=" * 60)
    print("Fantasy Football Trade Analyzer - Setup Test")
    print("=" * 60)

    tests = [
        test_python_version(),
        test_imports(),
        test_api_connection(),
        test_app_file()
    ]

    print("\n" + "=" * 60)
    if all(tests):
        print("✅ ALL TESTS PASSED!")
        print("\nYou're ready to run the app:")
        print("   streamlit run app.py")
    else:
        print("⚠️ SOME TESTS FAILED")
        print("\nFix the issues above, then:")
        print("   pip install -r requirements.txt")
        print("   python test_setup.py")
    print("=" * 60)

if __name__ == "__main__":
    main()
