"""
Comprehensive Sleeper API utilities for Fantasy Football Trade Analyzer
Fetches league details, rosters, users, picks, drafts, transactions, and matchups
"""

import streamlit as st
import requests
from typing import Dict, List, Optional, Tuple
import pandas as pd
from datetime import datetime

SLEEPER_BASE_URL = "https://api.sleeper.app/v1"

@st.cache_data(ttl=86400)
def fetch_all_nfl_players() -> Dict:
    """
    Fetch all NFL players from Sleeper API.
    Returns: dict with player_id as key, player data as value
    Cached for 24 hours since player data doesn't change frequently
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/players/nfl")
        if response.status_code == 200:
            return response.json()
        return {}
    except Exception as e:
        st.error(f"Error fetching NFL players: {e}")
        return {}

@st.cache_data(ttl=1800)
def fetch_league_details(league_id: str) -> Optional[Dict]:
    """
    Fetch comprehensive league details including scoring settings and roster positions.
    Returns: dict with name, season, scoring_settings, settings, roster_positions
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/league/{league_id}")
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        st.error(f"Error fetching league details: {e}")
        return None

@st.cache_data(ttl=1800)
def fetch_league_rosters(league_id: str) -> List[Dict]:
    """
    Fetch all rosters in the league with players, starters, settings.
    Returns: list of roster dicts with owner_id, roster_id, players, starters, settings
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/league/{league_id}/rosters")
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        st.error(f"Error fetching rosters: {e}")
        return []

@st.cache_data(ttl=1800)
def fetch_league_users(league_id: str) -> List[Dict]:
    """
    Fetch all users/teams in the league.
    Returns: list of user dicts with user_id, display_name, team_name, metadata
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/league/{league_id}/users")
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        st.error(f"Error fetching users: {e}")
        return []

@st.cache_data(ttl=1800)
def fetch_traded_picks(league_id: str) -> List[Dict]:
    """
    Fetch all traded draft picks including future years.
    Returns: list of traded pick dicts with season, round, roster_id, owner_id, previous_owner_id
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/league/{league_id}/traded_picks")
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        st.error(f"Error fetching traded picks: {e}")
        return []

@st.cache_data(ttl=1800)
def fetch_league_drafts(league_id: str) -> List[Dict]:
    """
    Fetch all drafts for the league.
    Returns: list of draft dicts with draft_id, type, status, settings
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/league/{league_id}/drafts")
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        st.error(f"Error fetching drafts: {e}")
        return []

@st.cache_data(ttl=1800)
def fetch_draft_picks(draft_id: str) -> List[Dict]:
    """
    Fetch all picks from a specific draft.
    Returns: list of pick dicts with pick_no, player_id, picked_by, roster_id, round, draft_slot
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/draft/{draft_id}/picks")
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        st.error(f"Error fetching draft picks: {e}")
        return []

@st.cache_data(ttl=1800)
def fetch_draft_traded_picks(draft_id: str) -> List[Dict]:
    """
    Fetch traded picks for a specific draft.
    Returns: list of traded pick dicts
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/draft/{draft_id}/traded_picks")
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        return []

@st.cache_data(ttl=600)
def fetch_league_transactions(league_id: str, round_num: int = 1) -> List[Dict]:
    """
    Fetch transactions for a specific week/round.
    Returns: list of transaction dicts with type, status, roster_ids, settings, adds, drops
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/league/{league_id}/transactions/{round_num}")
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        return []

@st.cache_data(ttl=600)
def fetch_league_matchups(league_id: str, week: int) -> List[Dict]:
    """
    Fetch matchups for a specific week.
    Returns: list of matchup dicts with roster_id, points, starters, players
    """
    try:
        response = requests.get(f"{SLEEPER_BASE_URL}/league/{league_id}/matchups/{week}")
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        return []

def get_roster_positions_summary(league_details: Dict) -> Dict[str, int]:
    """
    Parse roster_positions into a summary count.
    Returns: dict with position counts (e.g., {'QB': 1, 'RB': 2, 'FLEX': 2, 'BN': 6})
    """
    if not league_details or 'roster_positions' not in league_details:
        return {}

    positions = league_details['roster_positions']
    position_counts = {}

    for pos in positions:
        position_counts[pos] = position_counts.get(pos, 0) + 1

    return position_counts

def get_scoring_summary(league_details: Dict) -> pd.DataFrame:
    """
    Convert scoring_settings into a readable DataFrame.
    Returns: DataFrame with scoring rules
    """
    if not league_details or 'scoring_settings' not in league_details:
        return pd.DataFrame()

    scoring = league_details['scoring_settings']

    categories = {
        'Passing': ['pass_yd', 'pass_td', 'pass_int', 'pass_2pt', 'pass_att', 'pass_cmp', 'pass_inc'],
        'Rushing': ['rush_yd', 'rush_td', 'rush_2pt', 'rush_att'],
        'Receiving': ['rec', 'rec_yd', 'rec_td', 'rec_2pt'],
        'Fumbles': ['fum', 'fum_lost', 'fum_rec', 'fum_rec_td'],
        'Defense': ['def_td', 'def_st_td', 'def_st_ff', 'sack', 'int', 'fgmiss', 'safe'],
        'IDP': ['tkl', 'tkl_loss', 'qb_hit', 'tkl_ast', 'sack', 'def_td', 'ff', 'int', 'def_pass_def'],
        'Kicking': ['fgm_0_19', 'fgm_20_29', 'fgm_30_39', 'fgm_40_49', 'fgm_50p', 'xpm']
    }

    data = []
    for category, stats in categories.items():
        for stat in stats:
            if stat in scoring and scoring[stat] != 0:
                stat_display = stat.replace('_', ' ').title()
                data.append({
                    'Category': category,
                    'Stat': stat_display,
                    'Points': scoring[stat]
                })

    return pd.DataFrame(data)

def get_future_picks_inventory(league_id: str, league_details: Dict, rosters: List[Dict],
                                 users: List[Dict], traded_picks: List[Dict]) -> pd.DataFrame:
    """
    Build a complete inventory of future picks per team including traded picks.
    Returns: DataFrame with team, season, round, original_owner
    """
    if not league_details or not rosters or not users:
        return pd.DataFrame()

    current_season = int(league_details.get('season', datetime.now().year))
    num_teams = len(rosters)
    num_rounds = league_details.get('settings', {}).get('draft_rounds', 3)

    user_map = {user['user_id']: user.get('display_name', user.get('team_name', 'Unknown'))
                for user in users}
    roster_to_user = {roster['roster_id']: roster['owner_id'] for roster in rosters}

    picks_data = []

    for future_year in range(current_season + 1, current_season + 4):
        for round_num in range(1, num_rounds + 1):
            for roster in rosters:
                roster_id = roster['roster_id']
                owner_id = roster['owner_id']
                team_name = user_map.get(owner_id, f"Team {roster_id}")

                traded = False
                current_owner_roster_id = roster_id

                for traded_pick in traded_picks:
                    if (str(traded_pick.get('season')) == str(future_year) and
                        traded_pick.get('round') == round_num and
                        traded_pick.get('roster_id') == roster_id):

                        owner_roster_id = traded_pick.get('owner_id')
                        if owner_roster_id in roster_to_user:
                            owner_user_id = roster_to_user[owner_roster_id]
                            current_owner_name = user_map.get(owner_user_id, f"Team {owner_roster_id}")
                        else:
                            current_owner_name = f"Team {owner_roster_id}"

                        picks_data.append({
                            'Current Owner': current_owner_name,
                            'Season': future_year,
                            'Round': round_num,
                            'Original Team': team_name,
                            'Pick': f"{future_year} Round {round_num}",
                            'Status': 'Traded'
                        })
                        traded = True
                        break

                if not traded:
                    picks_data.append({
                        'Current Owner': team_name,
                        'Season': future_year,
                        'Round': round_num,
                        'Original Team': team_name,
                        'Pick': f"{future_year} Round {round_num}",
                        'Status': 'Own'
                    })

    return pd.DataFrame(picks_data)

def adjust_value_for_league_scoring(base_value: float, position: str, league_details: Dict) -> float:
    """
    Adjust player value based on league-specific scoring settings.
    For example, if league has 6pt passing TDs or full PPR, adjust accordingly.
    """
    if not league_details or 'scoring_settings' not in league_details:
        return base_value

    scoring = league_details['scoring_settings']
    multiplier = 1.0

    if position == 'QB':
        pass_td_pts = scoring.get('pass_td', 4)
        if pass_td_pts == 6:
            multiplier *= 1.15
        elif pass_td_pts > 4:
            multiplier *= 1.0 + (pass_td_pts - 4) / 10

    if position in ['WR', 'RB', 'TE']:
        rec_pts = scoring.get('rec', 0)
        if rec_pts == 1:
            if position in ['WR', 'TE']:
                multiplier *= 1.10
        elif rec_pts == 0.5:
            if position in ['WR', 'TE']:
                multiplier *= 1.05

    if position == 'TE':
        te_premium = scoring.get('bonus_rec_te', 0)
        if te_premium > 0:
            multiplier *= 1.0 + (te_premium * 0.05)

    if position in ['DL', 'LB', 'DB']:
        sack_pts = scoring.get('sack', 0)
        tkl_pts = scoring.get('tkl', 0)

        if sack_pts >= 2:
            multiplier *= 1.05
        if tkl_pts >= 1:
            multiplier *= 1.08

    return base_value * multiplier

def get_team_roster_composition(roster: Dict, players_data: Dict) -> Dict[str, int]:
    """
    Analyze a team's roster composition by position.
    Returns: dict with position counts
    """
    composition = {}

    player_ids = roster.get('players', [])

    for player_id in player_ids:
        if player_id in players_data:
            player = players_data[player_id]
            position = player.get('position', 'Unknown')
            composition[position] = composition.get(position, 0) + 1

    return composition

def calculate_optimal_starter_count(league_details: Dict) -> Dict[str, int]:
    """
    Calculate how many starters are needed per position.
    Returns: dict with position: count for starters only (no bench)
    """
    if not league_details or 'roster_positions' not in league_details:
        return {}

    positions = league_details['roster_positions']
    starter_counts = {}

    for pos in positions:
        if pos not in ['BN', 'IR', 'TAXI']:
            starter_counts[pos] = starter_counts.get(pos, 0) + 1

    return starter_counts

def get_recent_transactions_summary(league_id: str, weeks: int = 4) -> Dict:
    """
    Fetch recent transactions and summarize activity.
    Returns: dict with trade counts, waiver activity, FAAB spent
    """
    summary = {
        'total_trades': 0,
        'total_waivers': 0,
        'total_faab_spent': 0,
        'active_teams': set()
    }

    for week in range(1, weeks + 1):
        transactions = fetch_league_transactions(league_id, week)

        for txn in transactions:
            if txn.get('type') == 'trade' and txn.get('status') == 'complete':
                summary['total_trades'] += 1
                for roster_id in txn.get('roster_ids', []):
                    summary['active_teams'].add(roster_id)

            elif txn.get('type') == 'waiver' and txn.get('status') == 'complete':
                summary['total_waivers'] += 1
                settings = txn.get('settings', {})
                faab = settings.get('waiver_bid', 0)
                summary['total_faab_spent'] += faab

                for roster_id in txn.get('roster_ids', []):
                    summary['active_teams'].add(roster_id)

    summary['active_teams'] = len(summary['active_teams'])

    return summary

def format_roster_positions(league_details: Dict) -> str:
    """
    Format roster positions into a readable string.
    """
    position_counts = get_roster_positions_summary(league_details)

    if not position_counts:
        return "Unknown roster setup"

    starters = []
    bench = 0

    for pos, count in position_counts.items():
        if pos == 'BN':
            bench = count
        elif pos in ['IR', 'TAXI']:
            continue
        else:
            starters.append(f"{count} {pos}")

    starters_str = ", ".join(starters)
    return f"{starters_str} + {bench} Bench"

def is_superflex_league(league_details: Dict) -> bool:
    """
    Determine if league is superflex by checking roster positions.
    """
    if not league_details or 'roster_positions' not in league_details:
        return False

    positions = league_details.get('roster_positions', [])
    return 'SUPER_FLEX' in positions or positions.count('QB') >= 2

@st.cache_data(ttl=3600)
def fetch_league_transactions(league_id: str, week: int = None) -> List[Dict]:
    """
    Fetch all transactions for a league.
    If week is provided, fetch for that specific week (round).
    If week is None, fetch all transactions for the season.

    Returns: list of transaction dicts
    """
    try:
        if week is not None:
            url = f"{SLEEPER_BASE_URL}/league/{league_id}/transactions/{week}"
            response = requests.get(url)
            if response.status_code == 200:
                return response.json()
        else:
            all_transactions = []
            for wk in range(1, 19):
                url = f"{SLEEPER_BASE_URL}/league/{league_id}/transactions/{wk}"
                response = requests.get(url)
                if response.status_code == 200:
                    transactions = response.json()
                    if transactions:
                        all_transactions.extend(transactions)
            return all_transactions
        return []
    except Exception as e:
        st.error(f"Error fetching transactions: {e}")
        return []

def filter_trades(transactions: List[Dict]) -> List[Dict]:
    """
    Filter transactions to only include trades.
    Returns: list of trade transactions
    """
    return [t for t in transactions if t.get('type') == 'trade']

def parse_trade_details(trade: Dict, users: List[Dict], nfl_players: Dict,
                       rosters: List[Dict]) -> Dict:
    """
    Parse trade transaction into readable format.

    Returns: dict with:
        - transaction_id
        - timestamp
        - teams_involved (list of team names)
        - roster_ids (list of roster IDs)
        - exchanges (dict mapping roster_id to what they received)
        - players_involved (list of player names)
    """
    transaction_id = trade.get('transaction_id', 'Unknown')
    timestamp = trade.get('created')

    user_map = {user['user_id']: user.get('display_name', user.get('username', 'Unknown'))
                for user in users}
    roster_to_user = {roster['roster_id']: roster.get('owner_id') for roster in rosters}

    roster_ids = trade.get('roster_ids', [])
    teams_involved = []
    for roster_id in roster_ids:
        owner_id = roster_to_user.get(roster_id)
        team_name = user_map.get(owner_id, f"Team {roster_id}")
        teams_involved.append(team_name)

    adds = trade.get('adds', {})
    drops = trade.get('drops', {})
    draft_picks = trade.get('draft_picks', [])
    waiver_budget = trade.get('waiver_budget', [])

    exchanges = {}
    players_involved = set()

    for roster_id in roster_ids:
        exchanges[roster_id] = {
            'players_received': [],
            'players_given': [],
            'picks_received': [],
            'picks_given': [],
            'faab_received': 0,
            'faab_given': 0
        }

    for player_id, receiving_roster_id in adds.items():
        player_name = nfl_players.get(player_id, {}).get('full_name', player_id)
        players_involved.add(player_name)

        if receiving_roster_id in exchanges:
            exchanges[receiving_roster_id]['players_received'].append(player_name)

        giving_roster_id = drops.get(player_id)
        if giving_roster_id and giving_roster_id in exchanges:
            exchanges[giving_roster_id]['players_given'].append(player_name)

    for pick in draft_picks:
        season = pick.get('season')
        round_num = pick.get('round')
        owner_id = pick.get('owner_id')
        previous_owner_id = pick.get('previous_owner_id')

        pick_str = f"{season} Round {round_num}"

        if owner_id in exchanges:
            exchanges[owner_id]['picks_received'].append(pick_str)
        if previous_owner_id in exchanges:
            exchanges[previous_owner_id]['picks_given'].append(pick_str)

    for budget_entry in waiver_budget:
        sender = budget_entry.get('sender')
        receiver = budget_entry.get('receiver')
        amount = budget_entry.get('amount', 0)

        if sender in exchanges:
            exchanges[sender]['faab_given'] = amount
        if receiver in exchanges:
            exchanges[receiver]['faab_received'] = amount

    return {
        'transaction_id': transaction_id,
        'timestamp': timestamp,
        'teams_involved': teams_involved,
        'roster_ids': roster_ids,
        'exchanges': exchanges,
        'players_involved': list(players_involved)
    }
