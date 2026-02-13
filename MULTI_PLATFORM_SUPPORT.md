# Multi-Platform Fantasy Football Support

Fantasy Draft Pros now supports multiple fantasy football platforms beyond just Sleeper!

## Supported Platforms

### ✅ Fully Supported
- **Sleeper** - Full support, no authentication required
- **ESPN Fantasy** - Full support with cookie authentication

### 🚧 Coming Soon
- **Yahoo Fantasy** - In development (OAuth integration needed)
- **NFL.com** - Planned for future release

## Platform Features

### Sleeper (🛌)
**Status:** Fully supported
**Authentication:** None required (public API)

**Features:**
- League details and settings
- Team rosters and records
- Player data and values
- Trade analysis
- Power rankings
- Playoff simulations
- All FDP features fully functional

**How to Add:**
1. Click "Add League"
2. Select Sleeper platform
3. Enter your Sleeper League ID (from URL)
4. That's it!

### ESPN Fantasy (🏈)
**Status:** Fully supported
**Authentication:** Cookie-based (espn_s2 and SWID)

**Features:**
- League details and settings
- Team rosters and records
- Player data
- Trade analysis (using FDP values)
- Basic analytics

**How to Add:**
1. Click "Add League"
2. Select ESPN platform
3. Get your authentication cookies:
   - Open ESPN Fantasy in your browser
   - Log in to your account
   - Press F12 to open Developer Tools
   - Go to "Application" or "Storage" tab
   - Click "Cookies" in the left sidebar
   - Find and copy these two values:
     - `espn_s2` (long alphanumeric string)
     - `SWID` (format: {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX})
4. Enter your League ID, espn_s2, and SWID
5. Done!

**Note:** ESPN cookies expire periodically (usually after a few weeks or months). You may need to update them occasionally.

**Private Leagues:** ESPN requires authentication for private leagues. Public leagues may work with just the League ID in some cases.

### Yahoo Fantasy (🟣)
**Status:** In development
**Authentication:** OAuth 2.0 (coming soon)

**Current Status:**
- Public league IDs may work with limited functionality
- Full OAuth integration coming in future update
- You can manually export/import league data in the meantime

**Planned Features:**
- Full OAuth authentication flow
- Complete league data access
- All FDP features
- Auto-refresh tokens

### NFL.com (🏆)
**Status:** Planned
**Authentication:** TBD

**Status:** Currently in planning phase. Use Sleeper or ESPN in the meantime.

## How It Works

### Database Schema
The `user_leagues` table now includes:
- `platform` - Which platform the league is from (sleeper, espn, yahoo, nfl)
- `platform_settings` - Platform-specific configuration (auth tokens, cookies, etc.)

### API Architecture
We've created a unified API layer that abstracts platform differences:

```typescript
// services/platformApi.ts
- fetchLeague(platform, leagueId, settings) → UnifiedLeague
- fetchTeams(platform, leagueId, settings) → UnifiedTeam[]
```

Each platform has its own API service:
- `services/sleeperApi.ts` - Sleeper API integration
- `services/espnApi.ts` - ESPN API integration
- `services/yahooApi.ts` - Yahoo API integration (in progress)

The platform layer converts platform-specific data into a unified format that works across all FDP features.

## Security & Privacy

### Data Storage
- **Sleeper:** No credentials stored (public API)
- **ESPN:** Cookies stored encrypted in Supabase (user-specific)
- **Yahoo:** OAuth tokens will be stored encrypted (future)

### Data Access
- All platform settings use Row Level Security (RLS)
- Only you can access your authentication credentials
- Credentials are never shared or exposed

### Cookie Expiration (ESPN)
- ESPN cookies expire periodically
- You'll need to update them when they expire
- The app will notify you if authentication fails
- Simply edit the league and update your cookies

## Feature Compatibility

| Feature | Sleeper | ESPN | Yahoo | NFL.com |
|---------|---------|------|-------|---------|
| League Details | ✅ | ✅ | 🚧 | ❌ |
| Rosters | ✅ | ✅ | 🚧 | ❌ |
| Trade Analyzer | ✅ | ✅ | 🚧 | ❌ |
| Power Rankings | ✅ | ✅ | 🚧 | ❌ |
| Playoff Simulator | ✅ | ⚠️ | 🚧 | ❌ |
| Player Values | ✅ | ✅ | ✅ | ❌ |
| Draft Picks | ✅ | ⚠️ | 🚧 | ❌ |
| FAAB Tracking | ✅ | ⚠️ | 🚧 | ❌ |

Legend:
- ✅ Fully supported
- ⚠️ Partially supported
- 🚧 In development
- ❌ Not available

## Troubleshooting

### ESPN Issues

**"Failed to fetch league"**
- Check that your League ID is correct
- Verify your espn_s2 and SWID cookies are current
- Make sure there are no extra spaces in the cookies
- Try refreshing your cookies (they may have expired)

**"Authentication failed"**
- Your cookies have likely expired
- Get fresh cookies from ESPN (F12 → Application → Cookies)
- Update your league settings with new cookies

**Private league not loading**
- ESPN requires authentication for private leagues
- Make sure you're logged into ESPN when copying cookies
- Cookies must be from the same browser session

### Sleeper Issues

**"League not found"**
- Double-check your League ID from the URL
- Sleeper IDs are numbers only (e.g., 123456789)
- Make sure the league is still active

### General Issues

**Platform badge not showing**
- Platform defaults to Sleeper for old leagues
- Edit the league to set the correct platform
- Database migration handles this automatically

**Can't switch platforms**
- Each league is tied to one platform
- To use a different platform, add it as a new league
- You can have the same league on multiple platforms if needed

## Adding Multiple Leagues

You can add leagues from different platforms:
1. Sleeper Dynasty League
2. ESPN Redraft League
3. Yahoo Bestball League (coming soon)

All leagues are managed independently with platform-specific settings.

## Migration from Existing Leagues

Existing Sleeper leagues are automatically marked as `platform: 'sleeper'` in the database. No action needed!

If you want to add the same league from a different platform (e.g., you manage it on both Sleeper and ESPN), you can add it as a separate entry.

## Future Enhancements

### Planned Features
- Cross-platform league comparisons
- Multi-platform player value aggregation
- Platform migration tools
- Bulk league imports
- Auto-sync credentials refresh

### Under Consideration
- Mobile platform support (Sleeper app, ESPN app)
- Custom/private league integrations
- Platform-agnostic league hosting
- Universal player ID mapping

## Technical Details

### API Rate Limits
- **Sleeper:** No strict limits, reasonable use
- **ESPN:** Cookie-based, respects browser limits
- **Yahoo:** OAuth rate limits will apply (future)

### Data Sync
- League data is cached for 30 minutes
- Player data is cached for 24 hours
- Authentication credentials stored securely
- You can manually refresh anytime

### Platform Detection
The app automatically detects the platform from saved league data and uses the appropriate API endpoints.

## Support

For issues or questions:
1. Check this documentation first
2. Review the main README
3. Check KNOWN_ISSUES.md
4. Open a GitHub issue

## Contributing

Want to help add support for more platforms?

See CONTRIBUTING.md for guidelines on:
- Adding new platform APIs
- Testing multi-platform features
- Submitting platform integrations

## Changelog

### v2.0.0 - Multi-Platform Support
- Added ESPN Fantasy support
- Added Yahoo Fantasy (partial)
- Created platform abstraction layer
- Updated database schema
- Enhanced UI for platform selection
- Added platform badges in League Manager

---

**Note:** This is a major feature update. Please report any issues you encounter with platform integrations!
