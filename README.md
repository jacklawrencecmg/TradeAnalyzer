# Fantasy Draft Pros

> The ultimate fantasy football trade analyzer and league management platform. Make smarter trades, optimize your lineups, and dominate your league with data-driven insights.

[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green.svg)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Multi-Platform Support

Fantasy Draft Pros now supports multiple fantasy football platforms:
- **🛌 Sleeper** - Fully supported (no auth required)
- **🏈 ESPN Fantasy** - Fully supported (cookie auth)
- **🟣 Yahoo Fantasy** - Coming soon
- **🏆 NFL.com** - Coming soon

See [MULTI_PLATFORM_SUPPORT.md](MULTI_PLATFORM_SUPPORT.md) for detailed instructions on connecting each platform.

## Features

### Trade Analysis
- **Trade Analyzer** - Evaluate multi-player trades with win/loss predictions
- **Counter Offer Generator** - AI-powered trade counter-offer suggestions
- **Trade Finder** - Discover win-win trades with league mates
- **Trade Block Marketplace** - See what players are available across your league
- **Trade History** - Track and review your past trades

### League Insights
- **Power Rankings** - Advanced team strength analysis with weekly updates
- **Playoff Simulator** - Monte Carlo simulation for playoff odds (10,000+ iterations)
- **Championship Calculator** - Predict championship probabilities
- **Rivalry Tracker** - Head-to-head matchup history and trends
- **Weekly Recap** - Automated summaries of league activity

### Roster Management
- **Lineup Optimizer** - AI-recommended optimal starting lineups
- **Waiver Assistant** - Priority-ranked waiver wire recommendations
- **Roster Health** - Injury tracking and bye week planning
- **Player Values** - Real-time player valuations and market trends
- **Value Trend Tracker** - Historical player value charts

### Data Management
- **KTC Admin Sync** - Server-side scraping pipeline for KeepTradeCut dynasty QB rankings
- **QB Rankings** - Live dynasty superflex QB rankings with search and filtering
- **Value Snapshots** - Historical value tracking for trend analysis

### Draft & Keeper Tools
- **Draft Kit** - Live draft assistant with rankings and recommendations
- **Keeper Calculator** - Analyze keeper value and ROI

### Communication & Sharing
- **League Chat** - In-app messaging with league members
- **Player News Feed** - Real-time injury updates and breaking news
- **Notifications Panel** - Stay on top of league activity
- **Export & Share** - Share analysis with league mates

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- A fantasy football league (Sleeper, ESPN, Yahoo, or NFL.com)
- Supabase account (free tier works)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/fantasy-draft-pros.git
   cd fantasy-draft-pros
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_SPORTSDATA_API_KEY=your_sportsdata_api_key
   ```

4. **Set up the database**

   The Supabase migrations in `supabase/migrations/` will automatically create:
   - User authentication tables
   - League management tables
   - Trade history tracking
   - Player values system
   - Playoff simulations storage

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to `http://localhost:5173`

### First Time Setup

1. **Create an account** - Sign up with your email
2. **Add your league** - Enter your Sleeper League ID
3. **Start analyzing** - Access all tools from the dashboard

## Getting Your Sleeper League ID

1. Go to [sleeper.app](https://sleeper.app)
2. Navigate to your league
3. Copy the ID from the URL:
   ```
   https://sleeper.app/leagues/YOUR_LEAGUE_ID/team
   ```

## Technology Stack

### Frontend
- **React 18** - Modern UI with hooks and functional components
- **TypeScript** - Full type safety and enhanced developer experience
- **Vite** - Lightning-fast build tool and dev server
- **Tailwind CSS** - Utility-first styling with custom theme
- **Lucide React** - Beautiful, consistent iconography

### Backend
- **Supabase** - Complete backend solution
  - PostgreSQL database with Row Level Security
  - Real-time subscriptions
  - Built-in authentication
  - RESTful API

### APIs & Data Sources
- **Sleeper API** - League data, rosters, and matchups
- **SportsData.io** - Player stats, projections, and news
- **Fantasy Draft Pros Values** - Proprietary player valuations

## Project Structure

```
fantasy-draft-pros/
├── src/
│   ├── components/          # React components
│   │   ├── AuthForm.tsx     # Login/signup
│   │   ├── Dashboard.tsx    # Main app shell
│   │   ├── TradeAnalyzer.tsx
│   │   ├── PowerRankings.tsx
│   │   ├── PlayoffSimulator.tsx
│   │   ├── PlayerValues.tsx
│   │   └── ...              # 20+ feature components
│   ├── hooks/
│   │   └── useAuth.tsx      # Authentication context
│   ├── services/
│   │   ├── sleeperApi.ts    # Sleeper API client
│   │   ├── sportsdataApi.ts # SportsData API client
│   │   └── playerValuesApi.ts
│   ├── lib/
│   │   └── supabase.ts      # Supabase client
│   ├── App.tsx              # Root component
│   └── main.tsx             # Entry point
├── supabase/
│   └── migrations/          # Database migrations
├── public/                  # Static assets
├── dist/                    # Production build
└── package.json

```

## Key Features Explained

### Trade Analyzer
Multi-player trade evaluation with:
- Win probability calculations
- Positional need analysis
- Short-term vs long-term value assessment
- Fair trade indicators

### Power Rankings
Advanced algorithm considering:
- Season record and point differential
- Roster strength (starters + bench depth)
- Remaining schedule strength
- Recent performance trends
- Playoff positioning

### Playoff Simulator
Monte Carlo simulation engine:
- 10,000+ simulations per run
- Accounts for remaining schedule
- Projects final standings
- Calculates playoff odds and seeding

### Player Values
Real-time valuations updated regularly:
- Dynasty league values
- Redraft league values
- Superflex adjustments
- Positional scarcity factors
- Historical value trends

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
```

### Building for Production

```bash
npm run build
```

The optimized files will be in the `dist/` directory, ready for deployment.

## Deployment

### Deploy to Netlify

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add environment variables in Netlify dashboard
5. Deploy!

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow the prompts and add your environment variables when asked.

### Other Options
- **GitHub Pages** - Static hosting with custom domain
- **Cloudflare Pages** - Global CDN with great performance
- **AWS Amplify** - Full-featured hosting with CI/CD

## Database Schema

### Core Tables

**user_leagues** - Saved leagues per user
- Stores Sleeper league IDs and metadata
- Supports multiple leagues per user
- Soft delete for data retention

**saved_trades** - Trade history
- Complete trade details in JSONB
- Analysis results and fairness scores
- User notes and timestamps

**player_values** - Player valuations
- Dynasty and redraft values
- Position and team data
- Trend data for charts

**playoff_simulations** - Simulation results
- 10,000+ scenario outcomes
- Playoff odds by team
- Championship probabilities

**league_power_rankings** - Weekly rankings
- Calculated team strengths
- Performance metrics
- Historical tracking

## Configuration

### Custom Scoring
Edit player value weights in `src/services/playerValuesApi.ts`

### Theme Customization
Modify CMG colors in `tailwind.config.js`:
```javascript
colors: {
  'fdp-primary': '#3CBEDC',
  'fdp-accent': '#2EE59D',
  // ...
}
```

## Security

- Row Level Security (RLS) on all tables
- Users can only access their own data
- Secure session management via Supabase Auth
- Environment variables for sensitive keys
- No hardcoded credentials
- HTTPS enforced in production

## Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Code splitting for optimal bundle size
- Lazy loading for route components
- Efficient React rendering with memoization
- Cached API responses
- Optimized images and assets
- 90+ Lighthouse score

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
- Sufficient color contrast
- Focus indicators on all interactive elements
- Semantic HTML structure

## Troubleshooting

### "League not found"
- Verify your Sleeper League ID is correct
- Ensure the league is active for the current season
- Check your internet connection

### "Authentication error"
- Check that Supabase credentials are correct in `.env`
- Verify your Supabase project is active
- Clear browser cache and try again

### Slow Performance
- First load fetches and caches league data
- Subsequent loads are much faster
- Large leagues (14+ teams) take longer to process

### Build Errors
- Run `npm install` to ensure dependencies are up to date
- Check Node.js version (18+ required)
- Clear `node_modules` and reinstall if needed

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

### Coming Soon
- ESPN and Yahoo league integration
- Mobile app (React Native)
- Advanced machine learning predictions
- Multi-league portfolio dashboard
- Automated trade proposals via bot

### Future Enhancements
- Video analysis and highlights
- Integration with betting odds
- Social features and league communities
- Custom report generation
- API for third-party integrations

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- **Sleeper** - Excellent free API for fantasy football data
- **SportsData.io** - Professional-grade NFL statistics
- **Supabase** - Amazing backend-as-a-service platform
- **Fantasy Football Community** - Inspiration and feedback

## Support

- Read the [documentation](QUICKSTART.md)
- Check [examples](EXAMPLES.md)
- Report issues on GitHub
- Star the repo if you find it useful

---

**Built for fantasy football enthusiasts by fantasy football enthusiasts**

Ready to dominate your league? Get started now and make smarter trades with data-driven insights.
