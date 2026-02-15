/**
 * Market Consensus Sync Job
 *
 * Fetches external market rankings and stores them in market_player_consensus table.
 * This runs separately from the rebuild pipeline (e.g., daily cron job).
 *
 * Supported Sources:
 * - KeepTradeCut (KTC)
 * - FantasyPros
 * - Custom consensus (average of multiple sources)
 *
 * Process:
 * 1. Fetch rankings from source
 * 2. Normalize player names to nfl_players
 * 3. Store only rank (not value)
 * 4. Overwrite previous snapshot from same source
 */

import { supabase } from '../supabase';
import { resolvePlayerId } from '../players/resolvePlayerId';

export interface MarketRanking {
  player_name: string;
  position: string;
  rank: number;
  tier?: number;
}

export interface MarketSyncResult {
  source: string;
  format: 'dynasty' | 'redraft';
  imported: number;
  matched: number;
  unmatched: string[];
  errors: string[];
}

/**
 * Sync market consensus rankings
 *
 * @param source - Ranking source (ktc, fantasypros, etc.)
 * @param format - Dynasty or redraft
 * @param rankings - Array of rankings
 * @returns Sync result with statistics
 */
export async function syncMarketConsensus(
  source: string,
  format: 'dynasty' | 'redraft',
  rankings: MarketRanking[]
): Promise<MarketSyncResult> {
  const result: MarketSyncResult = {
    source,
    format,
    imported: rankings.length,
    matched: 0,
    unmatched: [],
    errors: [],
  };

  const consensusRecords: Array<{
    player_id: string;
    format: string;
    market_rank: number;
    market_tier: number | null;
    market_source: string;
  }> = [];

  // Step 1: Match players to nfl_players registry
  for (const ranking of rankings) {
    try {
      const playerId = await resolvePlayerId(ranking.player_name, ranking.position);

      if (playerId) {
        consensusRecords.push({
          player_id: playerId,
          format,
          market_rank: ranking.rank,
          market_tier: ranking.tier || null,
          market_source: source,
        });
        result.matched++;
      } else {
        result.unmatched.push(
          `${ranking.player_name} (${ranking.position}) - Rank ${ranking.rank}`
        );
      }
    } catch (error) {
      result.errors.push(
        `Error matching ${ranking.player_name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Step 2: Delete old rankings from this source
  const { error: deleteError } = await supabase
    .from('market_player_consensus')
    .delete()
    .eq('market_source', source)
    .eq('format', format);

  if (deleteError) {
    result.errors.push(`Error deleting old rankings: ${deleteError.message}`);
    return result;
  }

  // Step 3: Insert new rankings
  if (consensusRecords.length > 0) {
    const { error: insertError } = await supabase
      .from('market_player_consensus')
      .insert(consensusRecords);

    if (insertError) {
      result.errors.push(`Error inserting rankings: ${insertError.message}`);
    }
  }

  return result;
}

/**
 * Fetch KTC rankings and sync
 *
 * NOTE: This is a placeholder. Actual implementation would fetch from KTC API.
 *
 * @param format - Dynasty or redraft
 * @returns Sync result
 */
export async function syncKTCRankings(
  format: 'dynasty' | 'redraft'
): Promise<MarketSyncResult> {
  // Placeholder: In production, fetch from KTC API
  const rankings: MarketRanking[] = [];

  // TODO: Implement KTC API fetch
  // const response = await fetch('https://keeptradecut.com/api/rankings');
  // rankings = await response.json();

  return syncMarketConsensus('ktc', format, rankings);
}

/**
 * Fetch FantasyPros rankings and sync
 *
 * NOTE: This is a placeholder. Actual implementation would fetch from FP API.
 *
 * @param format - Dynasty or redraft
 * @returns Sync result
 */
export async function syncFantasyProsRankings(
  format: 'dynasty' | 'redraft'
): Promise<MarketSyncResult> {
  // Placeholder: In production, fetch from FantasyPros API
  const rankings: MarketRanking[] = [];

  // TODO: Implement FantasyPros API fetch
  // const response = await fetch('https://fantasypros.com/api/rankings');
  // rankings = await response.json();

  return syncMarketConsensus('fantasypros', format, rankings);
}

/**
 * Create consensus rankings by averaging multiple sources
 *
 * @param sources - Array of source names to average
 * @param format - Dynasty or redraft
 * @returns Sync result
 */
export async function createConsensusRankings(
  sources: string[],
  format: 'dynasty' | 'redraft'
): Promise<MarketSyncResult> {
  // Step 1: Fetch rankings from all sources
  const { data: allRankings, error } = await supabase
    .from('market_player_consensus')
    .select('player_id, market_rank, market_source')
    .eq('format', format)
    .in('market_source', sources);

  if (error || !allRankings) {
    return {
      source: 'consensus',
      format,
      imported: 0,
      matched: 0,
      unmatched: [],
      errors: [error?.message || 'No rankings found'],
    };
  }

  // Step 2: Group by player and average ranks
  const playerRanks = new Map<string, number[]>();

  for (const ranking of allRankings) {
    if (!playerRanks.has(ranking.player_id)) {
      playerRanks.set(ranking.player_id, []);
    }
    playerRanks.get(ranking.player_id)!.push(ranking.market_rank);
  }

  // Step 3: Calculate average rank for each player
  const consensusRankings: Array<{
    player_id: string;
    format: string;
    market_rank: number;
    market_tier: number | null;
    market_source: string;
  }> = [];

  for (const [playerId, ranks] of playerRanks.entries()) {
    const avgRank = Math.round(ranks.reduce((sum, r) => sum + r, 0) / ranks.length);
    consensusRankings.push({
      player_id: playerId,
      format,
      market_rank: avgRank,
      market_tier: null,
      market_source: 'consensus',
    });
  }

  // Step 4: Sort by rank and reassign sequential ranks
  consensusRankings.sort((a, b) => a.market_rank - b.market_rank);
  consensusRankings.forEach((record, index) => {
    record.market_rank = index + 1;
  });

  // Step 5: Delete old consensus rankings
  const { error: deleteError } = await supabase
    .from('market_player_consensus')
    .delete()
    .eq('market_source', 'consensus')
    .eq('format', format);

  if (deleteError) {
    return {
      source: 'consensus',
      format,
      imported: 0,
      matched: 0,
      unmatched: [],
      errors: [`Error deleting old consensus: ${deleteError.message}`],
    };
  }

  // Step 6: Insert new consensus rankings
  const { error: insertError } = await supabase
    .from('market_player_consensus')
    .insert(consensusRankings);

  if (insertError) {
    return {
      source: 'consensus',
      format,
      imported: consensusRankings.length,
      matched: consensusRankings.length,
      unmatched: [],
      errors: [`Error inserting consensus: ${insertError.message}`],
    };
  }

  return {
    source: 'consensus',
    format,
    imported: consensusRankings.length,
    matched: consensusRankings.length,
    unmatched: [],
    errors: [],
  };
}

/**
 * Import rankings from CSV file
 *
 * Expected CSV format:
 * player_name,position,rank
 *
 * @param source - Source name
 * @param format - Dynasty or redraft
 * @param csvContent - CSV file content
 * @returns Sync result
 */
export function importRankingsFromCsv(
  source: string,
  format: 'dynasty' | 'redraft',
  csvContent: string
): Promise<MarketSyncResult> {
  const rankings: MarketRanking[] = [];

  // Parse CSV
  const lines = csvContent.split('\n');
  const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());

  const nameIndex = headers.findIndex((h) => h.includes('name'));
  const posIndex = headers.findIndex((h) => h.includes('pos'));
  const rankIndex = headers.findIndex((h) => h.includes('rank'));

  if (nameIndex === -1 || posIndex === -1 || rankIndex === -1) {
    return Promise.resolve({
      source,
      format,
      imported: 0,
      matched: 0,
      unmatched: [],
      errors: ['Invalid CSV format: must have name, position, and rank columns'],
    });
  }

  // Parse each row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',').map((c) => c.trim());

    if (columns.length >= 3) {
      rankings.push({
        player_name: columns[nameIndex],
        position: columns[posIndex],
        rank: parseInt(columns[rankIndex], 10),
      });
    }
  }

  return syncMarketConsensus(source, format, rankings);
}

/**
 * Get latest sync status for all sources
 *
 * @param format - Dynasty or redraft
 * @returns Array of sync statuses
 */
export async function getMarketSyncStatus(
  format: 'dynasty' | 'redraft'
): Promise<
  Array<{
    source: string;
    playerCount: number;
    lastSync: string | null;
  }>
> {
  const { data, error } = await supabase
    .from('market_player_consensus')
    .select('market_source, captured_at')
    .eq('format', format)
    .order('captured_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  // Group by source
  const statusMap = new Map<
    string,
    { count: number; lastSync: string | null }
  >();

  for (const record of data) {
    if (!statusMap.has(record.market_source)) {
      statusMap.set(record.market_source, {
        count: 0,
        lastSync: record.captured_at,
      });
    }
    const status = statusMap.get(record.market_source)!;
    status.count++;
  }

  return Array.from(statusMap.entries()).map(([source, status]) => ({
    source,
    playerCount: status.count,
    lastSync: status.lastSync,
  }));
}

/**
 * Validate market rankings
 *
 * Checks for common issues like duplicate ranks, missing positions, etc.
 *
 * @param source - Source to validate
 * @param format - Dynasty or redraft
 * @returns Validation result
 */
export async function validateMarketRankings(
  source: string,
  format: 'dynasty' | 'redraft'
): Promise<{
  valid: boolean;
  warnings: string[];
  stats: {
    totalPlayers: number;
    duplicateRanks: number;
    missingTiers: number;
    positionBreakdown: Record<string, number>;
  };
}> {
  const warnings: string[] = [];

  // Fetch rankings
  const { data: rankings, error } = await supabase
    .from('latest_market_consensus')
    .select('market_rank, market_tier, position')
    .eq('market_source', source)
    .eq('format', format);

  if (error || !rankings) {
    return {
      valid: false,
      warnings: ['Failed to fetch rankings'],
      stats: {
        totalPlayers: 0,
        duplicateRanks: 0,
        missingTiers: 0,
        positionBreakdown: {},
      },
    };
  }

  // Check for duplicate ranks
  const rankCounts = new Map<number, number>();
  for (const ranking of rankings) {
    rankCounts.set(ranking.market_rank, (rankCounts.get(ranking.market_rank) || 0) + 1);
  }

  const duplicateRanks = Array.from(rankCounts.values()).filter((count) => count > 1).length;

  if (duplicateRanks > 0) {
    warnings.push(`Found ${duplicateRanks} duplicate ranks`);
  }

  // Check for missing tiers
  const missingTiers = rankings.filter((r) => r.market_tier === null).length;

  if (missingTiers > rankings.length * 0.5) {
    warnings.push(`${missingTiers} players missing tier data`);
  }

  // Position breakdown
  const positionBreakdown: Record<string, number> = {};
  for (const ranking of rankings) {
    positionBreakdown[ranking.position] = (positionBreakdown[ranking.position] || 0) + 1;
  }

  // Check position distribution
  const qbCount = positionBreakdown.QB || 0;
  const rbCount = positionBreakdown.RB || 0;
  const wrCount = positionBreakdown.WR || 0;
  const teCount = positionBreakdown.TE || 0;

  if (qbCount < 10) {
    warnings.push(`Only ${qbCount} QBs ranked (expected 30+)`);
  }

  if (rbCount < 20) {
    warnings.push(`Only ${rbCount} RBs ranked (expected 50+)`);
  }

  if (wrCount < 30) {
    warnings.push(`Only ${wrCount} WRs ranked (expected 80+)`);
  }

  if (teCount < 10) {
    warnings.push(`Only ${teCount} TEs ranked (expected 20+)`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
    stats: {
      totalPlayers: rankings.length,
      duplicateRanks,
      missingTiers,
      positionBreakdown,
    },
  };
}

/**
 * Sync all market sources
 *
 * Convenience function to sync multiple sources.
 *
 * @param format - Dynasty or redraft
 * @returns Array of sync results
 */
export async function syncAllMarketSources(
  format: 'dynasty' | 'redraft'
): Promise<MarketSyncResult[]> {
  const results: MarketSyncResult[] = [];

  // Sync KTC
  try {
    const ktcResult = await syncKTCRankings(format);
    results.push(ktcResult);
  } catch (error) {
    results.push({
      source: 'ktc',
      format,
      imported: 0,
      matched: 0,
      unmatched: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    });
  }

  // Sync FantasyPros
  try {
    const fpResult = await syncFantasyProsRankings(format);
    results.push(fpResult);
  } catch (error) {
    results.push({
      source: 'fantasypros',
      format,
      imported: 0,
      matched: 0,
      unmatched: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    });
  }

  // Create consensus from both sources
  try {
    const consensusResult = await createConsensusRankings(['ktc', 'fantasypros'], format);
    results.push(consensusResult);
  } catch (error) {
    results.push({
      source: 'consensus',
      format,
      imported: 0,
      matched: 0,
      unmatched: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    });
  }

  return results;
}
