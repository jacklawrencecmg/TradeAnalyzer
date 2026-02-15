/**
 * Market Drift Detector
 *
 * Detects when model rankings drift too far from market consensus.
 * Prevents bad ingests from corrupting rankings.
 *
 * Logic:
 * avg_rank_difference = avg(|model_rank - market_rank|)
 * if avg_rank_difference > 85 → WARNING
 * if avg_rank_difference > 140 → CRITICAL
 */

import { supabase } from '../supabase';

export interface DriftResult {
  passed: boolean;
  status: 'ok' | 'warning' | 'critical';
  avgDrift: number;
  maxDrift: number;
  playersChecked: number;
  topDrifters: Array<{
    playerId: string;
    playerName: string;
    modelRank: number;
    marketRank: number;
    drift: number;
  }>;
  message: string;
}

const DRIFT_THRESHOLDS = {
  warningThreshold: 85,
  criticalThreshold: 140,
  maxAcceptableDrift: 200, // Individual player max drift
};

/**
 * Detect market drift
 *
 * Compares model rankings vs market consensus (KTC)
 */
export async function detectMarketDrift(
  format: 'dynasty' | 'redraft' = 'dynasty'
): Promise<DriftResult> {
  try {
    // Get players with both model rank and market rank
    const { data: players } = await supabase
      .from('player_values')
      .select(
        `
        player_id,
        fdp_value,
        market_rank,
        nfl_players!player_values_player_id_fkey (
          full_name
        )
      `
      )
      .eq('format', format)
      .not('market_rank', 'is', null)
      .not('fdp_value', 'is', null)
      .order('fdp_value', { ascending: false })
      .limit(500); // Check top 500 players

    if (!players || players.length === 0) {
      return {
        passed: false,
        status: 'critical',
        avgDrift: 0,
        maxDrift: 0,
        playersChecked: 0,
        topDrifters: [],
        message: 'No players with both model and market ranks found',
      };
    }

    // Calculate model ranks (rank by fdp_value)
    const rankedPlayers = players.map((p, index) => ({
      playerId: p.player_id,
      playerName: (p.nfl_players as any)?.full_name || 'Unknown',
      modelRank: index + 1,
      marketRank: p.market_rank,
      drift: Math.abs(index + 1 - p.market_rank),
    }));

    // Calculate statistics
    const avgDrift = rankedPlayers.reduce((sum, p) => sum + p.drift, 0) / rankedPlayers.length;
    const maxDrift = Math.max(...rankedPlayers.map((p) => p.drift));

    // Get top 10 drifters
    const topDrifters = [...rankedPlayers]
      .sort((a, b) => b.drift - a.drift)
      .slice(0, 10)
      .map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        modelRank: p.modelRank,
        marketRank: p.marketRank,
        drift: p.drift,
      }));

    // Determine status
    let status: 'ok' | 'warning' | 'critical' = 'ok';
    let message = `Average rank drift: ${avgDrift.toFixed(1)} positions`;

    if (avgDrift > DRIFT_THRESHOLDS.criticalThreshold) {
      status = 'critical';
      message = `CRITICAL: Average rank drift of ${avgDrift.toFixed(1)} positions exceeds critical threshold (${DRIFT_THRESHOLDS.criticalThreshold})`;
    } else if (avgDrift > DRIFT_THRESHOLDS.warningThreshold) {
      status = 'warning';
      message = `WARNING: Average rank drift of ${avgDrift.toFixed(1)} positions exceeds warning threshold (${DRIFT_THRESHOLDS.warningThreshold})`;
    }

    const result: DriftResult = {
      passed: avgDrift <= DRIFT_THRESHOLDS.warningThreshold,
      status,
      avgDrift: Math.round(avgDrift * 10) / 10,
      maxDrift,
      playersChecked: rankedPlayers.length,
      topDrifters,
      message,
    };

    // Record health check
    await recordDriftCheck(status, result);

    return result;
  } catch (error) {
    console.error('Error detecting market drift:', error);

    await recordDriftCheck('critical', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      passed: false,
      status: 'critical',
      avgDrift: 0,
      maxDrift: 0,
      playersChecked: 0,
      topDrifters: [],
      message: 'Drift detection failed with error',
    };
  }
}

/**
 * Record drift check result
 */
async function recordDriftCheck(status: 'ok' | 'warning' | 'critical', details: any) {
  try {
    await supabase.from('system_health_checks').insert({
      check_name: 'market_drift',
      status,
      meta: details,
      checked_at: new Date().toISOString(),
    });

    // If critical, create alert
    if (status === 'critical') {
      await supabase.from('system_alerts').insert({
        severity: 'critical',
        message: `Market drift exceeded critical threshold`,
        alert_type: 'market_drift_critical',
        metadata: details,
      });
    }
  } catch (error) {
    console.error('Error recording drift check:', error);
  }
}

/**
 * Detect drift for specific player
 */
export async function getPlayerDrift(
  playerId: string,
  format: 'dynasty' | 'redraft' = 'dynasty'
): Promise<{
  modelRank: number;
  marketRank: number;
  drift: number;
  driftPercent: number;
} | null> {
  try {
    // Get player's model rank
    const { data: allPlayers } = await supabase
      .from('player_values')
      .select('player_id, fdp_value')
      .eq('format', format)
      .not('fdp_value', 'is', null)
      .order('fdp_value', { ascending: false });

    if (!allPlayers) return null;

    const modelRank = allPlayers.findIndex((p) => p.player_id === playerId) + 1;

    if (modelRank === 0) return null;

    // Get player's market rank
    const { data: player } = await supabase
      .from('player_values')
      .select('market_rank')
      .eq('player_id', playerId)
      .eq('format', format)
      .maybeSingle();

    if (!player || !player.market_rank) return null;

    const drift = Math.abs(modelRank - player.market_rank);
    const driftPercent = (drift / player.market_rank) * 100;

    return {
      modelRank,
      marketRank: player.market_rank,
      drift,
      driftPercent: Math.round(driftPercent * 10) / 10,
    };
  } catch (error) {
    console.error('Error getting player drift:', error);
    return null;
  }
}

/**
 * Get drift history (trend over time)
 */
export async function getDriftHistory(days: number = 7): Promise<
  Array<{
    date: string;
    avgDrift: number;
    status: string;
  }>
> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data: checks } = await supabase
      .from('system_health_checks')
      .select('status, meta, checked_at')
      .eq('check_name', 'market_drift')
      .gte('checked_at', startDate.toISOString())
      .order('checked_at', { ascending: true });

    if (!checks) return [];

    return checks.map((check) => ({
      date: check.checked_at,
      avgDrift: check.meta.avgDrift || 0,
      status: check.status,
    }));
  } catch (error) {
    console.error('Error getting drift history:', error);
    return [];
  }
}

/**
 * Detect sudden drift spike
 *
 * Compares current drift to recent average
 */
export async function detectDriftSpike(): Promise<{
  hasSpike: boolean;
  currentDrift: number;
  recentAverage: number;
  changePercent: number;
}> {
  try {
    // Get current drift
    const current = await detectMarketDrift();

    // Get recent average (last 7 days)
    const history = await getDriftHistory(7);

    if (history.length < 2) {
      return {
        hasSpike: false,
        currentDrift: current.avgDrift,
        recentAverage: current.avgDrift,
        changePercent: 0,
      };
    }

    const recentAverage = history.reduce((sum, h) => sum + h.avgDrift, 0) / history.length;

    const changePercent = ((current.avgDrift - recentAverage) / recentAverage) * 100;

    const hasSpike = changePercent > 50; // 50% increase = spike

    if (hasSpike) {
      // Create alert
      await supabase.from('system_alerts').insert({
        severity: 'warning',
        message: `Market drift spike detected: ${changePercent.toFixed(1)}% increase`,
        alert_type: 'drift_spike',
        metadata: {
          currentDrift: current.avgDrift,
          recentAverage,
          changePercent,
        },
      });
    }

    return {
      hasSpike,
      currentDrift: current.avgDrift,
      recentAverage: Math.round(recentAverage * 10) / 10,
      changePercent: Math.round(changePercent * 10) / 10,
    };
  } catch (error) {
    console.error('Error detecting drift spike:', error);
    return {
      hasSpike: false,
      currentDrift: 0,
      recentAverage: 0,
      changePercent: 0,
    };
  }
}

/**
 * Get latest drift check
 */
export async function getLatestDriftCheck(): Promise<DriftResult | null> {
  try {
    const { data: check } = await supabase
      .from('system_health_checks')
      .select('status, meta, checked_at')
      .eq('check_name', 'market_drift')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!check || !check.meta) return null;

    return {
      passed: check.status === 'ok',
      status: check.status as 'ok' | 'warning' | 'critical',
      avgDrift: check.meta.avgDrift || 0,
      maxDrift: check.meta.maxDrift || 0,
      playersChecked: check.meta.playersChecked || 0,
      topDrifters: check.meta.topDrifters || [],
      message: check.meta.message || '',
    };
  } catch (error) {
    console.error('Error getting latest drift check:', error);
    return null;
  }
}
