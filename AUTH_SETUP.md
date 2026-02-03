# User Authentication & Multi-League Setup

This Fantasy Football Trade Analyzer now includes comprehensive user authentication and multi-league support powered by Supabase.

## Features

### 🔐 User Authentication
- **Email/Password Sign Up**: Create an account with email and password
- **Secure Login**: Sign in with your credentials
- **Session Management**: Stay logged in across sessions
- **Privacy**: All data is private to your account with Row-Level Security (RLS)

### 📁 Multi-League Support
- **Save Multiple Leagues**: Add unlimited Sleeper leagues to your account
- **Quick Switching**: Instantly switch between leagues via sidebar dropdown
- **League Management**: Edit league names, team names, and settings
- **Superflex Detection**: Mark leagues as superflex for accurate valuations

### 💾 Trade History
- **Save Trades**: Save analyzed trades with optional notes
- **Review History**: View past trade evaluations for each league
- **Track Decisions**: See your saved trade results and notes

## Setup

### Prerequisites
The app is already configured with Supabase. The `.env` file contains:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Database Schema
The following tables are automatically created:
- `user_leagues`: Stores user's saved leagues
- `saved_trades`: Stores trade history
- `user_preferences`: Stores user settings

All tables have Row-Level Security (RLS) enabled to ensure data privacy.

## Usage

### First Time Setup

1. **Sign Up**
   - Run the app: `streamlit run app.py`
   - Click "Sign Up" on the auth screen
   - Enter your email and password (min 6 characters)
   - Check your email for verification link
   - Return to login screen and sign in

2. **Add Your First League**
   - After login, you'll see "Add New League" form
   - Enter your Sleeper League ID (found in Sleeper URL)
   - Optionally name your league (e.g., "My Dynasty League")
   - Optionally enter your team name
   - Check "Superflex" if applicable
   - Click "Add League"

3. **Start Analyzing**
   - The app will load your league data
   - Use the trade analyzer as normal
   - All trades can now be saved!

### Managing Leagues

**Add Another League:**
- Click "➕ Add Another League" in sidebar
- Fill out the league form
- Click "Add League"

**Switch Leagues:**
- Use the dropdown in sidebar
- Select any saved league
- App instantly loads that league's data

**Edit/Remove Leagues:**
- Click "⚙️ Manage Leagues" in sidebar
- Expand any league to edit or remove
- Changes save immediately

### Saving Trades

1. Analyze a trade as normal in the "Manual Trade Analyzer" section
2. Scroll to "💾 Save This Trade" section
3. Optionally add notes (e.g., "Offered by John, considering...")
4. Click "💾 Save Trade"
5. View saved trades in "Your Saved Trades" section

### Viewing Saved Trades

- Scroll to "💾 Your Saved Trades" section
- See all trades for current league
- Expand any trade to view full details
- Shows up to 10 most recent trades

## Security

### Row-Level Security (RLS)
All tables have RLS policies that ensure:
- Users can only view their own leagues
- Users can only save trades to their account
- Users can only edit/delete their own data
- No user can access another user's data

### Authentication
- Passwords are hashed by Supabase Auth
- Session tokens are secure and expire appropriately
- Email verification available (optional in Supabase settings)

## Architecture

### Files
- `app.py`: Main Streamlit application
- `auth_utils.py`: Authentication and database utilities
- `.env`: Supabase credentials (keep secure!)

### Database Tables

**user_leagues**
```sql
- id (uuid, primary key)
- user_id (uuid, references auth.users)
- league_id (text, Sleeper ID)
- league_name (text)
- team_name (text)
- is_superflex (boolean)
- is_active (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**saved_trades**
```sql
- id (uuid, primary key)
- user_id (uuid, references auth.users)
- league_id (text)
- trade_data (jsonb)
- trade_result (jsonb)
- notes (text)
- created_at (timestamptz)
```

**user_preferences**
```sql
- user_id (uuid, primary key)
- default_league_id (text)
- theme (text)
- email_notifications (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
```

## Future Enhancements

### Potential Features
- **Google OAuth**: Add OAuth providers for easier sign-in
- **Cross-League Comparison**: Compare player values across leagues
- **Email Notifications**: Weekly summaries and trade alerts
- **Trade Analytics**: Track prediction accuracy over time
- **Shared Trades**: Share trade evaluations via link
- **Import/Export**: Backup and restore trade history

## Troubleshooting

### "Supabase credentials not configured"
- Check that `.env` file exists in project root
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart the Streamlit app

### "Failed to load league data"
- Verify Sleeper League ID is correct
- Check internet connection
- Try refreshing the page

### Can't see my leagues
- Make sure you're logged in
- Check that you added leagues after logging in
- Leagues added before login aren't saved

### Sign up email not received
- Check spam folder
- Verify email is correct
- Email verification is optional - try logging in anyway

## Support

For issues or questions:
1. Check Supabase dashboard for database status
2. Check browser console for errors
3. Verify `.env` credentials are correct
4. Ensure Supabase RLS policies are enabled

## Privacy Notice

All user data is:
- Stored securely in Supabase
- Protected by Row-Level Security
- Never shared with other users
- Only accessible to you while logged in
- Can be deleted by removing leagues or deleting your account in Supabase dashboard
