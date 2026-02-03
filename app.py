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
from sklearn.preprocessing import StandardScaler
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

        **AI Features:**
        - 🤖 Roster needs/surplus analysis
        - 📊 Playoff odds estimation
        - 💡 10 optimized trade suggestions
        - 🎯 Includes picks + FAAB balancing

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

                            # Calculate impact on playoff odds
                            value_change = suggestion['value_diff']
                            odds_change = (value_change / roster_analysis['total_value']) * playoff_data['playoff_odds'] * 0.15  # Conservative estimate
                            if abs(odds_change) > 0.5:
                                odds_text = f"This trade could change your playoff odds by approximately {odds_change:+.1f}%"
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

    # Footer
    st.markdown("---")
    st.markdown("""
    ### ✅ Implemented Features
    - **Machine Learning**: ✅ scikit-learn models for player value prediction
    - **AI Trade Suggestions**: ✅ Roster analysis with positional needs/surpluses
    - **Playoff Odds Calculator**: ✅ Championship probability estimation
    - **FAAB Integration**: ✅ Full support with tiered valuation
    - **IDP Support**: ✅ DL, LB, DB positions with valuations

    ### 🔧 Future Enhancement Ideas
    - **Custom Scoring**: Adjust position weights and scoring settings
    - **Advanced Metrics**: Add snap counts, target share, red zone usage
    - **Trade History**: Track completed trades and accuracy of predictions
    - **Real-time Updates**: Integrate injury reports and breaking news
    """)

if __name__ == "__main__":
    main()
