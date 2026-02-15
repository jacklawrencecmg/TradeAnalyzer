# Build Execution Plan - Phase 0 Through Phase 7

## ✅ COMPLETED: Phase 0 - Inventory + Freeze

### What Was Done
1. ✅ **Comprehensive Repository Scan**
   - Documented all 60+ database tables
   - Cataloged all 66 edge functions
   - Identified 66 value-related source files
   - Created inventory in ARCHITECTURE.md

2. ✅ **ARCHITECTURE.md Documentation**
   - Canonical value flow diagram
   - Current (legacy) vs Target architecture
   - Single Source of Truth design
   - All tables, endpoints, and flows documented
   - 350+ lines of comprehensive documentation

3. ✅ **System Mode Kill-Switch**
   - Added `system_mode` to model_config
   - Created `get_system_mode()` function
   - Created `set_system_mode()` function
   - Added `is_system_operational()` helper
   - Added `are_writes_allowed()` helper
   - Created SystemModeBanner.tsx component
   - Modes: normal, maintenance, safe_mode

### Deliverables
- ✅ `docs/ARCHITECTURE.md` - Complete system architecture
- ✅ `src/components/SystemModeBanner.tsx` - UI banner component
- ✅ Database functions for system mode management
- ✅ Audit logging for mode changes

---

## ✅ COMPLETED: Phase 1 Part 1 - Canonical Schema

### What Was Done
1. ✅ **value_epochs Table**
   - Tracks rebuild versions
   - epoch_number (auto-increment)
   - Status tracking (active/archived/rolled_back)
   - Metadata support

2. ✅ **player_values_canonical Table**
   - Single Source of Truth schema
   - Player identity (player_id, name, position, team)
   - League context (profile_id, format)
   - Values (base_value, adjusted_value, market_value)
   - Rankings (rank_overall, rank_position, tier)
   - Versioning (value_epoch_id)
   - Comprehensive indexes for performance
   - UNIQUE constraint per (player, profile, format, epoch)

3. ✅ **player_values_staging Table**
   - Identical schema to canonical
   - Used for atomic swaps during rebuilds

4. ✅ **latest_player_values View**
   - Filters to current epoch only
   - Easy consumption for queries

5. ✅ **Helper Functions**
   - `get_current_epoch()` - Returns active epoch ID
   - `get_latest_epoch_number()` - Returns latest epoch number
   - `create_new_epoch()` - Creates new epoch, archives old

6. ✅ **RLS Policies**
   - Everyone can read
   - Service role can write
   - Staging is service-role only

### Deliverables
- ✅ Canonical schema with 10+ indexes
- ✅ Epoch versioning system
- ✅ Staging table for atomic swaps
- ✅ View for easy access
- ✅ Helper functions for epoch management

---

## 🔄 IN PROGRESS: Phase 1 Part 2 - Canonical API

### What Needs To Be Done

1. **Create `src/lib/values/canonicalApi.ts`**
   ```typescript
   // Primary functions
   export async function getPlayerValue(
     player_id: string,
     league_profile_id: string | null = null,
     format: string = 'dynasty'
   ): Promise<PlayerValueCanonical | null>

   export async function getPlayerValues(
     player_ids: string[],
     league_profile_id: string | null = null,
     format: string = 'dynasty'
   ): Promise<Map<string, PlayerValueCanonical>>

   export async function getRankings(
     league_profile_id: string | null = null,
     format: string = 'dynasty',
     position?: string,
     limit?: number
   ): Promise<PlayerValueCanonical[]>

   export async function getValueHistory(
     player_id: string,
     days: number = 180
   ): Promise<ValueHistoryPoint[]>

   // Types
   interface PlayerValueCanonical {
     player_id: string;
     player_name: string;
     position: string;
     team: string | null;
     base_value: number;
     adjusted_value: number;
     market_value: number | null;
     rank_overall: number | null;
     rank_position: number | null;
     tier: string;
     value_epoch_id: string;
     updated_at: string;
     league_profile_id: string | null;
     format: string;
     confidence_score: number | null;
     metadata: Record<string, any>;
   }
   ```

2. **Implement Epoch-Based Caching**
   ```typescript
   // Cache keys MUST include epoch
   const cacheKey = `player-value:${player_id}:${profile}:${format}:${epoch_id}`;

   // Invalidation on new epoch
   export function invalidateValuesForEpoch(old_epoch_id: string): void {
     cache.invalidatePattern(`*:${old_epoch_id}`);
   }
   ```

3. **Create Batch Operations**
   ```typescript
   // Efficient batch loading
   export async function getPlayerValuesBatch(
     requests: Array<{ player_id: string; profile_id?: string; format?: string }>
   ): Promise<Map<string, PlayerValueCanonical>>
   ```

---

## 📋 TODO: Phase 1 Part 3 - Refactor All Consumers

### Components To Refactor (12+)

1. **UnifiedRankings.tsx**
   - Currently reads from `ktc_value_snapshots` ❌
   - Must use `getRankings()` ✅

2. **PlayerDetail.tsx**
   - Currently reads from multiple sources ❌
   - Must use `getPlayerValue()` ✅

3. **TradeAnalyzer.tsx**
   - Currently reads from `ktc_value_snapshots` ❌
   - Must use `getPlayerValues()` batch ✅

4. **PlayerValues.tsx**
   - Currently reads from `ktc_value_snapshots` ❌
   - Must use `getRankings()` ✅

5. **LineupOptimizer.tsx**
   - Must use `getPlayerValues()` ✅

6. **Top1000Rankings.tsx**
   - Must use `getRankings()` ✅

7. **KTCQBRankings.tsx, KTCRBRankings.tsx, KTCWRRankings.tsx, KTCTERankings.tsx**
   - Must use `getRankings(null, 'dynasty', position)` ✅

8. **PlayerComparison.tsx**
   - Must use `getPlayerValues([p1, p2])` ✅

9. **TradeFinder.tsx**
   - Must use `getPlayerValues()` ✅

10. **ExportShare.tsx**
    - Must use `getRankings()` for CSV export ✅

### Edge Functions To Refactor (15+)

1. **values-latest**
   - Must read from `player_values_canonical` ✅

2. **player-value-detail**
   - Must use canonical API ✅

3. **ktc-rankings, ktc-qb-values, ktc-rb-values, ktc-wr-values, ktc-te-values**
   - Must read from canonical table ✅

4. **get-top1000**
   - Must read from canonical table ✅

5. **trade-eval**
   - Must use `getPlayerValues()` batch ✅

6. **player-search**
   - Must return canonical values ✅

7. **idp-rankings**
   - Must read from canonical table ✅

8. **league-rosters**
   - Must use canonical API ✅

9. **league-suggestions**
   - Must use canonical API ✅

10. **export-top1000-csv**
    - Must read from canonical table ✅

### Delete/Disable Fallback Calculations

Search for and eliminate:
- Any `calculateValue()` in components
- Inline value calculations
- Direct reads from `ktc_value_snapshots` (except for history)
- Fallback logic that computes values client-side

---

## 📋 TODO: Phase 2 - Rebuild Pipeline

### 2.1 Atomic Swap Function

Create `swap_player_values_atomic()` function:
```sql
CREATE OR REPLACE FUNCTION swap_player_values_atomic()
RETURNS boolean AS $$
BEGIN
  -- Validate staging has data
  -- Rename canonical → canonical_old
  -- Rename staging → canonical
  -- Create new empty staging
  -- Re-apply indexes and RLS
  -- Drop canonical_old
  -- Log success
END;
$$;
```

### 2.2 Validation Functions

Create `validate_player_values_before_swap()`:
```sql
-- Check coverage (>90% expected players)
-- Check for duplicates
-- Check tier distribution
-- Check top players in range
-- Sanity check: Justin Jefferson is tier-1 WR
```

### 2.3 Rebuild Edge Function

Create `supabase/functions/rebuild-player-values-v2/index.ts`:
```typescript
1. Check system mode (block if maintenance/safe_mode)
2. Validate environment
3. Load model_config
4. Load market consensus
5. Load league profiles
6. For each player:
   - Calculate base_value
   - Apply market anchor
   - Store to staging
7. For each league profile:
   - Calculate adjusted values
   - Apply scarcity/replacement
   - Store to staging
8. Run validation checks
9. Create new epoch
10. Atomic swap
11. Invalidate caches
12. Log success
```

### 2.4 Epoch-Safe Caching

Update cache.ts:
```typescript
export function getCacheKeyWithEpoch(
  parts: string[],
  epoch_id: string
): string {
  return `${parts.join(':')}:${epoch_id}`;
}

export function invalidateEpoch(epoch_id: string): void {
  cache.invalidatePattern(`*:${epoch_id}`);
}
```

### 2.5 Post-Rebuild Hooks

Create hooks:
- Invalidate all value caches
- Update `system_health_metrics`
- Notify admins
- Trigger dependent jobs (advice engine, alerts)

---

## 📋 TODO: Phase 3 - Data Freshness

### 3.1 Season Context

Add to `src/config/seasonContext.ts`:
```typescript
export const SEASON_CONTEXT = {
  current_season: 2026,
  current_week: 1,
  invalidate_before: '2025-12-31T23:59:59Z', // Post-2025
  is_offseason: true,
  draft_date: '2026-04-25',
  season_start: '2026-09-05',
};
```

### 3.2 Stale Data Purge

Create migration:
```sql
-- Delete all snapshots before cutoff
DELETE FROM ktc_value_snapshots
WHERE captured_at < '2025-12-31 23:59:59';

-- Archive instead of delete
INSERT INTO value_snapshots_archive
SELECT * FROM ktc_value_snapshots
WHERE captured_at < '2025-12-31 23:59:59';
```

### 3.3 Post-2025 Weights

Update model_config defaults:
```sql
UPDATE model_config
SET value = CASE key
  WHEN 'production_weight' THEN 0.65  -- Increase (was 0.60)
  WHEN 'rookie_draft_capital_weight' THEN 0.25  -- Decrease (was 0.35)
  WHEN 'age_curve_weight' THEN 0.10  -- Keep same
  ELSE value
END
WHERE key IN ('production_weight', 'rookie_draft_capital_weight', 'age_curve_weight');
```

### 3.4 Sanity Assertions

Add to validation:
```typescript
// Justin Jefferson should be tier-1 WR
const jjValue = await getPlayerValue('justin_jefferson', null, 'dynasty');
if (!jjValue || jjValue.tier !== 'elite' || jjValue.rank_position > 5) {
  throw new Error('SANITY CHECK FAILED: Justin Jefferson not tier-1 WR');
}

// CMC should be top-5 RB
const cmcValue = await getPlayerValue('christian_mccaffrey', null, 'dynasty');
if (!cmcValue || cmcValue.rank_position > 5) {
  throw new Error('SANITY CHECK FAILED: CMC not top-5 RB');
}
```

---

## 📋 TODO: Phase 4 - League Profiles

### 4.1 Profile Resolver

Create `src/lib/league/resolveLeagueProfile.ts`:
```typescript
export async function resolveLeagueProfile(
  leagueId: string
): Promise<LeagueProfile>

export async function getProfileMultipliers(
  profileId: string
): Promise<ProfileMultipliers>
```

### 4.2 Per-Profile Value Calculation

In rebuild job:
```typescript
// After base values calculated
for (const profile of profiles) {
  for (const player of players) {
    const adjustedValue = applyProfileMultipliers(
      player.base_value,
      player.position,
      profile
    );

    await insertStaging({
      ...player,
      league_profile_id: profile.id,
      adjusted_value: adjustedValue,
    });
  }
}
```

### 4.3 Scarcity Adjustment

Create `src/lib/values/scarcityAdjustment.ts`:
```typescript
export function applyScarcityAdjustment(
  baseValue: number,
  position: string,
  profileMultipliers: ProfileMultipliers
): number {
  // TE premium
  if (position === 'TE' && profileMultipliers.te_premium) {
    return baseValue * (1 + profileMultipliers.te_premium);
  }

  // QB superflex boost
  if (position === 'QB' && profileMultipliers.qb_superflex) {
    return baseValue * profileMultipliers.qb_superflex_boost;
  }

  return baseValue;
}
```

### 4.4 Replacement Levels

Create `src/lib/values/replacementLevels.ts`:
```typescript
export function calculateReplacementLevel(
  position: string,
  profile: LeagueProfile
): number {
  // Based on roster requirements and starter counts
  const starterCount = profile.starters_by_position[position];
  const benchDepth = profile.bench_depth;

  // Replacement level = (starters * teams) + typical bench
  return (starterCount * profile.team_count) + benchDepth;
}
```

---

## 📋 TODO: Phase 5 - Advice + Alerts

### 5.1 Advice Engine

Create `src/lib/advice/generateDailyAdvice.ts`:
```typescript
export async function generateDailyAdvice(
  userId: string
): Promise<AdviceItem[]> {
  const config = await getModelConfig();
  const watchlist = await getWatchlist(userId);

  const advice: AdviceItem[] = [];

  for (const player of watchlist) {
    const current = await getPlayerValue(player.id);
    const history = await getValueHistory(player.id, 30);

    // Buy-low detection
    if (history.length > 0) {
      const valueDrop = history[0].value - current.adjusted_value;
      if (valueDrop >= config.buy_low_delta) {
        advice.push({
          type: 'buy_low',
          player_id: player.id,
          reason: `Value dropped ${valueDrop} in last 30 days`,
          confidence: 0.85,
        });
      }
    }

    // Sell-high detection
    // Breakout candidate detection
    // Waiver wire suggestions
  }

  return advice;
}
```

### 5.2 Watchlists + Alerts

Enhance existing watchlist system:
- Add alert triggers (value drop %, value spike %, role change)
- Add notification dispatch
- Add rate limiting
- Add digest generation

### 5.3 Today's Opportunities UI

Create component that shows:
- Buy-low candidates (from watchlist + user's league)
- Sell-high opportunities
- Waiver wire adds
- Trade targets

---

## 📋 TODO: Phase 6 - Doctor Mode

### 6.1 Consistency Test Suite

Create `src/tests/crossSurfaceConsistency.test.ts`:
```typescript
describe('Cross-Surface Value Consistency', () => {
  test('Rankings and Trade Calculator show same values', async () => {
    const playerId = 'justin_jefferson';
    const profile = 'superflex';

    const rankingsValue = await getRankingsValue(playerId, profile);
    const tradeCalcValue = await getTradeCalcValue(playerId, profile);

    expect(rankingsValue.adjusted_value).toBe(tradeCalcValue.adjusted_value);
    expect(rankingsValue.value_epoch_id).toBe(tradeCalcValue.value_epoch_id);
  });

  test('Player page and CSV export show same values', async () => {
    const playerId = 'justin_jefferson';

    const playerPageValue = await getPlayerPageValue(playerId);
    const csvValue = await getCsvExportValue(playerId);

    expect(playerPageValue.adjusted_value).toBe(csvValue.adjusted_value);
  });
});
```

### 6.2 Doctor Mode Scanning

Enhance `src/lib/doctor/runDoctorAudit.ts`:
- Check all surfaces read from canonical table
- Check epoch consistency across surfaces
- Check for stale caches
- Check for direct ktc_value_snapshots reads
- Check for inline value calculations

### 6.3 Auto-Repairs

Add repair functions:
- Invalidate stale caches
- Force cache refresh
- Trigger rebuild if values corrupted
- Enter safe mode if critical failure

---

## 📋 TODO: Phase 7 - Production Gate

### 7.1 Environment Validation

Create `src/lib/startup/validateEnvironment.ts`:
```typescript
export async function validateEnvironment(): Promise<ValidationResult> {
  // Check Supabase connection
  // Check required tables exist
  // Check model_config loaded
  // Check current epoch exists
  // Check values fresh (updated within 48h)

  return {
    valid: boolean,
    errors: string[],
    warnings: string[],
  };
}
```

### 7.2 Value Freshness Gate

```typescript
export async function validateValueFreshness(): Promise<boolean> {
  const lastUpdate = await getValuesLastUpdated();
  const hoursSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);

  if (hoursSinceUpdate > 48) {
    console.error('VALUES ARE STALE: Last update was', hoursSinceUpdate, 'hours ago');
    return false;
  }

  return true;
}
```

### 7.3 Prelaunch Script

Update `scripts/prelaunch.js`:
```javascript
async function prelaunch() {
  console.log('Running pre-launch validation...');

  // 1. Environment check
  const envValid = await validateEnvironment();
  if (!envValid.valid) {
    console.error('Environment validation failed:', envValid.errors);
    process.exit(1);
  }

  // 2. Value freshness check
  const valuesFresh = await validateValueFreshness();
  if (!valuesFresh) {
    console.error('Values are stale! Deploy blocked.');
    process.exit(1);
  }

  // 3. Consistency checks
  const consistencyValid = await runConsistencyTests();
  if (!consistencyValid) {
    console.error('Consistency tests failed! Deploy blocked.');
    process.exit(1);
  }

  // 4. Doctor mode scan
  const doctorResult = await runDoctorAudit();
  if (doctorResult.critical_issues > 0) {
    console.error('Doctor mode found critical issues! Deploy blocked.');
    process.exit(1);
  }

  console.log('✅ All pre-launch checks passed!');
}
```

---

## 🎯 Definition of Done

### System Must Satisfy All Of:

1. ✅ **Single Source of Truth**
   - All components read from `player_values_canonical`
   - No direct reads from `ktc_value_snapshots`
   - No inline value calculations

2. ✅ **Consistency Guarantee**
   - Rankings page shows same values as trade calculator
   - Player page shows same values as CSV export
   - All surfaces show same epoch_id
   - Test suite enforces consistency

3. ✅ **Epoch Versioning**
   - Every response includes `value_epoch_id`
   - Cache keys include epoch
   - Rebuilds create new epoch
   - Atomic swaps (zero downtime)

4. ✅ **League Profile Aware**
   - Default profile (null) = standard dynasty
   - SF/1QB/TEP/IDP profiles adjust values correctly
   - Scarcity + replacement levels applied
   - Visible impact on rankings

5. ✅ **Data Freshness**
   - Post-2025 data only
   - Stale data purged/archived
   - Production-based weights
   - Sanity checks enforce expectations

6. ✅ **Advice + Alerts**
   - Buy-low/sell-high detection
   - Watchlist alerts
   - Today's Opportunities UI
   - Daily digest

7. ✅ **Doctor Mode**
   - Consistency test suite
   - Auto-detect issues
   - Auto-repair where safe
   - Rollback on critical failure

8. ✅ **Production Gate**
   - Env validation
   - Value freshness check
   - Consistency tests
   - Deploy blocked on failure

---

## 📊 Progress Tracking

### Phase 0: ✅ COMPLETE (100%)
- Inventory: ✅
- ARCHITECTURE.md: ✅
- Kill-switch: ✅

### Phase 1: 🔄 IN PROGRESS (60%)
- Canonical schema: ✅
- Canonical API: 🔄 IN PROGRESS
- Refactor consumers: ❌ TODO

### Phase 2: ❌ TODO (0%)
### Phase 3: ❌ TODO (0%)
### Phase 4: ❌ TODO (0%)
### Phase 5: ❌ TODO (0%)
### Phase 6: ❌ TODO (0%)
### Phase 7: ❌ TODO (0%)

---

## 🚀 Next Actions

### Immediate (This Session If Possible)
1. Complete canonical API functions
2. Start refactoring UnifiedRankings.tsx

### Short Term (Next Session)
1. Complete component refactoring
2. Complete edge function refactoring
3. Delete fallback calculations

### Medium Term
1. Complete Phase 2 (rebuild pipeline)
2. Complete Phase 3 (data freshness)

### Long Term
1. Phases 4-7
2. Full test suite
3. Production deployment

---

*Plan Version: 1.0*
*Last Updated: 2026-02-15*
*Status: Phase 0 Complete, Phase 1 60% Complete*
