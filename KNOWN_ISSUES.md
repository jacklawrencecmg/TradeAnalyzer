# Known Issues & Status

This document tracks known issues, their status, and solutions.

## Critical Issues (Fixed)

### 1. Empty Player Values Table ✅ FIXED
**Status:** Resolved
**Issue:** The `player_values` table was empty, causing Trade Analyzer and other features to have no data.
**Solution:**
- Added a "Sync Player Values" button in the Power Rankings component
- Users can manually sync player data from SportsData.io API
- Data syncs automatically when accessed

**How to Populate:**
1. Log in to the application
2. Add a league
3. Navigate to Power Rankings
4. Click "Sync Player Values from SportsData.io"
5. Wait for sync to complete (may take 30-60 seconds)

### 2. Missing league_power_rankings Table ✅ FIXED
**Status:** Resolved
**Issue:** Table referenced in README but didn't exist in database
**Solution:** Created migration `add_league_power_rankings_table.sql`
**Applied:** Yes

### 3. No Error Boundaries ✅ FIXED
**Status:** Resolved
**Issue:** React errors would crash the entire app with no recovery
**Solution:** Added ErrorBoundary component wrapping the entire app
**Location:** `src/components/ErrorBoundary.tsx`

### 4. Inconsistent Column Naming ✅ FIXED
**Status:** Resolved
**Issue:** Database used `ktc_value` but app should use `base_value`
**Solution:** Created migration to rename column and updated all references
**Applied:** Yes

## Current Issues

### 1. Data Type Mismatches
**Status:** Active (Minor Impact)
**Issue:** Database uses `numeric` type but TypeScript interfaces expect `number`
**Impact:** PostgreSQL `numeric` is returned as string, may cause type errors
**Workaround:** Type coercion in API layer handles most cases
**Solution:** Update interfaces to handle both `string | number` for numeric fields

**Affected Fields:**
- `player_values.base_value`
- `player_values.fdp_value`
- `player_values.age`
- `player_values.volatility_score`
- All adjustment factor fields

### 2. Empty Feature Tables
**Status:** Expected (By Design)
**Issue:** Many tables have 0 rows (player_news, waiver_recommendations, etc.)
**Impact:** Features will show "No data" until users interact with them
**Solution:** This is normal - data populates as users use features

**Empty Tables:**
- `player_news` - Populated when news is fetched
- `player_cache` - Populated on first player fetch
- `waiver_recommendations` - User-generated data
- `draft_rankings` - User-generated data
- `keeper_values` - User-generated data
- `trade_blocks` - User-generated data
- `weekly_recaps` - Generated on demand
- `league_chat` - User-generated data
- `notifications` - Event-triggered

### 3. Large Bundle Size
**Status:** Active (Performance Warning)
**Issue:** Main JavaScript bundle is 549KB (136KB gzipped)
**Impact:** Slower initial load on slow connections
**Recommendation:** Consider code splitting for routes
**Priority:** Low

## Planned Enhancements

### Near Term
1. **Code Splitting**
   - Split routes into separate bundles
   - Lazy load heavy components
   - Target: <500KB main bundle

2. **Player Value Auto-Sync**
   - Schedule automatic daily sync
   - Add background sync on app load
   - Cache player data for 24 hours

3. **Better Loading States**
   - Replace generic spinners with skeletons
   - Add progress indicators for long operations
   - Show sync status in UI

4. **Offline Support**
   - Cache league data locally
   - Allow offline viewing of cached data
   - Sync when connection restored

### Long Term
1. **Real-time Updates**
   - WebSocket connections for live data
   - Push notifications for trades
   - Live chat updates

2. **Advanced Analytics**
   - Machine learning predictions
   - Historical trend analysis
   - Win probability calculations

3. **Mobile App**
   - React Native version
   - Push notifications
   - Offline-first architecture

## Testing Checklist

### Core Features
- [x] User authentication (login/signup)
- [x] League management (add/remove leagues)
- [x] Trade Analyzer (basic functionality)
- [ ] Power Rankings (needs player data sync)
- [ ] Playoff Simulator (needs league data)
- [x] Trade History (saves trades)
- [ ] Player Values (needs initial sync)

### Advanced Features
- [ ] Trade Finder
- [ ] Counter Offer Generator
- [ ] Waiver Assistant
- [ ] Lineup Optimizer
- [ ] Draft Kit
- [ ] Keeper Calculator
- [ ] Roster Health
- [ ] Weekly Recap
- [ ] Rivalry Tracker
- [ ] League Chat
- [ ] Notifications
- [ ] Player News Feed
- [ ] Export & Share

### API Integrations
- [x] Sleeper API (league data)
- [x] SportsData.io (player stats)
- [x] Supabase (database)
- [x] Supabase Auth

## Performance Metrics

### Current
- Build time: ~16 seconds
- Bundle size: 549KB (136KB gzipped)
- CSS size: 36KB (7KB gzipped)
- TypeScript compilation: Clean

### Targets
- Build time: <20 seconds ✅
- Bundle size: <500KB (goal)
- First contentful paint: <2s
- Time to interactive: <3s

## Browser Compatibility

### Tested
- ✅ Chrome 120+ (Desktop)
- ✅ Firefox 120+ (Desktop)
- ✅ Safari 17+ (Desktop)
- ✅ Edge 120+ (Desktop)

### Not Tested
- Mobile Safari (iOS)
- Chrome Mobile (Android)
- Firefox Mobile
- Samsung Internet

## Environment

### Required Variables
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SPORTSDATA_API_KEY=your_api_key
```

### Current Status
- ✅ All variables configured
- ✅ Database connected
- ✅ APIs accessible
- ✅ Authentication working

## Deployment Status

### Development
- ✅ Local dev server working
- ✅ Hot reload functioning
- ✅ TypeScript checking enabled
- ✅ ESLint configured

### Production
- ✅ Build succeeds
- ✅ Assets optimized
- ⚠️ Bundle size warning (expected)
- ✅ No critical errors

## Support & Help

### Common Solutions

**"No player data showing"**
- Navigate to Power Rankings
- Click "Sync Player Values"
- Wait for completion

**"League not found"**
- Verify Sleeper League ID is correct
- Check league is active for current season
- Ensure you have access to the league

**"Authentication error"**
- Clear browser cache
- Check environment variables
- Verify Supabase project is active

**"Build errors"**
- Run `npm install` to update dependencies
- Clear `node_modules` and reinstall
- Check Node.js version (18+ required)

## Contributing

When reporting issues:
1. Check this document first
2. Include browser and OS info
3. Describe steps to reproduce
4. Include error messages/screenshots
5. Note expected vs actual behavior

## Last Updated

2026-02-13 - Initial issue tracking document created
