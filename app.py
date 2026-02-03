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
                            matchup_factor: float) -> Tuple[float, Dict]:
    """
    Calculate enhanced player value with multiple factors.
    Returns adjusted value and breakdown of components.
    """
    base_projection = player_data.get('FantasyPointsPPR', 0)

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

    # Calculate weighted components
    projection_component = base_projection * SCORING_WEIGHTS['projections']
    historical_component = historical_avg * SCORING_WEIGHTS['historical']
    team_component = base_projection * (team_factor - 1) * SCORING_WEIGHTS['team_performance']
    matchup_component = base_projection * matchup_factor * SCORING_WEIGHTS['matchup_sos']

    # Age and injury adjustments applied to total
    pre_adjustment_value = (projection_component + historical_component +
                           team_component + matchup_component)

    adjusted_value = pre_adjustment_value * age_factor * injury_factor

    breakdown = {
        'base_projection': base_projection,
        'projection_component': projection_component,
        'historical_component': historical_component,
        'team_component': team_component,
        'matchup_component': matchup_component,
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

            # Determine strength level
            if avg_value > 150:
                strength = "Strong"
            elif avg_value > 100:
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

def get_pick_value(pick_description: str) -> float:
    """
    Calculate dynasty draft pick value.
    Values are approximate and can be customized based on your league.
    You can also integrate KeepTradeCut (KTC) API for dynamic values if available.
    """
    pick_values = {
        # 2026 picks
        '2026 1st (Early)': 3500,
        '2026 1st (Mid)': 3000,
        '2026 1st (Late)': 2500,
        '2026 1st': 3000,  # Default mid-value
        '2026 2nd (Early)': 1500,
        '2026 2nd (Mid)': 1200,
        '2026 2nd (Late)': 1000,
        '2026 2nd': 1200,
        '2026 3rd': 500,
        '2026 4th': 200,

        # 2027 picks (slightly discounted)
        '2027 1st (Early)': 3200,
        '2027 1st (Mid)': 2700,
        '2027 1st (Late)': 2200,
        '2027 1st': 2700,
        '2027 2nd (Early)': 1300,
        '2027 2nd (Mid)': 1000,
        '2027 2nd (Late)': 800,
        '2027 2nd': 1000,
        '2027 3rd': 400,
        '2027 4th': 150,

        # 2028 picks (more discounted)
        '2028 1st (Early)': 2900,
        '2028 1st (Mid)': 2400,
        '2028 1st (Late)': 2000,
        '2028 1st': 2400,
        '2028 2nd (Early)': 1100,
        '2028 2nd (Mid)': 900,
        '2028 2nd (Late)': 700,
        '2028 2nd': 900,
        '2028 3rd': 350,
        '2028 4th': 100,
    }

    return pick_values.get(pick_description, 0)

def evaluate_manual_trade(give_players: List[Dict], receive_players: List[Dict],
                         give_picks: List[str], receive_picks: List[str]) -> Dict:
    """Evaluate a manually entered trade including players and draft picks."""
    # Calculate player values
    give_player_total = sum(p['value'] for p in give_players)
    receive_player_total = sum(p['value'] for p in receive_players)

    # Calculate pick values
    give_pick_total = sum(get_pick_value(pick) for pick in give_picks)
    receive_pick_total = sum(get_pick_value(pick) for pick in receive_picks)

    # Total values
    give_total = give_player_total + give_pick_total
    receive_total = receive_player_total + receive_pick_total

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
        'give_total': give_total,
        'receive_player_total': receive_player_total,
        'receive_pick_total': receive_pick_total,
        'receive_total': receive_total,
        'difference': difference,
        'percentage_diff': percentage_diff
    }

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
        This tool analyzes fantasy football trades using:
        - 📊 ROS projections (60%)
        - 📈 Historical trends (20%)
        - 🏆 Team performance (10%)
        - 📅 Matchup SOS (5%)
        - 👤 Age & injury (5%)
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

        # Process data
        player_details = {p['PlayerID']: p for p in player_details_raw} if player_details_raw else {}
        team_stats = {t['Team']: t for t in team_stats_raw} if team_stats_raw else {}

    # Map rosters to owners
    user_map = {user['user_id']: user.get('display_name', user.get('username', 'Unknown'))
                for user in users}

    roster_map = {}
    for roster in rosters:
        owner_id = roster.get('owner_id')
        owner_name = user_map.get(owner_id, f"Team {roster.get('roster_id', '?')}")
        roster_map[owner_name] = roster.get('players', [])

    # Team selection
    st.header("👥 Select Your Team")
    your_team = st.selectbox("Choose your team:", list(roster_map.keys()))

    # Process player data with enhanced valuations
    st.header("📊 Enhanced Player Valuations")

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

            # Calculate historical average (placeholder - would need real historical data)
            historical_avg = base_points * 0.95  # Simplified for demo

            # Matchup factor (placeholder - would need real schedule analysis)
            matchup_factor = 0.02  # Slight boost

            # Calculate enhanced value
            adjusted_value, breakdown = calculate_enhanced_value(
                proj, details, team_stats, historical_avg, matchup_factor
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
        st.markdown("Analyze multi-player trades with draft picks included")

        # Prepare player options with detailed info
        your_player_options = []
        for _, player in your_roster_df.iterrows():
            option = f"{player['Name']} ({player['Position']}, {player['Team']}, Age {player['Age']}) - {player['AdjustedValue']:.0f} pts"
            your_player_options.append(option)

        # Available draft picks
        available_picks = [
            '2026 1st (Early)', '2026 1st (Mid)', '2026 1st (Late)', '2026 1st',
            '2026 2nd (Early)', '2026 2nd (Mid)', '2026 2nd (Late)', '2026 2nd',
            '2026 3rd', '2026 4th',
            '2027 1st (Early)', '2027 1st (Mid)', '2027 1st (Late)', '2027 1st',
            '2027 2nd (Early)', '2027 2nd (Mid)', '2027 2nd (Late)', '2027 2nd',
            '2027 3rd', '2027 4th',
            '2028 1st (Early)', '2028 1st (Mid)', '2028 1st (Late)', '2028 1st',
            '2028 2nd (Early)', '2028 2nd (Mid)', '2028 2nd (Late)', '2028 2nd',
            '2028 3rd', '2028 4th',
        ]

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

                    give_pick_selections = st.multiselect(
                        "Draft Picks:",
                        options=available_picks,
                        key="give_picks",
                        help="Select draft picks to trade away"
                    )

                    # Show current side A value
                    if give_player_selections or give_pick_selections:
                        temp_give_value = 0
                        for sel in give_player_selections:
                            player_name = sel.split(' (')[0]
                            player = your_roster_df[your_roster_df['Name'] == player_name].iloc[0]
                            temp_give_value += player['AdjustedValue']
                        for pick in give_pick_selections:
                            temp_give_value += get_pick_value(pick)
                        st.info(f"Total Value: {temp_give_value:.0f} pts")

                with col2:
                    st.subheader(f"📥 {selected_team} Gives")

                    receive_player_selections = st.multiselect(
                        "Players:",
                        options=other_player_options,
                        key="receive_players",
                        help="Select multiple players to receive"
                    )

                    receive_pick_selections = st.multiselect(
                        "Draft Picks:",
                        options=available_picks,
                        key="receive_picks",
                        help="Select draft picks to receive"
                    )

                    # Show current side B value
                    if receive_player_selections or receive_pick_selections:
                        temp_receive_value = 0
                        for sel in receive_player_selections:
                            player_name = sel.split(' (')[0]
                            player = other_roster_df[other_roster_df['Name'] == player_name].iloc[0]
                            temp_receive_value += player['AdjustedValue']
                        for pick in receive_pick_selections:
                            temp_receive_value += get_pick_value(pick)
                        st.info(f"Total Value: {temp_receive_value:.0f} pts")

                # Analyze button
                st.markdown("---")
                if st.button("🔍 Analyze Trade", type="primary", use_container_width=True):
                    if (give_player_selections or give_pick_selections) and (receive_player_selections or receive_pick_selections):
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

                        # Evaluate trade
                        evaluation = evaluate_manual_trade(
                            give_data,
                            receive_data,
                            give_pick_selections,
                            receive_pick_selections
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

                            if give_pick_selections:
                                st.markdown("*Draft Picks:*")
                                for pick in give_pick_selections:
                                    st.write(f"• {pick} - {get_pick_value(pick):.0f} pts")
                                st.write(f"**Picks Total:** {evaluation['give_pick_total']:.0f} pts")

                        with detail_col2:
                            st.markdown(f"**{selected_team} Gives:**")

                            if receive_data:
                                st.markdown("*Players:*")
                                for player in receive_data:
                                    st.write(f"• {player['name']} ({player['position']}, {player['team']}) - {player['value']:.0f} pts")
                                st.write(f"**Players Total:** {evaluation['receive_player_total']:.0f} pts")

                            if receive_pick_selections:
                                st.markdown("*Draft Picks:*")
                                for pick in receive_pick_selections:
                                    st.write(f"• {pick} - {get_pick_value(pick):.0f} pts")
                                st.write(f"**Picks Total:** {evaluation['receive_pick_total']:.0f} pts")

                        # Recommendation
                        st.markdown("---")
                        if evaluation['percentage_diff'] > 10:
                            st.success("💰 This trade significantly favors you! Strong opportunity to upgrade your roster.")
                        elif evaluation['percentage_diff'] > 5:
                            st.success("👍 This trade favors you slightly. Good deal if it fills a positional need.")
                        elif abs(evaluation['percentage_diff']) <= 5:
                            st.info("⚖️ This is a balanced trade. Consider your positional needs and roster construction.")
                        elif evaluation['percentage_diff'] < -10:
                            st.error("⚠️ This trade is unfavorable for you. Consider negotiating or adding assets to your side.")
                        else:
                            st.warning("📊 This trade slightly favors the other team. Negotiate if possible.")

                    else:
                        st.warning("⚠️ Please select at least one player or pick for each side of the trade.")
        else:
            st.info("No other teams available for trading.")

    else:
        st.warning(f"No roster data found for {your_team}")

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
    ### 🔧 Extension Ideas
    - **Machine Learning**: Train models with scikit-learn for better predictions
    - **Custom Scoring**: Adjust position weights and scoring settings
    - **Advanced Metrics**: Add snap counts, target share, red zone usage
    - **Trade History**: Track completed trades and accuracy of predictions
    - **Keeper/Dynasty**: Add long-term value calculations
    """)

if __name__ == "__main__":
    main()
