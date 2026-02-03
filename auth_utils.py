"""
Authentication utilities for Fantasy Football Trade Analyzer
Handles Supabase auth, session management, and user data
"""

import streamlit as st
from supabase import create_client, Client
from typing import Optional, Dict, List
import os
from datetime import datetime

def get_supabase_client() -> Client:
    """Get or create Supabase client"""
    url = os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("VITE_SUPABASE_ANON_KEY")

    if not url or not key:
        st.error("Supabase credentials not configured. Check .env file.")
        st.stop()

    return create_client(url, key)

def init_session_state():
    """Initialize session state variables"""
    if 'user' not in st.session_state:
        st.session_state.user = None
    if 'access_token' not in st.session_state:
        st.session_state.access_token = None
    if 'user_leagues' not in st.session_state:
        st.session_state.user_leagues = []
    if 'current_league_id' not in st.session_state:
        st.session_state.current_league_id = None
    if 'auth_mode' not in st.session_state:
        st.session_state.auth_mode = 'login'

def sign_up(email: str, password: str) -> Dict:
    """Sign up a new user"""
    supabase = get_supabase_client()
    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        return {"success": True, "data": response}
    except Exception as e:
        return {"success": False, "error": str(e)}

def sign_in(email: str, password: str) -> Dict:
    """Sign in an existing user"""
    supabase = get_supabase_client()
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if response.user:
            st.session_state.user = response.user
            st.session_state.access_token = response.session.access_token if response.session else None

            create_user_preferences_if_not_exists(response.user.id)

            return {"success": True, "user": response.user}
        else:
            return {"success": False, "error": "Invalid credentials"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def sign_out():
    """Sign out current user"""
    supabase = get_supabase_client()
    try:
        supabase.auth.sign_out()
        st.session_state.user = None
        st.session_state.access_token = None
        st.session_state.user_leagues = []
        st.session_state.current_league_id = None
    except Exception as e:
        st.error(f"Error signing out: {e}")

def is_authenticated() -> bool:
    """Check if user is authenticated"""
    return st.session_state.user is not None

def get_current_user():
    """Get current authenticated user"""
    return st.session_state.user

def create_user_preferences_if_not_exists(user_id: str):
    """Create default user preferences if they don't exist"""
    supabase = get_supabase_client()
    try:
        result = supabase.table('user_preferences').select('*').eq('user_id', user_id).execute()

        if not result.data:
            supabase.table('user_preferences').insert({
                'user_id': user_id,
                'theme': 'light',
                'email_notifications': True
            }).execute()
    except Exception as e:
        st.warning(f"Could not create user preferences: {e}")

def get_user_leagues(user_id: str) -> List[Dict]:
    """Get all leagues for a user"""
    supabase = get_supabase_client()
    try:
        response = supabase.table('user_leagues').select('*').eq('user_id', user_id).eq('is_active', True).order('created_at', desc=True).execute()
        return response.data
    except Exception as e:
        st.error(f"Error fetching leagues: {e}")
        return []

def add_user_league(user_id: str, league_id: str, league_name: str, team_name: str = None, is_superflex: bool = False) -> bool:
    """Add a league to user's saved leagues"""
    supabase = get_supabase_client()
    try:
        supabase.table('user_leagues').insert({
            'user_id': user_id,
            'league_id': league_id,
            'league_name': league_name,
            'team_name': team_name,
            'is_superflex': is_superflex,
            'is_active': True
        }).execute()
        return True
    except Exception as e:
        if "duplicate key" in str(e).lower():
            st.warning("This league is already saved to your account.")
            return False
        st.error(f"Error adding league: {e}")
        return False

def update_user_league(league_db_id: str, user_id: str, **kwargs) -> bool:
    """Update a user's league settings"""
    supabase = get_supabase_client()
    try:
        supabase.table('user_leagues').update(kwargs).eq('id', league_db_id).eq('user_id', user_id).execute()
        return True
    except Exception as e:
        st.error(f"Error updating league: {e}")
        return False

def delete_user_league(league_db_id: str, user_id: str) -> bool:
    """Soft delete a user's league"""
    supabase = get_supabase_client()
    try:
        supabase.table('user_leagues').update({'is_active': False}).eq('id', league_db_id).eq('user_id', user_id).execute()
        return True
    except Exception as e:
        st.error(f"Error deleting league: {e}")
        return False

def save_trade(user_id: str, league_id: str, trade_data: Dict, trade_result: Dict, notes: str = None) -> bool:
    """Save a trade for future reference"""
    supabase = get_supabase_client()
    try:
        supabase.table('saved_trades').insert({
            'user_id': user_id,
            'league_id': league_id,
            'trade_data': trade_data,
            'trade_result': trade_result,
            'notes': notes
        }).execute()
        return True
    except Exception as e:
        st.error(f"Error saving trade: {e}")
        return False

def get_saved_trades(user_id: str, league_id: str = None) -> List[Dict]:
    """Get saved trades for a user, optionally filtered by league"""
    supabase = get_supabase_client()
    try:
        query = supabase.table('saved_trades').select('*').eq('user_id', user_id)
        if league_id:
            query = query.eq('league_id', league_id)
        response = query.order('created_at', desc=True).execute()
        return response.data
    except Exception as e:
        st.error(f"Error fetching saved trades: {e}")
        return []

def get_user_preferences(user_id: str) -> Optional[Dict]:
    """Get user preferences"""
    supabase = get_supabase_client()
    try:
        response = supabase.table('user_preferences').select('*').eq('user_id', user_id).single().execute()
        return response.data
    except Exception as e:
        return None

def update_user_preferences(user_id: str, **kwargs) -> bool:
    """Update user preferences"""
    supabase = get_supabase_client()
    try:
        supabase.table('user_preferences').update(kwargs).eq('user_id', user_id).execute()
        return True
    except Exception as e:
        st.error(f"Error updating preferences: {e}")
        return False

def render_auth_ui():
    """Render authentication UI (login/signup)"""
    st.title("🏈 Fantasy Football Trade Analyzer")

    col1, col2, col3 = st.columns([1, 2, 1])

    with col2:
        st.markdown("### Welcome!")
        st.markdown("Sign in to manage multiple leagues and save your trades.")

        auth_mode = st.radio("", ["Login", "Sign Up"], horizontal=True, label_visibility="collapsed")

        with st.form("auth_form"):
            email = st.text_input("Email", placeholder="your.email@example.com")
            password = st.text_input("Password", type="password", placeholder="Enter password")

            if auth_mode == "Sign Up":
                password_confirm = st.text_input("Confirm Password", type="password", placeholder="Confirm password")

            submit = st.form_submit_button("Sign Up" if auth_mode == "Sign Up" else "Login", use_container_width=True)

            if submit:
                if not email or not password:
                    st.error("Please enter both email and password")
                elif auth_mode == "Sign Up":
                    if password != password_confirm:
                        st.error("Passwords do not match")
                    elif len(password) < 6:
                        st.error("Password must be at least 6 characters")
                    else:
                        with st.spinner("Creating account..."):
                            result = sign_up(email, password)
                            if result['success']:
                                st.success("Account created! Please check your email to verify, then login.")
                                st.balloons()
                            else:
                                st.error(f"Sign up failed: {result.get('error', 'Unknown error')}")
                else:
                    with st.spinner("Signing in..."):
                        result = sign_in(email, password)
                        if result['success']:
                            st.success("Signed in successfully!")
                            st.rerun()
                        else:
                            st.error(f"Login failed: {result.get('error', 'Invalid credentials')}")

        st.markdown("---")
        st.info("""
        **Features with account:**
        - 💾 Save multiple Sleeper leagues
        - 🔄 Switch between leagues instantly
        - 📊 Compare trades across leagues
        - 💰 Track saved trades and history
        - 🔒 Private data - only you can see your leagues
        """)

def render_league_selector():
    """Render league selector sidebar"""
    user = get_current_user()
    if not user:
        return None

    user_leagues = get_user_leagues(user.id)
    st.session_state.user_leagues = user_leagues

    with st.sidebar:
        st.markdown("---")
        st.subheader("🏆 Your Leagues")

        if user_leagues:
            league_options = {f"{league['league_name']} ({league['league_id']})": league['league_id']
                            for league in user_leagues}

            if st.session_state.current_league_id is None and user_leagues:
                st.session_state.current_league_id = user_leagues[0]['league_id']

            current_key = next((k for k, v in league_options.items()
                              if v == st.session_state.current_league_id), None)

            selected_league = st.selectbox(
                "Active League",
                options=list(league_options.keys()),
                index=list(league_options.keys()).index(current_key) if current_key else 0,
                key="league_selector"
            )

            st.session_state.current_league_id = league_options[selected_league]

            current_league_data = next((l for l in user_leagues
                                       if l['league_id'] == st.session_state.current_league_id), None)

            if current_league_data:
                if current_league_data.get('team_name'):
                    st.caption(f"Team: {current_league_data['team_name']}")
                if current_league_data.get('is_superflex'):
                    st.caption("⚡ Superflex League")

            if st.button("➕ Add Another League", use_container_width=True):
                st.session_state.show_add_league = True

            if st.button("⚙️ Manage Leagues", use_container_width=True):
                st.session_state.show_manage_leagues = True
        else:
            st.info("No leagues saved yet. Add your first league below!")
            st.session_state.show_add_league = True

        st.markdown("---")
        st.caption(f"Logged in as: {user.email}")
        if st.button("🚪 Sign Out", use_container_width=True):
            sign_out()
            st.rerun()

    return st.session_state.current_league_id

def render_add_league_modal():
    """Render add league modal"""
    user = get_current_user()
    if not user:
        return

    st.subheader("➕ Add New League")

    with st.form("add_league_form"):
        league_id = st.text_input("Sleeper League ID", placeholder="e.g., 123456789")
        league_name = st.text_input("League Name (optional)", placeholder="My Dynasty League")
        team_name = st.text_input("Your Team Name (optional)", placeholder="My Team")
        is_superflex = st.checkbox("Superflex League?", value=False)

        col1, col2 = st.columns(2)
        with col1:
            submit = st.form_submit_button("Add League", use_container_width=True)
        with col2:
            cancel = st.form_submit_button("Cancel", use_container_width=True)

        if submit:
            if not league_id:
                st.error("Please enter a League ID")
            else:
                display_name = league_name if league_name else f"League {league_id}"
                if add_user_league(user.id, league_id, display_name, team_name, is_superflex):
                    st.success(f"League '{display_name}' added successfully!")
                    st.session_state.show_add_league = False
                    st.session_state.current_league_id = league_id
                    st.rerun()

        if cancel:
            st.session_state.show_add_league = False
            st.rerun()

def render_manage_leagues_modal():
    """Render manage leagues modal"""
    user = get_current_user()
    if not user:
        return

    st.subheader("⚙️ Manage Your Leagues")

    user_leagues = get_user_leagues(user.id)

    if not user_leagues:
        st.info("No leagues to manage.")
        if st.button("Close"):
            st.session_state.show_manage_leagues = False
            st.rerun()
        return

    for league in user_leagues:
        with st.expander(f"{league['league_name']} ({league['league_id']})", expanded=False):
            st.write(f"**League ID:** {league['league_id']}")
            if league.get('team_name'):
                st.write(f"**Team:** {league['team_name']}")
            st.write(f"**Superflex:** {'Yes' if league.get('is_superflex') else 'No'}")
            st.write(f"**Added:** {league['created_at'][:10]}")

            col1, col2 = st.columns(2)
            with col1:
                if st.button(f"🗑️ Remove", key=f"delete_{league['id']}"):
                    if delete_user_league(league['id'], user.id):
                        st.success("League removed!")
                        st.rerun()
            with col2:
                if st.button(f"✏️ Edit", key=f"edit_{league['id']}"):
                    st.session_state[f"edit_mode_{league['id']}"] = True

            if st.session_state.get(f"edit_mode_{league['id']}", False):
                with st.form(f"edit_form_{league['id']}"):
                    new_name = st.text_input("League Name", value=league['league_name'])
                    new_team = st.text_input("Team Name", value=league.get('team_name', ''))
                    new_sf = st.checkbox("Superflex", value=league.get('is_superflex', False))

                    if st.form_submit_button("Save"):
                        if update_user_league(league['id'], user.id,
                                             league_name=new_name,
                                             team_name=new_team,
                                             is_superflex=new_sf):
                            st.success("League updated!")
                            st.session_state[f"edit_mode_{league['id']}"] = False
                            st.rerun()

    if st.button("Close", use_container_width=True):
        st.session_state.show_manage_leagues = False
        st.rerun()
