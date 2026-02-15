import { supabase } from '../supabase';
import { syncWeeklyStats, getCurrentSeasonWeek } from '../stats/sleeperWeeklyStats';
import { calculatePerformanceTrend, calculateMarketTrend } from './trendSignals';
import { blendAndApplySafety } from './blendDelta';
import { applyDynastyAdjustments, saveDynastySnapshot } from './applyAdjustments';

export interface RebalanceResult {
  success: boolean;
  stats_synced: number;
  players_rebalanced: number;
  snapshots_saved: number;
  errors: string[];
}

/**
 * Run weekly dynasty value rebalance
 *
 * Steps:
 * 1. Sync weekly stats from Sleeper
 * 2. Calculate trend signals for all rosterable players
 * 3. Blend signals and apply safety checks
 * 4. Write dynasty_adjustments
 * 5. Apply adjustments to dynasty values
 * 6. Save dynasty_value_snapshots
 */
export async function runWeeklyDynastyRebalance(): Promise<RebalanceResult> {
  const result: RebalanceResult = {
    success: false,
    stats_synced: 0,
    players_rebalanced: 0,
    snapshots_saved: 0,
    errors: [],
  };

  try {
    // Step 1: Sync weekly stats
    const { season, week } = getCurrentSeasonWeek();
    console.log(`Syncing stats for ${season} week ${week}`);

    const statsResult = await syncWeeklyStats(season, week);
    result.stats_synced = statsResult.synced;

    if (statsResult.errors.length > 0) {
      result.errors.push(...statsResult.errors.slice(0, 5)); // Limit error messages
    }

    // Step 2: Get all rosterable players from player_values
    const { data: players, error: fetchError } = await supabase
      .from('player_values')
      .select('player_id, player_name, position, base_value, fdp_value')
      .not('position', 'in', '(K,P,LS)')
      .order('fdp_value', { ascending: false })
      .limit(1000); // Top 1000 players

    if (fetchError) {
      result.errors.push(`Failed to fetch players: ${fetchError.message}`);
      return result;
    }

    if (!players || players.length === 0) {
      result.errors.push('No players found to rebalance');
      return result;
    }

    const today = new Date().toISOString().split('T')[0];

    // Step 3-6: Process each player
    for (const player of players) {
      try {
        // Calculate trend signals
        const performanceTrend = await calculatePerformanceTrend(player.player_id, season);
        const marketTrend = await calculateMarketTrend(player.player_id);

        // Skip if both signals are zero (no change)
        if (performanceTrend.delta === 0 && marketTrend.delta === 0) {
          continue;
        }

        // Blend signals with safety checks
        const blended = await blendAndApplySafety(
          player.player_id,
          performanceTrend,
          marketTrend,
          supabase
        );

        // Only write adjustment if delta is non-zero
        if (blended.delta !== 0) {
          // Write blended adjustment
          const { error: adjError } = await supabase.from('dynasty_adjustments').upsert(
            {
              player_id: player.player_id,
              as_of_date: today,
              signal_source: 'blended',
              delta: blended.delta,
              reason: blended.reason,
              confidence: Math.max(
                performanceTrend.confidence,
                marketTrend.confidence
              ),
            },
            {
              onConflict: 'player_id,as_of_date,signal_source',
            }
          );

          if (adjError) {
            result.errors.push(
              `Failed to save adjustment for ${player.player_name}: ${adjError.message}`
            );
            continue;
          }
        }

        // Apply all adjustments to get new dynasty value
        const baseDynastyValue = player.fdp_value || player.base_value || 0;
        const { dynastyValue, adjustmentTotal } = await applyDynastyAdjustments(
          player.player_id,
          baseDynastyValue,
          30 // 30-day rolling window
        );

        // Update player_values with new dynasty value
        const { error: updateError } = await supabase
          .from('player_values')
          .update({
            fdp_value: dynastyValue,
            last_updated: new Date().toISOString(),
          })
          .eq('player_id', player.player_id);

        if (updateError) {
          result.errors.push(
            `Failed to update ${player.player_name}: ${updateError.message}`
          );
          continue;
        }

        // Save snapshot
        await saveDynastySnapshot(
          player.player_id,
          dynastyValue,
          baseDynastyValue,
          adjustmentTotal
        );

        result.players_rebalanced++;
        result.snapshots_saved++;
      } catch (err) {
        result.errors.push(
          `Error rebalancing ${player.player_name}: ${err instanceof Error ? err.message : 'Unknown'}`
        );
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.errors.push(
      `Rebalance failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
    return result;
  }
}

/**
 * Run rebalance for a specific player (for testing/manual triggers)
 */
export async function rebalanceSinglePlayer(playerId: string): Promise<{
  success: boolean;
  dynasty_value: number;
  adjustment_total: number;
  error?: string;
}> {
  try {
    const { season } = getCurrentSeasonWeek();

    // Get player data
    const { data: player } = await supabase
      .from('player_values')
      .select('player_name, position, base_value, fdp_value')
      .eq('player_id', playerId)
      .maybeSingle();

    if (!player) {
      return {
        success: false,
        dynasty_value: 0,
        adjustment_total: 0,
        error: 'Player not found',
      };
    }

    // Calculate trends
    const performanceTrend = await calculatePerformanceTrend(playerId, season);
    const marketTrend = await calculateMarketTrend(playerId);

    // Blend
    const blended = await blendAndApplySafety(
      playerId,
      performanceTrend,
      marketTrend,
      supabase
    );

    // Save adjustment if non-zero
    if (blended.delta !== 0) {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('dynasty_adjustments').upsert(
        {
          player_id: playerId,
          as_of_date: today,
          signal_source: 'blended',
          delta: blended.delta,
          reason: blended.reason,
          confidence: Math.max(performanceTrend.confidence, marketTrend.confidence),
        },
        {
          onConflict: 'player_id,as_of_date,signal_source',
        }
      );
    }

    // Apply adjustments
    const baseDynastyValue = player.fdp_value || player.base_value || 0;
    const { dynastyValue, adjustmentTotal } = await applyDynastyAdjustments(
      playerId,
      baseDynastyValue
    );

    // Update player value
    await supabase
      .from('player_values')
      .update({ fdp_value: dynastyValue })
      .eq('player_id', playerId);

    // Save snapshot
    await saveDynastySnapshot(playerId, dynastyValue, baseDynastyValue, adjustmentTotal);

    return {
      success: true,
      dynasty_value: dynastyValue,
      adjustment_total: adjustmentTotal,
    };
  } catch (err) {
    return {
      success: false,
      dynasty_value: 0,
      adjustment_total: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
