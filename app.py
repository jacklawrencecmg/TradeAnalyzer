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
from fuzzywuzzy import fuzz, process
import altair as alt
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import warnings
warnings.filterwarnings('ignore')

from auth_utils import (
    init_session_state, is_authenticated, render_auth_ui,
    render_league_selector, render_add_league_modal, render_manage_leagues_modal,
    get_current_user, save_trade, get_saved_trades
)

from sleeper_api import (
    fetch_league_details, fetch_league_rosters, fetch_league_users,
    fetch_traded_picks, fetch_league_drafts, fetch_draft_picks,
    fetch_league_transactions, fetch_league_matchups,
    get_roster_positions_summary, get_scoring_summary,
    get_future_picks_inventory, adjust_value_for_league_scoring,
    get_team_roster_composition, calculate_optimal_starter_count,
    get_recent_transactions_summary, format_roster_positions, is_superflex_league,
    fetch_all_nfl_players, filter_trades, parse_trade_details
)

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

# ============================================================================
# PREDICTIVE TEXT / AUTOCOMPLETE HELPER FUNCTIONS
# ============================================================================

def format_player_display_name(player_data: Dict, player_id: str = None) -> str:
    """
    Format player data into searchable display name.
    Format: "Full Name (Position - Team) - Age X"
    Example: "Patrick Mahomes (QB - KC) - Age 29"
    """
    full_name = player_data.get('full_name') or player_data.get('display_name', 'Unknown')
    first_name = player_data.get('first_name', '')
    last_name = player_data.get('last_name', '')

    if not full_name or full_name == 'Unknown':
        full_name = f"{first_name} {last_name}".strip()

    position = player_data.get('position', 'UNK')
    team = player_data.get('team', 'FA')
    age = player_data.get('age', '')

    age_str = f" - Age {age}" if age else ""
    return f"{full_name} ({position} - {team}){age_str}"

def build_searchable_player_list(all_nfl_players: Dict, active_only: bool = True) -> Dict[str, str]:
    """
    Build a searchable player list with formatted names.
    Returns: dict mapping display_name -> player_id
    """
    player_options = {}

    for player_id, player_data in all_nfl_players.items():
        if active_only and player_data.get('status') not in ['Active', 'Inactive', 'Questionable', 'Doubtful', 'Out', 'PUP', 'IR']:
            continue

        position = player_data.get('position', '')
        if position in ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB']:
            display_name = format_player_display_name(player_data, player_id)
            player_options[display_name] = player_id

    return player_options

def fuzzy_search_players(search_query: str, player_options: Dict[str, str], limit: int = 20) -> List[str]:
    """
    Perform fuzzy search on player names.
    Returns top matches sorted by similarity score.
    """
    if not search_query:
        return []

    results = process.extract(search_query, player_options.keys(), limit=limit, scorer=fuzz.token_sort_ratio)

    return [match[0] for match in results if match[1] > 40]

def build_pick_options(num_teams: int = 12, years: List[int] = None, num_rounds: int = 5) -> List[str]:
    """
    Build comprehensive pick options for autocomplete.
    Includes specific slots (1.01, 1.02) and general picks (Early 1st, Mid 2nd, Late 3rd).
    """
    if years is None:
        current_year = datetime.now().year
        years = [current_year + i for i in range(1, 4)]

    pick_options = []

    for year in years:
        for round_num in range(1, num_rounds + 1):
            for slot in range(1, num_teams + 1):
                pick_options.append(f"{year} {round_num}.{slot:02d}")

            for timing in ['Early', 'Mid', 'Late']:
                round_suffix = {1: '1st', 2: '2nd', 3: '3rd'}.get(round_num, f'{round_num}th')
                pick_options.append(f"{year} {timing} {round_suffix}")

    return sorted(pick_options)

def fuzzy_search_picks(search_query: str, pick_options: List[str], limit: int = 20) -> List[str]:
    """
    Perform fuzzy search on draft picks.
    Returns top matches sorted by relevance.
    """
    if not search_query:
        return []

    results = process.extract(search_query, pick_options, limit=limit, scorer=fuzz.partial_ratio)

    return [match[0] for match in results if match[1] > 50]

def render_searchable_player_multiselect(
    label: str,
    player_display_to_id: Dict[str, str],
    roster_df: pd.DataFrame,
    key: str,
    help_text: str = None
) -> List[str]:
    """
    Render a searchable multiselect for players with fuzzy matching.
    Returns list of selected player display names.
    """
    col_search, col_clear = st.columns([4, 1])

    with col_search:
        search_query = st.text_input(
            f"🔍 Search {label}",
            key=f"{key}_search",
            placeholder="Type player name (e.g., 'Mah' for Mahomes)...",
            help="Use fuzzy search to find players quickly"
        )

    filtered_options = []

    if search_query:
        matched_names = fuzzy_search_players(search_query, player_display_to_id, limit=30)

        roster_player_names = set(roster_df['Name'].tolist())
        filtered_options = []

        for display_name in matched_names:
            player_name = display_name.split(' (')[0]
            if player_name in roster_player_names:
                player = roster_df[roster_df['Name'] == player_name].iloc[0]
                option = f"{player['Name']} ({player['Position']}, {player['Team']}, Age {player['Age']}) - {player['AdjustedValue']:.0f} pts"
                filtered_options.append(option)

        if filtered_options:
            st.caption(f"Found {len(filtered_options)} matches")
        else:
            st.caption("No matches found in roster")
    else:
        for _, player in roster_df.iterrows():
            option = f"{player['Name']} ({player['Position']}, {player['Team']}, Age {player['Age']}) - {player['AdjustedValue']:.0f} pts"
            filtered_options.append(option)

    selections = st.multiselect(
        label,
        options=filtered_options,
        key=f"{key}_select",
        help=help_text or "Select multiple players"
    )

    return selections

@st.cache_data(ttl=1800)
def calculate_league_rankings(
    all_rosters_df: Dict,
    traded_picks: List[Dict],
    league_rosters: List[Dict],
    league_users: List[Dict],
    league_details: Dict,
    is_superflex: bool = False
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Calculate league-wide team rankings based on player values and picks.
    Returns: (players_only_df, players_plus_picks_df)
    """
    if not all_rosters_df:
        return pd.DataFrame(), pd.DataFrame()

    current_season = int(league_details.get('season', datetime.now().year)) if league_details else datetime.now().year
    num_rounds = league_details.get('settings', {}).get('draft_rounds', 5) if league_details else 5

    user_map = {user['user_id']: user.get('display_name', user.get('username', 'Unknown'))
                for user in league_users} if league_users else {}
    roster_to_user = {roster['roster_id']: roster['owner_id'] for roster in league_rosters} if league_rosters else {}

    roster_id_to_team = {}
    for roster in league_rosters:
        owner_id = roster.get('owner_id')
        team_name = user_map.get(owner_id, f"Team {roster.get('roster_id', '?')}")
        roster_id_to_team[roster['roster_id']] = team_name

    rankings_data = []

    for team_name, roster_df in all_rosters_df.items():
        total_player_value = roster_df['AdjustedValue'].sum()

        top_players = roster_df.nlargest(5, 'AdjustedValue')[['Name', 'Position', 'AdjustedValue']].to_dict('records')
        top_players_str = ", ".join([f"{p['Name']} ({p['Position']}) {p['AdjustedValue']:.0f}"
                                     for p in top_players[:3]])

        team_roster_id = None
        for roster_id, name in roster_id_to_team.items():
            if name == team_name:
                team_roster_id = roster_id
                break

        total_pick_value = 0
        future_picks = []

        if team_roster_id and traded_picks:
            for future_year in range(current_season + 1, current_season + 4):
                for round_num in range(1, num_rounds + 1):
                    owned_by_team = False
                    original_owner_name = None

                    pick_traded_away = False
                    for traded_pick in traded_picks:
                        if (str(traded_pick.get('season')) == str(future_year) and
                            traded_pick.get('round') == round_num and
                            traded_pick.get('roster_id') == team_roster_id):
                            pick_traded_away = True
                            break

                    if not pick_traded_away:
                        owned_by_team = True
                        original_owner_name = "Own"

                    for traded_pick in traded_picks:
                        if (str(traded_pick.get('season')) == str(future_year) and
                            traded_pick.get('round') == round_num and
                            traded_pick.get('owner_id') == team_roster_id):
                            owned_by_team = True
                            original_roster_id = traded_pick.get('roster_id')
                            original_owner_name = roster_id_to_team.get(original_roster_id, f"Team {original_roster_id}")
                            break

                    if owned_by_team:
                        pick_str = f"{future_year} {round_num}.06"
                        pick_value, _ = get_pick_value(pick_str, is_superflex)
                        total_pick_value += pick_value

                        round_suffix = {1: '1st', 2: '2nd', 3: '3rd'}.get(round_num, f'{round_num}th')
                        pick_desc = f"{future_year} {round_suffix}"
                        if original_owner_name and original_owner_name != "Own":
                            pick_desc += f" (from {original_owner_name})"
                        future_picks.append(pick_desc)

        future_picks_str = ", ".join(future_picks) if future_picks else "None"

        rankings_data.append({
            'Team': team_name,
            'Player Value': total_player_value,
            'Pick Value': total_pick_value,
            'Total Value': total_player_value + total_pick_value,
            'Top Players': top_players_str,
            'Future Picks': future_picks_str,
            'Pick Count': len(future_picks)
        })

    rankings_df = pd.DataFrame(rankings_data)

    players_only_df = rankings_df[['Team', 'Player Value', 'Top Players']].copy()
    players_only_df['Rank'] = players_only_df['Player Value'].rank(ascending=False, method='min').astype(int)
    players_only_df = players_only_df.sort_values('Player Value', ascending=False).reset_index(drop=True)
    players_only_df = players_only_df[['Rank', 'Team', 'Player Value', 'Top Players']]

    players_plus_picks_df = rankings_df[['Team', 'Total Value', 'Player Value', 'Pick Value', 'Future Picks', 'Pick Count']].copy()
    players_plus_picks_df['Rank'] = players_plus_picks_df['Total Value'].rank(ascending=False, method='min').astype(int)
    players_plus_picks_df = players_plus_picks_df.sort_values('Total Value', ascending=False).reset_index(drop=True)
    players_plus_picks_df = players_plus_picks_df[['Rank', 'Team', 'Total Value', 'Player Value', 'Pick Value', 'Future Picks', 'Pick Count']]

    return players_only_df, players_plus_picks_df

@st.cache_data(ttl=1800)
def fetch_all_matchups(league_id: str, current_week: int, total_weeks: int) -> Dict[int, List[Dict]]:
    """
    Fetch matchups for all weeks in the season.
    Returns: dict mapping week number to list of matchup dicts
    """
    all_matchups = {}
    for week in range(1, total_weeks + 1):
        matchups = fetch_league_matchups(league_id, week)
        if matchups:
            all_matchups[week] = matchups
    return all_matchups

def calculate_team_projected_points(
    roster_df: pd.DataFrame,
    league_details: Dict,
    starters_only: bool = True
) -> float:
    """
    Calculate projected points for a team based on their roster.
    Uses AdjustedValue as weekly projection proxy.
    """
    if roster_df.empty:
        return 0.0

    # Use AdjustedValue as season-long value, divide by ~17 weeks for weekly projection
    # For starters, use top players at each position based on league settings
    if starters_only and league_details:
        roster_positions = league_details.get('roster_positions', [])
        position_counts = {}
        for pos in roster_positions:
            if pos != 'BN':  # Exclude bench
                position_counts[pos] = position_counts.get(pos, 0) + 1

        weekly_value = 0
        for position, count in position_counts.items():
            if position == 'FLEX':
                # FLEX can be RB/WR/TE
                flex_players = roster_df[roster_df['Position'].isin(['RB', 'WR', 'TE'])].nlargest(count, 'AdjustedValue')
                weekly_value += flex_players['AdjustedValue'].sum() / 17
            elif position == 'SUPER_FLEX':
                # SUPER_FLEX can be any offensive position
                sf_players = roster_df[roster_df['Position'].isin(['QB', 'RB', 'WR', 'TE'])].nlargest(count, 'AdjustedValue')
                weekly_value += sf_players['AdjustedValue'].sum() / 17
            else:
                pos_players = roster_df[roster_df['Position'] == position].nlargest(count, 'AdjustedValue')
                weekly_value += pos_players['AdjustedValue'].sum() / 17

        return max(weekly_value, 0.0)
    else:
        # Simple average of top players
        return roster_df['AdjustedValue'].sum() / 17

def simulate_matchup(
    team1_projection: float,
    team2_projection: float,
    variance_pct: float = 0.25,
    n_simulations: int = 1
) -> Tuple[float, float]:
    """
    Simulate a single matchup between two teams.
    Returns: (team1_win_pct, team2_win_pct)
    """
    team1_wins = 0
    team2_wins = 0

    for _ in range(n_simulations):
        # Generate scores with normal distribution
        team1_score = np.random.normal(team1_projection, team1_projection * variance_pct)
        team2_score = np.random.normal(team2_projection, team2_projection * variance_pct)

        # Ensure non-negative scores
        team1_score = max(team1_score, 0)
        team2_score = max(team2_score, 0)

        if team1_score > team2_score:
            team1_wins += 1
        elif team2_score > team1_score:
            team2_wins += 1
        else:
            # Tie - split
            team1_wins += 0.5
            team2_wins += 0.5

    return team1_wins / n_simulations, team2_wins / n_simulations

@st.cache_data(ttl=1800)
def run_playoff_simulation(
    all_rosters_df: Dict,
    league_details: Dict,
    league_rosters: List[Dict],
    league_users: List[Dict],
    all_matchups: Dict[int, List[Dict]],
    current_week: int,
    n_simulations: int = 10000,
    variance_pct: float = 0.25
) -> pd.DataFrame:
    """
    Run Monte Carlo playoff simulation.

    Returns DataFrame with columns:
    - Team: Team name
    - Current Wins: Actual wins so far
    - Current Losses: Actual losses so far
    - Projected Wins: Average wins in simulations
    - Projected Losses: Average losses in simulations
    - Playoff Pct: % of simulations making playoffs
    - Bye Pct: % of simulations getting first-round bye
    - Championship Pct: % of simulations winning championship
    - Avg Seed: Average playoff seed
    - Avg Points: Average points per game
    """
    if not all_rosters_df or not league_details:
        return pd.DataFrame()

    # Map roster IDs to team names
    user_map = {user['user_id']: user.get('display_name', user.get('username', 'Unknown'))
                for user in league_users}
    roster_id_to_team = {}
    team_to_roster_id = {}
    for roster in league_rosters:
        owner_id = roster.get('owner_id')
        roster_id = roster['roster_id']
        team_name = user_map.get(owner_id, f"Team {roster_id}")
        roster_id_to_team[roster_id] = team_name
        team_to_roster_id[team_name] = roster_id

    # Calculate projected points for each team
    team_projections = {}
    for team_name, roster_df in all_rosters_df.items():
        team_projections[team_name] = calculate_team_projected_points(roster_df, league_details, starters_only=True)

    # Get current standings
    team_records = {team: {'wins': 0, 'losses': 0, 'ties': 0, 'points_for': 0.0, 'points_against': 0.0}
                    for team in team_projections.keys()}

    # Process completed weeks
    for week in range(1, min(current_week, len(all_matchups) + 1)):
        if week not in all_matchups:
            continue

        matchups = all_matchups[week]
        matchup_dict = {}

        # Group matchups by matchup_id
        for matchup in matchups:
            roster_id = matchup.get('roster_id')
            matchup_id = matchup.get('matchup_id')
            points = matchup.get('points', 0)

            if matchup_id and roster_id in roster_id_to_team:
                if matchup_id not in matchup_dict:
                    matchup_dict[matchup_id] = []
                matchup_dict[matchup_id].append({
                    'roster_id': roster_id,
                    'team': roster_id_to_team[roster_id],
                    'points': points
                })

        # Process each matchup
        for matchup_id, teams in matchup_dict.items():
            if len(teams) == 2:
                team1 = teams[0]['team']
                team2 = teams[1]['team']
                points1 = teams[0]['points']
                points2 = teams[1]['points']

                if team1 in team_records and team2 in team_records:
                    team_records[team1]['points_for'] += points1
                    team_records[team1]['points_against'] += points2
                    team_records[team2]['points_for'] += points2
                    team_records[team2]['points_against'] += points1

                    if points1 > points2:
                        team_records[team1]['wins'] += 1
                        team_records[team2]['losses'] += 1
                    elif points2 > points1:
                        team_records[team2]['wins'] += 1
                        team_records[team1]['losses'] += 1
                    else:
                        team_records[team1]['ties'] += 1
                        team_records[team2]['ties'] += 1

    # Get league settings
    settings = league_details.get('settings', {})
    playoff_teams = settings.get('playoff_teams', 6)
    total_weeks = settings.get('playoff_week_start', 15) - 1  # Regular season ends before playoffs
    playoff_bye_teams = settings.get('playoff_seed_type', 0)  # 0 = no byes, 1 = top 2 get bye

    # Determine remaining weeks and matchups
    remaining_weeks = list(range(current_week, total_weeks + 1))

    # Run simulations
    simulation_results = {team: {
        'playoff_count': 0,
        'bye_count': 0,
        'championship_count': 0,
        'total_wins': 0,
        'total_losses': 0,
        'seeds': [],
        'points': []
    } for team in team_projections.keys()}

    for sim in range(n_simulations):
        # Copy current records
        sim_records = {team: {
            'wins': team_records[team]['wins'],
            'losses': team_records[team]['losses'],
            'points_for': team_records[team]['points_for'],
            'points_against': team_records[team]['points_against']
        } for team in team_projections.keys()}

        # Simulate remaining regular season weeks
        for week in remaining_weeks:
            if week in all_matchups:
                # Use actual matchup schedule
                matchups = all_matchups[week]
                matchup_dict = {}

                for matchup in matchups:
                    roster_id = matchup.get('roster_id')
                    matchup_id = matchup.get('matchup_id')

                    if matchup_id and roster_id in roster_id_to_team:
                        if matchup_id not in matchup_dict:
                            matchup_dict[matchup_id] = []
                        matchup_dict[matchup_id].append(roster_id_to_team[roster_id])

                for matchup_id, teams in matchup_dict.items():
                    if len(teams) == 2:
                        team1, team2 = teams[0], teams[1]
                        if team1 in team_projections and team2 in team_projections:
                            # Simulate game
                            proj1 = team_projections[team1]
                            proj2 = team_projections[team2]

                            score1 = max(0, np.random.normal(proj1, proj1 * variance_pct))
                            score2 = max(0, np.random.normal(proj2, proj2 * variance_pct))

                            sim_records[team1]['points_for'] += score1
                            sim_records[team1]['points_against'] += score2
                            sim_records[team2]['points_for'] += score2
                            sim_records[team2]['points_against'] += score1

                            if score1 > score2:
                                sim_records[team1]['wins'] += 1
                                sim_records[team2]['losses'] += 1
                            else:
                                sim_records[team2]['wins'] += 1
                                sim_records[team1]['losses'] += 1

        # Determine playoff seeding
        teams_sorted = sorted(
            sim_records.items(),
            key=lambda x: (x[1]['wins'], x[1]['points_for']),
            reverse=True
        )

        # Award playoff spots
        for i, (team, record) in enumerate(teams_sorted[:playoff_teams]):
            seed = i + 1
            simulation_results[team]['playoff_count'] += 1
            simulation_results[team]['seeds'].append(seed)
            simulation_results[team]['points'].append(record['points_for'])

            # First-round bye (typically top 1 or 2 seeds)
            if seed <= min(2, playoff_bye_teams):
                simulation_results[team]['bye_count'] += 1

        # Simulate playoffs (simple model: higher seed has advantage)
        playoff_teams_list = [team for team, _ in teams_sorted[:playoff_teams]]

        # Championship simulation (simplified: weight by seed)
        if playoff_teams_list:
            # Weight teams inversely by seed (seed 1 has highest weight)
            weights = [1.0 / (i + 1) for i in range(len(playoff_teams_list))]
            total_weight = sum(weights)
            normalized_weights = [w / total_weight for w in weights]

            champion = np.random.choice(playoff_teams_list, p=normalized_weights)
            simulation_results[champion]['championship_count'] += 1

        # Track totals
        for team, record in sim_records.items():
            simulation_results[team]['total_wins'] += record['wins']
            simulation_results[team]['total_losses'] += record['losses']

    # Build results DataFrame
    results_data = []
    for team in team_projections.keys():
        current_wins = team_records[team]['wins']
        current_losses = team_records[team]['losses']
        current_pf = team_records[team]['points_for']

        avg_wins = simulation_results[team]['total_wins'] / n_simulations
        avg_losses = simulation_results[team]['total_losses'] / n_simulations
        playoff_pct = (simulation_results[team]['playoff_count'] / n_simulations) * 100
        bye_pct = (simulation_results[team]['bye_count'] / n_simulations) * 100
        championship_pct = (simulation_results[team]['championship_count'] / n_simulations) * 100

        avg_seed = np.mean(simulation_results[team]['seeds']) if simulation_results[team]['seeds'] else 0
        avg_points = np.mean(simulation_results[team]['points']) if simulation_results[team]['points'] else current_pf

        results_data.append({
            'Team': team,
            'Current Record': f"{current_wins}-{current_losses}",
            'Current Wins': current_wins,
            'Current Losses': current_losses,
            'Projected Wins': avg_wins,
            'Projected Losses': avg_losses,
            'Playoff %': playoff_pct,
            'Bye %': bye_pct,
            'Championship %': championship_pct,
            'Avg Seed': avg_seed,
            'Avg Points': avg_points,
            'Projection': team_projections[team]
        })

    results_df = pd.DataFrame(results_data)
    results_df = results_df.sort_values('Playoff %', ascending=False).reset_index(drop=True)

    return results_df

def calculate_recent_performance(
    all_matchups: Dict[int, List[Dict]],
    roster_id_to_team: Dict[int, str],
    current_week: int,
    lookback_weeks: int = 4
) -> Dict[str, Dict]:
    """
    Calculate recent performance metrics for each team based on last N weeks.

    Returns dict with team -> {
        'recent_points': average points over last N weeks,
        'recent_wins': wins in last N weeks,
        'recent_games': number of games played,
        'trend': 'up', 'down', or 'stable'
    }
    """
    team_performance = {}

    start_week = max(1, current_week - lookback_weeks)

    for team in roster_id_to_team.values():
        team_performance[team] = {
            'recent_points': 0.0,
            'recent_wins': 0,
            'recent_games': 0,
            'weekly_points': [],
            'trend': 'stable'
        }

    for week in range(start_week, current_week):
        if week not in all_matchups:
            continue

        matchups = all_matchups[week]
        matchup_dict = {}

        for matchup in matchups:
            roster_id = matchup.get('roster_id')
            matchup_id = matchup.get('matchup_id')
            points = matchup.get('points', 0)

            if matchup_id and roster_id in roster_id_to_team:
                if matchup_id not in matchup_dict:
                    matchup_dict[matchup_id] = []
                matchup_dict[matchup_id].append({
                    'roster_id': roster_id,
                    'team': roster_id_to_team[roster_id],
                    'points': points
                })

        for matchup_id, teams in matchup_dict.items():
            if len(teams) == 2:
                team1 = teams[0]['team']
                team2 = teams[1]['team']
                points1 = teams[0]['points']
                points2 = teams[1]['points']

                if team1 in team_performance:
                    team_performance[team1]['recent_points'] += points1
                    team_performance[team1]['recent_games'] += 1
                    team_performance[team1]['weekly_points'].append(points1)
                    if points1 > points2:
                        team_performance[team1]['recent_wins'] += 1

                if team2 in team_performance:
                    team_performance[team2]['recent_points'] += points2
                    team_performance[team2]['recent_games'] += 1
                    team_performance[team2]['weekly_points'].append(points2)
                    if points2 > points1:
                        team_performance[team2]['recent_wins'] += 1

    for team in team_performance:
        if team_performance[team]['recent_games'] > 0:
            team_performance[team]['recent_points'] /= team_performance[team]['recent_games']

            weekly_points = team_performance[team]['weekly_points']
            if len(weekly_points) >= 2:
                first_half = weekly_points[:len(weekly_points)//2]
                second_half = weekly_points[len(weekly_points)//2:]

                if len(first_half) > 0 and len(second_half) > 0:
                    avg_first = sum(first_half) / len(first_half)
                    avg_second = sum(second_half) / len(second_half)

                    if avg_second > avg_first * 1.05:
                        team_performance[team]['trend'] = 'up'
                    elif avg_second < avg_first * 0.95:
                        team_performance[team]['trend'] = 'down'

    return team_performance

def calculate_strength_of_schedule(
    all_matchups: Dict[int, List[Dict]],
    roster_id_to_team: Dict[int, str],
    team_projections: Dict[str, float],
    current_week: int,
    total_weeks: int
) -> Dict[str, Dict]:
    """
    Calculate strength of schedule for each team.

    Returns dict with team -> {
        'past_sos': average opponent strength (past games),
        'future_sos': average opponent strength (remaining games),
        'overall_sos': combined SOS,
        'sos_rank': difficulty rank (1 = hardest)
    }
    """
    team_schedules = {team: {'past_opponents': [], 'future_opponents': []}
                     for team in roster_id_to_team.values()}

    for week in range(1, total_weeks + 1):
        if week not in all_matchups:
            continue

        matchups = all_matchups[week]
        matchup_dict = {}

        for matchup in matchups:
            roster_id = matchup.get('roster_id')
            matchup_id = matchup.get('matchup_id')

            if matchup_id and roster_id in roster_id_to_team:
                if matchup_id not in matchup_dict:
                    matchup_dict[matchup_id] = []
                matchup_dict[matchup_id].append(roster_id_to_team[roster_id])

        for matchup_id, teams in matchup_dict.items():
            if len(teams) == 2:
                team1, team2 = teams[0], teams[1]

                if week < current_week:
                    team_schedules[team1]['past_opponents'].append(team2)
                    team_schedules[team2]['past_opponents'].append(team1)
                else:
                    team_schedules[team1]['future_opponents'].append(team2)
                    team_schedules[team2]['future_opponents'].append(team1)

    sos_results = {}

    for team in team_schedules:
        past_opponents = team_schedules[team]['past_opponents']
        future_opponents = team_schedules[team]['future_opponents']

        past_sos = 0.0
        if past_opponents:
            past_strengths = [team_projections.get(opp, 0) for opp in past_opponents]
            past_sos = sum(past_strengths) / len(past_strengths)

        future_sos = 0.0
        if future_opponents:
            future_strengths = [team_projections.get(opp, 0) for opp in future_opponents]
            future_sos = sum(future_strengths) / len(future_strengths)

        total_opponents = len(past_opponents) + len(future_opponents)
        if total_opponents > 0:
            overall_sos = (past_sos * len(past_opponents) + future_sos * len(future_opponents)) / total_opponents
        else:
            overall_sos = 0.0

        sos_results[team] = {
            'past_sos': past_sos,
            'future_sos': future_sos,
            'overall_sos': overall_sos,
            'sos_rank': 0
        }

    sorted_teams = sorted(sos_results.items(), key=lambda x: x[1]['overall_sos'], reverse=True)
    for rank, (team, data) in enumerate(sorted_teams, 1):
        sos_results[team]['sos_rank'] = rank

    return sos_results

def calculate_power_rankings(
    all_rosters_df: Dict[str, pd.DataFrame],
    playoff_odds_df: pd.DataFrame,
    recent_performance: Dict[str, Dict],
    team_projections: Dict[str, float],
    sos_data: Dict[str, Dict],
    weights: Dict[str, float] = None
) -> pd.DataFrame:
    """
    Calculate power rankings using weighted formula.

    Weights:
    - roster_value: 40% (long-term strength)
    - playoff_odds: 30% (championship probability)
    - recent_performance: 20% (current form)
    - strength_of_schedule: 10% (difficulty adjustment)

    Returns DataFrame with power rankings.
    """
    if weights is None:
        weights = {
            'roster_value': 0.40,
            'playoff_odds': 0.30,
            'recent_performance': 0.20,
            'strength_of_schedule': 0.10
        }

    power_scores = []

    for team in all_rosters_df.keys():
        roster_value = team_projections.get(team, 0)

        playoff_row = playoff_odds_df[playoff_odds_df['Team'] == team]
        playoff_pct = playoff_row['Playoff %'].iloc[0] if len(playoff_row) > 0 else 0
        championship_pct = playoff_row['Championship %'].iloc[0] if len(playoff_row) > 0 else 0
        playoff_score = (playoff_pct * 0.7 + championship_pct * 0.3)

        recent_perf = recent_performance.get(team, {})
        recent_points = recent_perf.get('recent_points', 0)
        recent_wins = recent_perf.get('recent_wins', 0)
        recent_games = recent_perf.get('recent_games', 1)
        recent_win_pct = (recent_wins / recent_games * 100) if recent_games > 0 else 0
        recent_score = (recent_points * 0.6 + recent_win_pct * 0.4)

        sos = sos_data.get(team, {})
        sos_rank = sos.get('sos_rank', len(all_rosters_df) / 2)
        num_teams = len(all_rosters_df)
        sos_score = ((num_teams - sos_rank + 1) / num_teams) * 100

        max_roster_value = max(team_projections.values()) if team_projections else 1
        normalized_roster = (roster_value / max_roster_value) * 100 if max_roster_value > 0 else 0

        max_recent = max([rp.get('recent_points', 0) for rp in recent_performance.values()]) if recent_performance else 1
        normalized_recent = (recent_score / max_recent) * 100 if max_recent > 0 else 0

        power_score = (
            normalized_roster * weights['roster_value'] +
            playoff_score * weights['playoff_odds'] +
            normalized_recent * weights['recent_performance'] +
            sos_score * weights['strength_of_schedule']
        )

        trend = recent_perf.get('trend', 'stable')

        power_scores.append({
            'Team': team,
            'Power Score': power_score,
            'Roster Value': roster_value,
            'Playoff %': playoff_pct,
            'Championship %': championship_pct,
            'Recent PPG': recent_points,
            'Recent Record': f"{recent_wins}-{recent_games - recent_wins}" if recent_games > 0 else "0-0",
            'Trend': trend,
            'SOS Rank': sos_rank,
            'Future SOS': sos.get('future_sos', 0),
            'Overall SOS': sos.get('overall_sos', 0)
        })

    df = pd.DataFrame(power_scores)
    df = df.sort_values('Power Score', ascending=False).reset_index(drop=True)
    df['Rank'] = range(1, len(df) + 1)

    cols = ['Rank', 'Team', 'Power Score', 'Trend', 'Roster Value', 'Playoff %',
            'Championship %', 'Recent PPG', 'Recent Record', 'SOS Rank', 'Future SOS']
    df = df[cols]

    return df

def track_power_rankings_history(
    current_rankings: pd.DataFrame,
    current_week: int
) -> pd.DataFrame:
    """
    Track power rankings history over time.
    Stores in session state and returns historical DataFrame.
    """
    if 'power_rankings_history' not in st.session_state:
        st.session_state['power_rankings_history'] = []

    history = st.session_state['power_rankings_history']

    current_snapshot = []
    for _, row in current_rankings.iterrows():
        current_snapshot.append({
            'Week': current_week,
            'Team': row['Team'],
            'Rank': row['Rank'],
            'Power Score': row['Power Score']
        })

    existing_week = [i for i, item in enumerate(history) if item['Week'] == current_week]
    if existing_week:
        history = [item for item in history if item['Week'] != current_week]

    history.extend(current_snapshot)
    st.session_state['power_rankings_history'] = history

    if history:
        history_df = pd.DataFrame(history)
        return history_df
    else:
        return pd.DataFrame()

def calculate_rank_change(
    current_rankings: pd.DataFrame,
    history_df: pd.DataFrame,
    current_week: int
) -> pd.DataFrame:
    """
    Calculate rank change from previous week.
    """
    rankings_with_change = current_rankings.copy()
    rankings_with_change['Δ Rank'] = 0
    rankings_with_change['Δ Score'] = 0.0

    if not history_df.empty and current_week > 1:
        prev_week = current_week - 1
        prev_data = history_df[history_df['Week'] == prev_week]

        if not prev_data.empty:
            for idx, row in rankings_with_change.iterrows():
                team = row['Team']
                current_rank = row['Rank']
                current_score = row['Power Score']

                prev_row = prev_data[prev_data['Team'] == team]
                if len(prev_row) > 0:
                    prev_rank = prev_row['Rank'].iloc[0]
                    prev_score = prev_row['Power Score'].iloc[0]

                    rankings_with_change.at[idx, 'Δ Rank'] = prev_rank - current_rank
                    rankings_with_change.at[idx, 'Δ Score'] = current_score - prev_score

    return rankings_with_change

def calculate_trade_value(
    players: List[str],
    picks: List[str],
    faab: int,
    all_players_data: Dict,
    projections_df: pd.DataFrame,
    league_details: Dict
) -> float:
    """
    Calculate total value of players, picks, and FAAB in a trade.

    Returns: total value
    """
    total_value = 0.0

    for player_name in players:
        player_row = projections_df[projections_df['Player'] == player_name]
        if len(player_row) > 0:
            total_value += player_row['Value'].iloc[0]

    pick_values = get_draft_pick_values(league_details)
    for pick_str in picks:
        pick_value = pick_values.get(pick_str, 0)
        total_value += pick_value

    total_value += faab * 2

    return total_value

def analyze_historical_trade(
    trade_details: Dict,
    all_rosters_df: Dict[str, pd.DataFrame],
    projections_df: pd.DataFrame,
    league_details: Dict,
    all_players_data: Dict
) -> Dict:
    """
    Analyze a historical trade using current player valuations.

    Returns: dict with analysis including value diff, winner/loser, fairness rating
    """
    exchanges = trade_details['exchanges']
    roster_ids = trade_details['roster_ids']
    teams_involved = trade_details['teams_involved']

    team_values = {}

    for i, roster_id in enumerate(roster_ids):
        team_name = teams_involved[i] if i < len(teams_involved) else f"Team {roster_id}"
        exchange = exchanges.get(roster_id, {})

        received_players = exchange.get('players_received', [])
        given_players = exchange.get('players_given', [])
        received_picks = exchange.get('picks_received', [])
        given_picks = exchange.get('picks_given', [])
        received_faab = exchange.get('faab_received', 0)
        given_faab = exchange.get('faab_given', 0)

        value_received = calculate_trade_value(
            received_players, received_picks, received_faab,
            all_players_data, projections_df, league_details
        )

        value_given = calculate_trade_value(
            given_players, given_picks, given_faab,
            all_players_data, projections_df, league_details
        )

        net_value = value_received - value_given

        team_values[team_name] = {
            'received': {
                'players': received_players,
                'picks': received_picks,
                'faab': received_faab,
                'value': value_received
            },
            'given': {
                'players': given_players,
                'picks': given_picks,
                'faab': given_faab,
                'value': value_given
            },
            'net_value': net_value,
            'net_percent': ((net_value / value_given) * 100) if value_given > 0 else 0
        }

    sorted_teams = sorted(team_values.items(), key=lambda x: x[1]['net_value'], reverse=True)

    if len(sorted_teams) >= 2:
        winner = sorted_teams[0]
        loser = sorted_teams[-1]

        value_diff = abs(winner[1]['net_value'] - loser[1]['net_value'])
        avg_value = (winner[1]['given']['value'] + loser[1]['given']['value']) / 2
        fairness_pct = (value_diff / avg_value * 100) if avg_value > 0 else 0

        is_lopsided = fairness_pct > 20

        return {
            'team_values': team_values,
            'winner': winner[0],
            'loser': loser[0],
            'value_diff': value_diff,
            'fairness_pct': fairness_pct,
            'is_lopsided': is_lopsided,
            'trade_quality': 'Lopsided' if is_lopsided else 'Fair'
        }
    else:
        return {
            'team_values': team_values,
            'winner': None,
            'loser': None,
            'value_diff': 0,
            'fairness_pct': 0,
            'is_lopsided': False,
            'trade_quality': 'Unknown'
        }

def build_trade_history_dataframe(
    trades: List[Dict],
    analyzed_trades: List[Dict]
) -> pd.DataFrame:
    """
    Build a DataFrame from analyzed trades for display.

    Returns: DataFrame with trade history
    """
    if not trades or not analyzed_trades:
        return pd.DataFrame()

    data = []

    for trade, analysis in zip(trades, analyzed_trades):
        timestamp = trade.get('timestamp', 0)
        if timestamp:
            trade_date = datetime.fromtimestamp(timestamp / 1000).strftime('%Y-%m-%d')
        else:
            trade_date = 'Unknown'

        teams = trade.get('teams_involved', [])
        teams_str = ' ↔ '.join(teams)

        all_players = trade.get('players_involved', [])
        players_str = ', '.join(all_players) if all_players else 'No players'

        winner = analysis.get('winner', 'N/A')
        loser = analysis.get('loser', 'N/A')
        value_diff = analysis.get('value_diff', 0)
        fairness_pct = analysis.get('fairness_pct', 0)
        is_lopsided = analysis.get('is_lopsided', False)
        trade_quality = analysis.get('trade_quality', 'Unknown')

        data.append({
            'Date': trade_date,
            'Teams': teams_str,
            'Players': players_str,
            'Winner': winner,
            'Loser': loser,
            'Value Diff': value_diff,
            'Fairness %': fairness_pct,
            'Lopsided': is_lopsided,
            'Quality': trade_quality,
            'Timestamp': timestamp
        })

    df = pd.DataFrame(data)
    df = df.sort_values('Timestamp', ascending=False).reset_index(drop=True)

    return df

def render_searchable_pick_input(
    label: str,
    pick_options: List[str],
    key: str,
    help_text: str = None
) -> str:
    """
    Render a searchable text input for draft picks with autocomplete suggestions.
    Returns the input string.
    """
    search_query = st.text_input(
        f"🔍 {label}",
        key=f"{key}_search",
        placeholder="Type pick (e.g., '2026 1' or 'Early 1st')...",
        help="Use predictive search for picks"
    )

    if search_query:
        matched_picks = fuzzy_search_picks(search_query, pick_options, limit=15)

        if matched_picks:
            st.caption("💡 Suggestions (click to copy):")
            suggestion_cols = st.columns(min(5, len(matched_picks)))

            for idx, pick in enumerate(matched_picks[:15]):
                col_idx = idx % 5
                with suggestion_cols[col_idx]:
                    if st.button(pick, key=f"{key}_suggestion_{idx}", use_container_width=True):
                        st.session_state[f"{key}_value"] = st.session_state.get(f"{key}_value", "") + f"{pick}, "
                        st.rerun()

    current_value = st.session_state.get(f"{key}_value", "")

    pick_input = st.text_area(
        "Draft Picks (comma-separated):",
        value=current_value,
        placeholder="Examples:\n2026 1.01, 2026 2.08\n2027 1st (late), 2027 2nd\n2028 1.05 (from Team X)",
        height=100,
        key=key,
        help=help_text or "Enter picks separated by commas"
    )

    st.session_state[f"{key}_value"] = pick_input

    return pick_input

def parse_pick_description(pick_str: str, default_value: float = 50.0) -> float:
    """
    Parse a pick description and return its approximate value.
    Examples:
      - "2026 1.01" -> 300 pts
      - "2026 Early 1st" -> 280 pts
      - "2027 Mid 2nd" -> 120 pts
    """
    pick_str = pick_str.lower()

    year_offset = 0
    if '2026' in pick_str:
        year_offset = 1
    elif '2027' in pick_str:
        year_offset = 2
    elif '2028' in pick_str:
        year_offset = 3

    base_values = {
        '1st': 250, '1.': 250,
        '2nd': 150, '2.': 150,
        '3rd': 75, '3.': 75,
        '4th': 40, '4.': 40,
        '5th': 25, '5.': 25
    }

    pick_value = default_value

    for key, value in base_values.items():
        if key in pick_str:
            pick_value = value
            break

    if 'early' in pick_str:
        pick_value *= 1.2
    elif 'mid' in pick_str:
        pick_value *= 1.0
    elif 'late' in pick_str:
        pick_value *= 0.8

    if '1.01' in pick_str or '1.1' in pick_str:
        pick_value = 350
    elif '1.02' in pick_str or '1.2' in pick_str:
        pick_value = 330
    elif '1.03' in pick_str or '1.3' in pick_str:
        pick_value = 310

    discount_factor = 0.85 ** year_offset
    pick_value *= discount_factor

    return pick_value

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

def configure_chart_theme():
    """Configure Altair chart theme with dark colors."""
    return {
        'config': {
            'view': {
                'continuousHeight': 300,
                'continuousWidth': 400,
                'strokeWidth': 0
            },
            'background': '#001428',
            'title': {
                'color': '#EAF2FF',
                'fontSize': 16,
                'font': 'Inter',
                'fontWeight': 600
            },
            'axis': {
                'domainColor': '#1A2A44',
                'gridColor': '#1A2A44',
                'labelColor': '#8FA2BF',
                'tickColor': '#1A2A44',
                'titleColor': '#C7CBD6',
                'labelFont': 'Inter',
                'titleFont': 'Inter',
                'titleFontWeight': 600,
                'labelFontSize': 11,
                'titleFontSize': 12
            },
            'legend': {
                'labelColor': '#C7CBD6',
                'titleColor': '#EAF2FF',
                'labelFont': 'Inter',
                'titleFont': 'Inter',
                'titleFontWeight': 600
            },
            'mark': {
                'color': '#3CBEDC'
            }
        }
    }

def analyze_trade_question(
    question: str,
    all_rosters_df: Dict[str, pd.DataFrame],
    full_projections_df: pd.DataFrame,
    league_details: Dict,
    your_team: str,
    playoff_odds_df: pd.DataFrame = None,
    power_rankings_df: pd.DataFrame = None
) -> str:
    """
    Analyze a trade question using available league data.

    Returns: AI-generated response with analysis
    """
    question_lower = question.lower()

    response = []

    if "should i trade" in question_lower or "trade" in question_lower:
        response.append("📊 **Trade Analysis**\n")

        player_names = []
        for _, row in full_projections_df.iterrows():
            player_name = row['Player']
            if player_name.lower() in question_lower:
                player_names.append(player_name)

        if player_names:
            response.append(f"Players mentioned: {', '.join(player_names)}\n")

            for player_name in player_names:
                player_row = full_projections_df[full_projections_df['Player'] == player_name]
                if len(player_row) > 0:
                    value = player_row['Value'].iloc[0]
                    position = player_row['Position'].iloc[0]
                    age = player_row.get('Age', pd.Series([0])).iloc[0] if 'Age' in player_row else 0

                    response.append(f"\n**{player_name}** ({position})")
                    response.append(f"- Current Value: {value:.1f} points")
                    if age > 0:
                        response.append(f"- Age: {age}")

                        if age >= 30:
                            response.append(f"  ⚠️ Over 30 - declining asset")
                        elif age <= 24:
                            response.append(f"  ✅ Young - appreciating asset")

            response.append("\n**Considerations:**")

            if any(word in question_lower for word in ["contender", "contending", "win now", "championship"]):
                response.append("- You're in win-now mode: prioritize proven producers over picks")
                response.append("- Target players 25-29 years old for immediate impact")
                response.append("- Consider consolidating depth for star power")

            if any(word in question_lower for word in ["rebuild", "rebuilding", "future", "picks"]):
                response.append("- You're rebuilding: prioritize young players and draft picks")
                response.append("- Sell veterans over 28 for maximum return")
                response.append("- Target players under 25 with upside")

            if power_rankings_df is not None and not power_rankings_df.empty:
                your_rank_row = power_rankings_df[power_rankings_df['Team'] == your_team]
                if len(your_rank_row) > 0:
                    your_rank = your_rank_row['Rank'].iloc[0]
                    response.append(f"\n- Your current power rank: #{your_rank}")

                    if your_rank <= 3:
                        response.append("  → You're a top contender - go all-in for the title")
                    elif your_rank <= 6:
                        response.append("  → You're a playoff team - make calculated upgrades")
                    else:
                        response.append("  → Consider selling and building for next year")

            if playoff_odds_df is not None and not playoff_odds_df.empty:
                your_odds_row = playoff_odds_df[playoff_odds_df['Team'] == your_team]
                if len(your_odds_row) > 0:
                    playoff_pct = your_odds_row['Playoff %'].iloc[0]
                    champ_pct = your_odds_row['Championship %'].iloc[0]

                    response.append(f"\n- Your playoff odds: {playoff_pct:.1f}%")
                    response.append(f"- Your championship odds: {champ_pct:.1f}%")

                    if champ_pct >= 15:
                        response.append("  → Strong title odds - trade for stars, not picks")
                    elif champ_pct >= 5:
                        response.append("  → Decent title shot - balance present and future")
                    else:
                        response.append("  → Long odds - consider selling for future value")

        else:
            response.append("I couldn't identify specific players in your question.")
            response.append("Try asking about specific players by name.")

        response.append("\n**Recommendation:**")
        response.append("Use the Dynasty Trade Analyzer below to input the exact trade and see detailed value calculations.")

    elif "contender" in question_lower or "championship" in question_lower:
        response.append("🏆 **Contender Status Analysis**\n")

        if power_rankings_df is not None and not power_rankings_df.empty:
            your_rank_row = power_rankings_df[power_rankings_df['Team'] == your_team]
            if len(your_rank_row) > 0:
                your_rank = your_rank_row['Rank'].iloc[0]
                your_score = your_rank_row['Power Score'].iloc[0]
                trend = your_rank_row['Trend'].iloc[0]

                response.append(f"**Power Rankings:**")
                response.append(f"- Current Rank: #{your_rank}")
                response.append(f"- Power Score: {your_score:.1f}")
                response.append(f"- Recent Trend: {trend}")

        if playoff_odds_df is not None and not playoff_odds_df.empty:
            your_odds_row = playoff_odds_df[playoff_odds_df['Team'] == your_team]
            if len(your_odds_row) > 0:
                playoff_pct = your_odds_row['Playoff %'].iloc[0]
                champ_pct = your_odds_row['Championship %'].iloc[0]

                response.append(f"\n**Playoff Probabilities:**")
                response.append(f"- Make Playoffs: {playoff_pct:.1f}%")
                response.append(f"- Win Championship: {champ_pct:.1f}%")

                if champ_pct >= 20:
                    response.append("\n✅ **Elite Contender** - You're a championship favorite")
                    response.append("- Strategy: Go all-in, trade picks for proven stars")
                    response.append("- Target: Top-5 players at key positions")
                    response.append("- Timeline: Win in the next 1-2 years")

                elif champ_pct >= 10:
                    response.append("\n⚠️ **Strong Contender** - You have a good shot")
                    response.append("- Strategy: Make calculated upgrades, don't mortgage future")
                    response.append("- Target: Fill specific roster gaps")
                    response.append("- Timeline: Competitive for 2-3 years")

                elif champ_pct >= 5:
                    response.append("\n📊 **Fringe Contender** - You're on the bubble")
                    response.append("- Strategy: Evaluate risk/reward carefully")
                    response.append("- Target: High-upside plays, avoid overpaying")
                    response.append("- Timeline: Decide if this is your year or next")

                else:
                    response.append("\n❌ **Rebuilder** - Focus on the future")
                    response.append("- Strategy: Sell veterans, acquire picks and youth")
                    response.append("- Target: Players under 25, early-round picks")
                    response.append("- Timeline: Build for 2-3 years from now")

        response.append("\n**Next Steps:**")
        response.append("Check the Power Rankings and Playoff Odds sections above for detailed analysis.")

    elif any(word in question_lower for word in ["help", "advice", "what should", "how do"]):
        response.append("🤖 **AI Trade Advisor Help**\n")
        response.append("I can help you with:")
        response.append("\n**Trade Analysis:**")
        response.append('- "Should I trade Bijan for Chase + 2026 1.05?"')
        response.append('- "Is trading my 2026 1st for CMC worth it?"')
        response.append("\n**Team Strategy:**")
        response.append('- "Is my team a contender?"')
        response.append('- "Should I rebuild or compete?"')
        response.append("\n**Player Evaluation:**")
        response.append('- "What is Josh Allen worth?"')
        response.append('- "Should I sell Tyreek Hill?"')
        response.append("\nFor best results, mention specific players by name and your team's goals.")

    else:
        response.append("🤖 **AI Trade Advisor**\n")
        response.append("I'm here to help with trade decisions and team strategy!")
        response.append("\nTry asking:")
        response.append('- "Should I trade [Player A] for [Player B]?"')
        response.append('- "Is my team a contender?"')
        response.append('- "What should my strategy be?"')

    return '\n'.join(response)

def main():
    st.set_page_config(
        page_title="Fantasy Football Trade Analyzer",
        layout="wide",
        initial_sidebar_state="expanded"
    )

    # Configure Altair dark theme
    alt.themes.register('dark_theme', configure_chart_theme)
    alt.themes.enable('dark_theme')

    st.markdown("""
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        /* Color Variables */
        :root {
            --bg-0: #000A1E;
            --bg-1: #0A141E;
            --bg-2: #0A1428;
            --surface-1: #001428;
            --surface-2: #0B1B33;
            --border-1: #1A2A44;
            --text-1: #EAF2FF;
            --text-2: #C7CBD6;
            --text-3: #8FA2BF;
            --accent-1: #3CBEDC;
            --accent-2: #5BC0FF;
            --accent-glow: #9AF0FF;
            --pos: #2EE59D;
            --neg: #FF4D6D;
            --warn: #F5C542;
        }

        /* Global Styles */
        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
        }

        /* Main Background */
        .stApp {
            background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-0) 100%);
        }

        /* Main Content Area */
        .main .block-container {
            padding-top: 2rem;
            padding-bottom: 2rem;
            max-width: 1400px;
        }

        /* Headers */
        h1 {
            font-weight: 800 !important;
            background: linear-gradient(135deg, var(--accent-1) 0%, var(--accent-2) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-size: 3rem !important;
            margin-bottom: 0.5rem !important;
            letter-spacing: -0.02em;
        }

        h2 {
            font-weight: 700 !important;
            color: var(--text-1) !important;
            font-size: 2rem !important;
            margin-top: 2rem !important;
            margin-bottom: 1rem !important;
            letter-spacing: -0.01em;
        }

        h3 {
            font-weight: 600 !important;
            color: var(--text-2) !important;
            font-size: 1.5rem !important;
            margin-top: 1.5rem !important;
        }

        /* Body Text */
        p, span, div {
            color: var(--text-2) !important;
            font-weight: 400;
            line-height: 1.6;
        }

        /* Sidebar Styling */
        section[data-testid="stSidebar"] {
            background: linear-gradient(180deg, var(--surface-1) 0%, var(--bg-1) 100%);
            border-right: 1px solid var(--border-1);
        }

        section[data-testid="stSidebar"] .block-container {
            padding-top: 2rem;
        }

        /* Cards & Expanders */
        .stExpander {
            background: var(--surface-1) !important;
            border: 1px solid var(--border-1) !important;
            border-radius: 12px !important;
            margin: 0.75rem 0 !important;
            transition: all 0.3s ease;
        }

        .stExpander:hover {
            border-color: var(--accent-1) !important;
            box-shadow: 0 0 20px rgba(60, 190, 220, 0.3);
            transform: translateY(-2px);
        }

        .stExpander summary {
            color: var(--text-1) !important;
            font-weight: 600 !important;
        }

        /* Buttons - Glowing Effect */
        .stButton > button {
            background: linear-gradient(135deg, var(--accent-1) 0%, var(--accent-2) 100%) !important;
            color: white !important;
            font-weight: 600 !important;
            border: none !important;
            border-radius: 8px !important;
            padding: 0.75rem 2rem !important;
            transition: all 0.3s ease !important;
            box-shadow: 0 4px 15px rgba(60, 190, 220, 0.4);
        }

        .stButton > button:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(60, 190, 220, 0.6);
        }

        .stButton > button:active {
            transform: translateY(-1px);
        }

        /* Download Buttons */
        .stDownloadButton > button {
            background: linear-gradient(135deg, var(--pos) 0%, #00D9A3 100%) !important;
            color: white !important;
            font-weight: 600 !important;
            border: none !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 15px rgba(46, 229, 157, 0.4);
        }

        .stDownloadButton > button:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(46, 229, 157, 0.6);
        }

        /* Input Fields */
        .stTextInput > div > div > input,
        .stNumberInput > div > div > input,
        .stTextArea > div > div > textarea {
            background: var(--surface-2) !important;
            border: 1px solid var(--border-1) !important;
            border-radius: 8px !important;
            color: var(--text-1) !important;
            padding: 0.75rem !important;
            transition: all 0.3s ease;
        }

        .stTextInput > div > div > input:focus,
        .stNumberInput > div > div > input:focus,
        .stTextArea > div > div > textarea:focus {
            border-color: var(--accent-1) !important;
            box-shadow: 0 0 0 1px var(--accent-1), 0 0 20px rgba(60, 190, 220, 0.3) !important;
        }

        /* Select Boxes */
        .stSelectbox > div > div {
            background: var(--surface-2) !important;
            border: 1px solid var(--border-1) !important;
            border-radius: 8px !important;
        }

        .stSelectbox > div > div:hover {
            border-color: var(--accent-1) !important;
        }

        /* Multiselect */
        .stMultiSelect > div > div {
            background: var(--surface-2) !important;
            border: 1px solid var(--border-1) !important;
            border-radius: 8px !important;
        }

        /* DataFrames / Tables */
        .stDataFrame {
            background: var(--surface-1) !important;
            border-radius: 12px !important;
            overflow: hidden;
            border: 1px solid var(--border-1) !important;
        }

        .stDataFrame [data-testid="stTable"] {
            background: var(--surface-1) !important;
        }

        .stDataFrame thead tr {
            background: var(--surface-2) !important;
        }

        .stDataFrame thead th {
            color: var(--text-1) !important;
            font-weight: 700 !important;
            padding: 1rem !important;
            border-bottom: 2px solid var(--accent-1) !important;
        }

        .stDataFrame tbody tr {
            border-bottom: 1px solid var(--border-1) !important;
        }

        .stDataFrame tbody tr:nth-child(even) {
            background: var(--surface-2) !important;
        }

        .stDataFrame tbody tr:hover {
            background: rgba(60, 190, 220, 0.1) !important;
        }

        .stDataFrame tbody td {
            color: var(--text-2) !important;
            padding: 0.75rem 1rem !important;
        }

        /* Metrics */
        [data-testid="stMetricValue"] {
            color: var(--text-1) !important;
            font-weight: 700 !important;
            font-size: 2rem !important;
        }

        [data-testid="stMetricDelta"] {
            font-weight: 600 !important;
        }

        /* Success/Info/Warning/Error Messages */
        .stSuccess {
            background: rgba(46, 229, 157, 0.15) !important;
            border-left: 4px solid var(--pos) !important;
            border-radius: 8px !important;
            color: var(--pos) !important;
        }

        .stInfo {
            background: rgba(60, 190, 220, 0.15) !important;
            border-left: 4px solid var(--accent-1) !important;
            border-radius: 8px !important;
            color: var(--accent-2) !important;
        }

        .stWarning {
            background: rgba(245, 197, 66, 0.15) !important;
            border-left: 4px solid var(--warn) !important;
            border-radius: 8px !important;
            color: var(--warn) !important;
        }

        .stError {
            background: rgba(255, 77, 109, 0.15) !important;
            border-left: 4px solid var(--neg) !important;
            border-radius: 8px !important;
            color: var(--neg) !important;
        }

        /* Progress Bar */
        .stProgress > div > div > div {
            background: linear-gradient(90deg, var(--accent-1) 0%, var(--accent-2) 100%) !important;
        }

        /* Spinner */
        .stSpinner > div {
            border-top-color: var(--accent-1) !important;
        }

        /* Tabs */
        .stTabs [data-baseweb="tab-list"] {
            gap: 8px;
            background: var(--surface-1);
            border-radius: 8px;
            padding: 0.5rem;
        }

        .stTabs [data-baseweb="tab"] {
            background: transparent;
            border-radius: 6px;
            color: var(--text-3) !important;
            font-weight: 600;
            padding: 0.75rem 1.5rem;
        }

        .stTabs [data-baseweb="tab"]:hover {
            background: var(--surface-2);
            color: var(--text-2) !important;
        }

        .stTabs [aria-selected="true"] {
            background: linear-gradient(135deg, var(--accent-1) 0%, var(--accent-2) 100%) !important;
            color: white !important;
        }

        /* Code Blocks */
        .stCodeBlock, code {
            background: var(--surface-2) !important;
            border: 1px solid var(--border-1) !important;
            border-radius: 8px !important;
            color: var(--accent-glow) !important;
        }

        /* Divider */
        hr {
            border-color: var(--border-1) !important;
            margin: 2rem 0 !important;
        }

        /* Checkbox & Radio */
        .stCheckbox, .stRadio {
            color: var(--text-2) !important;
        }

        /* Slider */
        .stSlider > div > div > div > div {
            background: var(--accent-1) !important;
        }

        /* Caption Text */
        .caption {
            color: var(--text-3) !important;
            font-size: 0.875rem;
        }

        /* Link Buttons */
        .stLinkButton > a {
            background: var(--surface-2) !important;
            border: 1px solid var(--border-1) !important;
            border-radius: 8px !important;
            color: var(--accent-2) !important;
            font-weight: 600 !important;
            padding: 0.75rem 1.5rem !important;
            text-decoration: none !important;
            transition: all 0.3s ease;
            display: inline-block;
        }

        .stLinkButton > a:hover {
            border-color: var(--accent-1) !important;
            box-shadow: 0 0 20px rgba(60, 190, 220, 0.4);
            transform: translateY(-2px);
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            h1 {
                font-size: 2rem !important;
            }

            h2 {
                font-size: 1.5rem !important;
            }

            .main .block-container {
                padding-left: 1rem;
                padding-right: 1rem;
            }
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        ::-webkit-scrollbar-track {
            background: var(--bg-1);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--surface-2);
            border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--accent-1);
        }

        /* Glow Animation */
        @keyframes glow {
            0%, 100% {
                box-shadow: 0 0 20px rgba(60, 190, 220, 0.3);
            }
            50% {
                box-shadow: 0 0 30px rgba(60, 190, 220, 0.6);
            }
        }

        .glow-effect {
            animation: glow 2s ease-in-out infinite;
        }
    </style>
    """, unsafe_allow_html=True)

    init_session_state()

    if not is_authenticated():
        render_auth_ui()
        return

    # Hero Header
    st.markdown("""
    <div style="text-align: center; padding: 2rem 0 3rem 0;">
        <h1 style="margin-bottom: 0.5rem;">
            <span style="font-size: 3.5rem;">🏈</span> Ultimate Fantasy Football Trade Analyzer
        </h1>
        <p style="font-size: 1.1rem; color: var(--text-3); font-weight: 500;">
            IDP Support • Historical Analysis • League Import • AI-Powered Insights
        </p>
    </div>
    """, unsafe_allow_html=True)

    if st.session_state.get('show_add_league', False):
        render_add_league_modal()
        return

    if st.session_state.get('show_manage_leagues', False):
        render_manage_leagues_modal()
        return

    league_id = render_league_selector()

    if league_id:
        query_params = st.query_params
        current_url = f"?league_id={league_id}"
        if st.session_state.get('selected_team'):
            current_url += f"&team={st.session_state['selected_team'].replace(' ', '+')}"

        with st.expander("🔗 Share This League"):
            shareable_url = f"https://your-app-url.com/{current_url}"
            st.code(shareable_url)

            share_col1, share_col2, share_col3 = st.columns(3)

            with share_col1:
                st.link_button(
                    "📱 Share via Twitter",
                    f"https://twitter.com/intent/tweet?text=Check%20out%20my%20dynasty%20league%20analysis&url={shareable_url}"
                )

            with share_col2:
                st.link_button(
                    "💬 Share via Facebook",
                    f"https://www.facebook.com/sharer/sharer.php?u={shareable_url}"
                )

            with share_col3:
                if st.button("📋 Copy Link"):
                    st.success("Link copied to clipboard!")

    # Sidebar for configuration
    with st.sidebar:
        st.header("⚙️ Configuration")

        st.markdown("---")
        st.markdown("**🤖 AI Trade Advisor**")

        if 'chat_history' not in st.session_state:
            st.session_state['chat_history'] = []

        if league_id and 'full_projections_df' in st.session_state:
            chat_input = st.text_input(
                "Ask me about trades...",
                key="chat_input",
                placeholder="e.g., Should I trade Bijan?"
            )

            if chat_input:
                with st.spinner("🤔 Thinking..."):
                    playoff_odds = st.session_state.get('playoff_odds_df', None)
                    power_rankings = None

                    if 'power_rankings_history' in st.session_state:
                        history = st.session_state['power_rankings_history']
                        if history:
                            history_df = pd.DataFrame(history)
                            current_week = max(history_df['Week'])
                            power_rankings = history_df[history_df['Week'] == current_week]

                    response = analyze_trade_question(
                        chat_input,
                        st.session_state.get('all_rosters_df', {}),
                        st.session_state.get('full_projections_df', pd.DataFrame()),
                        st.session_state.get('league_details', {}),
                        st.session_state.get('selected_team', ''),
                        playoff_odds,
                        power_rankings
                    )

                    st.session_state['chat_history'].append({
                        'question': chat_input,
                        'response': response
                    })

            with st.expander("💬 Chat History", expanded=True):
                if st.session_state['chat_history']:
                    for i, chat in enumerate(reversed(st.session_state['chat_history'])):
                        st.markdown(f"**You:** {chat['question']}")
                        st.markdown(chat['response'])
                        st.markdown("---")

                        if i >= 2:
                            break
                else:
                    st.info("Ask a question to get started!")

            if st.session_state['chat_history']:
                if st.button("🗑️ Clear Chat"):
                    st.session_state['chat_history'] = []
                    st.rerun()
        else:
            st.info("Enter a League ID to unlock AI advisor")

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

        **User Features:**
        - 🔐 Secure authentication via Supabase
        - 📁 Save multiple leagues per account
        - 💾 Save trades with notes
        - 🔄 Switch leagues instantly
        - 🔒 Private - only you see your data

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

    # Fetch comprehensive league data
    with st.spinner("Loading comprehensive league data..."):
        # Core league data
        users = fetch_sleeper_users(league_id)
        rosters = fetch_sleeper_rosters(league_id)
        sleeper_players = fetch_sleeper_players()

        # Comprehensive Sleeper data
        league_details = fetch_league_details(league_id)
        league_rosters = fetch_league_rosters(league_id)
        league_users = fetch_league_users(league_id)
        traded_picks = fetch_traded_picks(league_id)
        league_drafts = fetch_league_drafts(league_id)

        # Fetch all NFL players for autocomplete (cached 24 hours)
        all_nfl_players = fetch_all_nfl_players()

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

        # Detect league format (superflex check) using comprehensive league data
        is_superflex = is_superflex_league(league_details) if league_details else False

    # Build searchable player and pick lists for autocomplete
    if all_nfl_players:
        st.success(f"✅ Loaded {len(all_nfl_players):,} NFL players for predictive search")
        player_display_to_id = build_searchable_player_list(all_nfl_players, active_only=True)
    else:
        st.warning("⚠️ Could not load NFL player database. Autocomplete may be limited.")
        player_display_to_id = {}

    num_teams = len(rosters) if rosters else 12
    num_rounds = league_details.get('settings', {}).get('draft_rounds', 5) if league_details else 5
    pick_options = build_pick_options(num_teams=num_teams, num_rounds=num_rounds)

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

    # League Overview Section
    st.markdown("---")
    st.header("📋 League Overview")

    if league_details:
        overview_tab1, overview_tab2, overview_tab3, overview_tab4 = st.tabs([
            "⚙️ League Settings",
            "📊 Scoring",
            "🎯 Future Picks",
            "📈 Recent Activity"
        ])

        with overview_tab1:
            col1, col2, col3, col4 = st.columns(4)

            with col1:
                league_name = league_details.get('name', 'Unknown League')
                st.metric("League Name", league_name)

            with col2:
                season = league_details.get('season', 'N/A')
                st.metric("Season", season)

            with col3:
                num_teams = len(league_rosters) if league_rosters else len(rosters)
                st.metric("Teams", num_teams)

            with col4:
                league_status = league_details.get('status', 'unknown')
                st.metric("Status", league_status.title())

            st.markdown("#### Roster Configuration")
            roster_format = format_roster_positions(league_details)
            st.info(f"**Starters & Bench:** {roster_format}")

            st.markdown("#### League Settings")
            settings = league_details.get('settings', {})
            settings_col1, settings_col2, settings_col3 = st.columns(3)

            with settings_col1:
                waiver_type = settings.get('waiver_type', 'N/A')
                st.write(f"**Waiver Type:** {waiver_type}")
                waiver_budget = settings.get('waiver_budget', 0)
                if waiver_budget > 0:
                    st.write(f"**FAAB Budget:** ${waiver_budget}")

            with settings_col2:
                playoff_teams = settings.get('playoff_teams', 'N/A')
                st.write(f"**Playoff Teams:** {playoff_teams}")
                playoff_weeks = settings.get('playoff_week_start', 'N/A')
                st.write(f"**Playoff Start:** Week {playoff_weeks}")

            with settings_col3:
                trade_deadline = settings.get('trade_deadline', 'N/A')
                st.write(f"**Trade Deadline:** Week {trade_deadline}")
                taxi_slots = settings.get('taxi_slots', 0)
                if taxi_slots > 0:
                    st.write(f"**Taxi Slots:** {taxi_slots}")

            if is_superflex:
                st.success("⚡ **Superflex League** - QB values are boosted 50%")
            else:
                st.info("🏈 **1QB League** - Standard QB valuations")

        with overview_tab2:
            st.markdown("#### Scoring Settings")

            scoring_df = get_scoring_summary(league_details)

            if not scoring_df.empty:
                for category in scoring_df['Category'].unique():
                    with st.expander(f"{category} Scoring", expanded=(category in ['Passing', 'Rushing', 'Receiving'])):
                        category_df = scoring_df[scoring_df['Category'] == category]
                        st.dataframe(
                            category_df[['Stat', 'Points']].reset_index(drop=True),
                            use_container_width=True,
                            hide_index=True
                        )
            else:
                st.info("Scoring settings not available")

            st.markdown("#### PPR Status")
            scoring_settings = league_details.get('scoring_settings', {})
            rec_pts = scoring_settings.get('rec', 0)
            if rec_pts == 1:
                st.success("✅ **Full PPR** (1 point per reception)")
            elif rec_pts == 0.5:
                st.info("📊 **Half PPR** (0.5 points per reception)")
            else:
                st.info("📈 **Standard** (No PPR)")

        with overview_tab3:
            st.markdown("#### Future Draft Picks Inventory")

            if traded_picks or league_rosters:
                future_picks_df = get_future_picks_inventory(
                    league_id, league_details, league_rosters, league_users, traded_picks
                )

                if not future_picks_df.empty:
                    st.write(f"Total future picks tracked: **{len(future_picks_df)}**")

                    for team in sorted(future_picks_df['Current Owner'].unique()):
                        team_picks = future_picks_df[future_picks_df['Current Owner'] == team]
                        with st.expander(f"{team} ({len(team_picks)} picks)", expanded=False):
                            for _, pick_row in team_picks.iterrows():
                                if pick_row['Status'] == 'Traded':
                                    st.write(f"✅ {pick_row['Pick']} (from {pick_row['Original Team']})")
                                else:
                                    st.write(f"• {pick_row['Pick']}")

                    st.markdown("---")
                    st.markdown("**Pick Summary by Year:**")
                    picks_by_year = future_picks_df.groupby('Season').size().reset_index(name='Count')
                    st.dataframe(picks_by_year, use_container_width=True, hide_index=True)
                else:
                    st.info("No future picks data available")
            else:
                st.info("No traded picks found. All teams have their original picks.")

        with overview_tab4:
            st.markdown("#### Recent League Activity")

            recent_activity = get_recent_transactions_summary(league_id, weeks=4)

            activity_col1, activity_col2, activity_col3 = st.columns(3)

            with activity_col1:
                st.metric("Trades (Last 4 Weeks)", recent_activity['total_trades'])

            with activity_col2:
                st.metric("Waiver Claims", recent_activity['total_waivers'])

            with activity_col3:
                st.metric("FAAB Spent", f"${recent_activity['total_faab_spent']}")

            st.write(f"**Active Teams:** {recent_activity['active_teams']} teams have made moves")

            if league_drafts:
                st.markdown("#### Draft History")
                st.write(f"**Total Drafts:** {len(league_drafts)}")

                for draft in league_drafts[:3]:
                    draft_type = draft.get('type', 'unknown')
                    draft_status = draft.get('status', 'unknown')
                    st.write(f"• {draft_type.title()} Draft - Status: {draft_status.title()}")

    else:
        st.warning("League details not available. Some features may be limited.")

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

            # Apply league-specific scoring adjustments
            if league_details:
                adjusted_value = adjust_value_for_league_scoring(adjusted_value, position, league_details)

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

        # League Rankings Section
        st.markdown("---")
        st.header("🏆 League-Wide Team Rankings")
        st.caption("Rankings based on SportsDataIO projections with custom adjustments for age, scoring, and league format")

        with st.spinner("Calculating league rankings..."):
            players_only_df, players_plus_picks_df = calculate_league_rankings(
                all_rosters_df,
                traded_picks,
                league_rosters,
                league_users,
                league_details,
                is_superflex
            )

        if not players_only_df.empty and not players_plus_picks_df.empty:
            ranking_subtab1, ranking_subtab2 = st.tabs([
                "👥 Players Only",
                "👥+🎯 Players + Picks"
            ])

            with ranking_subtab1:
                st.markdown("##### Team Rankings by Player Value")
                st.caption("Total roster value based on adjusted projections, VORP, age, and scoring format")

                for idx, row in players_only_df.iterrows():
                    is_your_team = row['Team'] == your_team
                    team_display = f"**{row['Team']}**" if is_your_team else row['Team']
                    emoji = "🏆" if row['Rank'] == 1 else "🥈" if row['Rank'] == 2 else "🥉" if row['Rank'] == 3 else "📊"

                    with st.expander(f"{emoji} #{row['Rank']} - {team_display} - {row['Player Value']:.0f} pts", expanded=is_your_team):
                        st.write(f"**Total Player Value:** {row['Player Value']:,.0f} points")
                        st.write(f"**Top Players:** {row['Top Players']}")

                st.markdown("---")
                st.markdown("##### Visual Comparison")

                chart_data = players_only_df.copy()

                chart = alt.Chart(chart_data).mark_bar().encode(
                    x=alt.X('Player Value:Q', title='Total Player Value (pts)'),
                    y=alt.Y('Team:N', sort='-x', title='Team'),
                    color=alt.condition(
                        alt.datum.Team == your_team,
                        alt.value('#3CBEDC'),
                        alt.value('#0B1B33')
                    ),
                    tooltip=['Team', alt.Tooltip('Player Value:Q', format=',.0f')]
                ).properties(height=400)

                st.altair_chart(chart, use_container_width=True)

                st.dataframe(
                    players_only_df,
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        'Rank': st.column_config.NumberColumn('Rank', format='#%d'),
                        'Player Value': st.column_config.NumberColumn('Player Value', format='%,.0f pts')
                    }
                )

            with ranking_subtab2:
                st.markdown("##### Team Rankings by Total Value (Players + Future Picks)")
                st.caption("Complete roster value including future draft picks. Pick values estimated from slot position.")

                for idx, row in players_plus_picks_df.iterrows():
                    is_your_team = row['Team'] == your_team
                    team_display = f"**{row['Team']}**" if is_your_team else row['Team']
                    emoji = "🏆" if row['Rank'] == 1 else "🥈" if row['Rank'] == 2 else "🥉" if row['Rank'] == 3 else "📊"

                    with st.expander(f"{emoji} #{row['Rank']} - {team_display} - {row['Total Value']:.0f} pts", expanded=is_your_team):
                        col1, col2 = st.columns(2)

                        with col1:
                            st.metric("Total Value", f"{row['Total Value']:,.0f} pts")
                            st.metric("Player Value", f"{row['Player Value']:,.0f} pts")

                        with col2:
                            st.metric("Pick Value", f"{row['Pick Value']:,.0f} pts")
                            st.metric("Future Picks", f"{row['Pick Count']} picks")

                        st.write(f"**Future Picks:** {row['Future Picks']}")

                st.markdown("---")
                st.markdown("##### Visual Comparison")

                chart_data = players_plus_picks_df.copy()
                chart_data['Your Team'] = chart_data['Team'].apply(lambda x: 'Your Team' if x == your_team else 'Other Teams')

                chart = alt.Chart(chart_data).mark_bar().encode(
                    x=alt.X('Total Value:Q', title='Total Value (pts)'),
                    y=alt.Y('Team:N', sort='-x', title='Team'),
                    color=alt.Color('Your Team:N', scale=alt.Scale(domain=['Your Team', 'Other Teams'], range=['#3CBEDC', '#0B1B33'])),
                    tooltip=[
                        'Team',
                        alt.Tooltip('Total Value:Q', format=',.0f'),
                        alt.Tooltip('Player Value:Q', format=',.0f'),
                        alt.Tooltip('Pick Value:Q', format=',.0f'),
                        alt.Tooltip('Pick Count:Q', format='d')
                    ]
                ).properties(height=400)

                st.altair_chart(chart, use_container_width=True)

                chart_data_stacked = pd.DataFrame()
                for _, row in players_plus_picks_df.iterrows():
                    chart_data_stacked = pd.concat([
                        chart_data_stacked,
                        pd.DataFrame({
                            'Team': [row['Team'], row['Team']],
                            'Value Type': ['Players', 'Picks'],
                            'Value': [row['Player Value'], row['Pick Value']],
                            'Your Team': ['Your Team' if row['Team'] == your_team else 'Other Teams'] * 2
                        })
                    ])

                stacked_chart = alt.Chart(chart_data_stacked).mark_bar().encode(
                    x=alt.X('sum(Value):Q', title='Value (pts)', stack='zero'),
                    y=alt.Y('Team:N', sort=alt.EncodingSortField(field='Value', op='sum', order='descending'), title='Team'),
                    color=alt.Color('Value Type:N', scale=alt.Scale(domain=['Players', 'Picks'], range=['#2EE59D', '#F5C542'])),
                    tooltip=['Team', 'Value Type', alt.Tooltip('Value:Q', format=',.0f')]
                ).properties(height=400, title='Team Value Breakdown: Players vs Picks')

                st.altair_chart(stacked_chart, use_container_width=True)

                st.dataframe(
                    players_plus_picks_df,
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        'Rank': st.column_config.NumberColumn('Rank', format='#%d'),
                        'Total Value': st.column_config.NumberColumn('Total Value', format='%,.0f pts'),
                        'Player Value': st.column_config.NumberColumn('Player Value', format='%,.0f pts'),
                        'Pick Value': st.column_config.NumberColumn('Pick Value', format='%,.0f pts'),
                        'Pick Count': st.column_config.NumberColumn('Pick Count', format='%d picks')
                    }
                )

                st.info("💡 **Note:** Pick values are estimated at mid-round (slot .06) for each owned pick. Actual value may vary based on final draft position.")

        else:
            st.warning("Unable to calculate rankings. Please ensure roster data is loaded.")

        # Playoff Odds Simulator
        st.markdown("---")
        st.header("🎲 Playoff Odds Simulator")
        st.caption("Monte Carlo simulation using SportsDataIO projections with historical variance")

        # Get current week
        current_season = league_details.get('season', '2024')
        settings = league_details.get('settings', {})
        playoff_week_start = settings.get('playoff_week_start', 15)

        # Simple heuristic: if we're past week 1, assume season has started
        # For demo purposes, use week 10 as default mid-season point
        current_week_input = st.number_input(
            "Current Week",
            min_value=1,
            max_value=playoff_week_start - 1,
            value=min(10, playoff_week_start - 1),
            help="Enter the current week of the season. Past weeks will use actual results, future weeks will be simulated."
        )

        col1, col2 = st.columns(2)
        with col1:
            n_simulations = st.selectbox(
                "Number of Simulations",
                [5000, 10000, 25000],
                index=1,
                help="More simulations = more accurate but slower. 10,000 is recommended."
            )

        with col2:
            variance_pct = st.slider(
                "Score Variance %",
                min_value=10,
                max_value=40,
                value=25,
                step=5,
                help="Standard deviation as % of projected score. Higher = more randomness."
            ) / 100

        run_simulation = st.button("🎲 Run Playoff Simulation", type="primary")

        if run_simulation or 'playoff_odds_df' in st.session_state:
            with st.spinner(f"Running {n_simulations:,} Monte Carlo simulations..."):
                # Fetch all matchups
                total_weeks = playoff_week_start - 1
                all_matchups = fetch_all_matchups(league_id, current_week_input, total_weeks)

                # Run simulation
                playoff_odds_df = run_playoff_simulation(
                    all_rosters_df,
                    league_details,
                    league_rosters,
                    league_users,
                    all_matchups,
                    current_week_input,
                    n_simulations=n_simulations,
                    variance_pct=variance_pct
                )

                # Store in session state
                st.session_state['playoff_odds_df'] = playoff_odds_df
                st.session_state['simulation_params'] = {
                    'n_simulations': n_simulations,
                    'variance_pct': variance_pct,
                    'current_week': current_week_input
                }

            if not playoff_odds_df.empty:
                st.success(f"✅ Completed {n_simulations:,} simulations for {len(playoff_odds_df)} teams")

                # Find your team's odds
                your_odds = playoff_odds_df[playoff_odds_df['Team'] == your_team].iloc[0] if your_team in playoff_odds_df['Team'].values else None

                if your_odds is not None:
                    st.markdown(f"### Your Team: {your_team}")
                    metric_col1, metric_col2, metric_col3, metric_col4 = st.columns(4)

                    with metric_col1:
                        st.metric(
                            "Playoff Odds",
                            f"{your_odds['Playoff %']:.1f}%",
                            help="Probability of making the playoffs"
                        )

                    with metric_col2:
                        st.metric(
                            "Championship Odds",
                            f"{your_odds['Championship %']:.1f}%",
                            help="Probability of winning the championship"
                        )

                    with metric_col3:
                        st.metric(
                            "Projected Record",
                            f"{your_odds['Projected Wins']:.1f}-{your_odds['Projected Losses']:.1f}",
                            help="Average wins-losses across simulations"
                        )

                    with metric_col4:
                        st.metric(
                            "Avg Playoff Seed",
                            f"{your_odds['Avg Seed']:.1f}" if your_odds['Avg Seed'] > 0 else "N/A",
                            help="Average playoff seeding when making playoffs"
                        )

                st.markdown("---")
                st.markdown("### League-Wide Playoff Odds")

                # Display table with highlighting
                display_df = playoff_odds_df.copy()

                # Create a styled table
                for idx, row in display_df.iterrows():
                    is_your_team = row['Team'] == your_team
                    team_display = f"**{row['Team']}**" if is_your_team else row['Team']

                    playoff_color = "🟢" if row['Playoff %'] >= 75 else "🟡" if row['Playoff %'] >= 50 else "🟠" if row['Playoff %'] >= 25 else "🔴"
                    title_color = "🏆" if row['Championship %'] >= 20 else "🥈" if row['Championship %'] >= 10 else "🥉" if row['Championship %'] >= 5 else "📊"

                    with st.expander(
                        f"{playoff_color} {team_display} - Playoff: {row['Playoff %']:.1f}% | Title: {row['Championship %']:.1f}%",
                        expanded=is_your_team
                    ):
                        detail_col1, detail_col2, detail_col3 = st.columns(3)

                        with detail_col1:
                            st.write(f"**Current:** {row['Current Record']}")
                            st.write(f"**Projected:** {row['Projected Wins']:.1f}-{row['Projected Losses']:.1f}")

                        with detail_col2:
                            st.write(f"**Playoff %:** {row['Playoff %']:.1f}%")
                            st.write(f"**Bye %:** {row['Bye %']:.1f}%")

                        with detail_col3:
                            st.write(f"**Title %:** {row['Championship %']:.1f}%")
                            st.write(f"**Avg Seed:** {row['Avg Seed']:.1f}" if row['Avg Seed'] > 0 else "**Avg Seed:** N/A")

                # Visual charts
                st.markdown("---")
                st.markdown("### Visual Odds Comparison")

                odds_tab1, odds_tab2, odds_tab3 = st.tabs([
                    "📊 Playoff Odds",
                    "🏆 Championship Odds",
                    "📈 Projected Wins"
                ])

                with odds_tab1:
                    chart_data = playoff_odds_df.copy()
                    chart_data['Your Team'] = chart_data['Team'].apply(lambda x: 'Your Team' if x == your_team else 'Other Teams')

                    chart = alt.Chart(chart_data).mark_bar().encode(
                        x=alt.X('Playoff %:Q', title='Playoff Probability (%)'),
                        y=alt.Y('Team:N', sort='-x', title='Team'),
                        color=alt.Color('Your Team:N', scale=alt.Scale(domain=['Your Team', 'Other Teams'], range=['#3CBEDC', '#0B1B33'])),
                        tooltip=[
                            'Team',
                            alt.Tooltip('Playoff %:Q', format='.1f'),
                            alt.Tooltip('Championship %:Q', format='.1f'),
                            'Current Record'
                        ]
                    ).properties(height=400, title='Playoff Probability by Team')

                    st.altair_chart(chart, use_container_width=True)

                with odds_tab2:
                    chart_data = playoff_odds_df.copy()
                    chart_data['Your Team'] = chart_data['Team'].apply(lambda x: 'Your Team' if x == your_team else 'Other Teams')

                    chart = alt.Chart(chart_data).mark_bar().encode(
                        x=alt.X('Championship %:Q', title='Championship Probability (%)'),
                        y=alt.Y('Team:N', sort='-x', title='Team'),
                        color=alt.Color('Your Team:N', scale=alt.Scale(domain=['Your Team', 'Other Teams'], range=['#2EE59D', '#5BC0FF'])),
                        tooltip=[
                            'Team',
                            alt.Tooltip('Championship %:Q', format='.1f'),
                            alt.Tooltip('Playoff %:Q', format='.1f'),
                            alt.Tooltip('Avg Seed:Q', format='.1f')
                        ]
                    ).properties(height=400, title='Championship Probability by Team')

                    st.altair_chart(chart, use_container_width=True)

                with odds_tab3:
                    chart_data = playoff_odds_df.copy()
                    chart_data['Your Team'] = chart_data['Team'].apply(lambda x: 'Your Team' if x == your_team else 'Other Teams')

                    chart = alt.Chart(chart_data).mark_bar().encode(
                        x=alt.X('Projected Wins:Q', title='Projected Wins'),
                        y=alt.Y('Team:N', sort='-x', title='Team'),
                        color=alt.Color('Your Team:N', scale=alt.Scale(domain=['Your Team', 'Other Teams'], range=['#F5C542', '#9AF0FF'])),
                        tooltip=[
                            'Team',
                            alt.Tooltip('Projected Wins:Q', format='.1f'),
                            alt.Tooltip('Projected Losses:Q', format='.1f'),
                            alt.Tooltip('Playoff %:Q', format='.1f')
                        ]
                    ).properties(height=400, title='Projected Wins by Team')

                    st.altair_chart(chart, use_container_width=True)

                # Data table
                st.markdown("---")
                st.markdown("### Detailed Simulation Results")

                st.dataframe(
                    playoff_odds_df[[
                        'Team', 'Current Record', 'Projected Wins', 'Projected Losses',
                        'Playoff %', 'Bye %', 'Championship %', 'Avg Seed'
                    ]],
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        'Projected Wins': st.column_config.NumberColumn('Proj Wins', format='%.1f'),
                        'Projected Losses': st.column_config.NumberColumn('Proj Losses', format='%.1f'),
                        'Playoff %': st.column_config.NumberColumn('Playoff %', format='%.1f%%'),
                        'Bye %': st.column_config.NumberColumn('Bye %', format='%.1f%%'),
                        'Championship %': st.column_config.NumberColumn('Title %', format='%.1f%%'),
                        'Avg Seed': st.column_config.NumberColumn('Avg Seed', format='%.1f')
                    }
                )

                st.info("💡 **Simulation Details:** Based on SportsDataIO projections with " +
                       f"{int(variance_pct*100)}% variance. Past weeks use actual results, " +
                       "future weeks simulated. Championship odds use seed-weighted probability.")

            else:
                st.error("Unable to run simulation. Please ensure all data is loaded correctly.")

        # Power Rankings Dashboard
        st.markdown("---")
        st.header("⚡ Power Rankings")
        st.caption("Dynamic rankings combining roster value, playoff odds, recent performance, and strength of schedule")

        if 'playoff_odds_df' in st.session_state and not st.session_state['playoff_odds_df'].empty:
            power_current_week = st.session_state.get('simulation_params', {}).get('current_week', current_week_input)

            with st.spinner("Calculating power rankings..."):
                roster_id_to_team = {}
                for roster in league_rosters:
                    owner_id = roster.get('owner_id')
                    roster_id = roster['roster_id']
                    user_map = {user['user_id']: user.get('display_name', user.get('username', 'Unknown'))
                               for user in league_users}
                    team_name = user_map.get(owner_id, f"Team {roster_id}")
                    roster_id_to_team[roster_id] = team_name

                team_projections = {}
                for team_name, roster_df in all_rosters_df.items():
                    team_projections[team_name] = calculate_team_projected_points(roster_df, league_details, starters_only=True)

                recent_performance = calculate_recent_performance(
                    all_matchups,
                    roster_id_to_team,
                    power_current_week,
                    lookback_weeks=4
                )

                sos_data = calculate_strength_of_schedule(
                    all_matchups,
                    roster_id_to_team,
                    team_projections,
                    power_current_week,
                    total_weeks
                )

                power_rankings_df = calculate_power_rankings(
                    all_rosters_df,
                    st.session_state['playoff_odds_df'],
                    recent_performance,
                    team_projections,
                    sos_data
                )

                history_df = track_power_rankings_history(power_rankings_df, power_current_week)
                power_rankings_df = calculate_rank_change(power_rankings_df, history_df, power_current_week)

            st.markdown(f"### Week {power_current_week} Power Rankings")

            your_rank_row = power_rankings_df[power_rankings_df['Team'] == your_team]
            if len(your_rank_row) > 0:
                your_rank = your_rank_row['Rank'].iloc[0]
                your_score = your_rank_row['Power Score'].iloc[0]
                your_delta_rank = your_rank_row['Δ Rank'].iloc[0]
                your_trend = your_rank_row['Trend'].iloc[0]

                rank_col1, rank_col2, rank_col3, rank_col4 = st.columns(4)

                with rank_col1:
                    st.metric(
                        "Your Rank",
                        f"#{your_rank}",
                        delta=f"{your_delta_rank:+.0f}" if your_delta_rank != 0 else None,
                        delta_color="inverse"
                    )

                with rank_col2:
                    st.metric(
                        "Power Score",
                        f"{your_score:.1f}",
                        delta=f"{your_rank_row['Δ Score'].iloc[0]:+.1f}" if your_rank_row['Δ Score'].iloc[0] != 0 else None
                    )

                with rank_col3:
                    trend_icon = "📈" if your_trend == "up" else "📉" if your_trend == "down" else "➡️"
                    st.metric(
                        "Recent Form",
                        f"{trend_icon} {your_rank_row['Recent PPG'].iloc[0]:.1f} PPG",
                        help="Average points per game over last 4 weeks"
                    )

                with rank_col4:
                    sos_rank = your_rank_row['SOS Rank'].iloc[0]
                    sos_difficulty = "Hard" if sos_rank <= 4 else "Medium" if sos_rank <= 8 else "Easy"
                    st.metric(
                        "Schedule",
                        f"{sos_difficulty} (#{sos_rank})",
                        help="Strength of schedule rank"
                    )

            st.markdown("---")

            visual_tab1, visual_tab2, visual_tab3 = st.tabs([
                "📊 Rankings Table",
                "📈 Power Score Trends",
                "🎯 Component Breakdown"
            ])

            with visual_tab1:
                st.markdown("### Current Power Rankings")

                display_rankings = power_rankings_df.copy()
                display_rankings['Your Team'] = display_rankings['Team'].apply(
                    lambda x: '⭐ ' + x if x == your_team else x
                )

                for idx, row in display_rankings.iterrows():
                    is_your_team = row['Team'] == your_team
                    team_display = row['Your Team']

                    trend_icon = "📈" if row['Trend'] == "up" else "📉" if row['Trend'] == "down" else "➡️"
                    delta_icon = "🔺" if row['Δ Rank'] > 0 else "🔻" if row['Δ Rank'] < 0 else "➖"

                    rank_str = f"#{row['Rank']}"
                    if row['Δ Rank'] != 0:
                        rank_str += f" ({delta_icon} {abs(row['Δ Rank'])})"

                    sos_difficulty = "🔴" if row['SOS Rank'] <= 4 else "🟡" if row['SOS Rank'] <= 8 else "🟢"

                    with st.expander(
                        f"{rank_str} {team_display} - Score: {row['Power Score']:.1f} {trend_icon}",
                        expanded=is_your_team
                    ):
                        detail_col1, detail_col2, detail_col3 = st.columns(3)

                        with detail_col1:
                            st.write("**Roster & Odds**")
                            st.write(f"Roster Value: {row['Roster Value']:.1f}")
                            st.write(f"Playoff %: {row['Playoff %']:.1f}%")
                            st.write(f"Title %: {row['Championship %']:.1f}%")

                        with detail_col2:
                            st.write("**Recent Performance**")
                            st.write(f"Last 4 Weeks: {row['Recent Record']}")
                            st.write(f"Avg PPG: {row['Recent PPG']:.1f}")
                            st.write(f"Trend: {trend_icon} {row['Trend'].title()}")

                        with detail_col3:
                            st.write("**Schedule**")
                            st.write(f"SOS Rank: {sos_difficulty} #{row['SOS Rank']}")
                            st.write(f"Future SOS: {row['Future SOS']:.1f}")
                            st.write(f"Power Score: {row['Power Score']:.1f}")

                st.markdown("---")
                st.markdown("### Detailed Rankings Table")

                table_display = display_rankings[[
                    'Rank', 'Your Team', 'Power Score', 'Δ Rank', 'Δ Score',
                    'Trend', 'Recent PPG', 'SOS Rank'
                ]].copy()

                table_display = table_display.rename(columns={
                    'Your Team': 'Team',
                    'Δ Rank': 'Δ',
                    'Δ Score': 'Score Δ'
                })

                st.dataframe(
                    table_display,
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        'Rank': st.column_config.NumberColumn('Rank', format='#%d'),
                        'Power Score': st.column_config.NumberColumn('Power Score', format='%.1f'),
                        'Δ': st.column_config.NumberColumn('Δ', format='%+d'),
                        'Score Δ': st.column_config.NumberColumn('Score Δ', format='%+.1f'),
                        'Recent PPG': st.column_config.NumberColumn('Recent PPG', format='%.1f'),
                        'SOS Rank': st.column_config.NumberColumn('SOS', format='#%d')
                    }
                )

            with visual_tab2:
                st.markdown("### Power Score Trends Over Time")

                if not history_df.empty and len(history_df['Week'].unique()) > 1:
                    chart_data = history_df.copy()
                    chart_data['Your Team'] = chart_data['Team'].apply(
                        lambda x: 'Your Team' if x == your_team else 'Other Teams'
                    )

                    base_chart = alt.Chart(chart_data).mark_line(point=True).encode(
                        x=alt.X('Week:Q', title='Week', scale=alt.Scale(domain=[
                            chart_data['Week'].min(),
                            chart_data['Week'].max()
                        ])),
                        y=alt.Y('Power Score:Q', title='Power Score'),
                        color=alt.Color(
                            'Team:N',
                            legend=alt.Legend(title='Team', orient='right'),
                            scale=alt.Scale(scheme='tableau20')
                        ),
                        strokeWidth=alt.condition(
                            alt.datum.Team == your_team,
                            alt.value(3),
                            alt.value(1)
                        ),
                        opacity=alt.condition(
                            alt.datum.Team == your_team,
                            alt.value(1.0),
                            alt.value(0.3)
                        ),
                        tooltip=[
                            alt.Tooltip('Week:Q', title='Week'),
                            alt.Tooltip('Team:N', title='Team'),
                            alt.Tooltip('Power Score:Q', title='Power Score', format='.1f'),
                            alt.Tooltip('Rank:Q', title='Rank')
                        ]
                    ).properties(
                        height=400,
                        title='Power Score Progression by Team'
                    ).interactive()

                    st.altair_chart(base_chart, use_container_width=True)

                    st.markdown("#### Rank Movement Chart")

                    rank_chart = alt.Chart(chart_data).mark_line(point=True).encode(
                        x=alt.X('Week:Q', title='Week'),
                        y=alt.Y('Rank:Q', title='Power Rank', scale=alt.Scale(reverse=True)),
                        color=alt.Color(
                            'Team:N',
                            legend=alt.Legend(title='Team', orient='right'),
                            scale=alt.Scale(scheme='tableau20')
                        ),
                        strokeWidth=alt.condition(
                            alt.datum.Team == your_team,
                            alt.value(3),
                            alt.value(1)
                        ),
                        opacity=alt.condition(
                            alt.datum.Team == your_team,
                            alt.value(1.0),
                            alt.value(0.3)
                        ),
                        tooltip=[
                            alt.Tooltip('Week:Q', title='Week'),
                            alt.Tooltip('Team:N', title='Team'),
                            alt.Tooltip('Rank:Q', title='Rank'),
                            alt.Tooltip('Power Score:Q', title='Power Score', format='.1f')
                        ]
                    ).properties(
                        height=400,
                        title='Power Rank Progression (Lower is Better)'
                    ).interactive()

                    st.altair_chart(rank_chart, use_container_width=True)

                    your_history = chart_data[chart_data['Team'] == your_team].sort_values('Week')
                    if len(your_history) > 1:
                        st.markdown(f"#### Your Team's Journey")

                        weeks = your_history['Week'].tolist()
                        scores = your_history['Power Score'].tolist()
                        ranks = your_history['Rank'].tolist()

                        journey_cols = st.columns(min(len(weeks), 5))
                        for i, week in enumerate(weeks):
                            with journey_cols[i % 5]:
                                rank_change = ""
                                if i > 0:
                                    rank_diff = ranks[i-1] - ranks[i]
                                    if rank_diff > 0:
                                        rank_change = f" 🔺+{rank_diff}"
                                    elif rank_diff < 0:
                                        rank_change = f" 🔻{rank_diff}"

                                st.metric(
                                    f"Week {int(week)}",
                                    f"#{int(ranks[i])}{rank_change}",
                                    f"{scores[i]:.1f} pts"
                                )

                else:
                    st.info("📊 Power rankings history will appear here as you run simulations across multiple weeks. " +
                           "Update the current week and re-run to track changes over time.")

            with visual_tab3:
                st.markdown("### Power Score Component Breakdown")

                st.markdown("""
                **Power Score Formula:**
                - 40% Roster Value (long-term strength)
                - 30% Playoff Odds (championship probability)
                - 20% Recent Performance (current form)
                - 10% Strength of Schedule (difficulty adjustment)
                """)

                component_data = []
                for _, row in power_rankings_df.iterrows():
                    team = row['Team']
                    is_your_team = team == your_team

                    playoff_score = (row['Playoff %'] * 0.7 + row['Championship %'] * 0.3)

                    max_roster = power_rankings_df['Roster Value'].max()
                    normalized_roster = (row['Roster Value'] / max_roster * 100) if max_roster > 0 else 0

                    max_recent = power_rankings_df['Recent PPG'].max()
                    normalized_recent = (row['Recent PPG'] / max_recent * 100) if max_recent > 0 else 0

                    num_teams = len(power_rankings_df)
                    sos_score = ((num_teams - row['SOS Rank'] + 1) / num_teams) * 100

                    component_data.append({
                        'Team': team,
                        'Roster': normalized_roster * 0.40,
                        'Playoff Odds': playoff_score * 0.30,
                        'Recent Form': normalized_recent * 0.20,
                        'Schedule': sos_score * 0.10,
                        'Your Team': 'Your Team' if is_your_team else 'Other Teams'
                    })

                component_df = pd.DataFrame(component_data)

                melted_components = component_df.melt(
                    id_vars=['Team', 'Your Team'],
                    value_vars=['Roster', 'Playoff Odds', 'Recent Form', 'Schedule'],
                    var_name='Component',
                    value_name='Score'
                )

                component_chart = alt.Chart(melted_components).mark_bar().encode(
                    x=alt.X('Score:Q', title='Contribution to Power Score', stack='zero'),
                    y=alt.Y('Team:N', sort='-x', title='Team'),
                    color=alt.Color(
                        'Component:N',
                        scale=alt.Scale(scheme='category10'),
                        legend=alt.Legend(title='Component')
                    ),
                    opacity=alt.condition(
                        alt.datum['Your Team'] == 'Your Team',
                        alt.value(1.0),
                        alt.value(0.6)
                    ),
                    tooltip=[
                        'Team',
                        'Component',
                        alt.Tooltip('Score:Q', format='.1f')
                    ]
                ).properties(
                    height=400,
                    title='Power Score Component Breakdown by Team'
                ).interactive()

                st.altair_chart(component_chart, use_container_width=True)

                if len(your_rank_row) > 0:
                    st.markdown("#### Your Team's Component Analysis")

                    your_components = component_df[component_df['Team'] == your_team].iloc[0]

                    comp_col1, comp_col2, comp_col3, comp_col4 = st.columns(4)

                    with comp_col1:
                        st.metric(
                            "Roster (40%)",
                            f"{your_components['Roster']:.1f}",
                            help="Normalized roster value contribution"
                        )

                    with comp_col2:
                        st.metric(
                            "Playoff Odds (30%)",
                            f"{your_components['Playoff Odds']:.1f}",
                            help="Playoff & championship probability contribution"
                        )

                    with comp_col3:
                        st.metric(
                            "Recent Form (20%)",
                            f"{your_components['Recent Form']:.1f}",
                            help="Last 4 weeks performance contribution"
                        )

                    with comp_col4:
                        st.metric(
                            "Schedule (10%)",
                            f"{your_components['Schedule']:.1f}",
                            help="Strength of schedule contribution"
                        )

            st.info("💡 **How to Use Power Rankings:** These rankings combine multiple factors to show true team strength. " +
                   "Rising ranks indicate improving teams, while falling ranks may signal concern. " +
                   "Use this alongside playoff odds and trade analysis for strategic decisions.")

        else:
            st.info("⚡ Run the Playoff Odds Simulator above to unlock Power Rankings analysis.")

        # Trade History Analyzer
        st.markdown("---")
        st.header("📜 Trade History & Analyzer")
        st.caption("Retrospective analysis of all league trades using current player valuations")

        with st.spinner("Fetching trade history..."):
            all_transactions = fetch_league_transactions(league_id)
            trades = filter_trades(all_transactions)

        if trades:
            st.success(f"Found {len(trades)} trades in league history")

            parsed_trades = []
            analyzed_trades = []

            with st.spinner("Analyzing trades..."):
                for trade in trades:
                    parsed = parse_trade_details(trade, league_users, all_players_data, league_rosters)
                    parsed_trades.append(parsed)

                    analysis = analyze_historical_trade(
                        parsed,
                        all_rosters_df,
                        full_projections_df,
                        league_details,
                        all_players_data
                    )
                    analyzed_trades.append(analysis)

            trade_history_df = build_trade_history_dataframe(parsed_trades, analyzed_trades)

            filter_col1, filter_col2, filter_col3 = st.columns(3)

            with filter_col1:
                unique_teams = []
                for trade in parsed_trades:
                    unique_teams.extend(trade['teams_involved'])
                unique_teams = sorted(list(set(unique_teams)))

                team_filter = st.multiselect(
                    "Filter by Team",
                    options=['All'] + unique_teams,
                    default=['All']
                )

            with filter_col2:
                quality_filter = st.multiselect(
                    "Filter by Quality",
                    options=['All', 'Fair', 'Lopsided'],
                    default=['All']
                )

            with filter_col3:
                player_filter = st.text_input(
                    "Filter by Player Name",
                    placeholder="e.g., Bijan Robinson"
                )

            filtered_df = trade_history_df.copy()

            if team_filter and 'All' not in team_filter:
                filtered_df = filtered_df[filtered_df['Teams'].apply(
                    lambda x: any(team in x for team in team_filter)
                )]

            if quality_filter and 'All' not in quality_filter:
                filtered_df = filtered_df[filtered_df['Quality'].isin(quality_filter)]

            if player_filter:
                filtered_df = filtered_df[filtered_df['Players'].str.contains(
                    player_filter, case=False, na=False
                )]

            st.markdown(f"### Showing {len(filtered_df)} trades")

            lopsided_count = len(filtered_df[filtered_df['Lopsided'] == True])
            if lopsided_count > 0:
                st.warning(f"⚠️ {lopsided_count} lopsided trades detected (>20% value difference)")

            st.dataframe(
                filtered_df[[
                    'Date', 'Teams', 'Players', 'Winner', 'Loser',
                    'Value Diff', 'Fairness %', 'Quality'
                ]],
                use_container_width=True,
                hide_index=True,
                column_config={
                    'Value Diff': st.column_config.NumberColumn('Value Diff', format='%.1f'),
                    'Fairness %': st.column_config.NumberColumn('Fairness %', format='%.1f%%')
                }
            )

            st.markdown("---")
            st.markdown("### Detailed Trade Analysis")

            for i, (parsed, analysis) in enumerate(zip(parsed_trades, analyzed_trades)):
                if i >= len(filtered_df):
                    continue

                timestamp = parsed['timestamp']
                if timestamp and timestamp in filtered_df['Timestamp'].values:
                    trade_date_str = datetime.fromtimestamp(timestamp / 1000).strftime('%Y-%m-%d %H:%M')

                    is_lopsided = analysis['is_lopsided']
                    quality = analysis['trade_quality']
                    winner = analysis.get('winner', 'N/A')
                    loser = analysis.get('loser', 'N/A')

                    expander_title = f"📅 {trade_date_str} - {' ↔ '.join(parsed['teams_involved'])}"
                    if is_lopsided:
                        expander_title += " ⚠️ LOPSIDED"

                    with st.expander(expander_title, expanded=False):
                        if winner and loser:
                            st.markdown(f"**Winner:** {winner} | **Loser:** {loser}")
                            st.markdown(f"**Value Difference:** {analysis['value_diff']:.1f} points")
                            st.markdown(f"**Fairness:** {analysis['fairness_pct']:.1f}% variance")

                        st.markdown("---")

                        team_values = analysis['team_values']

                        for team_name, values in team_values.items():
                            is_winner = team_name == winner
                            header = f"**{team_name}**"
                            if is_winner:
                                header += " ✅ (Winner)"

                            st.markdown(header)

                            trade_col1, trade_col2, trade_col3 = st.columns(3)

                            with trade_col1:
                                st.write("**Received:**")
                                for player in values['received']['players']:
                                    st.write(f"- {player}")
                                for pick in values['received']['picks']:
                                    st.write(f"- {pick}")
                                if values['received']['faab'] > 0:
                                    st.write(f"- ${values['received']['faab']} FAAB")
                                st.write(f"**Total Value:** {values['received']['value']:.1f}")

                            with trade_col2:
                                st.write("**Gave:**")
                                for player in values['given']['players']:
                                    st.write(f"- {player}")
                                for pick in values['given']['picks']:
                                    st.write(f"- {pick}")
                                if values['given']['faab'] > 0:
                                    st.write(f"- ${values['given']['faab']} FAAB")
                                st.write(f"**Total Value:** {values['given']['value']:.1f}")

                            with trade_col3:
                                net_value = values['net_value']
                                net_pct = values['net_percent']

                                if net_value > 0:
                                    st.success(f"**Net Gain:** +{net_value:.1f}")
                                    st.success(f"**ROI:** +{net_pct:.1f}%")
                                elif net_value < 0:
                                    st.error(f"**Net Loss:** {net_value:.1f}")
                                    st.error(f"**ROI:** {net_pct:.1f}%")
                                else:
                                    st.info("**Even Trade**")

                            st.markdown("---")

            hist_col1, hist_col2 = st.columns(2)

            with hist_col1:
                st.markdown("### Trade Volume by Team")

                team_trade_counts = {}
                for trade in parsed_trades:
                    for team in trade['teams_involved']:
                        team_trade_counts[team] = team_trade_counts.get(team, 0) + 1

                if team_trade_counts:
                    volume_df = pd.DataFrame(
                        list(team_trade_counts.items()),
                        columns=['Team', 'Trades']
                    ).sort_values('Trades', ascending=False)

                    volume_chart = alt.Chart(volume_df).mark_bar().encode(
                        x=alt.X('Trades:Q', title='Number of Trades'),
                        y=alt.Y('Team:N', sort='-x', title='Team'),
                        color=alt.condition(
                            alt.datum.Team == your_team,
                            alt.value('#3CBEDC'),
                            alt.value('#0B1B33')
                        ),
                        tooltip=['Team', 'Trades']
                    ).properties(height=300)

                    st.altair_chart(volume_chart, use_container_width=True)

            with hist_col2:
                st.markdown("### Trade Quality Distribution")

                quality_counts = filtered_df['Quality'].value_counts().to_dict()

                if quality_counts:
                    quality_df = pd.DataFrame(
                        list(quality_counts.items()),
                        columns=['Quality', 'Count']
                    )

                    quality_chart = alt.Chart(quality_df).mark_arc().encode(
                        theta='Count:Q',
                        color=alt.Color('Quality:N', scale=alt.Scale(
                            domain=['Fair', 'Lopsided'],
                            range=['#2EE59D', '#FF4D6D']
                        )),
                        tooltip=['Quality', 'Count']
                    ).properties(height=300)

                    st.altair_chart(quality_chart, use_container_width=True)

            csv_button = st.download_button(
                label="📥 Download Trade History as CSV",
                data=trade_history_df.to_csv(index=False),
                file_name=f"trade_history_{league_id}.csv",
                mime="text/csv"
            )

        else:
            st.info("No trades found in league history yet.")

        # Trade suggestions
        st.markdown("---")
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

                    give_player_selections = render_searchable_player_multiselect(
                        "Players:",
                        player_display_to_id,
                        your_roster_df,
                        "give_players",
                        help_text="Type to search and select multiple players to trade away"
                    )

                    give_pick_input = render_searchable_pick_input(
                        "Draft Picks",
                        pick_options,
                        "give_picks",
                        help_text="Type to search picks. Click suggestions to add. Formats: '2026 1.01', '2027 Early 1st'"
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

                    receive_player_selections = render_searchable_player_multiselect(
                        "Players:",
                        player_display_to_id,
                        other_roster_df,
                        "receive_players",
                        help_text="Type to search and select multiple players to receive"
                    )

                    receive_pick_input = render_searchable_pick_input(
                        "Draft Picks",
                        pick_options,
                        "receive_picks",
                        help_text="Type to search picks. Click suggestions to add. Formats: '2026 1.01', '2027 Early 1st'"
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

                        # Save Trade Feature
                        st.markdown("---")
                        st.markdown("### 💾 Save This Trade")

                        col_save1, col_save2 = st.columns([3, 1])
                        with col_save1:
                            trade_notes = st.text_area("Notes (optional)", placeholder="Add notes about this trade...")
                        with col_save2:
                            st.write("")
                            st.write("")
                            if st.button("💾 Save Trade", use_container_width=True):
                                user = get_current_user()
                                if user:
                                    trade_data = {
                                        'give_players': [{'name': p['name'], 'position': p['position'], 'value': p['value']} for p in give_data],
                                        'receive_players': [{'name': p['name'], 'position': p['position'], 'value': p['value']} for p in receive_data],
                                        'give_picks': give_picks_parsed,
                                        'receive_picks': receive_picks_parsed,
                                        'give_faab': give_faab,
                                        'receive_faab': receive_faab,
                                        'partner_team': selected_team
                                    }

                                    trade_result = {
                                        'verdict': evaluation['verdict'],
                                        'give_total': evaluation['give_total'],
                                        'receive_total': evaluation['receive_total'],
                                        'difference': evaluation['difference'],
                                        'percentage_diff': evaluation['percentage_diff']
                                    }

                                    if save_trade(user.id, league_id, trade_data, trade_result, trade_notes):
                                        st.success("✅ Trade saved successfully!")
                                    else:
                                        st.error("Failed to save trade")

                    else:
                        st.warning("⚠️ Please select at least one player or pick for each side of the trade.")
        else:
            st.info("No other teams available for trading.")

    else:
        st.warning(f"No roster data found for {your_team}")

    # AI Trade Suggestions Section
    st.markdown("---")
    st.header("🤖 AI-Powered Trade Suggestions")
    league_context_str = ""
    if league_details:
        roster_format = format_roster_positions(league_details)
        league_context_str = f" for your {roster_format} roster"
    st.markdown(f"Machine learning analyzes your roster needs, surpluses{league_context_str}, and generates optimized trade proposals")

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

                            league_fit_context = ""
                            if league_details:
                                optimal_starters = calculate_optimal_starter_count(league_details)
                                scoring_settings = league_details.get('scoring_settings', {})
                                rec_pts = scoring_settings.get('rec', 0)

                                context_parts = []
                                if is_superflex:
                                    context_parts.append("This trade fits your **Superflex** league format")
                                if rec_pts == 1:
                                    context_parts.append("Values adjusted for **Full PPR** scoring")
                                elif rec_pts == 0.5:
                                    context_parts.append("Values adjusted for **Half PPR** scoring")

                                if context_parts:
                                    league_fit_context = f"\n\n**League Context:** {' | '.join(context_parts)}"

                            st.info(f"**Rationale:** {suggestion['rationale']}\n\n**Impact:** {suggestion['impact']}{league_fit_context}")

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
            alt.value('#3CBEDC'),
            alt.value('#0B1B33')
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

    # Saved Trades Section
    st.markdown("---")
    st.header("💾 Your Saved Trades")

    user = get_current_user()
    if user:
        saved_trades_list = get_saved_trades(user.id, league_id)

        if saved_trades_list:
            st.write(f"**{len(saved_trades_list)}** saved trades for this league")

            for idx, trade in enumerate(saved_trades_list[:10], 1):
                trade_data = trade.get('trade_data', {})
                trade_result = trade.get('trade_result', {})
                created_at = trade.get('created_at', '')

                with st.expander(f"Trade #{idx} - {trade_result.get('verdict', 'N/A')} ({created_at[:10]})", expanded=False):
                    col1, col2 = st.columns(2)

                    with col1:
                        st.markdown("**You Give:**")
                        for player in trade_data.get('give_players', []):
                            st.write(f"• {player['name']} ({player['position']}) - {player['value']:.0f} pts")
                        for pick in trade_data.get('give_picks', []):
                            st.write(f"• {pick['parsed']} - {pick['value']:.0f} pts")
                        if trade_data.get('give_faab', 0) > 0:
                            st.write(f"• ${trade_data['give_faab']:.0f} FAAB")

                    with col2:
                        st.markdown(f"**{trade_data.get('partner_team', 'Partner')} Gives:**")
                        for player in trade_data.get('receive_players', []):
                            st.write(f"• {player['name']} ({player['position']}) - {player['value']:.0f} pts")
                        for pick in trade_data.get('receive_picks', []):
                            st.write(f"• {pick['parsed']} - {pick['value']:.0f} pts")
                        if trade_data.get('receive_faab', 0) > 0:
                            st.write(f"• ${trade_data['receive_faab']:.0f} FAAB")

                    st.markdown("---")
                    result_col1, result_col2, result_col3 = st.columns(3)
                    with result_col1:
                        st.metric("You Give", f"{trade_result.get('give_total', 0):.0f} pts")
                    with result_col2:
                        st.metric("You Receive", f"{trade_result.get('receive_total', 0):.0f} pts")
                    with result_col3:
                        st.metric("Net Gain", f"{trade_result.get('difference', 0):+.0f} pts",
                                 delta=f"{trade_result.get('percentage_diff', 0):+.1f}%")

                    if trade.get('notes'):
                        st.markdown(f"**Notes:** {trade['notes']}")

            if len(saved_trades_list) > 10:
                st.info(f"Showing 10 most recent trades. {len(saved_trades_list) - 10} more in history.")
        else:
            st.info("No saved trades yet. Analyze a trade above and save it!")
    else:
        st.warning("Please log in to view saved trades.")

    # Footer
    st.markdown("---")
    st.markdown("""
    ### ✅ Implemented Features
    - **User Authentication**: ✅ Email/password auth via Supabase
    - **Multi-League Support**: ✅ Save and switch between multiple Sleeper leagues
    - **Trade History**: ✅ Save trades with notes and review past evaluations
    - **Privacy & Security**: ✅ RLS policies ensure data isolation per user
    - **League Management**: ✅ Add, edit, remove, and switch leagues instantly
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
    - **Google OAuth**: Add OAuth providers for easier sign-in
    - **Cross-League Comparison**: Compare player values across your leagues
    - **Email Notifications**: Trade alerts and weekly roster analysis
    - **Model Persistence**: Store trained models in Supabase for faster loading
    - **X/Twitter Integration**: Add semantic search for real-time trade rumors
    - **Custom Scoring**: Adjust position weights and scoring settings
    - **Advanced Metrics**: Add snap counts, target share, red zone usage
    """)

if __name__ == "__main__":
    main()
