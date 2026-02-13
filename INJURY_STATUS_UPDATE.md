# Injury Status Update

## Change Summary
Removed automatic value penalties for injured players. Injury status is now displayed for informational purposes only and does not affect player values.

## What Changed

### Before
- Players with injury designations (OUT, IR, Doubtful, Questionable) had their FDP values automatically reduced
- The `injury_risk` factor in `calculateFDPValue()` applied a negative multiplier
- This could significantly lower a player's trade value even if the injury was temporary

### After
- Injury status is still tracked and displayed prominently with color-coded badges
- No automatic value adjustments are made based on injury status
- Users can see injury information and make their own valuation decisions
- Values remain consistent with Fantasy Draft Pros rankings

## Why This Change?

1. **User Control**: You should decide how much an injury affects value, not an algorithm
2. **Context Matters**: Some injuries are minor (questionable tag for rest day), others are season-ending
3. **Trade Fairness**: Automatic deductions could undervalue players unfairly
4. **Transparency**: Clean separation between objective value and subjective injury impact

## How It Works Now

### Display
- Injury badges still appear in the "Details" column
- Color-coded for quick reference:
  - 🔴 Red: Out/IR (serious)
  - 🟠 Orange: Doubtful
  - 🟡 Yellow: Questionable
  - 🟢 Green: Healthy

### Filtering
- You can still filter by injury status to find specific players
- Useful for identifying buy-low opportunities on injured stars
- Or avoiding players with concerning injury histories

### Values
- FDP value = Base value + your league adjustments
- League adjustments include:
  - ✅ Superflex boost for QBs
  - ✅ Playoff schedule strength
  - ✅ Recent performance trends
  - ✅ Team situation factors
  - ❌ No injury penalties (removed)

## Example Scenario

**Player**: Christian McCaffrey
**Status**: Questionable (knee)
**Value**: 9,500

**Before**: Value might drop to 8,000 automatically
**After**: Value stays 9,500 - you decide if the injury concerns you

If you want to trade for him, you can offer less based on the injury risk **you** assess. But the baseline value doesn't assume the worst.

## Technical Details

### Code Change
File: `src/services/playerValuesApi.ts`

```typescript
// REMOVED from calculateFDPValue():
if (factors.injury_risk) {
  adjustedValue *= (1 - Math.abs(factors.injury_risk));
}
```

### Database
- `injury_status` column still exists and is populated
- Used for display and filtering only
- Not used in value calculations

## User Guide

### For Trades
1. Check the injury badge on player cards
2. Research the actual injury severity yourself
3. Make offers based on your own risk assessment
4. Use the displayed FDP value as the "healthy" baseline

### For Analysis
1. Filter by injury status to find opportunity targets
2. Compare injured stars vs healthy alternatives
3. Look for buy-low chances on temporarily injured elite players
4. Monitor injury designations throughout the season

## Future Considerations

If you want injury-based value adjustments in the future, consider:
- User-configurable injury risk multipliers
- Historical injury data and patterns
- Recovery timeline tracking
- Position-specific injury impact models

But for now, the system trusts you to make informed decisions based on visible injury information.
