# Fantasy Draft Pros Documentation

Complete documentation for Fantasy Draft Pros - the ultimate fantasy football trade analyzer and league management platform.

## Quick Links

- [Main README](../README.md) - Project overview and quick start
- [Contributing Guidelines](../CONTRIBUTING.md) - How to contribute
- [Feature Guides](#feature-guides) - Detailed feature documentation
- [API Documentation](#api-documentation) - API integration guides
- [Deployment](#deployment) - Production deployment guides

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fantasy-draft-pros.git
cd fantasy-draft-pros

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

### First Time Setup

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key to `.env`
4. The database migrations will run automatically
5. Sign up in the app to create your first account

## Feature Guides

### Core Features

- **[Trade Analyzer](TRADE_ANALYZER.md)** - Evaluate multi-player trades
- **[Power Rankings](POWER_RANKINGS.md)** - Team strength analysis
- **[Playoff Simulator](PLAYOFF_ODDS_SIMULATOR.md)** - Monte Carlo playoff odds
- **[Player Values](PLAYER_VALUES_SYSTEM.md)** - Real-time player valuations
- **[League Management](LEAGUE_SETUP.md)** - Managing multiple leagues

### Advanced Features

- **Trade Finder** - Discover win-win trades
- **Trade Block Marketplace** - View available players
- **Counter Offer Generator** - AI-powered trade suggestions
- **Lineup Optimizer** - Optimal lineup recommendations
- **Waiver Assistant** - Priority-ranked waiver targets
- **Roster Health** - Injury and bye week tracking
- **Championship Calculator** - Title probability predictions
- **Rivalry Tracker** - Head-to-head matchup history

### Draft & Keeper Tools

- **Draft Kit** - Live draft assistant
- **Keeper Calculator** - Analyze keeper value

## API Documentation

### Sleeper API Integration

The app integrates with Sleeper's free API to fetch:
- League rosters and settings
- Matchup data and scores
- Player information
- Transaction history

See [SLEEPER_API_FEATURES.md](../SLEEPER_API_FEATURES.md) for details.

### SportsData.io Integration

Real-time NFL data including:
- Player stats and projections
- Injury reports
- Team performance metrics
- Game schedules

Get your free API key at [sportsdata.io](https://sportsdata.io)

### Player Values API

Custom player valuation system:
- Dynasty and redraft values
- Superflex adjustments
- Trend analysis
- Historical data

See [PLAYER_VALUES_SYSTEM.md](../PLAYER_VALUES_SYSTEM.md) for details.

## Architecture

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Context + Hooks

### Backend

- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **File Storage**: Supabase Storage

### Deployment

- **Frontend Hosting**: Netlify, Vercel, or Cloudflare Pages
- **Database**: Supabase Cloud
- **CDN**: Automatic via hosting provider

## Database Schema

### Core Tables

**user_leagues** - User's saved leagues
```sql
- id (uuid, primary key)
- user_id (uuid, FK to auth.users)
- league_id (text, Sleeper ID)
- league_name (text)
- team_name (text)
- is_superflex (boolean)
- is_active (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**player_values** - Player valuations
```sql
- id (uuid, primary key)
- player_id (text, unique)
- player_name (text)
- position (text)
- team (text)
- base_value (integer)
- fdp_value (integer)
- trend (text)
- last_updated (timestamptz)
- metadata (jsonb)
```

**saved_trades** - Trade history
```sql
- id (uuid, primary key)
- user_id (uuid, FK to auth.users)
- league_id (text)
- trade_data (jsonb)
- trade_result (jsonb)
- notes (text)
- created_at (timestamptz)
```

**playoff_simulations** - Simulation results
```sql
- id (uuid, primary key)
- user_id (uuid, FK to auth.users)
- league_id (text)
- simulation_data (jsonb)
- playoff_odds (jsonb)
- created_at (timestamptz)
```

## Security

### Row Level Security (RLS)

All tables use RLS to ensure data privacy:
- Users can only access their own data
- Authentication required for all operations
- Public read access for reference data only

### API Keys

Store sensitive keys in environment variables:
```env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
VITE_SPORTSDATA_API_KEY=your_key
```

Never commit these to version control!

## Deployment

### Netlify Deployment

1. Push to GitHub
2. Connect repository to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variables
6. Deploy!

### Vercel Deployment

```bash
npm install -g vercel
vercel
```

Follow prompts and add environment variables.

### Custom Domain

1. Configure DNS records with your provider
2. Add custom domain in hosting dashboard
3. Enable HTTPS (automatic with most providers)

## Troubleshooting

### Common Issues

**"Cannot find module" errors**
```bash
rm -rf node_modules
npm install
```

**Build fails with TypeScript errors**
```bash
npm run typecheck
```
Fix reported errors before building.

**API requests failing**
- Verify environment variables are set
- Check API key validity
- Ensure Supabase project is active

**Database connection errors**
- Verify Supabase credentials
- Check project status in Supabase dashboard
- Ensure RLS policies are correct

### Getting Help

1. Check [GitHub Issues](https://github.com/yourusername/fantasy-draft-pros/issues)
2. Review existing documentation
3. Open a new issue with details

## Development Workflow

### Local Development

```bash
# Start dev server
npm run dev

# In another terminal, watch for TypeScript errors
npm run typecheck -- --watch

# Run linter
npm run lint
```

### Before Committing

```bash
# Run all checks
npm run typecheck
npm run lint
npm run build
```

### Creating Features

1. Create feature branch
2. Develop and test locally
3. Run all checks
4. Create pull request
5. Wait for review

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history and updates.

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Support

- GitHub Issues for bugs
- GitHub Discussions for questions
- Star the repo if you find it useful!

---

Built with ❤️ for fantasy football enthusiasts
