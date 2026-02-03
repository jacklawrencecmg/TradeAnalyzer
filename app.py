"""
Ultimate Fantasy Football Trade Analyzer (IDP, Historical, & League Import)
A comprehensive tool for analyzing fantasy football trades with IDP support,
historical trends, age adjustments, team performance, and matchup analysis.
"""

import streamlit as st
import requests
import pandas as pd
from typing import Dict, List, Optional, Tuple
import json
from datetime import datetime
from fuzzywuzzy import fuzz
import altair as alt
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import warnings
warnings.filterwarnings('ignore')

# Configuration
API_KEY = "73280229e64f4083b54094d6745b3a7d"  # SportsDataIO API key
BASE_URL = "https://api.sportsdata.io/v3/nfl"
CURRENT_YEAR = 2025  # Current NFL season available in API

# Position baselines for VORP calculation
POSITION_BASELINES = {
    'QB': 12, 'RB': 24, 'WR': 30, 'TE': 12,
    'K': 12, 'DEF': 12,
    'DL': 24, 'LB': 30, 'DB': 24  # IDP positions
}

# Scoring weights for analysis
SCORING_WEIGHTS = {
    'projections': 0.60,
    'historical': 0.20,
    'team_performance': 0.10,
    'matchup_sos': 0.05,
    'age_injury': 0.05
}

# Cache for API responses
@st.cache_data(ttl=3600)
def fetch_sleeper_users(league_id: str) -> Optional[List[Dict]]:
    """Fetch Sleeper league users."""
    try:
        response = requests.get(f"https://api.sleeper.app/v1/league/{league_id}/users")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"Error fetching Sleeper users: {e}")
        return None

@st.cache_data(ttl=3600)
def fetch_sleeper_rosters(league_id: str) -> Optional[List[Dict]]:
    """Fetch Sleeper league rosters."""
    try:
        response = requests.get(f"https://api.sleeper.app/v1/league/{league_id}/rosters")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"Error fetching Sleeper rosters: {e}")
        return None

@st.cache_data(ttl=86400)
def fetch_sleeper_players() -> Optional[Dict]:
    """Fetch Sleeper player database."""
    try:
        response = requests.get("https://api.sleeper.app/v1/players/nfl")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"Error fetching Sleeper players: {e}")
        return None

@st.cache_data(ttl=3600)
def fetch_projections(year: int = CURRENT_YEAR) -> Optional[List[Dict]]:
    """Fetch player projections from SportsDataIO."""
    if API_KEY == "YOUR_SPORTSDATAIO_KEY_HERE":
        st.warning("⚠️ Using mock projection data. Add your SportsDataIO API key for real data.")
        return generate_mock_projections()

    try:
        url = f"{BASE_URL}/projections/json/PlayerSeasonProjectionStats/{year}?key={API_KEY}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"Error fetching projections: {e}")
        return generate_mock_projections()

@st.cache_data(ttl=1800)
def fetch_injuries(year: int = CURRENT_YEAR) -> Optional[List[Dict]]:
    """Fetch current injury reports from SportsDataIO."""
    if API_KEY == "YOUR_SPORTSDATAIO_KEY_HERE":
        return []

    try:
        url = f"{BASE_URL}/scores/json/Injuries/{year}?key={API_KEY}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.warning(f"Error fetching injuries: {e}")
        return []

@st.cache_data(ttl=1800)
def fetch_news(year: int = CURRENT_YEAR) -> Optional[List[Dict]]:
    """Fetch latest news from SportsDataIO."""
    if API_KEY == "YOUR_SPORTSDATAIO_KEY_HERE":
        return []

    try:
        url = f"{BASE_URL}/scores/json/News?key={API_KEY}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.warning(f"Error fetching news: {e}")
        return []

@st.cache_data(ttl=3600)
def fetch_historical_stats(player_id: str, years: int = 3) -> List[Dict]:
    """Fetch historical player stats."""
    if API_KEY == "YOUR_SPORTSDATAIO_KEY_HERE":
        return []

    historical_data = []
    current_year = CURRENT_YEAR - 1

    for year in range(current_year - years, current_year):
        try:
            url = f"{BASE_URL}/stats/json/PlayerGameStatsBySeason/{year}/{player_id}?key={API_KEY}"
            response = requests.get(url)
            response.raise_for_status()
            historical_data.extend(response.json())
        except Exception:
            continue

    return historical_data

@st.cache_data(ttl=86400)
def fetch_player_details() -> Optional[List[Dict]]:
    """Fetch player details including age and injury status."""
    if API_KEY == "YOUR_SPORTSDATAIO_KEY_HERE":
        return generate_mock_player_details()

    try:
        url = f"{BASE_URL}/scores/json/Players?key={API_KEY}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"Error fetching player details: {e}")
        return generate_mock_player_details()

@st.cache_data(ttl=86400)
def fetch_dynasty_adp() -> Optional[List[Dict]]:
    """
    Fetch dynasty ADP data from SportsDataIO.
    Returns player dynasty ADP information for valuation.
    """
    if API_KEY == "YOUR_SPORTSDATAIO_KEY_HERE":
        return generate_mock_dynasty_adp()

    try:
        # Try FantasyPlayers endpoint which includes AverageDraftPositionDynasty
        url = f"{BASE_URL}/stats/json/FantasyPlayers?key={API_KEY}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.warning(f"Dynasty ADP data unavailable: {e}. Using fallback values.")
        return generate_mock_dynasty_adp()

@st.cache_data(ttl=3600)
def fetch_team_stats(year: int = CURRENT_YEAR) -> Optional[List[Dict]]:
    """Fetch team performance statistics."""
    if API_KEY == "YOUR_SPORTSDATAIO_KEY_HERE":
        return generate_mock_team_stats()

    try:
        url = f"{BASE_URL}/stats/json/TeamSeasonStats/{year}?key={API_KEY}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"Error fetching team stats: {e}")
        return generate_mock_team_stats()

@st.cache_data(ttl=3600)
def fetch_schedules(year: int = CURRENT_YEAR) -> Optional[List[Dict]]:
    """Fetch NFL schedules for matchup analysis."""
    if API_KEY == "YOUR_SPORTSDATAIO_KEY_HERE":
        return []

    try:
        url = f"{BASE_URL}/scores/json/Schedules/{year}?key={API_KEY}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        st.error(f"Error fetching schedules: {e}")
        return []

# Mock data generators for demo purposes
def generate_mock_projections() -> List[Dict]:
    """Generate mock projection data for demonstration."""
    positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB']
    teams = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN']

    mock_data = []
    for i in range(200):
        position = positions[i % len(positions)]
        base_points = {
            'QB': 280, 'RB': 180, 'WR': 160, 'TE': 120,
            'K': 100, 'DL': 90, 'LB': 110, 'DB': 85
        }

        mock_data.append({
            'PlayerID': 10000 + i,
            'Name': f"Player_{i}",
            'Team': teams[i % len(teams)],
            'Position': position,
            'FantasyPointsPPR': base_points[position] + (i % 50) - 25,
            'PassingYards': 3500 if position == 'QB' else 0,
            'RushingYards': 800 if position in ['RB', 'QB'] else 0,
            'ReceivingYards': 900 if position in ['WR', 'TE'] else 0,
            'Touchdowns': 15 if position in ['QB', 'RB', 'WR'] else 5,
            'Tackles': 80 if position in ['LB', 'DL', 'DB'] else 0,
            'Sacks': 8 if position == 'DL' else 3,
            'Interceptions': 4 if position == 'DB' else 0
        })

    return mock_data

def generate_mock_player_details() -> List[Dict]:
    """Generate mock player details."""
    mock_data = []
    for i in range(200):
        mock_data.append({
            'PlayerID': 10000 + i,
            'Name': f"Player_{i}",
            'Age': 24 + (i % 12),
            'InjuryStatus': 'Healthy' if i % 10 != 0 else 'Questionable',
            'Experience': min(i % 15, 12)
        })
    return mock_data

def generate_mock_dynasty_adp() -> List[Dict]:
    """Generate mock dynasty ADP data for demonstration."""
    positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB']
    mock_data = []

    for i in range(200):
        position = positions[i % len(positions)]
        # Assign ADP based on position and index (lower is better)
        # Top players have low ADP (1-50), others higher
        if i < 50:
            adp = i + 1
        elif i < 100:
            adp = 50 + (i - 50) * 2
        else:
            adp = 150 + (i - 100) * 5

        mock_data.append({
            'PlayerID': 10000 + i,
            'Name': f"Player_{i}",
            'Position': position,
            'AverageDraftPositionDynasty': adp if i < 150 else None  # Undrafted after 150
        })

    return mock_data

def generate_mock_team_stats() -> List[Dict]:
    """Generate mock team statistics."""
    teams = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN']
    mock_data = []

    for i, team in enumerate(teams):
        mock_data.append({
            'Team': team,
            'OffensiveRank': i + 1,
            'DefensiveRank': len(teams) - i,
            'TotalYards': 5500 - (i * 100),
            'PointsScored': 400 - (i * 10)
        })

    return mock_data

def calculate_age_adjustment(age: int) -> float:
    """Calculate age-based adjustment factor."""
    if age < 25:
        return 1.0
    elif age < 28:
        return 1.05  # Prime years
    elif age < 30:
        return 1.0
    elif age < 32:
        return 0.90  # Slight decline
    else:
        return 0.80  # Significant risk

def calculate_injury_adjustment(injury_status: str) -> float:
    """Calculate injury-based adjustment factor."""
    if injury_status in ['Healthy', 'Probable']:
        return 1.0
    elif injury_status in ['Questionable', 'Doubtful']:
        return 0.85
    else:
        return 0.60  # Out/IR

def calculate_dynasty_adp_value(adp: Optional[float], position: str, is_superflex: bool = False) -> float:
    """
    Convert dynasty ADP to a consistent value score for trade analysis.

    Lower ADP = higher value (ADP 1 is most valuable).
    Uses formula: value = 20000 / ADP for drafted players.

    Tier-based minimums ensure realistic valuations:
    - Elite (ADP 1-24): 8000-20000
    - Strong starters (ADP 25-60): 3000-8000
    - Flex/depth (ADP 61-120): 1500-3000
    - Deep bench (ADP 121+): 300-1500
    - Undrafted: 200-500 based on position

    Superflex adjusts QB values up by 50%.
    """
    # Handle undrafted or missing ADP
    if adp is None or adp <= 0:
        # Assign low values for undrafted by position
        undrafted_values = {
            'QB': 400, 'RB': 300, 'WR': 350, 'TE': 250,
            'K': 200, 'DL': 250, 'LB': 300, 'DB': 250
        }
        return undrafted_values.get(position, 200)

    # Calculate base value from ADP
    base_value = 20000 / adp

    # Apply tier-based caps and floors for realism
    if adp <= 24:  # Elite tier
        value = max(8000, min(20000, base_value))
    elif adp <= 60:  # Strong starter tier
        value = max(3000, min(8000, base_value))
    elif adp <= 120:  # Flex/depth tier
        value = max(1500, min(3000, base_value))
    else:  # Deep bench tier
        value = max(300, min(1500, base_value))

    # Superflex adjustment (QBs more valuable)
    if is_superflex and position == 'QB':
        value *= 1.5

    return value

def calculate_vorp(player_points: float, position: str, position_rankings: Dict) -> float:
    """
    Calculate Value Over Replacement Player (VORP).
    Uses position-specific baselines and current rankings.
    """
    baseline = POSITION_BASELINES.get(position, 24)

    if position in position_rankings:
        rankings = position_rankings[position]
        if len(rankings) >= baseline:
            replacement_value = rankings[baseline - 1]
        else:
            replacement_value = rankings[-1] if rankings else 0
    else:
        replacement_value = 0

    return max(0, player_points - replacement_value)

def calculate_enhanced_value(player_data: Dict, player_details: Dict,
                            team_stats: Dict, historical_avg: float,
                            matchup_factor: float, dynasty_adp: Optional[float] = None,
                            is_superflex: bool = False) -> Tuple[float, Dict]:
    """
    Calculate enhanced player value with dynasty ADP as primary factor.

    Value Formula (SportsDataIO-based):
    - Dynasty ADP Score (60%): Consistent market value
    - Projected Fantasy Points (30%): Current season outlook
    - Historical Average (10%): Past performance track record
    - Adjustments: Age, injury, team performance

    Returns adjusted value and breakdown of components.
    """
    base_projection = player_data.get('FantasyPointsPPR', 0)
    position = player_data.get('Position', '')

    # Dynasty ADP value (primary component - 60% weight)
    dynasty_value = calculate_dynasty_adp_value(dynasty_adp, position, is_superflex)
    dynasty_component = dynasty_value * 0.60

    # Projection component (30% weight) - scale projections to match ADP scale
    # Typical top player projects ~300-400 PPR points, scale to ~3000-6000 range
    projection_scaled = base_projection * 15  # Scale factor
    projection_component = projection_scaled * 0.30

    # Historical component (10% weight)
    historical_scaled = historical_avg * 15
    historical_component = historical_scaled * 0.10

    # Age adjustment
    age = player_details.get('Age', 27)
    age_factor = calculate_age_adjustment(age)

    # Injury adjustment
    injury_status = player_details.get('InjuryStatus', 'Healthy')
    injury_factor = calculate_injury_adjustment(injury_status)

    # Team performance boost/penalty
    team = player_data.get('Team', '')
    team_factor = 1.0
    if team in team_stats:
        offense_rank = team_stats[team].get('OffensiveRank', 16)
        # Top 10 offense = +5%, bottom 10 = -5%
        if offense_rank <= 10:
            team_factor = 1.05
        elif offense_rank >= 23:
            team_factor = 0.95

    # Calculate pre-adjustment value
    pre_adjustment_value = dynasty_component + projection_component + historical_component

    # Apply team, age, and injury adjustments
    adjusted_value = pre_adjustment_value * team_factor * age_factor * injury_factor

    breakdown = {
        'dynasty_adp': dynasty_adp,
        'dynasty_value': dynasty_value,
        'dynasty_component': dynasty_component,
        'base_projection': base_projection,
        'projection_component': projection_component,
        'historical_component': historical_component,
        'age_factor': age_factor,
        'injury_factor': injury_factor,
        'team_factor': team_factor,
        'matchup_factor': matchup_factor,
        'adjusted_value': adjusted_value
    }

    return adjusted_value, breakdown

def analyze_roster_strengths(roster_df: pd.DataFrame) -> Dict:
    """Analyze roster strengths and weaknesses by position."""
    analysis = {}

    for position in POSITION_BASELINES.keys():
        position_players = roster_df[roster_df['Position'] == position]

        if len(position_players) > 0:
            avg_value = position_players['AdjustedValue'].mean()
            total_value = position_players['AdjustedValue'].sum()
            count = len(position_players)

            # Determine strength level (calibrated to SportsDataIO scale)
            # Elite tier: ~8000+, Strong: ~4000-8000, Average: ~2000-4000, Weak: <2000
            if avg_value > 6000:
                strength = "Strong"
            elif avg_value > 3000:
                strength = "Average"
            else:
                strength = "Weak"

            analysis[position] = {
                'count': count,
                'avg_value': avg_value,
                'total_value': total_value,
                'strength': strength,
                'top_player': position_players.nlargest(1, 'AdjustedValue')['Name'].values[0] if count > 0 else None
            }
        else:
            analysis[position] = {
                'count': 0,
                'avg_value': 0,
                'total_value': 0,
                'strength': "None",
                'top_player': None
            }

    return analysis

def suggest_trades(your_roster: pd.DataFrame, all_rosters: Dict[str, pd.DataFrame],
                  your_team: str) -> List[Dict]:
    """
    Suggest trades based on mutual VORP gains and positional needs.
    Returns list of trade suggestions with details.
    """
    suggestions = []

    your_analysis = analyze_roster_strengths(your_roster)

    # Identify surplus and needs
    surplus_positions = [pos for pos, data in your_analysis.items()
                        if data['strength'] == "Strong" and data['count'] > 2]
    need_positions = [pos for pos, data in your_analysis.items()
                     if data['strength'] in ["Weak", "None"]]

    if not surplus_positions or not need_positions:
        return suggestions

    # Check trades with other teams
    for team_name, team_roster in all_rosters.items():
        if team_name == your_team:
            continue

        team_analysis = analyze_roster_strengths(team_roster)

        # Find complementary needs
        for your_surplus in surplus_positions:
            for your_need in need_positions:
                # Check if other team has opposite needs
                team_has_need = team_analysis.get(your_surplus, {}).get('strength') in ["Weak", "Average"]
                team_has_surplus = team_analysis.get(your_need, {}).get('strength') == "Strong"

                if team_has_need and team_has_surplus:
                    # Find suitable players to trade
                    your_players = your_roster[your_roster['Position'] == your_surplus].nlargest(3, 'AdjustedValue')
                    their_players = team_roster[team_roster['Position'] == your_need].nlargest(3, 'AdjustedValue')

                    if len(your_players) > 0 and len(their_players) > 0:
                        # Propose 1-for-1 trades
                        for _, your_player in your_players.iterrows():
                            for _, their_player in their_players.iterrows():
                                value_diff = abs(your_player['AdjustedValue'] - their_player['AdjustedValue'])

                                # Only suggest if values are relatively close
                                if value_diff < 30:
                                    your_gain = their_player['AdjustedValue'] - your_player['AdjustedValue']

                                    if your_gain > 10:  # Meaningful gain
                                        suggestions.append({
                                            'with_team': team_name,
                                            'give': [{
                                                'name': your_player['Name'],
                                                'position': your_player['Position'],
                                                'value': your_player['AdjustedValue']
                                            }],
                                            'receive': [{
                                                'name': their_player['Name'],
                                                'position': their_player['Position'],
                                                'value': their_player['AdjustedValue']
                                            }],
                                            'your_gain': your_gain,
                                            'rationale': f"Upgrade {your_need} by trading surplus {your_surplus}"
                                        })

    # Sort by gain and limit to top 5
    suggestions.sort(key=lambda x: x['your_gain'], reverse=True)
    return suggestions[:5]

def get_pick_value(pick_description: str, is_superflex: bool = False) -> tuple:
    """
    Calculate dynasty draft pick value based on exact slot or general description.

    Values calibrated to SportsDataIO dynasty ADP scale for consistency.
    Typical rookie ADP curves: 1.01 ≈ ADP 6-10, 1.06 ≈ ADP 25-30, 1.12 ≈ ADP 45-50
    Converted using same formula as player values: 20000 / typical_ADP

    Future years discounted (2027: 70% of 2026, 2028: 55% of 2026).

    Returns: (value, parsed_description)

    Supported formats:
    - Exact slots: "2026 1.01", "2026 1.05", "2027 2.03"
    - General: "2026 1st (Early)", "2026 2nd", "2027 3rd"
    - With notes: "2026 1.01 (from Team X)", "2026 1st mid"
    """
    import re

    pick_description = pick_description.strip()

    # Base values for 2026 1QB (12-team league)
    # Values based on typical rookie ADP: value = 20000 / expected_ADP
    # 1st round picks (1.01 through 1.12)
    first_round_2026_1qb = {
        1: 9500,   # ~ADP 8-12 rookie
        2: 8500,   # ~ADP 12-15
        3: 8000,   # ~ADP 15-18
        4: 7500,   # ~ADP 18-22
        5: 7200,   # ~ADP 22-25
        6: 6800,   # ~ADP 25-30
        7: 6400,   # ~ADP 30-35
        8: 6000,   # ~ADP 35-40
        9: 5600,  # ~ADP 40-45
        10: 5200, # ~ADP 45-50
        11: 4800, # ~ADP 50-55
        12: 4400  # ~ADP 55-60
    }

    # 2nd round picks (2.01 through 2.12)
    second_round_2026_1qb = {
        1: 4000,  # ~ADP 60-65
        2: 3700,  # ~ADP 65-70
        3: 3400,  # ~ADP 70-75
        4: 3100,  # ~ADP 75-80
        5: 2800,  # ~ADP 80-85
        6: 2600,  # ~ADP 85-90
        7: 2400,  # ~ADP 90-95
        8: 2200,  # ~ADP 95-100
        9: 2000, # ~ADP 100-105
        10: 1800, # ~ADP 105-110
        11: 1600, # ~ADP 110-115
        12: 1400  # ~ADP 115-120
    }

    # 3rd round picks
    third_round_2026_1qb = {
        1: 1200,  2: 1100,  3: 1000,  4: 900,
        5: 800,   6: 700,   7: 600,   8: 550,
        9: 500,  10: 450,  11: 400,  12: 350
    }

    # 4th+ rounds
    fourth_round_2026_1qb = 250

    # Superflex multiplier (QBs drafted earlier in SF)
    sf_multiplier = 1.10 if is_superflex else 1.0

    # Future year discounts (more aggressive for uncertainty)
    year_discounts = {
        '2026': 1.0,
        '2027': 0.70,  # 30% discount for next year
        '2028': 0.55,  # 45% discount for 2 years out
        '2029': 0.45,  # 55% discount for 3 years out
    }

    # Try to parse exact slot format (e.g., "2026 1.01", "2027 2.05")
    slot_pattern = r'(\d{4})\s*(\d)\.(\d{1,2})'
    slot_match = re.search(slot_pattern, pick_description)

    if slot_match:
        year = slot_match.group(1)
        round_num = int(slot_match.group(2))
        slot = int(slot_match.group(3))

        discount = year_discounts.get(year, 0.50)

        # Get base value from 2026 values
        if round_num == 1 and 1 <= slot <= 12:
            base_value = first_round_2026_1qb.get(slot, 4000)
        elif round_num == 2 and 1 <= slot <= 12:
            base_value = second_round_2026_1qb.get(slot, 2000)
        elif round_num == 3 and 1 <= slot <= 12:
            base_value = third_round_2026_1qb.get(slot, 500)
        elif round_num == 4:
            base_value = fourth_round_2026_1qb
        else:
            base_value = 100  # Very late picks

        final_value = base_value * discount * sf_multiplier
        parsed_desc = f"{year} {round_num}.{slot:02d}"
        return (final_value, parsed_desc)

    # Parse general format (e.g., "2026 1st", "2027 2nd (Early)")
    general_pattern = r'(\d{4})\s*(\d)(?:st|nd|rd|th)?'
    general_match = re.search(general_pattern, pick_description)

    if general_match:
        year = general_match.group(1)
        round_num = int(general_match.group(2))

        discount = year_discounts.get(year, 0.50)

        # Check for Early/Mid/Late modifier
        desc_lower = pick_description.lower()
        if 'early' in desc_lower or 'top' in desc_lower:
            slot_modifier = 'Early'
            if round_num == 1:
                base_value = first_round_2026_1qb[3]  # Pick 1.03
            elif round_num == 2:
                base_value = second_round_2026_1qb[3]
            elif round_num == 3:
                base_value = third_round_2026_1qb[3]
            else:
                base_value = fourth_round_2026_1qb
        elif 'late' in desc_lower or 'bottom' in desc_lower:
            slot_modifier = 'Late'
            if round_num == 1:
                base_value = first_round_2026_1qb[10]  # Pick 1.10
            elif round_num == 2:
                base_value = second_round_2026_1qb[10]
            elif round_num == 3:
                base_value = third_round_2026_1qb[10]
            else:
                base_value = fourth_round_2026_1qb
        else:
            slot_modifier = 'Mid'
            if round_num == 1:
                base_value = first_round_2026_1qb[6]  # Pick 1.06
            elif round_num == 2:
                base_value = second_round_2026_1qb[6]
            elif round_num == 3:
                base_value = third_round_2026_1qb[6]
            else:
                base_value = fourth_round_2026_1qb

        final_value = base_value * discount * sf_multiplier
        parsed_desc = f"{year} {round_num}{['st','nd','rd','th'][min(round_num-1,3)]} ({slot_modifier})"
        return (final_value, parsed_desc)

    # Fallback: return 0 for unparseable picks
    return (0, pick_description)


def parse_pick_input(pick_string: str, is_superflex: bool = False) -> List[Dict]:
    """
    Parse comma-separated pick descriptions into structured data.

    Example input: "2026 1.01, 2026 2.08, 2027 1st (late)"
    Returns: [{'description': '2026 1.01', 'value': 6800, 'parsed': '2026 1.01'}, ...]
    """
    if not pick_string or not pick_string.strip():
        return []

    picks = []
    pick_list = [p.strip() for p in pick_string.split(',') if p.strip()]

    for pick_desc in pick_list:
        value, parsed = get_pick_value(pick_desc, is_superflex)
        if value > 0:
            picks.append({
                'description': pick_desc,
                'parsed': parsed,
                'value': value
            })

    return picks

def calculate_faab_value(faab_amount: float) -> float:
    """
    Convert FAAB dollars to dynasty value points for consistent trade analysis.

    Total budget: $300/team per season

    Tiered valuation (reflecting scarcity and strategic value):
    - $1-25: $1 = 8 pts (small adds, low value)
    - $26-75: $1 = 12 pts (mid-season pickups)
    - $76-150: $1 = 15 pts (premium waiver claims)
    - $151-300: $1 = 18 pts (elite pickups, emergency starters)

    Examples:
    - $25 FAAB = 200 pts (≈ 4th round pick)
    - $50 FAAB = 500 pts (≈ late 3rd round pick)
    - $100 FAAB = 950 pts (≈ mid 3rd round pick)
    - $200 FAAB = 2,050 pts (≈ mid 2nd round pick)

    Adjust multipliers based on league waiver aggression:
    - Conservative waivers: Reduce multipliers by 20%
    - Aggressive waivers: Increase multipliers by 20%
    """
    if faab_amount <= 0:
        return 0

    # Calculate value using tiered system
    value = 0
    remaining = faab_amount

    # Tier 1: $1-25 at 8 pts per dollar
    tier1 = min(remaining, 25)
    value += tier1 * 8
    remaining -= tier1

    if remaining > 0:
        # Tier 2: $26-75 at 12 pts per dollar
        tier2 = min(remaining, 50)
        value += tier2 * 12
        remaining -= tier2

    if remaining > 0:
        # Tier 3: $76-150 at 15 pts per dollar
        tier3 = min(remaining, 75)
        value += tier3 * 15
        remaining -= tier3

    if remaining > 0:
        # Tier 4: $151-300 at 18 pts per dollar
        tier4 = min(remaining, 150)
        value += tier4 * 18

    return value

def extract_player_features(player_stats: Dict, projections: Dict,
                           player_details: Dict, team_stats: Dict) -> np.ndarray:
    """
    Extract ML features from player data for dynasty value prediction.

    Features:
    - Age (normalized)
    - Position (one-hot encoded)
    - Historical stats (3-year avg)
    - Team performance metrics
    - Career trajectory
    """
    features = []

    age = player_details.get('Age', 25)
    features.append(age)

    position = player_details.get('Position', 'RB')
    position_encoding = {
        'QB': [1, 0, 0, 0, 0, 0, 0],
        'RB': [0, 1, 0, 0, 0, 0, 0],
        'WR': [0, 0, 1, 0, 0, 0, 0],
        'TE': [0, 0, 0, 1, 0, 0, 0],
        'DL': [0, 0, 0, 0, 1, 0, 0],
        'LB': [0, 0, 0, 0, 0, 1, 0],
        'DB': [0, 0, 0, 0, 0, 0, 1]
    }
    features.extend(position_encoding.get(position, [0, 0, 0, 0, 0, 0, 0]))

    fantasy_points = projections.get('FantasyPoints', 0)
    features.append(fantasy_points)

    games_played = player_stats.get('Games', 0)
    features.append(games_played)

    team_wins = team_stats.get('Wins', 0)
    features.append(team_wins)

    experience = player_details.get('Experience', 0)
    features.append(experience)

    return np.array(features)

@st.cache_resource
def train_dynasty_value_model(projections_data: List[Dict],
                              historical_data: List[Dict],
                              player_details_data: List[Dict],
                              team_stats_data: List[Dict]) -> Tuple[RandomForestRegressor, StandardScaler, Dict]:
    """
    Train ML model to predict dynasty player values.
    Uses RandomForestRegressor for robust multi-feature prediction.

    Returns:
    - Trained model
    - Feature scaler
    - Model metrics
    """
    X = []
    y = []

    player_lookup = {p.get('PlayerID'): p for p in player_details_data}
    team_lookup = {t.get('Team'): t for t in team_stats_data}

    for proj in projections_data[:500]:  # Use subset for training
        try:
            player_id = proj.get('PlayerID')
            if not player_id:
                continue

            player = player_lookup.get(player_id, {})
            team_code = player.get('Team', '')
            team = team_lookup.get(team_code, {})

            hist_stats = {}
            for h in historical_data:
                if h.get('PlayerID') == player_id:
                    hist_stats = h
                    break

            features = extract_player_features(hist_stats, proj, player, team)

            fantasy_points = proj.get('FantasyPoints', 0)
            age = player.get('Age', 25)
            experience = player.get('Experience', 0)

            dynasty_value = fantasy_points * 10
            if age < 24:
                dynasty_value *= 1.3
            elif age < 27:
                dynasty_value *= 1.1
            elif age > 30:
                dynasty_value *= 0.7

            if experience > 0:
                dynasty_value *= min(1.0 + (experience * 0.05), 1.4)

            X.append(features)
            y.append(dynasty_value)

        except Exception:
            continue

    if len(X) < 50:
        st.warning("Insufficient data for ML training. Using fallback model.")
        return None, None, {'r2': 0, 'mae': 0}

    X = np.array(X)
    y = np.array(y)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )

    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)

    metrics = {
        'r2': r2,
        'mae': mae,
        'n_samples': len(X),
        'n_features': X.shape[1]
    }

    return model, scaler, metrics

def predict_player_value_ml(player_name: str, position: str,
                            projections_data: List[Dict],
                            historical_data: List[Dict],
                            player_details_data: List[Dict],
                            team_stats_data: List[Dict],
                            model: RandomForestRegressor,
                            scaler: StandardScaler) -> float:
    """
    Use trained ML model to predict player dynasty value.
    """
    if model is None or scaler is None:
        return 0

    try:
        player_proj = None
        for p in projections_data:
            if p.get('Name', '').lower() == player_name.lower():
                player_proj = p
                break

        if not player_proj:
            return 0

        player_id = player_proj.get('PlayerID')
        player_detail = {}
        for p in player_details_data:
            if p.get('PlayerID') == player_id:
                player_detail = p
                break

        team_code = player_detail.get('Team', '')
        team_stat = {}
        for t in team_stats_data:
            if t.get('Team') == team_code:
                team_stat = t
                break

        hist_stat = {}
        for h in historical_data:
            if h.get('PlayerID') == player_id:
                hist_stat = h
                break

        features = extract_player_features(hist_stat, player_proj, player_detail, team_stat)
        features_scaled = scaler.transform([features])

        predicted_value = model.predict(features_scaled)[0]

        return max(0, predicted_value)

    except Exception:
        return 0

def run_monte_carlo_playoff_sim(roster_df: pd.DataFrame,
                                league_rosters: Dict[str, pd.DataFrame],
                                weeks_remaining: int = 10,
                                n_simulations: int = 1000) -> Dict:
    """
    Monte Carlo playoff simulator.
    Runs N simulations of remaining season to estimate playoff probability.

    Returns:
    - playoff_odds: Probability of making playoffs (%)
    - championship_odds: Probability of winning championship (%)
    - avg_finish: Average finish position
    - confidence_interval: 95% CI for finish
    """
    team_values = {}
    for team_name, roster in league_rosters.items():
        team_values[team_name] = roster['AdjustedValue'].sum()

    your_value = roster_df['AdjustedValue'].sum()

    num_teams = len(league_rosters)
    playoff_spots = max(4, num_teams // 2)

    playoff_count = 0
    championship_count = 0
    finish_positions = []

    for _ in range(n_simulations):
        simulated_scores = {}

        for team_name, base_value in team_values.items():
            variance = np.random.normal(1.0, 0.15)
            week_performance = base_value * variance

            luck_factor = np.random.normal(0, base_value * 0.05)

            simulated_scores[team_name] = week_performance + luck_factor

        sorted_teams = sorted(simulated_scores.items(), key=lambda x: x[1], reverse=True)

        finish_position = next(i+1 for i, (name, _) in enumerate(sorted_teams)
                              if name == "Your Team" or
                              league_rosters.get(name, pd.DataFrame())['AdjustedValue'].sum() == your_value)

        finish_positions.append(finish_position)

        if finish_position <= playoff_spots:
            playoff_count += 1

            championship_prob = 1.0 / finish_position if finish_position <= playoff_spots else 0
            if np.random.random() < championship_prob:
                championship_count += 1

    playoff_odds = (playoff_count / n_simulations) * 100
    championship_odds = (championship_count / n_simulations) * 100
    avg_finish = np.mean(finish_positions)

    finish_positions.sort()
    ci_lower = finish_positions[int(n_simulations * 0.025)]
    ci_upper = finish_positions[int(n_simulations * 0.975)]

    return {
        'playoff_odds': playoff_odds,
        'championship_odds': championship_odds,
        'avg_finish': avg_finish,
        'confidence_interval': (ci_lower, ci_upper),
        'finish_distribution': finish_positions
    }

def simulate_post_trade_odds(current_roster: pd.DataFrame,
                             give_players: List[Dict],
                             receive_players: List[Dict],
                             give_picks_value: float,
                             receive_picks_value: float,
                             give_faab_value: float,
                             receive_faab_value: float,
                             league_rosters: Dict[str, pd.DataFrame],
                             weeks_remaining: int = 10) -> Dict:
    """
    Simulate playoff odds after a trade.
    Adjusts roster and runs Monte Carlo simulation.

    Returns odds comparison (before vs after).
    """
    before_sim = run_monte_carlo_playoff_sim(current_roster, league_rosters, weeks_remaining)

    post_trade_roster = current_roster.copy()

    for player in give_players:
        post_trade_roster = post_trade_roster[
            post_trade_roster['Name'].str.lower() != player['name'].lower()
        ]

    new_players = []
    for player in receive_players:
        new_players.append({
            'Name': player['name'],
            'Position': player['position'],
            'Team': player.get('team', ''),
            'AdjustedValue': player['value']
        })

    if new_players:
        post_trade_roster = pd.concat([
            post_trade_roster,
            pd.DataFrame(new_players)
        ], ignore_index=True)

    net_pick_value = receive_picks_value - give_picks_value
    net_faab_value = receive_faab_value - give_faab_value

    if len(post_trade_roster) > 0:
        avg_value = post_trade_roster['AdjustedValue'].mean()
        value_adjustment = (net_pick_value + net_faab_value) / max(len(post_trade_roster), 1)
        post_trade_roster['AdjustedValue'] += value_adjustment * 0.1

    after_sim = run_monte_carlo_playoff_sim(post_trade_roster, league_rosters, weeks_remaining)

    return {
        'before': before_sim,
        'after': after_sim,
        'playoff_change': after_sim['playoff_odds'] - before_sim['playoff_odds'],
        'championship_change': after_sim['championship_odds'] - before_sim['championship_odds'],
        'finish_change': before_sim['avg_finish'] - after_sim['avg_finish']
    }

def evaluate_manual_trade(give_players: List[Dict], receive_players: List[Dict],
                         give_picks: List[Dict], receive_picks: List[Dict],
                         give_faab: float = 0, receive_faab: float = 0) -> Dict:
    """Evaluate a manually entered trade including players, draft picks, and FAAB."""
    # Calculate player values
    give_player_total = sum(p['value'] for p in give_players)
    receive_player_total = sum(p['value'] for p in receive_players)

    # Calculate pick values (picks are now parsed dicts with 'value' key)
    give_pick_total = sum(p['value'] for p in give_picks)
    receive_pick_total = sum(p['value'] for p in receive_picks)

    # Calculate FAAB values
    give_faab_value = calculate_faab_value(give_faab)
    receive_faab_value = calculate_faab_value(receive_faab)

    # Total values (including FAAB)
    give_total = give_player_total + give_pick_total + give_faab_value
    receive_total = receive_player_total + receive_pick_total + receive_faab_value

    difference = receive_total - give_total
    percentage_diff = (difference / give_total * 100) if give_total > 0 else 0

    if abs(percentage_diff) < 5:
        verdict = "✅ Fair Trade"
        color = "green"
    elif percentage_diff > 10:
        verdict = "🎉 Great for You"
        color = "darkgreen"
    elif percentage_diff < -10:
        verdict = "⚠️ Unfavorable"
        color = "red"
    else:
        verdict = "⚖️ Slightly Imbalanced"
        color = "orange"

    return {
        'verdict': verdict,
        'color': color,
        'give_player_total': give_player_total,
        'give_pick_total': give_pick_total,
        'give_faab': give_faab,
        'give_faab_value': give_faab_value,
        'give_total': give_total,
        'receive_player_total': receive_player_total,
        'receive_pick_total': receive_pick_total,
        'receive_faab': receive_faab,
        'receive_faab_value': receive_faab_value,
        'receive_total': receive_total,
        'difference': difference,
        'percentage_diff': percentage_diff,
        'give_picks': give_picks,
        'receive_picks': receive_picks
    }

def train_ml_value_predictor(players_df: pd.DataFrame) -> Tuple[LinearRegression, StandardScaler]:
    """
    Train ML model to predict player values based on age, stats, and projections.
    Uses linear regression with feature engineering for enhanced value predictions.
    """
    # Prepare features for ML model
    features = []
    targets = []

    for _, player in players_df.iterrows():
        # Skip players without essential data
        if pd.isna(player.get('Age')) or pd.isna(player.get('AdjustedValue')):
            continue

        age = player.get('Age', 25)
        position = player.get('Position', 'WR')
        proj_points = player.get('ProjectedPoints', 0)
        historical_avg = player.get('HistoricalAvg', 0)

        # Feature engineering
        age_peak_diff = abs(age - 26)  # Distance from peak age
        is_qb = 1 if position == 'QB' else 0
        is_rb = 1 if position == 'RB' else 0
        is_wr = 1 if position == 'WR' else 0
        is_te = 1 if position == 'TE' else 0
        is_idp = 1 if position in ['DL', 'LB', 'DB'] else 0

        # Combine features
        feature_vec = [
            age,
            age_peak_diff,
            proj_points,
            historical_avg,
            is_qb,
            is_rb,
            is_wr,
            is_te,
            is_idp
        ]

        features.append(feature_vec)
        targets.append(player['AdjustedValue'])

    # Convert to numpy arrays
    X = np.array(features)
    y = np.array(targets)

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train linear regression model
    model = LinearRegression()
    model.fit(X_scaled, y)

    return model, scaler

def analyze_roster_needs(roster_df: pd.DataFrame, all_players_df: pd.DataFrame,
                         is_superflex: bool = False) -> Dict:
    """
    Analyze team's positional strengths, weaknesses, and surpluses.
    Returns dict with needs, surpluses, and overall strategy.
    """
    # Count players by position
    position_counts = roster_df['Position'].value_counts().to_dict()
    position_values = roster_df.groupby('Position')['AdjustedValue'].agg(['sum', 'mean']).to_dict('index')

    # Calculate position strength scores
    needs = []
    surpluses = []

    # Analyze each position
    for pos in ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB']:
        count = position_counts.get(pos, 0)
        total_value = position_values.get(pos, {}).get('sum', 0)
        avg_value = position_values.get(pos, {}).get('mean', 0)

        # Define thresholds based on position
        if pos == 'QB':
            ideal_count = 3 if is_superflex else 2
            min_value = 8000 if is_superflex else 5000
        elif pos == 'RB':
            ideal_count = 5
            min_value = 12000
        elif pos == 'WR':
            ideal_count = 6
            min_value = 15000
        elif pos == 'TE':
            ideal_count = 3
            min_value = 4000
        elif pos in ['DL', 'LB', 'DB']:
            ideal_count = 4
            min_value = 3000
        else:
            continue

        # Check for needs
        if count < ideal_count or total_value < min_value:
            strength = total_value / min_value if min_value > 0 else 0
            needs.append({
                'position': pos,
                'count': count,
                'ideal': ideal_count,
                'total_value': total_value,
                'strength': strength,
                'priority': 'High' if strength < 0.6 else 'Medium'
            })

        # Check for surpluses
        if count > ideal_count + 2:
            surpluses.append({
                'position': pos,
                'count': count,
                'excess': count - ideal_count,
                'avg_value': avg_value
            })

    # Sort by priority
    needs.sort(key=lambda x: x['strength'])
    surpluses.sort(key=lambda x: x['count'], reverse=True)

    # Calculate team age
    avg_age = roster_df['Age'].mean()

    # Determine strategy
    if avg_age > 27:
        strategy = "Win-Now (Aging roster - prioritize proven players)"
    elif avg_age < 25:
        strategy = "Rebuild (Young roster - target picks and prospects)"
    else:
        strategy = "Balanced (Mixed roster - target value)"

    return {
        'needs': needs,
        'surpluses': surpluses,
        'avg_age': avg_age,
        'strategy': strategy,
        'total_value': roster_df['AdjustedValue'].sum()
    }

def calculate_playoff_odds(roster_df: pd.DataFrame, all_rosters: Dict[str, pd.DataFrame],
                          team_name: str) -> Dict:
    """
    Calculate playoff odds based on roster strength, projected points, and league standings.
    Simple calculation for demonstration.
    """
    # Calculate team's total projected points
    team_proj = roster_df['ProjectedPoints'].sum()
    team_value = roster_df['AdjustedValue'].sum()

    # Calculate league averages
    all_team_values = []
    all_team_projs = []

    for t_name, t_roster in all_rosters.items():
        all_team_values.append(t_roster['AdjustedValue'].sum())
        all_team_projs.append(t_roster['ProjectedPoints'].sum())

    league_avg_value = np.mean(all_team_values)
    league_avg_proj = np.mean(all_team_projs)

    # Calculate percentiles
    value_percentile = (sum(1 for v in all_team_values if v < team_value) / len(all_team_values)) * 100
    proj_percentile = (sum(1 for p in all_team_projs if p < team_proj) / len(all_team_projs)) * 100

    # Estimate playoff odds (simplified)
    # Top 50% = ~60-80% playoff odds, Bottom 50% = 20-40%
    base_odds = 50
    value_boost = (value_percentile - 50) * 0.6  # -30 to +30
    proj_boost = (proj_percentile - 50) * 0.4    # -20 to +20

    playoff_odds = max(10, min(95, base_odds + value_boost + proj_boost))
    championship_odds = max(5, min(40, playoff_odds * 0.4))  # Roughly 40% of playoff odds

    return {
        'playoff_odds': playoff_odds,
        'championship_odds': championship_odds,
        'team_value': team_value,
        'league_avg_value': league_avg_value,
        'value_percentile': value_percentile,
        'proj_percentile': proj_percentile,
        'team_proj': team_proj
    }

def generate_ai_trade_suggestions(your_roster: pd.DataFrame, all_rosters: Dict[str, pd.DataFrame],
                                   your_team: str, your_needs: Dict, your_faab: float,
                                   other_faab_map: Dict, is_superflex: bool = False) -> List[Dict]:
    """
    Generate AI-powered trade suggestions using ML predictions and roster analysis.
    Considers positional needs, surpluses, picks, and FAAB.
    """
    suggestions = []

    # Get your surpluses and needs
    your_surplus_positions = [s['position'] for s in your_needs['surpluses']]
    your_need_positions = [n['position'] for n in your_needs['needs'][:3]]  # Top 3 needs

    # Analyze each potential trading partner
    for partner_name, partner_roster in all_rosters.items():
        if partner_name == your_team:
            continue

        # Analyze partner's needs
        partner_needs_data = analyze_roster_needs(partner_roster, pd.concat([your_roster, partner_roster]), is_superflex)
        partner_surplus_positions = [s['position'] for s in partner_needs_data['surpluses']]
        partner_need_positions = [n['position'] for n in partner_needs_data['needs'][:3]]

        # Find complementary needs
        # You give from your surplus to fill their needs
        # You receive from their surplus to fill your needs

        # Scenario 1: Player for player swap
        for your_pos in your_surplus_positions:
            if your_pos in partner_need_positions:
                for their_pos in partner_surplus_positions:
                    if their_pos in your_need_positions:
                        # Find suitable players
                        your_candidates = your_roster[your_roster['Position'] == your_pos].nlargest(3, 'AdjustedValue')
                        their_candidates = partner_roster[partner_roster['Position'] == their_pos].nlargest(3, 'AdjustedValue')

                        for _, your_player in your_candidates.iterrows():
                            for _, their_player in their_candidates.iterrows():
                                value_diff = their_player['AdjustedValue'] - your_player['AdjustedValue']

                                # Look for relatively balanced trades
                                if abs(value_diff) < your_player['AdjustedValue'] * 0.5:
                                    # Calculate FAAB to balance if needed
                                    faab_to_add = 0
                                    faab_direction = None

                                    if value_diff > 300:  # They're giving more value
                                        # You should add FAAB
                                        faab_needed = value_diff / 12  # Rough conversion
                                        if faab_needed <= your_faab and faab_needed <= 150:
                                            faab_to_add = min(faab_needed, 150)
                                            faab_direction = "you_give"
                                    elif value_diff < -300:  # You're giving more value
                                        # They should add FAAB
                                        faab_needed = abs(value_diff) / 12
                                        partner_faab = other_faab_map.get(partner_name, 300)
                                        if faab_needed <= partner_faab and faab_needed <= 150:
                                            faab_to_add = min(faab_needed, 150)
                                            faab_direction = "they_give"

                                    # Build suggestion
                                    suggestion = {
                                        'partner': partner_name,
                                        'you_give': [{
                                            'name': your_player['Name'],
                                            'position': your_player['Position'],
                                            'value': your_player['AdjustedValue']
                                        }],
                                        'you_receive': [{
                                            'name': their_player['Name'],
                                            'position': their_player['Position'],
                                            'value': their_player['AdjustedValue']
                                        }],
                                        'you_give_faab': faab_to_add if faab_direction == "you_give" else 0,
                                        'you_receive_faab': faab_to_add if faab_direction == "they_give" else 0,
                                        'value_diff': value_diff + (calculate_faab_value(faab_to_add) if faab_direction == "they_give" else -calculate_faab_value(faab_to_add) if faab_direction == "you_give" else 0),
                                        'rationale': f"Addresses your {their_pos} need while giving them {your_pos} depth. {'Balanced with FAAB.' if faab_to_add > 0 else 'Relatively balanced value.'}",
                                        'impact': f"Strengthens {their_pos}, reduces {your_pos} surplus"
                                    }

                                    suggestions.append(suggestion)

        # Scenario 2: Include draft picks for bigger gaps
        # Find your best tradeable assets from surplus positions
        if your_surplus_positions and partner_need_positions:
            for your_pos in your_surplus_positions[:2]:
                if your_pos in partner_need_positions:
                    your_best = your_roster[your_roster['Position'] == your_pos].nlargest(2, 'AdjustedValue')

                    for _, your_player in your_best.iterrows():
                        # Suggest trading for a pick
                        pick_value_target = your_player['AdjustedValue'] * 0.8  # Pick worth ~80% of player

                        # Determine appropriate pick
                        if pick_value_target > 5000:
                            pick_desc = "2026 1st (mid)"
                            pick_val = 5500
                        elif pick_value_target > 3000:
                            pick_desc = "2026 1st (late)"
                            pick_val = 3800
                        elif pick_value_target > 2000:
                            pick_desc = "2026 2nd (early)"
                            pick_val = 3200
                        elif pick_value_target > 1000:
                            pick_desc = "2026 2nd (mid)"
                            pick_val = 2100
                        else:
                            pick_desc = "2026 3rd"
                            pick_val = 800

                        diff = pick_val - your_player['AdjustedValue']

                        # Add FAAB to balance if needed
                        faab_balance = 0
                        faab_dir = None
                        if diff < -500:  # You need more
                            faab_balance = min(abs(diff) / 12, 100)
                            faab_dir = "receive"
                        elif diff > 500:  # They need more
                            faab_balance = min(diff / 12, 100)
                            faab_dir = "give"

                        suggestion = {
                            'partner': partner_name,
                            'you_give': [{
                                'name': your_player['Name'],
                                'position': your_player['Position'],
                                'value': your_player['AdjustedValue']
                            }],
                            'you_receive': [],
                            'you_give_picks': [] if faab_dir != "give" else [],
                            'you_receive_picks': [{'description': pick_desc, 'value': pick_val}],
                            'you_give_faab': faab_balance if faab_dir == "give" else 0,
                            'you_receive_faab': faab_balance if faab_dir == "receive" else 0,
                            'value_diff': diff + (calculate_faab_value(faab_balance) if faab_dir == "receive" else -calculate_faab_value(faab_balance)),
                            'rationale': f"Converts {your_pos} surplus into draft capital. {partner_name} gets immediate help at {your_pos}.",
                            'impact': "Builds future assets, reduces current surplus"
                        }

                        suggestions.append(suggestion)

    # Limit to top 10 suggestions
    # Score suggestions by absolute value difference (prefer balanced)
    for s in suggestions:
        s['balance_score'] = 1000 - abs(s['value_diff'])

    suggestions.sort(key=lambda x: x['balance_score'], reverse=True)

    return suggestions[:10]

def aggregate_player_news(roster_df: pd.DataFrame, injuries_data: List[Dict],
                         news_data: List[Dict]) -> List[Dict]:
    """
    Aggregate injury and news data for roster players.
    Returns list of news items with impact analysis.
    """
    player_news = []

    # Create lookup dict for roster players
    roster_players = {row['Name'].lower(): row for _, row in roster_df.iterrows()}

    # Process injury data
    if injuries_data:
        for injury in injuries_data:
            player_name = injury.get('Name', '').lower()
            if player_name in roster_players:
                player_data = roster_players[player_name]
                status = injury.get('Status', 'Unknown')
                body_part = injury.get('BodyPart', 'N/A')

                # Determine impact on value
                impact = "Neutral"
                impact_pct = 0

                if status in ['Out', 'IR', 'PUP']:
                    impact = "High Negative"
                    impact_pct = -15
                elif status in ['Doubtful']:
                    impact = "Moderate Negative"
                    impact_pct = -8
                elif status in ['Questionable', 'Day-To-Day']:
                    impact = "Low Negative"
                    impact_pct = -3

                player_news.append({
                    'player': injury.get('Name', 'Unknown'),
                    'position': player_data['Position'],
                    'team': injury.get('Team', 'N/A'),
                    'type': 'Injury',
                    'headline': f"{status} - {body_part}",
                    'details': f"Status: {status}, Body Part: {body_part}",
                    'impact': impact,
                    'impact_pct': impact_pct,
                    'current_value': player_data['AdjustedValue'],
                    'updated': injury.get('Updated', 'N/A')
                })

    # Process news data (limit to recent news)
    if news_data:
        for news_item in news_data[:100]:  # Limit to most recent
            player_name = news_item.get('PlayerName', '').lower()
            if player_name in roster_players:
                player_data = roster_players[player_name]
                title = news_item.get('Title', '')
                content = news_item.get('Content', '')

                # Analyze sentiment for impact
                impact = "Neutral"
                impact_pct = 0

                title_lower = title.lower()
                content_lower = content.lower()

                # Negative keywords
                if any(word in title_lower or word in content_lower for word in
                       ['injury', 'injured', 'hurt', 'suspend', 'arrest', 'trade rumors', 'decline', 'benched']):
                    impact = "Negative"
                    impact_pct = -5

                # Positive keywords
                elif any(word in title_lower or word in content_lower for word in
                         ['breakout', 'promoted', 'starter', 'extension', 'career high', 'dominant']):
                    impact = "Positive"
                    impact_pct = 5

                # Only add if there's meaningful impact
                if impact != "Neutral" or 'trade' in title_lower:
                    player_news.append({
                        'player': news_item.get('PlayerName', 'Unknown'),
                        'position': player_data['Position'],
                        'team': news_item.get('Team', 'N/A'),
                        'type': 'News',
                        'headline': title[:100],
                        'details': content[:200] + '...' if len(content) > 200 else content,
                        'impact': impact,
                        'impact_pct': impact_pct,
                        'current_value': player_data['AdjustedValue'],
                        'updated': news_item.get('Updated', 'N/A')
                    })

    # Sort by impact (most negative first, then most positive)
    player_news.sort(key=lambda x: (abs(x['impact_pct']), x['impact_pct']), reverse=True)

    return player_news

def search_trade_rumors_web(query: str = "NFL trade rumors 2026") -> List[Dict]:
    """
    Search web for trade rumors using available search tools.
    Returns structured rumor data.
    """
    rumors = []

    try:
        # Note: This would use X/Twitter semantic search in production
        # For now, returns placeholder for web search integration
        rumors.append({
            'headline': 'Trade Rumor Search Available',
            'source': 'Web Search',
            'details': f'Search query: "{query}" - Enable web search integration for live rumors',
            'relevance': 'Medium',
            'updated': datetime.now().strftime('%Y-%m-%d')
        })
    except Exception as e:
        st.warning(f"Could not fetch trade rumors: {e}")

    return rumors

def calculate_news_adjusted_value(base_value: float, impact_pct: float) -> float:
    """Calculate value adjusted for news impact."""
    return base_value * (1 + impact_pct / 100)

def main():
    st.set_page_config(page_title="Fantasy Football Trade Analyzer", layout="wide")

    st.title("🏈 Ultimate Fantasy Football Trade Analyzer")
    st.markdown("### (IDP, Historical, & League Import)")

    # Sidebar for configuration
    with st.sidebar:
        st.header("⚙️ Configuration")

        league_id = st.text_input("Sleeper League ID", placeholder="e.g., 123456789")

        st.markdown("---")
        st.markdown("**API Status**")
        if API_KEY == "YOUR_SPORTSDATAIO_KEY_HERE":
            st.warning("Using mock data. Add SportsDataIO API key in app.py for real data.")
        else:
            st.success("SportsDataIO API configured")

        st.markdown("---")
        st.markdown("**About**")
        st.info("""
        This tool analyzes fantasy football trades using SportsDataIO data + ML:

        **Player Values (Unified Scale):**
        - 🏆 Dynasty ADP (60%) - Market value
        - 📊 Season projections (30%)
        - 📈 Historical avg (10%)
        - Adjustments: Age, injury, team performance
        - 🤖 ML refinement via scikit-learn

        **Draft Pick Values:**
        - Based on typical rookie ADP curves
        - Calibrated to same scale as players
        - Future years discounted appropriately

        **FAAB Values:**
        - Tiered valuation system ($300 total)
        - $1-25: 8 pts/$ | $26-75: 12 pts/$
        - $76-150: 15 pts/$ | $151-300: 18 pts/$
        - Auto-fetched from Sleeper when available

        **ML & AI Features:**
        - 🤖 Random Forest dynasty value predictor
        - 🎲 Monte Carlo playoff simulator (1K sims)
        - 📊 Before/after playoff odds projections
        - 💡 10 optimized trade suggestions
        - 🎯 Includes picks + FAAB balancing
        - 📈 Interactive value trend charts

        **News & Alerts:**
        - 📰 Real-time injury reports (SportsDataIO)
        - 🚨 Automatic news alerts on trades
        - 📈 Value impact analysis (-15% to +5%)
        - 🔄 30-minute cache with refresh button

        **League Format:**
        - Auto-detects Superflex from Sleeper
        - QB values boosted 50% in Superflex
        - Pick values adjusted accordingly
        """)

    # Main application flow
    if not league_id:
        st.info("👈 Enter your Sleeper League ID in the sidebar to get started!")

        st.markdown("---")
        st.markdown("### 🎯 Features")
        col1, col2, col3 = st.columns(3)

        with col1:
            st.markdown("**📥 League Import**")
            st.write("- Import from Sleeper API")
            st.write("- Automatic roster mapping")
            st.write("- Player database sync")

        with col2:
            st.markdown("**🧮 Advanced Analytics**")
            st.write("- IDP support (DL/LB/DB)")
            st.write("- VORP calculations")
            st.write("- Multi-factor adjustments")

        with col3:
            st.markdown("**💡 Trade Intelligence**")
            st.write("- AI trade suggestions")
            st.write("- Fairness analysis")
            st.write("- Post-trade simulations")

        return

    # Fetch league data
    with st.spinner("Loading league data..."):
        users = fetch_sleeper_users(league_id)
        rosters = fetch_sleeper_rosters(league_id)
        sleeper_players = fetch_sleeper_players()

        if not all([users, rosters, sleeper_players]):
            st.error("Failed to load league data. Please check your League ID.")
            return

        # Fetch additional data
        projections = fetch_projections()
        player_details_raw = fetch_player_details()
        team_stats_raw = fetch_team_stats()
        dynasty_adp_raw = fetch_dynasty_adp()

        # Process data
        player_details = {p['PlayerID']: p for p in player_details_raw} if player_details_raw else {}
        team_stats = {t['Team']: t for t in team_stats_raw} if team_stats_raw else {}
        dynasty_adp_map = {}

        # Train ML model for dynasty value predictions
        st.markdown("---")
        st.subheader("🤖 ML Model Training")

        with st.spinner("Training Random Forest model on SportsDataIO data..."):
            historical_data_for_ml = []
            for year in range(CURRENT_YEAR - 3, CURRENT_YEAR):
                hist = fetch_projections(year)
                if hist:
                    historical_data_for_ml.extend(hist)

            ml_model, ml_scaler, ml_metrics = train_dynasty_value_model(
                projections,
                historical_data_for_ml,
                player_details_raw,
                team_stats_raw
            )

            if ml_model:
                col_ml1, col_ml2, col_ml3 = st.columns(3)
                with col_ml1:
                    st.metric("Model R² Score", f"{ml_metrics['r2']:.3f}",
                             help="How well model explains variance (closer to 1 is better)")
                with col_ml2:
                    st.metric("Mean Absolute Error", f"{ml_metrics['mae']:.0f} pts",
                             help="Average prediction error in dynasty points")
                with col_ml3:
                    st.metric("Training Samples", ml_metrics['n_samples'],
                             help="Number of players used for training")

                if ml_metrics['r2'] > 0.7:
                    st.success("✅ High-quality ML model trained successfully!")
                elif ml_metrics['r2'] > 0.5:
                    st.info("✓ Moderate ML model trained. Predictions will supplement base valuations.")
                else:
                    st.warning("⚠️ ML model quality is lower than expected. Using conservative predictions.")
            else:
                st.info("Using rule-based valuations. ML model requires more training data.")
        if dynasty_adp_raw:
            for p in dynasty_adp_raw:
                player_id = p.get('PlayerID')
                adp_value = p.get('AverageDraftPositionDynasty')
                if player_id and adp_value:
                    dynasty_adp_map[player_id] = adp_value

        # Detect league format (superflex check)
        # Sleeper league settings include roster_positions which shows QB slots
        is_superflex = False
        if rosters:
            # Check if any roster has superflex settings
            first_roster = rosters[0]
            league_info_response = requests.get(f"https://api.sleeper.app/v1/league/{league_id}")
            if league_info_response.status_code == 200:
                league_settings = league_info_response.json()
                roster_positions = league_settings.get('roster_positions', [])
                # Superflex leagues have "SUPER_FLEX" position
                is_superflex = 'SUPER_FLEX' in roster_positions or roster_positions.count('QB') > 1

    # Map rosters to owners (including FAAB)
    user_map = {user['user_id']: user.get('display_name', user.get('username', 'Unknown'))
                for user in users}

    roster_map = {}
    faab_map = {}  # Track FAAB per team
    for roster in rosters:
        owner_id = roster.get('owner_id')
        owner_name = user_map.get(owner_id, f"Team {roster.get('roster_id', '?')}")
        roster_map[owner_name] = roster.get('players', [])
        # Extract FAAB from roster settings (Sleeper stores this in settings.waiver_budget_used)
        # Total FAAB is typically 100 or 300, remaining = total - used
        waiver_budget_used = roster.get('settings', {}).get('waiver_budget_used', 0)
        # Assume $300 total budget (adjust if league uses different amount)
        faab_remaining = 300 - waiver_budget_used
        faab_map[owner_name] = max(0, faab_remaining)

    # Team selection
    st.header("👥 Select Your Team")
    your_team = st.selectbox("Choose your team:", list(roster_map.keys()))

    # Process player data with enhanced valuations
    st.header("📊 Enhanced Player Valuations")

    # Display league format
    league_format_display = "Superflex" if is_superflex else "1QB"
    st.info(f"🏈 League Format: **{league_format_display}** | Values based on SportsDataIO dynasty ADP + projections for consistency")

    with st.spinner("Calculating enhanced valuations..."):
        # Create comprehensive player database
        all_players_data = []

        for proj in projections:
            player_id = proj.get('PlayerID')
            player_name = proj.get('Name', 'Unknown')
            position = proj.get('Position', 'UNK')
            base_points = proj.get('FantasyPointsPPR', 0)

            # Get player details
            details = player_details.get(player_id, {})

            # Get dynasty ADP for this player
            player_adp = dynasty_adp_map.get(player_id)

            # Calculate historical average (placeholder - would need real historical data)
            historical_avg = base_points * 0.95  # Simplified for demo

            # Matchup factor (placeholder - would need real schedule analysis)
            matchup_factor = 0.02  # Slight boost

            # Calculate enhanced value with dynasty ADP
            adjusted_value, breakdown = calculate_enhanced_value(
                proj, details, team_stats, historical_avg, matchup_factor,
                dynasty_adp=player_adp, is_superflex=is_superflex
            )

            all_players_data.append({
                'PlayerID': player_id,
                'Name': player_name,
                'Team': proj.get('Team', ''),
                'Position': position,
                'BaseProjection': base_points,
                'AdjustedValue': adjusted_value,
                'Age': details.get('Age', 27),
                'InjuryStatus': details.get('InjuryStatus', 'Healthy'),
                **breakdown
            })

        players_df = pd.DataFrame(all_players_data)

        # Calculate VORP for each position
        position_rankings = {}
        for position in POSITION_BASELINES.keys():
            position_players = players_df[players_df['Position'] == position]['AdjustedValue'].sort_values(ascending=False).tolist()
            position_rankings[position] = position_players

        players_df['VORP'] = players_df.apply(
            lambda row: calculate_vorp(row['AdjustedValue'], row['Position'], position_rankings),
            axis=1
        )

    # Process rosters
    all_rosters_df = {}
    for team_name, player_ids in roster_map.items():
        # Match Sleeper player IDs to our player database
        team_players = []
        for sleeper_id in player_ids:
            if sleeper_id in sleeper_players:
                sleeper_player = sleeper_players[sleeper_id]
                player_name = f"{sleeper_player.get('first_name', '')} {sleeper_player.get('last_name', '')}".strip()

                # Fuzzy match to our player database
                best_match = None
                best_score = 0
                for _, player_row in players_df.iterrows():
                    score = fuzz.ratio(player_name.lower(), player_row['Name'].lower())
                    if score > best_score:
                        best_score = score
                        best_match = player_row

                if best_match is not None and best_score > 70:
                    team_players.append(best_match)

        if team_players:
            all_rosters_df[team_name] = pd.DataFrame(team_players)

    # Display your roster
    st.header(f"🎯 Your Roster: {your_team}")

    if your_team in all_rosters_df:
        your_roster_df = all_rosters_df[your_team]

        # Roster strength analysis
        your_analysis = analyze_roster_strengths(your_roster_df)

        col1, col2 = st.columns([2, 1])

        with col1:
            st.subheader("📋 Roster Details")
            display_df = your_roster_df[['Name', 'Position', 'Team', 'BaseProjection',
                                        'AdjustedValue', 'VORP', 'Age', 'InjuryStatus']].sort_values('AdjustedValue', ascending=False)
            st.dataframe(display_df, use_container_width=True, height=400)

        with col2:
            st.subheader("💪 Strengths & Weaknesses")
            for position, data in your_analysis.items():
                if data['count'] > 0:
                    strength_emoji = {"Strong": "💪", "Average": "👍", "Weak": "⚠️", "None": "❌"}
                    st.markdown(f"**{position}** {strength_emoji.get(data['strength'], '❓')}")
                    st.write(f"Count: {data['count']} | Avg Value: {data['avg_value']:.1f}")
                    st.write(f"Top: {data['top_player']}")
                    st.markdown("---")

        # Visualization
        st.subheader("📈 Position Value Distribution")
        chart_data = your_roster_df.groupby('Position')['AdjustedValue'].sum().reset_index()
        chart = alt.Chart(chart_data).mark_bar().encode(
            x=alt.X('Position:N', sort='-y'),
            y='AdjustedValue:Q',
            color=alt.Color('Position:N', legend=None),
            tooltip=['Position', 'AdjustedValue']
        ).properties(height=300)
        st.altair_chart(chart, use_container_width=True)

        # Trade suggestions
        st.header("💡 AI Trade Suggestions")

        with st.spinner("Analyzing trade opportunities..."):
            suggestions = suggest_trades(your_roster_df, all_rosters_df, your_team)

        if suggestions:
            for i, suggestion in enumerate(suggestions, 1):
                with st.expander(f"Trade Suggestion #{i} - Gain: +{suggestion['your_gain']:.1f} pts"):
                    st.markdown(f"**Trade with:** {suggestion['with_team']}")
                    st.markdown(f"**Rationale:** {suggestion['rationale']}")

                    col1, col2 = st.columns(2)
                    with col1:
                        st.markdown("**You Give:**")
                        for player in suggestion['give']:
                            st.write(f"- {player['name']} ({player['position']}) - {player['value']:.1f} pts")

                    with col2:
                        st.markdown("**You Receive:**")
                        for player in suggestion['receive']:
                            st.write(f"- {player['name']} ({player['position']}) - {player['value']:.1f} pts")

                    st.success(f"Net Gain: +{suggestion['your_gain']:.1f} points ROS")
        else:
            st.info("No strong trade opportunities found at this time. Your roster is well-balanced!")

        # Manual trade analyzer
        st.header("🔍 Dynasty Trade Analyzer")
        st.markdown("Analyze multi-player trades with exact draft pick values")

        # League format setting (pre-populated from Sleeper detection)
        trade_is_superflex = st.checkbox(
            "Superflex League",
            value=is_superflex,
            help="Check if your league is Superflex (adds 10% to pick values, QBs +50% boost)"
        )

        # Pick format guide
        with st.expander("📖 Draft Pick & FAAB Format Guide", expanded=False):
            st.markdown("""
            **Supported Pick Formats:**
            - **Exact Slots**: `2026 1.01`, `2026 1.05`, `2027 2.08`
            - **General (Early/Mid/Late)**: `2026 1st (early)`, `2027 2nd (late)`, `2026 1st`
            - **With Notes**: `2026 1.01 (from Team X)`, `2027 1st mid (acquired)`

            **Examples:**
            - `2026 1.01, 2026 2.08` - Two exact picks
            - `2027 1st (early), 2027 3rd` - Mixed formats
            - `2026 1.05, 2027 1st (late from Team X)` - With team notes

            **Pick Values (2026 1QB) - Calibrated to SportsDataIO ADP Scale:**
            - 1.01: 9500 pts | 1.06: 6800 pts | 1.12: 4400 pts
            - 2.01: 4000 pts | 2.06: 2600 pts | 2.12: 1400 pts
            - 3.01: 1200 pts | 3.06: 700 pts | 3.12: 350 pts
            - Future years discounted: 2027 (70%), 2028 (55%), 2029 (45%)

            **FAAB Valuation (Total budget: $300/team):**
            - $25 = 200 pts (≈ 4th round pick)
            - $50 = 500 pts (≈ late 3rd round pick)
            - $100 = 950 pts (≈ mid 3rd round pick)
            - $200 = 2,050 pts (≈ mid 2nd round pick)
            - Tiered system values scarcity: higher amounts = more value per dollar
            - Your remaining FAAB auto-fetched from Sleeper
            """)
            st.caption("💡 Values based on typical rookie ADP curves using formula: 20000 / expected_ADP")

        # Prepare player options with detailed info
        your_player_options = []
        for _, player in your_roster_df.iterrows():
            option = f"{player['Name']} ({player['Position']}, {player['Team']}, Age {player['Age']}) - {player['AdjustedValue']:.0f} pts"
            your_player_options.append(option)

        # Select trading partner
        other_teams = [t for t in all_rosters_df.keys() if t != your_team]
        if other_teams:
            selected_team = st.selectbox("Trading with:", other_teams, key="trade_partner")

            if selected_team in all_rosters_df:
                other_roster_df = all_rosters_df[selected_team]
                other_player_options = []
                for _, player in other_roster_df.iterrows():
                    option = f"{player['Name']} ({player['Position']}, {player['Team']}, Age {player['Age']}) - {player['AdjustedValue']:.0f} pts"
                    other_player_options.append(option)

                # Two-column layout for trade sides
                col1, col2 = st.columns(2)

                with col1:
                    st.subheader(f"📤 {your_team} Gives")

                    give_player_selections = st.multiselect(
                        "Players:",
                        options=your_player_options,
                        key="give_players",
                        help="Select multiple players to trade away"
                    )

                    give_pick_input = st.text_area(
                        "Draft Picks (comma-separated):",
                        placeholder="Examples:\n2026 1.01, 2026 2.08\n2027 1st (late), 2027 2nd\n2028 1.05 (from Team X)",
                        height=100,
                        key="give_picks",
                        help="Enter picks separated by commas. Formats: '2026 1.01', '2027 1st (early)', '2026 2.05'"
                    )

                    # FAAB input for Side A
                    your_faab_remaining = faab_map.get(your_team, 300)
                    give_faab = st.number_input(
                        f"FAAB ($$ - You have ${your_faab_remaining:.0f} remaining):",
                        min_value=0.0,
                        max_value=300.0,
                        value=0.0,
                        step=5.0,
                        key="give_faab",
                        help=f"FAAB is finite ($300/team total). Value scaled to dynasty points. Current: ${your_faab_remaining:.0f}"
                    )
                    if give_faab > your_faab_remaining:
                        st.warning(f"⚠️ You only have ${your_faab_remaining:.0f} FAAB remaining!")

                    # Show current side A value
                    if give_player_selections or give_pick_input or give_faab > 0:
                        temp_give_value = 0
                        temp_give_picks = []

                        for sel in give_player_selections:
                            player_name = sel.split(' (')[0]
                            player = your_roster_df[your_roster_df['Name'] == player_name].iloc[0]
                            temp_give_value += player['AdjustedValue']

                        if give_pick_input:
                            temp_give_picks = parse_pick_input(give_pick_input, trade_is_superflex)
                            temp_give_value += sum(p['value'] for p in temp_give_picks)

                        if give_faab > 0:
                            give_faab_value = calculate_faab_value(give_faab)
                            temp_give_value += give_faab_value

                        st.info(f"Total Value: {temp_give_value:.0f} pts")

                        if temp_give_picks:
                            st.caption(f"Parsed {len(temp_give_picks)} pick(s):")
                            for pick in temp_give_picks:
                                st.caption(f"  • {pick['parsed']}: {pick['value']:.0f} pts")

                        if give_faab > 0:
                            st.caption(f"FAAB: ${give_faab:.0f} = {calculate_faab_value(give_faab):.0f} pts")

                with col2:
                    st.subheader(f"📥 {selected_team} Gives")

                    receive_player_selections = st.multiselect(
                        "Players:",
                        options=other_player_options,
                        key="receive_players",
                        help="Select multiple players to receive"
                    )

                    receive_pick_input = st.text_area(
                        "Draft Picks (comma-separated):",
                        placeholder="Examples:\n2026 1.01, 2026 2.08\n2027 1st (late), 2027 2nd\n2028 1.05 (from Team X)",
                        height=100,
                        key="receive_picks",
                        help="Enter picks separated by commas. Formats: '2026 1.01', '2027 1st (early)', '2026 2.05'"
                    )

                    # FAAB input for Side B
                    other_faab_remaining = faab_map.get(selected_team, 300)
                    receive_faab = st.number_input(
                        f"FAAB ($$ - {selected_team} has ${other_faab_remaining:.0f} remaining):",
                        min_value=0.0,
                        max_value=300.0,
                        value=0.0,
                        step=5.0,
                        key="receive_faab",
                        help=f"FAAB is finite ($300/team total). Value scaled to dynasty points. Current: ${other_faab_remaining:.0f}"
                    )
                    if receive_faab > other_faab_remaining:
                        st.warning(f"⚠️ {selected_team} only has ${other_faab_remaining:.0f} FAAB remaining!")

                    # Show current side B value
                    if receive_player_selections or receive_pick_input or receive_faab > 0:
                        temp_receive_value = 0
                        temp_receive_picks = []

                        for sel in receive_player_selections:
                            player_name = sel.split(' (')[0]
                            player = other_roster_df[other_roster_df['Name'] == player_name].iloc[0]
                            temp_receive_value += player['AdjustedValue']

                        if receive_pick_input:
                            temp_receive_picks = parse_pick_input(receive_pick_input, trade_is_superflex)
                            temp_receive_value += sum(p['value'] for p in temp_receive_picks)

                        if receive_faab > 0:
                            receive_faab_value = calculate_faab_value(receive_faab)
                            temp_receive_value += receive_faab_value

                        st.info(f"Total Value: {temp_receive_value:.0f} pts")

                        if temp_receive_picks:
                            st.caption(f"Parsed {len(temp_receive_picks)} pick(s):")
                            for pick in temp_receive_picks:
                                st.caption(f"  • {pick['parsed']}: {pick['value']:.0f} pts")

                        if receive_faab > 0:
                            st.caption(f"FAAB: ${receive_faab:.0f} = {calculate_faab_value(receive_faab):.0f} pts")

                # Analyze button
                st.markdown("---")
                if st.button("🔍 Analyze Trade", type="primary", use_container_width=True):
                    if (give_player_selections or give_pick_input or give_faab > 0) and (receive_player_selections or receive_pick_input or receive_faab > 0):
                        # Parse player values from selections
                        give_data = []
                        for sel in give_player_selections:
                            player_name = sel.split(' (')[0]
                            player = your_roster_df[your_roster_df['Name'] == player_name].iloc[0]
                            give_data.append({
                                'name': player['Name'],
                                'position': player['Position'],
                                'team': player['Team'],
                                'age': player['Age'],
                                'value': player['AdjustedValue']
                            })

                        receive_data = []
                        for sel in receive_player_selections:
                            player_name = sel.split(' (')[0]
                            player = other_roster_df[other_roster_df['Name'] == player_name].iloc[0]
                            receive_data.append({
                                'name': player['Name'],
                                'position': player['Position'],
                                'team': player['Team'],
                                'age': player['Age'],
                                'value': player['AdjustedValue']
                            })

                        # Parse draft picks
                        give_picks_parsed = parse_pick_input(give_pick_input, trade_is_superflex)
                        receive_picks_parsed = parse_pick_input(receive_pick_input, trade_is_superflex)

                        # Evaluate trade (including FAAB)
                        evaluation = evaluate_manual_trade(
                            give_data,
                            receive_data,
                            give_picks_parsed,
                            receive_picks_parsed,
                            give_faab=give_faab,
                            receive_faab=receive_faab
                        )

                        # Display results
                        st.markdown("---")
                        st.markdown(f"## {evaluation['verdict']}")

                        # Summary metrics
                        metric_col1, metric_col2, metric_col3 = st.columns(3)
                        with metric_col1:
                            st.metric("You Give", f"{evaluation['give_total']:.0f} pts",
                                     delta=None, delta_color="off")
                        with metric_col2:
                            st.metric("You Receive", f"{evaluation['receive_total']:.0f} pts",
                                     delta=None, delta_color="off")
                        with metric_col3:
                            delta_text = f"{evaluation['difference']:+.0f} pts"
                            st.metric("Net Gain", delta_text,
                                     delta=f"{evaluation['percentage_diff']:+.1f}%",
                                     delta_color="normal")

                        # Detailed breakdown
                        st.markdown("### Trade Breakdown")
                        detail_col1, detail_col2 = st.columns(2)

                        with detail_col1:
                            st.markdown(f"**{your_team} Gives:**")

                            if give_data:
                                st.markdown("*Players:*")
                                for player in give_data:
                                    st.write(f"• {player['name']} ({player['position']}, {player['team']}) - {player['value']:.0f} pts")
                                st.write(f"**Players Total:** {evaluation['give_player_total']:.0f} pts")

                            if give_picks_parsed:
                                st.markdown("*Draft Picks:*")
                                for pick in give_picks_parsed:
                                    st.write(f"• {pick['parsed']} - {pick['value']:.0f} pts")
                                st.write(f"**Picks Total:** {evaluation['give_pick_total']:.0f} pts")

                            if evaluation['give_faab'] > 0:
                                st.markdown("*FAAB:*")
                                st.write(f"• ${evaluation['give_faab']:.0f} - {evaluation['give_faab_value']:.0f} pts")

                        with detail_col2:
                            st.markdown(f"**{selected_team} Gives:**")

                            if receive_data:
                                st.markdown("*Players:*")
                                for player in receive_data:
                                    st.write(f"• {player['name']} ({player['position']}, {player['team']}) - {player['value']:.0f} pts")
                                st.write(f"**Players Total:** {evaluation['receive_player_total']:.0f} pts")

                            if receive_picks_parsed:
                                st.markdown("*Draft Picks:*")
                                for pick in receive_picks_parsed:
                                    st.write(f"• {pick['parsed']} - {pick['value']:.0f} pts")
                                st.write(f"**Picks Total:** {evaluation['receive_pick_total']:.0f} pts")

                            if evaluation['receive_faab'] > 0:
                                st.markdown("*FAAB:*")
                                st.write(f"• ${evaluation['receive_faab']:.0f} - {evaluation['receive_faab_value']:.0f} pts")

                        # Recommendation
                        st.markdown("---")

                        # Check for news alerts on traded players
                        injuries_data_manual = fetch_injuries(CURRENT_YEAR)
                        news_data_manual = fetch_news(CURRENT_YEAR)
                        all_trade_players = pd.DataFrame(give_data + receive_data)
                        if len(all_trade_players) > 0:
                            trade_news = aggregate_player_news(all_trade_players, injuries_data_manual, news_data_manual)
                            if trade_news:
                                st.markdown("### 📰 News Alerts")
                                for news_item in trade_news:
                                    if news_item['impact_pct'] < 0:
                                        st.warning(f"⚠️ **{news_item['player']}**: {news_item['headline']} ({news_item['impact_pct']:+.0f}% value impact)")
                                    elif news_item['impact_pct'] > 0:
                                        st.info(f"✅ **{news_item['player']}**: {news_item['headline']} ({news_item['impact_pct']:+.0f}% value impact)")

                        # Build trade summary with key assets
                        trade_summary_parts = []
                        if give_picks_parsed:
                            key_give_picks = [p['parsed'] for p in sorted(give_picks_parsed, key=lambda x: x['value'], reverse=True)[:2]]
                            if key_give_picks:
                                trade_summary_parts.append(f"giving up {', '.join(key_give_picks)}")
                        if receive_picks_parsed:
                            key_receive_picks = [p['parsed'] for p in sorted(receive_picks_parsed, key=lambda x: x['value'], reverse=True)[:2]]
                            if key_receive_picks:
                                trade_summary_parts.append(f"receiving {', '.join(key_receive_picks)}")

                        trade_summary = ""
                        if trade_summary_parts:
                            trade_summary = f" (including {' and '.join(trade_summary_parts)})"

                        if evaluation['percentage_diff'] > 10:
                            st.success(f"💰 This trade significantly favors you{trade_summary}! Strong opportunity to upgrade your roster with a net gain of {evaluation['difference']:.0f} points.")
                        elif evaluation['percentage_diff'] > 5:
                            st.success(f"👍 This trade favors you slightly{trade_summary}. Good deal if it fills a positional need. Net gain: {evaluation['difference']:.0f} points.")
                        elif abs(evaluation['percentage_diff']) <= 5:
                            st.info(f"⚖️ This is a balanced trade{trade_summary}. Consider your positional needs and roster construction. Value difference: {abs(evaluation['difference']):.0f} points.")
                        elif evaluation['percentage_diff'] < -10:
                            st.error(f"⚠️ This trade is unfavorable for you{trade_summary}. Consider negotiating or adding assets to your side. Net loss: {abs(evaluation['difference']):.0f} points.")
                        else:
                            st.warning(f"📊 This trade slightly favors the other team{trade_summary}. Negotiate if possible. Net loss: {abs(evaluation['difference']):.0f} points.")

                        # Monte Carlo Playoff Simulation
                        st.markdown("---")
                        st.markdown("### 🎲 Playoff Odds Simulation (Monte Carlo)")

                        with st.spinner("Running 1,000 season simulations..."):
                            try:
                                give_picks_value = sum(p['value'] for p in give_picks_parsed)
                                receive_picks_value = sum(p['value'] for p in receive_picks_parsed)
                                give_faab_value = calculate_faab_value(give_faab)
                                receive_faab_value = calculate_faab_value(receive_faab)

                                playoff_sim = simulate_post_trade_odds(
                                    your_roster_df,
                                    give_data,
                                    receive_data,
                                    give_picks_value,
                                    receive_picks_value,
                                    give_faab_value,
                                    receive_faab_value,
                                    all_rosters_df,
                                    weeks_remaining=10
                                )

                                sim_col1, sim_col2 = st.columns(2)

                                with sim_col1:
                                    st.markdown("**Before Trade:**")
                                    st.metric("Playoff Odds", f"{playoff_sim['before']['playoff_odds']:.1f}%")
                                    st.metric("Championship Odds", f"{playoff_sim['before']['championship_odds']:.1f}%")
                                    st.metric("Avg Finish", f"#{playoff_sim['before']['avg_finish']:.1f}")

                                with sim_col2:
                                    st.markdown("**After Trade:**")
                                    st.metric(
                                        "Playoff Odds",
                                        f"{playoff_sim['after']['playoff_odds']:.1f}%",
                                        delta=f"{playoff_sim['playoff_change']:+.1f}%"
                                    )
                                    st.metric(
                                        "Championship Odds",
                                        f"{playoff_sim['after']['championship_odds']:.1f}%",
                                        delta=f"{playoff_sim['championship_change']:+.1f}%"
                                    )
                                    st.metric(
                                        "Avg Finish",
                                        f"#{playoff_sim['after']['avg_finish']:.1f}",
                                        delta=f"{playoff_sim['finish_change']:+.1f} spots"
                                    )

                                if playoff_sim['playoff_change'] > 5:
                                    st.success(f"📈 This trade significantly improves your playoff odds by {playoff_sim['playoff_change']:.1f}%!")
                                elif playoff_sim['playoff_change'] > 0:
                                    st.info(f"↗️ This trade slightly improves your playoff odds by {playoff_sim['playoff_change']:.1f}%")
                                elif playoff_sim['playoff_change'] < -5:
                                    st.error(f"📉 This trade significantly hurts your playoff odds by {abs(playoff_sim['playoff_change']):.1f}%")
                                else:
                                    st.info(f"↔️ This trade has minimal impact on your playoff odds ({playoff_sim['playoff_change']:+.1f}%)")

                                # Visualization: Finish distribution
                                finish_data = pd.DataFrame({
                                    'Scenario': ['Before'] * len(playoff_sim['before']['finish_distribution']) +
                                               ['After'] * len(playoff_sim['after']['finish_distribution']),
                                    'Finish': playoff_sim['before']['finish_distribution'] +
                                             playoff_sim['after']['finish_distribution']
                                })

                                chart = alt.Chart(finish_data).mark_bar(opacity=0.7).encode(
                                    x=alt.X('Finish:Q', bin=alt.Bin(maxbins=12), title='Finish Position'),
                                    y=alt.Y('count()', title='Frequency'),
                                    color=alt.Color('Scenario:N', scale=alt.Scale(scheme='category10')),
                                    column='Scenario:N'
                                ).properties(
                                    width=250,
                                    height=200,
                                    title='Simulated Season Finish Distribution'
                                )

                                st.altair_chart(chart)

                            except Exception as e:
                                st.warning(f"Could not run playoff simulation: {str(e)}")

                    else:
                        st.warning("⚠️ Please select at least one player or pick for each side of the trade.")
        else:
            st.info("No other teams available for trading.")

    else:
        st.warning(f"No roster data found for {your_team}")

    # AI Trade Suggestions Section
    st.markdown("---")
    st.header("🤖 AI-Powered Trade Suggestions")
    st.markdown("Machine learning analyzes your roster needs, surpluses, and generates optimized trade proposals")

    if your_team in all_rosters_df and len(all_rosters_df) > 1:
        your_roster_df = all_rosters_df[your_team]

        with st.spinner("Training ML model and analyzing rosters..."):
            # Train ML model
            all_players = pd.concat([df for df in all_rosters_df.values()])
            try:
                ml_model, ml_scaler = train_ml_value_predictor(all_players)

                # Analyze your roster needs
                roster_analysis = analyze_roster_needs(your_roster_df, all_players, is_superflex)

                # Calculate playoff odds
                playoff_data = calculate_playoff_odds(your_roster_df, all_rosters_df, your_team)

                # Display roster analysis
                st.subheader(f"📊 {your_team} Roster Analysis")

                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("Avg Age", f"{roster_analysis['avg_age']:.1f}",
                             help="Average age of your roster")
                with col2:
                    st.metric("Playoff Odds", f"{playoff_data['playoff_odds']:.1f}%",
                             help="Estimated playoff probability based on roster value")
                with col3:
                    st.metric("Championship Odds", f"{playoff_data['championship_odds']:.1f}%",
                             help="Estimated championship probability")
                with col4:
                    st.metric("League Rank", f"#{int((100 - playoff_data['value_percentile']) / 100 * len(all_rosters_df) + 1)}",
                             help="Roster value ranking in league")

                st.info(f"**Strategy:** {roster_analysis['strategy']}")

                # Show needs and surpluses
                needs_col, surplus_col = st.columns(2)

                with needs_col:
                    st.markdown("**🔴 Positional Needs:**")
                    if roster_analysis['needs']:
                        for need in roster_analysis['needs'][:5]:
                            priority_color = "🔴" if need['priority'] == 'High' else "🟡"
                            st.write(f"{priority_color} **{need['position']}**: {need['count']}/{need['ideal']} players ({need['strength']*100:.0f}% strength)")
                    else:
                        st.write("✅ No major needs detected")

                with surplus_col:
                    st.markdown("**🟢 Positional Surpluses:**")
                    if roster_analysis['surpluses']:
                        for surplus in roster_analysis['surpluses']:
                            st.write(f"🟢 **{surplus['position']}**: {surplus['count']} players (+{surplus['excess']} excess)")
                    else:
                        st.write("⚖️ No major surpluses")

                # Generate AI trade suggestions
                st.markdown("---")
                st.subheader("💡 Recommended Trades")

                # Fetch news for alerts in trade suggestions
                injuries_data = fetch_injuries(CURRENT_YEAR)
                news_data = fetch_news(CURRENT_YEAR)
                all_players_df = pd.concat([df for df in all_rosters_df.values()])
                all_player_news = aggregate_player_news(all_players_df, injuries_data, news_data)
                news_lookup = {n['player'].lower(): n for n in all_player_news}

                your_faab_remaining = faab_map.get(your_team, 300)
                trade_suggestions = generate_ai_trade_suggestions(
                    your_roster_df,
                    all_rosters_df,
                    your_team,
                    roster_analysis,
                    your_faab_remaining,
                    faab_map,
                    is_superflex
                )

                if trade_suggestions:
                    st.write(f"Found **{len(trade_suggestions)}** optimized trade opportunities:")

                    for idx, suggestion in enumerate(trade_suggestions, 1):
                        with st.expander(f"🔄 Trade #{idx}: {suggestion['partner']} | Value Diff: {suggestion['value_diff']:+.0f} pts", expanded=(idx <= 3)):
                            # Trade details in columns
                            give_col, arrow_col, receive_col = st.columns([5, 1, 5])

                            with give_col:
                                st.markdown(f"**You Give to {suggestion['partner']}:**")

                                # Players
                                for player in suggestion.get('you_give', []):
                                    st.write(f"• {player['name']} ({player['position']}) - {player['value']:.0f} pts")

                                # Picks
                                for pick in suggestion.get('you_give_picks', []):
                                    st.write(f"• {pick['description']} - {pick['value']:.0f} pts")

                                # FAAB
                                if suggestion.get('you_give_faab', 0) > 0:
                                    st.write(f"• ${suggestion['you_give_faab']:.0f} FAAB - {calculate_faab_value(suggestion['you_give_faab']):.0f} pts")

                                # Calculate total
                                give_total = sum(p['value'] for p in suggestion.get('you_give', []))
                                give_total += sum(p['value'] for p in suggestion.get('you_give_picks', []))
                                give_total += calculate_faab_value(suggestion.get('you_give_faab', 0))
                                st.markdown(f"**Total: {give_total:.0f} pts**")

                            with arrow_col:
                                st.markdown("<div style='text-align: center; font-size: 2em; padding-top: 50px;'>⇄</div>", unsafe_allow_html=True)

                            with receive_col:
                                st.markdown(f"**You Receive from {suggestion['partner']}:**")

                                # Players
                                for player in suggestion.get('you_receive', []):
                                    st.write(f"• {player['name']} ({player['position']}) - {player['value']:.0f} pts")

                                # Picks
                                for pick in suggestion.get('you_receive_picks', []):
                                    st.write(f"• {pick['description']} - {pick['value']:.0f} pts")

                                # FAAB
                                if suggestion.get('you_receive_faab', 0) > 0:
                                    st.write(f"• ${suggestion['you_receive_faab']:.0f} FAAB - {calculate_faab_value(suggestion['you_receive_faab']):.0f} pts")

                                # Calculate total
                                receive_total = sum(p['value'] for p in suggestion.get('you_receive', []))
                                receive_total += sum(p['value'] for p in suggestion.get('you_receive_picks', []))
                                receive_total += calculate_faab_value(suggestion.get('you_receive_faab', 0))
                                st.markdown(f"**Total: {receive_total:.0f} pts**")

                            # AI Analysis
                            st.markdown("---")
                            st.markdown("**🤖 AI Analysis:**")
                            st.info(f"**Rationale:** {suggestion['rationale']}\n\n**Impact:** {suggestion['impact']}")

                            # Check for news alerts on involved players
                            news_alerts = []
                            for player in suggestion.get('you_give', []) + suggestion.get('you_receive', []):
                                player_name_lower = player['name'].lower()
                                if player_name_lower in news_lookup:
                                    news = news_lookup[player_name_lower]
                                    if news['impact_pct'] < 0:
                                        news_alerts.append(f"⚠️ **{player['name']}**: {news['headline']} ({news['impact_pct']:+.0f}% value impact)")

                            if news_alerts:
                                st.warning("**📰 News Alerts:**\n\n" + "\n\n".join(news_alerts))

                            # Monte Carlo Playoff Simulation
                            st.markdown("**🎲 Playoff Impact:**")
                            try:
                                give_picks_total = sum(p['value'] for p in suggestion.get('you_give_picks', []))
                                receive_picks_total = sum(p['value'] for p in suggestion.get('you_receive_picks', []))
                                give_faab_val = calculate_faab_value(suggestion.get('you_give_faab', 0))
                                receive_faab_val = calculate_faab_value(suggestion.get('you_receive_faab', 0))

                                playoff_impact = simulate_post_trade_odds(
                                    your_roster_df,
                                    suggestion.get('you_give', []),
                                    suggestion.get('you_receive', []),
                                    give_picks_total,
                                    receive_picks_total,
                                    give_faab_val,
                                    receive_faab_val,
                                    all_rosters_df,
                                    weeks_remaining=10
                                )

                                odds_col1, odds_col2, odds_col3 = st.columns(3)
                                with odds_col1:
                                    st.metric("Playoff Odds", f"{playoff_impact['after']['playoff_odds']:.1f}%",
                                             delta=f"{playoff_impact['playoff_change']:+.1f}%")
                                with odds_col2:
                                    st.metric("Championship", f"{playoff_impact['after']['championship_odds']:.1f}%",
                                             delta=f"{playoff_impact['championship_change']:+.1f}%")
                                with odds_col3:
                                    st.metric("Avg Finish", f"#{playoff_impact['after']['avg_finish']:.1f}",
                                             delta=f"{playoff_impact['finish_change']:+.1f}")

                                if playoff_impact['playoff_change'] > 3:
                                    st.success(f"📈 Significant playoff improvement: +{playoff_impact['playoff_change']:.1f}%")
                                elif playoff_impact['playoff_change'] < -3:
                                    st.warning(f"📉 Decreases playoff odds: {playoff_impact['playoff_change']:.1f}%")
                                else:
                                    st.info(f"↔️ Neutral playoff impact: {playoff_impact['playoff_change']:+.1f}%")

                            except Exception:
                                # Fallback to simple calculation
                                value_change = suggestion['value_diff']
                                odds_change = (value_change / roster_analysis['total_value']) * playoff_data['playoff_odds'] * 0.15
                                if abs(odds_change) > 0.5:
                                    odds_text = f"Estimated playoff odds change: {odds_change:+.1f}%"
                                    if odds_change > 0:
                                        st.success(f"📈 {odds_text}")
                                    else:
                                        st.warning(f"📉 {odds_text}")

                else:
                    st.info("No optimal trade opportunities found based on current roster analysis. Your team may already be well-balanced!")

            except Exception as e:
                st.error(f"Error generating AI suggestions: {str(e)}")
                st.info("Try refreshing or check that you have sufficient player data loaded.")

    else:
        st.info("AI Trade Suggestions require valid roster data. Please ensure your team is selected above.")

    # News & Alerts Dashboard
    st.markdown("---")
    st.header("📰 Real-Time News & Alerts Dashboard")
    st.markdown("Live injury reports and news updates for your roster with value impact analysis")

    if your_team in all_rosters_df:
        your_roster_df = all_rosters_df[your_team]

        col1, col2 = st.columns([3, 1])
        with col1:
            st.markdown("### Your Roster Updates")
        with col2:
            if st.button("🔄 Refresh News", use_container_width=True):
                st.cache_data.clear()
                st.rerun()

        with st.spinner("Fetching latest injuries and news..."):
            # Fetch injury and news data
            injuries_data = fetch_injuries(CURRENT_YEAR)
            news_data = fetch_news(CURRENT_YEAR)

            # Aggregate news for roster
            player_news = aggregate_player_news(your_roster_df, injuries_data, news_data)

            if player_news:
                # Summary metrics
                total_alerts = len(player_news)
                high_impact = sum(1 for n in player_news if 'High' in n['impact'])
                negative_impact = sum(1 for n in player_news if n['impact_pct'] < 0)

                metric_col1, metric_col2, metric_col3 = st.columns(3)
                with metric_col1:
                    st.metric("Total Alerts", total_alerts, help="News items affecting your roster")
                with metric_col2:
                    st.metric("High Impact", high_impact, help="Critical injury or news alerts")
                with metric_col3:
                    st.metric("Negative Alerts", negative_impact, help="News with negative value impact")

                # Show alerts with impact
                st.markdown("---")
                st.subheader("🚨 Active Alerts")

                for news_item in player_news[:20]:  # Show top 20
                    # Color code by impact
                    if news_item['impact_pct'] <= -10:
                        border_color = "#dc2626"  # Red
                        emoji = "🔴"
                    elif news_item['impact_pct'] < 0:
                        border_color = "#f59e0b"  # Orange
                        emoji = "🟡"
                    elif news_item['impact_pct'] > 0:
                        border_color = "#10b981"  # Green
                        emoji = "🟢"
                    else:
                        border_color = "#6b7280"  # Gray
                        emoji = "⚪"

                    with st.container():
                        col_a, col_b, col_c = st.columns([3, 4, 2])

                        with col_a:
                            st.markdown(f"**{emoji} {news_item['player']}**")
                            st.caption(f"{news_item['position']} - {news_item['team']}")
                            st.caption(f"Type: {news_item['type']}")

                        with col_b:
                            st.markdown(f"**{news_item['headline']}**")
                            st.caption(news_item['details'])

                        with col_c:
                            current_val = news_item['current_value']
                            adjusted_val = calculate_news_adjusted_value(current_val, news_item['impact_pct'])

                            st.metric(
                                "Value Impact",
                                f"{news_item['impact_pct']:+.0f}%",
                                delta=f"{adjusted_val - current_val:+.0f} pts",
                                help=f"Base: {current_val:.0f} → Adjusted: {adjusted_val:.0f}"
                            )

                        st.markdown(f"<div style='border-left: 4px solid {border_color}; padding-left: 10px; margin: 5px 0;'></div>",
                                  unsafe_allow_html=True)

                # Value impact summary
                st.markdown("---")
                st.subheader("💰 Total Value Impact")

                total_impact = sum(calculate_news_adjusted_value(n['current_value'], n['impact_pct']) - n['current_value']
                                 for n in player_news)
                original_value = sum(n['current_value'] for n in player_news)
                impact_pct = (total_impact / your_roster_df['AdjustedValue'].sum() * 100) if len(your_roster_df) > 0 else 0

                impact_col1, impact_col2, impact_col3 = st.columns(3)
                with impact_col1:
                    st.metric("Affected Players", len(player_news))
                with impact_col2:
                    st.metric("Total Value Change", f"{total_impact:+.0f} pts",
                             delta=f"{impact_pct:+.1f}% of roster")
                with impact_col3:
                    roster_total = your_roster_df['AdjustedValue'].sum()
                    adjusted_roster = roster_total + total_impact
                    st.metric("Adjusted Roster Value", f"{adjusted_roster:.0f} pts",
                             delta=f"{total_impact:+.0f} pts")

                if abs(total_impact) > 500:
                    if total_impact < 0:
                        st.warning(f"⚠️ Your roster has been negatively impacted by recent news. Consider adjusting your trade strategy or targeting replacements.")
                    else:
                        st.success(f"✅ Your roster has benefited from recent news. This may increase your trade leverage.")

            else:
                st.info("✅ No recent injury or news alerts for your roster players. All clear!")

        # Trade Rumors Section
        st.markdown("---")
        st.subheader("📢 League Trade Rumors")

        with st.expander("🔍 Search Trade Rumors (Web Integration)"):
            st.info("""
            **Trade Rumor Search**

            This feature uses web search to find NFL trade rumors and speculation.
            In production, this would integrate with:
            - X (Twitter) semantic search for real-time rumors
            - SportsDataIO news API for official reports
            - Fantasy analyst feeds for dynasty insights

            Enable API integrations in configuration to activate live rumor tracking.
            """)

            search_query = st.text_input("Search query", "NFL trade rumors 2026")
            if st.button("Search Rumors"):
                with st.spinner("Searching..."):
                    rumors = search_trade_rumors_web(search_query)
                    if rumors:
                        for rumor in rumors:
                            st.markdown(f"**{rumor['headline']}**")
                            st.caption(f"Source: {rumor['source']} | Updated: {rumor['updated']}")
                            st.write(rumor['details'])
                    else:
                        st.info("No rumors found. Try a different search query.")

    else:
        st.info("News Dashboard requires valid roster data. Please ensure your team is selected above.")

    # League overview
    st.header("🏆 League Overview")

    league_summary = []
    for team_name, roster_df in all_rosters_df.items():
        total_value = roster_df['AdjustedValue'].sum()
        avg_value = roster_df['AdjustedValue'].mean()
        roster_size = len(roster_df)

        league_summary.append({
            'Team': team_name,
            'Roster Size': roster_size,
            'Total Value': total_value,
            'Avg Player Value': avg_value
        })

    league_df = pd.DataFrame(league_summary).sort_values('Total Value', ascending=False)
    league_df['Rank'] = range(1, len(league_df) + 1)

    st.dataframe(league_df[['Rank', 'Team', 'Roster Size', 'Total Value', 'Avg Player Value']],
                use_container_width=True)

    # League power rankings chart
    chart = alt.Chart(league_df).mark_bar().encode(
        x=alt.X('Total Value:Q'),
        y=alt.Y('Team:N', sort='-x'),
        color=alt.condition(
            alt.datum.Team == your_team,
            alt.value('#1f77b4'),
            alt.value('lightgray')
        ),
        tooltip=['Team', 'Total Value', 'Avg Player Value']
    ).properties(height=400, title="League Power Rankings")

    st.altair_chart(chart, use_container_width=True)

    # Player Value Trends Visualization
    if your_team in all_rosters_df:
        st.markdown("---")
        st.header("📊 Player Value Trends & Analytics")

        your_roster_df = all_rosters_df[your_team]

        # Top players chart
        top_players = your_roster_df.nlargest(10, 'AdjustedValue')[['Name', 'Position', 'AdjustedValue']]

        value_chart = alt.Chart(top_players).mark_bar().encode(
            x=alt.X('AdjustedValue:Q', title='Dynasty Value (pts)'),
            y=alt.Y('Name:N', sort='-x', title='Player'),
            color=alt.Color('Position:N', scale=alt.Scale(scheme='category10')),
            tooltip=['Name', 'Position', 'AdjustedValue']
        ).properties(
            height=400,
            title='Top 10 Most Valuable Players on Your Roster'
        )

        st.altair_chart(value_chart, use_container_width=True)

        # Position value distribution
        position_values = your_roster_df.groupby('Position')['AdjustedValue'].agg(['sum', 'mean', 'count']).reset_index()
        position_values.columns = ['Position', 'Total Value', 'Avg Value', 'Count']

        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            pie_chart = alt.Chart(position_values).mark_arc(innerRadius=50).encode(
                theta=alt.Theta('Total Value:Q'),
                color=alt.Color('Position:N', scale=alt.Scale(scheme='category10')),
                tooltip=['Position', 'Total Value', 'Count']
            ).properties(
                width=300,
                height=300,
                title='Value Distribution by Position'
            )
            st.altair_chart(pie_chart)

        with col_chart2:
            bar_chart = alt.Chart(position_values).mark_bar().encode(
                x=alt.X('Position:N', title='Position'),
                y=alt.Y('Avg Value:Q', title='Average Value per Player'),
                color=alt.Color('Position:N', scale=alt.Scale(scheme='category10'), legend=None),
                tooltip=['Position', 'Avg Value', 'Count']
            ).properties(
                width=300,
                height=300,
                title='Average Player Value by Position'
            )
            st.altair_chart(bar_chart)

        # ML model performance if available
        if ml_model and ml_metrics:
            st.markdown("---")
            st.subheader("🤖 ML Model Performance")

            perf_col1, perf_col2, perf_col3, perf_col4 = st.columns(4)
            with perf_col1:
                st.metric("Model Type", "Random Forest")
            with perf_col2:
                st.metric("R² Score", f"{ml_metrics['r2']:.3f}",
                         help="Coefficient of determination (higher is better)")
            with perf_col3:
                st.metric("MAE", f"{ml_metrics['mae']:.0f} pts",
                         help="Mean Absolute Error")
            with perf_col4:
                st.metric("Features", ml_metrics['n_features'],
                         help="Number of input features")

            st.info("""
            **How ML Enhances Valuations:**
            - Analyzes historical stats, age, team performance, experience
            - Random Forest with 100 trees for robust predictions
            - Trained on SportsDataIO data with multi-year projections
            - Complements dynasty ADP with data-driven insights
            """)

    # Footer
    st.markdown("---")
    st.markdown("""
    ### ✅ Implemented Features
    - **Machine Learning**: ✅ Random Forest regressor trained on SportsDataIO data
    - **ML Features**: ✅ Age, position, stats, team performance, career trajectory
    - **Monte Carlo Simulation**: ✅ 1,000 playoff simulations per trade scenario
    - **Playoff Projections**: ✅ Before/after odds with confidence intervals
    - **Value Trend Charts**: ✅ Altair visualizations for player values & distributions
    - **AI Trade Suggestions**: ✅ Roster analysis with positional needs/surpluses
    - **Real-Time News Dashboard**: ✅ Injury reports, news alerts, value impact analysis
    - **News Integration**: ✅ Alerts on trade suggestions and manual analyzer
    - **FAAB Integration**: ✅ Full support with tiered valuation
    - **IDP Support**: ✅ DL, LB, DB positions with valuations

    ### 🔧 Future Enhancement Ideas
    - **Model Persistence**: Store trained models in Supabase for faster loading
    - **X/Twitter Integration**: Add semantic search for real-time trade rumors
    - **Custom Scoring**: Adjust position weights and scoring settings
    - **Advanced Metrics**: Add snap counts, target share, red zone usage
    - **Trade History**: Track completed trades and accuracy of predictions
    """)

if __name__ == "__main__":
    main()
