/**
 * Cross-Source Verification System
 *
 * Compares data across multiple sources to detect discrepancies.
 * If sources disagree beyond tolerance, batch is quarantined.
 *
 * Verifications:
 * - Stats source vs backup source
 * - Roster source vs official feed
 * - Market ranks vs previous snapshot
 */

import { supabase } from '../supabase';

interface CrossSourceResult {
  passed: boolean;
  confidence: number;
  discrepancies: Discrepancy[];
  recommendation: 'approve' | 'quarantine' | 'reject';
}

interface Discrepancy {
  type: string;
  player_id: string;
  player_name: string;
  source1: string;
  source2: string;
  value1: any;
  value2: any;
  difference: number;
}

interface PlayerComparison {
  player_id: string;
  player_name: string;
  sources: Map<string, any>;
}

/**
 * Compare market ranks across sources
 */
export async function verifyMarketRanks(
  batchId: string,
  format: string,
  toleranceThreshold: number = 0.15
): Promise<CrossSourceResult> {
  const discrepancies: Discrepancy[] = [];

  // Get current batch data
  const { data: currentBatch } = await supabase
    .from('raw_market_ranks')
    .select('*')
    .eq('batch_id', batchId)
    .eq('format', format);

  if (!currentBatch || currentBatch.length === 0) {
    return {
      passed: false,
      confidence: 0,
      discrepancies: [],
      recommendation: 'reject',
    };
  }

  const source = currentBatch[0].source;

  // Get recent validated data from other sources (last 48 hours)
  const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentData } = await supabase
    .from('validated_market_ranks')
    .select('player_id, player_name, rank_overall, confidence_score')
    .eq('format', format)
    .gte('validated_at', cutoffTime)
    .neq('source_id', batchId);

  // Group by player
  const playerMap = new Map<string, PlayerComparison>();

  currentBatch.forEach(row => {
    if (!playerMap.has(row.player_id)) {
      playerMap.set(row.player_id, {
        player_id: row.player_id,
        player_name: row.player_name,
        sources: new Map(),
      });
    }
    playerMap.get(row.player_id)!.sources.set(source, row.rank_overall);
  });

  recentData?.forEach(row => {
    if (playerMap.has(row.player_id)) {
      playerMap.get(row.player_id)!.sources.set('previous', row.rank_overall);
    }
  });

  // Compare ranks
  let totalComparisons = 0;
  let significantDiscrepancies = 0;

  playerMap.forEach((comparison, playerId) => {
    if (comparison.sources.size < 2) return;

    const currentRank = comparison.sources.get(source);
    const previousRank = comparison.sources.get('previous');

    if (currentRank && previousRank) {
      totalComparisons++;

      const difference = Math.abs(currentRank - previousRank);
      const percentChange = difference / previousRank;

      if (percentChange > toleranceThreshold) {
        significantDiscrepancies++;

        discrepancies.push({
          type: 'rank_discrepancy',
          player_id: playerId,
          player_name: comparison.player_name,
          source1: source,
          source2: 'previous',
          value1: currentRank,
          value2: previousRank,
          difference: percentChange,
        });
      }
    }
  });

  // Calculate metrics
  const discrepancyRate = totalComparisons > 0 ? significantDiscrepancies / totalComparisons : 0;
  const confidence = Math.max(0, 1 - discrepancyRate * 2);

  let recommendation: 'approve' | 'quarantine' | 'reject';
  if (discrepancyRate < 0.05) {
    recommendation = 'approve';
  } else if (discrepancyRate < 0.15) {
    recommendation = 'quarantine';
  } else {
    recommendation = 'reject';
  }

  return {
    passed: discrepancyRate < 0.05,
    confidence,
    discrepancies: discrepancies.slice(0, 50),
    recommendation,
  };
}

/**
 * Compare player stats across sources
 */
export async function verifyPlayerStats(
  batchId: string,
  week: number,
  season: number,
  toleranceThreshold: number = 0.2
): Promise<CrossSourceResult> {
  const discrepancies: Discrepancy[] = [];

  // Get current batch
  const { data: currentBatch } = await supabase
    .from('raw_player_stats')
    .select('*')
    .eq('batch_id', batchId)
    .eq('week', week)
    .eq('season', season);

  if (!currentBatch || currentBatch.length === 0) {
    return {
      passed: false,
      confidence: 0,
      discrepancies: [],
      recommendation: 'reject',
    };
  }

  const source = currentBatch[0].source;

  // Get other sources for same week
  const { data: otherSources } = await supabase
    .from('validated_player_stats')
    .select('player_id, player_name, fantasy_points, snap_share')
    .eq('week', week)
    .eq('season', season);

  // Group by player
  const playerMap = new Map<string, PlayerComparison>();

  currentBatch.forEach(row => {
    if (!playerMap.has(row.player_id)) {
      playerMap.set(row.player_id, {
        player_id: row.player_id,
        player_name: row.player_name,
        sources: new Map(),
      });
    }
    playerMap.get(row.player_id)!.sources.set(source, {
      fantasy_points: row.fantasy_points,
      snap_share: row.snap_share,
    });
  });

  otherSources?.forEach(row => {
    if (playerMap.has(row.player_id)) {
      playerMap.get(row.player_id)!.sources.set('other', {
        fantasy_points: row.fantasy_points,
        snap_share: row.snap_share,
      });
    }
  });

  // Compare stats
  let totalComparisons = 0;
  let significantDiscrepancies = 0;

  playerMap.forEach((comparison, playerId) => {
    if (comparison.sources.size < 2) return;

    const currentStats = comparison.sources.get(source);
    const otherStats = comparison.sources.get('other');

    if (currentStats && otherStats) {
      totalComparisons++;

      // Compare fantasy points
      if (currentStats.fantasy_points && otherStats.fantasy_points) {
        const fpDiff = Math.abs(currentStats.fantasy_points - otherStats.fantasy_points);
        const fpPercent = fpDiff / Math.max(otherStats.fantasy_points, 1);

        if (fpPercent > toleranceThreshold) {
          significantDiscrepancies++;

          discrepancies.push({
            type: 'fantasy_points_discrepancy',
            player_id: playerId,
            player_name: comparison.player_name,
            source1: source,
            source2: 'other',
            value1: currentStats.fantasy_points,
            value2: otherStats.fantasy_points,
            difference: fpPercent,
          });
        }
      }

      // Compare snap share
      if (currentStats.snap_share && otherStats.snap_share) {
        const snapDiff = Math.abs(currentStats.snap_share - otherStats.snap_share);

        if (snapDiff > 20) {
          discrepancies.push({
            type: 'snap_share_discrepancy',
            player_id: playerId,
            player_name: comparison.player_name,
            source1: source,
            source2: 'other',
            value1: currentStats.snap_share,
            value2: otherStats.snap_share,
            difference: snapDiff / 100,
          });
        }
      }
    }
  });

  const discrepancyRate = totalComparisons > 0 ? significantDiscrepancies / totalComparisons : 0;
  const confidence = Math.max(0, 1 - discrepancyRate * 2);

  let recommendation: 'approve' | 'quarantine' | 'reject';
  if (discrepancyRate < 0.1) {
    recommendation = 'approve';
  } else if (discrepancyRate < 0.25) {
    recommendation = 'quarantine';
  } else {
    recommendation = 'reject';
  }

  return {
    passed: discrepancyRate < 0.1,
    confidence,
    discrepancies: discrepancies.slice(0, 50),
    recommendation,
  };
}

/**
 * Check for data consistency over time
 */
export async function verifyTemporalConsistency(
  batchId: string,
  tableName: string
): Promise<CrossSourceResult> {
  const discrepancies: Discrepancy[] = [];

  // Get batch data
  const { data: batchData } = await supabase
    .from(tableName)
    .select('player_id, player_name, team, position')
    .eq('batch_id', batchId);

  if (!batchData || batchData.length === 0) {
    return {
      passed: false,
      confidence: 0,
      discrepancies: [],
      recommendation: 'reject',
    };
  }

  // Get recent player data
  const playerIds = batchData.map(p => p.player_id);
  const { data: recentData } = await supabase
    .from('nfl_players')
    .select('player_id, full_name, team, position')
    .in('player_id', playerIds);

  const recentMap = new Map(recentData?.map(p => [p.player_id, p]) || []);

  let teamChanges = 0;
  let positionChanges = 0;

  batchData.forEach(row => {
    const recent = recentMap.get(row.player_id);
    if (!recent) return;

    if (row.team && recent.team && row.team !== recent.team) {
      teamChanges++;
      discrepancies.push({
        type: 'team_change',
        player_id: row.player_id,
        player_name: row.player_name,
        source1: 'current',
        source2: 'registry',
        value1: row.team,
        value2: recent.team,
        difference: 1,
      });
    }

    if (row.position && recent.position && row.position !== recent.position) {
      positionChanges++;
      discrepancies.push({
        type: 'position_change',
        player_id: row.player_id,
        player_name: row.player_name,
        source1: 'current',
        source2: 'registry',
        value1: row.position,
        value2: recent.position,
        difference: 1,
      });
    }
  });

  const teamChangeRate = teamChanges / batchData.length;
  const positionChangeRate = positionChanges / batchData.length;

  // More than 15% team changes is suspicious
  const suspicious = teamChangeRate > 0.15 || positionChangeRate > 0.1;

  const confidence = Math.max(0, 1 - teamChangeRate * 3 - positionChangeRate * 5);

  let recommendation: 'approve' | 'quarantine' | 'reject';
  if (!suspicious) {
    recommendation = 'approve';
  } else if (teamChangeRate < 0.25) {
    recommendation = 'quarantine';
  } else {
    recommendation = 'reject';
  }

  return {
    passed: !suspicious,
    confidence,
    discrepancies: discrepancies.slice(0, 50),
    recommendation,
  };
}

/**
 * Log cross-source verification results
 */
export async function logCrossSourceResults(
  batchId: string,
  tableName: string,
  result: CrossSourceResult
): Promise<void> {
  await supabase.from('data_batch_metadata').update({
    cross_source_check_status: result.recommendation,
  }).eq('batch_id', batchId);

  if (result.discrepancies.length > 0) {
    await supabase.from('data_validation_log').insert({
      batch_id: batchId,
      table_name: tableName,
      rule_name: 'cross_source_verification',
      severity: result.passed ? 'warning' : 'error',
      affected_rows: result.discrepancies.length,
      message: `Cross-source verification found ${result.discrepancies.length} discrepancies (confidence: ${(result.confidence * 100).toFixed(1)}%)`,
      details: { discrepancies: result.discrepancies.slice(0, 20) },
    });
  }
}
