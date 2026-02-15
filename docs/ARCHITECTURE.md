# FDP Dynasty Platform - System Architecture

## System Overview

This document describes the canonical architecture for the FDP Dynasty fantasy football valuation platform.

---

## 📊 Database Inventory

### **Core Tables** (60+ total)

#### **Value System (Critical)**
- `player_values` - **TARGET**: Single source of truth for all player values
- `ktc_value_snapshots` - **LEGACY**: Historical KTC imports (read-only for history)
- `dynasty_value_snapshots` - Dynasty-specific value snapshots
- `value_snapshots` - General value snapshots
- `value_snapshots_archive` - Archived historical snapshots
- `latest_player_values` - **VIEW**: Current active values by format/profile
- `value_epochs` - **TARGET**: Rebuild versioning system
- `value_adjustment_factors` - Per-player adjustment factors
- `user_custom_values` - User overrides

#### **Player Identity**
- `nfl_players` - Base player registry
- `player_identity` - Canonical player mapping
- `player_aliases` - Name variations and mappings
- `unresolved_entities` - Players needing reconciliation
- `player_events` - Career events (trades, injuries, etc.)
- `weekly_player_stats` - Performance data

#### **League System**
- `leagues` - User leagues
- `league_profiles` - League settings (scoring, roster rules)
- `league_profile_multipliers` - Position/scarcity adjustments per profile
- `league_rankings` - Team power rankings
- `league_power_rankings` - Historical rankings
- `league_chat` - League discussions

#### **Model Configuration** (NEW!)
- `model_config` - Live tunable parameters (23 params)
- `model_config_history` - Config change audit trail
- `model_tuning_parameters` - Additional tuning params

#### **Market & Consensus**
- `fantasypros_top1000_cache` - FantasyPros rankings
- `fantasypros_build_log` - Import history
- `top_1000_current` - Current top 1000 rankings
- `market_player_consensus` - Multi-source consensus
- `market_anchor_audit` - Market anchor application log

#### **Advice & Recommendations**
- `player_advice` - Buy/sell/hold recommendations
- `advice_outcomes` - Advice effectiveness tracking
- `trade_recommendations` - Trade suggestions
- `waiver_recommendations` - Waiver wire targets
- `user_watchlists` - Player watchlists
- `watchlist_players` - Watchlist entries
- `watchlist_alerts` - Alert rules
- `notifications` - User notifications

#### **Analytics & Learning**
- `model_performance_history` - Model accuracy over time
- `model_accuracy_history` - Prediction vs actual
- `model_learning_audit` - Self-correction events
- `adjustment_events` - Real-time adjustment log
- `dynasty_adjustments` - Dynasty-specific adjustments
- `player_context_suggestions` - Context-based suggestions

#### **User & Subscription**
- `user_subscriptions` - Subscription status
- `user_experiment_assignments` - A/B test assignments
- `user_actions` - User interaction log
- `usage_tracking` - Feature usage metrics
- `feature_access_log` - Feature access audit
- `feature_experiments` - A/B test definitions
- `experiment_variants` - Test variants

#### **Trading**
- `trade_blocks` - Active trade offers
- `trade_outcomes` - Trade result tracking
- `trade_explanations` - Trade reasoning
- `dynasty_draft_picks` - Draft pick inventory

#### **System Health**
- `system_health_metrics` - Health monitoring
- `data_integrity_checksums` - Data validation
- `doctor_audit_runs` - Doctor mode scan history
- `doctor_fixes` - Auto-repair log
- `backup_metadata` - Backup tracking
- `validation_samples` - Test data samples
- `performance_logs` - Performance metrics

#### **Reporting**
- `dynasty_reports` - Weekly dynasty reports
- `weekly_market_reports` - Market trend reports
- `draft_rankings` - Draft board rankings
- `daily_value_changes` - Value change tracking

#### **Admin**
- `admin_audit_log` - Admin action log

---

## 🔄 Current Architecture (LEGACY - To Be Fixed)

### **Current Value Flow** ❌

```
Multiple Sources (Scattered)
    ↓
ktc_value_snapshots table
    ↓
getLatestValueForPlayer() reads directly
    ↓
Components read different tables
    ↓
Rankings, Trade Calc, Player Page may differ
```

**Problems:**
1. **No Single Source of Truth** - Components read from different tables
2. **No Versioning** - Can't track rebuild epochs
3. **Inconsistent Data** - Rankings/trade calc may show different values
4. **Cache Chaos** - No epoch-based invalidation
5. **No League Awareness** - Values not adjusted per league profile
6. **Stale Data** - 2025 values still in system (Feb 2026!)

### **Current Read Patterns** ❌

**Rankings:**
```typescript
// Reads ktc_value_snapshots directly
const { data } = await supabase
  .from('ktc_value_snapshots')
  .select('*')
  .eq('format', format);
```

**Player Detail:**
```typescript
// Reads ktc_value_snapshots directly
const { data } = await supabase
  .from('ktc_value_snapshots')
  .select('*')
  .eq('player_id', playerId);
```

**Trade Calculator:**
```typescript
// May read from different source or calculate inline
const value = await getLatestValueForPlayer(playerId, format);
```

**Result:** Values can differ across surfaces!

---

## 🎯 Target Architecture (CANONICAL)

### **Canonical Value Flow** ✅

```
┌─────────────────────────────────────────────────────┐
│           DATA INGESTION (Multiple Sources)         │
├─────────────────────────────────────────────────────┤
│  FantasyPros   KTC    Sleeper    Manual    Model    │
│      ↓          ↓        ↓          ↓        ↓      │
│            fantasypros_top1000_cache                │
│            ktc_value_snapshots (archive)            │
│            market_player_consensus                  │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│              NIGHTLY REBUILD PIPELINE                │
├─────────────────────────────────────────────────────┤
│  1. Load model_config (live tunable weights)        │
│  2. Load market consensus                           │
│  3. Apply league_profile_multipliers                │
│  4. Calculate values for all players                │
│  5. Build to player_values_staging                  │
│  6. Validate (coverage, tiers, consistency)         │
│  7. Atomic swap to player_values                    │
│  8. Create value_epoch                              │
│  9. Invalidate caches with epoch                    │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│          SINGLE SOURCE OF TRUTH (SSoT)              │
├─────────────────────────────────────────────────────┤
│              player_values table                     │
│  ┌────────────────────────────────────────┐         │
│  │ player_id                              │         │
│  │ league_profile_id (null = default)     │         │
│  │ format (dynasty/redraft/bestball)      │         │
│  │ base_value (canonical value)           │         │
│  │ adjusted_value (with profile)          │         │
│  │ rank_overall                           │         │
│  │ rank_position                          │         │
│  │ tier                                   │         │
│  │ value_epoch_id                         │         │
│  │ updated_at                             │         │
│  └────────────────────────────────────────┘         │
│                                                      │
│           latest_player_values (view)                │
│  ┌────────────────────────────────────────┐         │
│  │ Filters to current epoch only          │         │
│  │ One row per player/profile/format      │         │
│  └────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│           CANONICAL API (All reads go here)         │
├─────────────────────────────────────────────────────┤
│  getPlayerValue(player_id, league_profile, format)  │
│  getPlayerValues(player_ids[], profile, format)     │
│  getRankings(profile, format, position?)            │
│  getValueHistory(player_id, days)                   │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│           ALL CONSUMERS (Consistent!)               │
├─────────────────────────────────────────────────────┤
│  Rankings Page                                      │
│  Player Detail                                      │
│  Trade Calculator                                   │
│  Lineup Optimizer                                   │
│  CSV Export                                         │
│  Mobile App (future)                                │
│  Public API (future)                                │
└─────────────────────────────────────────────────────┘
```

### **Key Principles**

1. **Single Source of Truth**
   - ALL value reads go through `player_values` table
   - NO direct reads from `ktc_value_snapshots` (except history)
   - NO inline value calculations in components

2. **Epoch-Based Versioning**
   - Every rebuild creates new `value_epoch`
   - All responses include `value_epoch_id` + `updated_at`
   - Cache keys include epoch for safe invalidation

3. **League Profile Aware**
   - Default profile (null) = standard dynasty
   - Custom profiles = SF/1QB/TEP/IDP adjustments
   - Scarcity + replacement level per profile

4. **Atomic Rebuilds**
   - Build to staging table first
   - Validate before swapping
   - Rollback on failure
   - Zero downtime

5. **Post-2025 Reality**
   - `invalidate_before` timestamp
   - Stale data automatically excluded
   - Production-based weights (not draft capital)
   - Season-aware calculations

---

## 🔌 Canonical API

### **Core Functions**

```typescript
// Primary: Get single player value
getPlayerValue(
  player_id: string,
  league_profile_id: string | null = null,
  format: 'dynasty' | 'redraft' | 'bestball' = 'dynasty'
): Promise<PlayerValue>

// Batch: Get multiple player values (efficient)
getPlayerValues(
  player_ids: string[],
  league_profile_id: string | null = null,
  format: string = 'dynasty'
): Promise<Map<string, PlayerValue>>

// Rankings: Get all players sorted
getRankings(
  league_profile_id: string | null = null,
  format: string = 'dynasty',
  position?: string
): Promise<PlayerValue[]>

// History: Get value changes over time
getValueHistory(
  player_id: string,
  days: number = 180
): Promise<Array<{ date: string; value: number; epoch_id: string }>>
```

### **Return Type**

```typescript
interface PlayerValue {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  base_value: number;           // Canonical value
  adjusted_value: number;        // With league profile applied
  rank_overall: number;
  rank_position: number;
  tier: string;                  // elite/high/mid/low/depth
  value_epoch_id: string;        // For cache invalidation
  updated_at: string;            // ISO timestamp
  league_profile_id: string | null;
  format: string;
}
```

### **Usage Examples**

```typescript
// Rankings page
const rankings = await getRankings(leagueProfileId, 'dynasty', 'QB');

// Player detail page
const player = await getPlayerValue(playerId, leagueProfileId, 'dynasty');

// Trade calculator
const values = await getPlayerValues(
  [player1, player2, player3],
  leagueProfileId,
  'dynasty'
);
const totalValue = Array.from(values.values())
  .reduce((sum, p) => sum + p.adjusted_value, 0);
```

---

## 🔄 Rebuild Pipeline

### **Trigger Mechanisms**

1. **Scheduled (Primary)** - Nightly at 3 AM UTC
2. **Manual** - Admin can trigger via UI/API
3. **Config Change** - Model config changes trigger rebuild
4. **Market Update** - New consensus data triggers rebuild

### **Pipeline Steps**

```
1. Validate Environment
   ├─ Check DB connection
   ├─ Check required tables exist
   └─ Check model config loaded

2. Load Inputs
   ├─ model_config (live weights)
   ├─ market_player_consensus
   ├─ league_profile_multipliers
   └─ seasonContext (invalidate_before date)

3. Calculate Base Values
   ├─ For each player in universe
   ├─ Apply production_weight, age_curve, etc.
   ├─ Apply market anchor by tier
   └─ Store to player_values_staging

4. Calculate Profile-Specific Values
   ├─ For each league_profile
   ├─ Apply scarcity_multiplier
   ├─ Apply qb_superflex_boost, te_premium, etc.
   ├─ Calculate replacement levels
   └─ Store to player_values_staging

5. Validation Checks
   ├─ Coverage: >90% of expected players
   ├─ No duplicates per (player, profile, format)
   ├─ Tier distribution looks sane
   ├─ Top players in expected ranges
   └─ Justin Jefferson is tier-1 WR (sanity check)

6. Atomic Swap
   ├─ BEGIN TRANSACTION
   ├─ Rename player_values → player_values_old
   ├─ Rename player_values_staging → player_values
   ├─ Insert new value_epoch record
   ├─ COMMIT
   └─ Drop player_values_old

7. Post-Rebuild
   ├─ Invalidate all value caches
   ├─ Update system_health_metrics
   ├─ Log success to doctor_audit_runs
   └─ Notify admins

8. Failure Handling
   ├─ ROLLBACK transaction
   ├─ Keep old player_values intact
   ├─ Log error to system_health_metrics
   ├─ Alert admins
   └─ Enter safe mode if critical
```

### **Rollback Procedure**

```sql
-- If new values are bad, rollback to previous epoch
SELECT rollback_to_epoch('previous_epoch_id');

-- This restores player_values from value_snapshots_archive
-- and invalidates all caches
```

---

## 📁 Edge Functions (66 total)

### **Value Endpoints** (Critical for consistency)

- `values-latest` - **CANONICAL**: Get current values
- `player-value-detail` - Player-specific value info
- `rebuild-player-values` - Trigger full rebuild
- `sync-values-all` - Sync from external sources

### **Sync Endpoints** (Data ingestion)

- `sync-ktc-all` - Import KTC values
- `sync-ktc-qbs`, `sync-ktc-rbs`, `sync-ktc-wrs`, `sync-ktc-tes` - Position-specific
- `sync-adp` - Import ADP data
- `sync-top1000` - Import FantasyPros top 1000
- `sync-full-pipeline` - Run complete sync + rebuild
- `sync-sleeper-players` - Player registry sync
- `sync-transactions` - Real-time transaction tracking

### **Rankings Endpoints**

- `ktc-rankings` - KTC-based rankings
- `ktc-qb-values`, `ktc-rb-values`, `ktc-wr-values`, `ktc-te-values`
- `idp-rankings` - IDP player rankings
- `get-top1000` - Top 1000 player list
- `build-top-1000` - Rebuild top 1000

### **Trade Endpoints**

- `trade-eval` - Evaluate trade fairness
- `trade-share` - Generate shareable trade
- `trade-og-image` - Social preview image

### **League Endpoints**

- `league-rosters` - Get league rosters
- `league-suggestions` - Trade suggestions
- `calculate-league-rankings` - Power rankings
- `calculate-team-strategy` - Team composition analysis
- `league-og-image` - League social preview

### **Advice/Alert Endpoints**

- `player-advice` - Buy/sell/hold recommendations
- `compute-watchlist-alerts` - Check watchlist triggers
- `watchlist-add`, `watchlist-remove`, `watchlist-get`
- `watchlist-alerts` - Get active alerts
- `evaluate-advice-outcomes` - Track advice effectiveness

### **Health/Admin Endpoints**

- `doctor-audit` - Run consistency scan
- `doctor-repair` - Auto-fix issues
- `cron-nightly-doctor` - Scheduled health check
- `cron-run-health-checks` - System health monitoring
- `cron-system-health-check` - Overall system status
- `admin-consistency-report` - Admin value consistency report
- `admin-model-performance` - Model accuracy dashboard

### **Model Tuning** (NEW!)

- `model-preview` - Preview config changes
- `update-model-config` - Update model parameters
- `cron-model-config-monitor` - Detect config changes + trigger rebuild

### **Market/Analytics**

- `market-trends` - Market trend analysis
- `compute-market-trends` - Calculate trends
- `player-dynasty-history` - Historical player data
- `rebalance-dynasty` - Weekly value rebalance
- `detect-role-changes` - Player role change detection

### **Utility Endpoints**

- `player-search` - Search players
- `player-detail` - Player profile
- `player-integrity` - Player data validation
- `export-top1000-csv` - CSV export
- `recalc-pick-values` - Rookie pick value calculation
- `recalc-rb-fdp` - RB FDP value calculation
- `generate-rb-context-suggestions` - RB role suggestions
- `generate-weekly-report` - Dynasty weekly report
- `value-scarcity-debug` - Debug scarcity calculations
- `update-model-performance` - Update model metrics

### **Subscription/Payment**

- `create-checkout-session` - Stripe checkout
- `stripe-webhook` - Payment webhooks

### **Social/Sharing**

- `report-og-image` - Report social preview

---

## 🛡️ System Mode Kill-Switch

### **Modes**

```typescript
enum SystemMode {
  NORMAL = 'normal',        // All systems operational
  MAINTENANCE = 'maintenance',  // Read-only, banner shown
  SAFE_MODE = 'safe_mode',     // Critical failure, minimal functionality
}
```

### **Behavior by Mode**

**NORMAL:**
- All endpoints active
- Rebuilds allowed
- Cache active
- Full functionality

**MAINTENANCE:**
- Read-only mode
- No rebuilds
- Banner shown: "System maintenance in progress"
- Value endpoints return last good epoch
- No writes to player_values

**SAFE_MODE:**
- Triggered by Doctor Mode on critical failure
- Returns last validated snapshot
- No rebuilds allowed
- Prominent warning banner
- Admin notification sent

### **Implementation**

```typescript
// Check system mode before value operations
const systemMode = await getSystemMode();

if (systemMode === 'maintenance') {
  return {
    ...lastGoodValues,
    system_message: 'System maintenance in progress. Values may be stale.',
  };
}

if (systemMode === 'safe_mode') {
  return {
    ...validatedSnapshot,
    system_message: 'SAFE MODE: System detected issues. Using validated snapshot.',
  };
}
```

---

## 📊 Consistency Guarantees

### **The Promise**

> "If two surfaces show the same player at the same time with the same league profile, they MUST show the same value."

### **Enforcement**

1. **Single Table** - All reads from `player_values`
2. **Same Epoch** - All concurrent reads see same epoch
3. **Atomic Swaps** - Rebuilds are instantaneous
4. **Cache Consistency** - Epoch-based cache keys
5. **Automated Tests** - CI fails if values diverge

### **Test Suite**

```typescript
// src/tests/crossSurfaceConsistency.test.ts

test('Rankings and Trade Calculator show same values', async () => {
  const playerId = 'justin_jefferson';
  const profile = 'superflex';

  const rankingsValue = await getRankingsValue(playerId, profile);
  const tradeCalcValue = await getTradeCalcValue(playerId, profile);

  expect(rankingsValue).toBe(tradeCalcValue);
  expect(rankingsValue.value_epoch_id).toBe(tradeCalcValue.value_epoch_id);
});

test('Player page and export show same values', async () => {
  const playerId = 'justin_jefferson';

  const playerPageValue = await getPlayerPageValue(playerId);
  const csvExportValue = await getCsvExportValue(playerId);

  expect(playerPageValue).toBe(csvExportValue);
});
```

---

## 🎯 Phase Implementation Order

### **Phase 0: Inventory + Freeze** ✅ (This Document)
- Document all tables
- Document all endpoints
- Document canonical flows
- Add kill-switch

### **Phase 1: Single Source of Truth**
- Ensure `player_values` schema correct
- Implement `getPlayerValue()` + batch
- Refactor all consumers
- Delete fallback calculations

### **Phase 2: Rebuild Pipeline**
- Implement staging table
- Add `value_epochs`
- Build atomic swap
- Add validation

### **Phase 3: Data Freshness**
- Add `seasonContext`
- Purge stale data
- Post-2025 weights
- Sanity checks

### **Phase 4: League Profiles**
- Add profile resolver
- Per-profile values in nightly job
- Scarcity + replacement levels
- Verify SF/TEP/IDP impact

### **Phase 5: Advice + Alerts**
- Advice engine
- Watchlists + alerts
- Today's Opportunities UI
- Digest generation

### **Phase 6: Doctor Mode**
- Consistency test suite
- Doctor Mode scan
- Auto-repairs
- Rollback snapshots

### **Phase 7: Prod Gate**
- Env validation
- Value freshness gate
- Prelaunch script
- Block bad deploys

---

## 📚 Additional Documentation

- `LIVE_TUNING_PANEL.md` - Model configuration system
- `DOCTOR_MODE_COMPLETE.md` - Health monitoring + auto-repair
- `AB_TESTING_OUTCOME_TRACKING.md` - Experimentation system
- `DATA_VERSIONING_AND_BACKUPS.md` - Backup + restore
- `PRODUCTION_READINESS_GATE.md` - Deployment checks
- `VALUE_CONSISTENCY_TESTING.md` - Test framework

---

## 🎊 Summary

**Current State:** ❌ Scattered, inconsistent, no versioning, stale data

**Target State:** ✅ Single source of truth, epoch-versioned, league-aware, always fresh

**Core Innovation:** Every surface reads from same table at same epoch = guaranteed consistency

**Timeline:** Phases 0-7 implement in order, no skipping allowed

---

*Architecture Version: 1.0*
*Last Updated: 2026-02-15*
*Status: Phase 0 Complete, Ready for Phase 1*
