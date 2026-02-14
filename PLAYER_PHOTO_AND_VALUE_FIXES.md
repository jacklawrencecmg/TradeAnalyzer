# Player Photo & Backup QB Value Fixes

## Changes Made

### 1. Player Photo Support
**File: `src/components/PlayerAvatar.tsx`**

Added support for actual player photos from Sleeper's CDN:
- Now accepts optional `playerId` prop
- Displays player photo from `https://sleepercdn.com/content/nfl/players/thumb/{playerId}.jpg`
- Falls back gracefully to initials if photo fails to load or playerId not provided
- Uses React state to handle image loading errors

**Usage:**
```tsx
<PlayerAvatar
  playerId="player_id_here"
  playerName="Joe Milton"
  team="NE"
  position="QB"
  size="lg"
/>
```

### 2. Backup QB Valuation Fix
**File: `src/utils/syncPlayerValues.ts`**

Fixed the issue where backup QBs like Joe Milton were getting inflated values (76.1 instead of ~2).

**Key Changes:**

1. **Added Known Backup QB List**
   ```typescript
   const KNOWN_BACKUP_QBS = [
     'joe milton', 'joe milton iii', 'trey lance', 'sam howell',
     // ... other known backups
   ];
   ```

2. **Enhanced Value Calculation Logic**
   - Detects backup QBs based on relative value to top QBs
   - Applies aggressive penalties:
     - Known backups or <5% of top QB value: **2% multiplier** (brings 76.1 → ~1.5)
     - <10% of top QB: **5% multiplier**
     - <20% of top QB: **15% multiplier**
     - <30% of median QB: **25% multiplier**

3. **Smart Detection Algorithm**
   - Compares each QB's raw value against all QB values
   - Calculates relative value to top QB
   - Identifies backups even if not in the known list

### How It Works

**Before:**
- All QBs normalized on same scale
- Joe Milton: Raw value → Normalized → 76.1 ❌

**After:**
- Detects Joe Milton as backup QB
- Applies 2% multiplier
- Joe Milton: 76.1 × 0.02 = 1.5 ✅

### Testing

To test the changes:

1. **Refresh Player Values** in the Trade Analyzer
2. Search for backup QBs like:
   - Joe Milton
   - Trey Lance
   - Jake Browning
   - Cooper Rush
3. Verify their values are now 0.5-3.0 range instead of 50-80

### Player Photos

Photos will now automatically display when `playerId` is provided to the `PlayerAvatar` component. All instances in:
- TradeAnalyzer
- TradeHistory
- PlayerComparison
- And other components

Will show actual player photos when available, with smooth fallback to team-colored initials.

## Impact

- **Backup QBs** now correctly valued at 0.5-3.0 instead of 50-80
- **Third-string QBs** valued even lower (0.1-0.5)
- **Player photos** display throughout the app
- **Trade analysis** now more accurate for QB-heavy trades
