/**
 * Trade Calculator Speedup
 *
 * Batch queries instead of per-player lookups.
 * Single query per side of trade.
 *
 * Before: N queries for N players
 * After: 1 query for all players
 *
 * Target: <30ms for trade calculation
 */

import { supabase } from '../supabase';

export interface PlayerValue {
  playerId: string;
  effectiveValue: number;
  tier?: number;
  positionRank?: number;
  position?: string;
  name?: string;
}

/**
 * Get values for multiple players in single query
 *
 * This is THE critical function for trade calculator performance
 */
export async function getValuesBatch(
  playerIds: string[],
  format: 'dynasty' | 'redraft',
  leagueProfileId?: string | null
): Promise<Map<string, PlayerValue>> {
  if (playerIds.length === 0) {
    return new Map();
  }

  const startTime = Date.now();

  try {
    // Single query with WHERE IN
    let query = supabase
      .from('latest_player_values')
      .select('player_id, fdp_value, position_rank, player_position, full_name')
      .in('player_id', playerIds)
      .eq('format', format);

    if (leagueProfileId) {
      query = query.eq('league_profile_id', leagueProfileId);
    } else {
      query = query.is('league_profile_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Batch values query error:', error);
      return new Map();
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 100) {
      console.warn(`⚠️ Slow batch query: ${elapsed}ms for ${playerIds.length} players`);
    }

    // Convert to map for O(1) lookups
    const valuesMap = new Map<string, PlayerValue>();

    (data || []).forEach((row) => {
      valuesMap.set(row.player_id, {
        playerId: row.player_id,
        effectiveValue: row.fdp_value || 0,
        positionRank: row.position_rank,
        position: row.player_position,
        name: row.full_name,
      });
    });

    return valuesMap;
  } catch (error) {
    console.error('Batch values error:', error);
    return new Map();
  }
}

/**
 * Calculate trade value difference (optimized)
 */
export async function calculateTradeDiff(
  side1PlayerIds: string[],
  side2PlayerIds: string[],
  format: 'dynasty' | 'redraft',
  leagueProfileId?: string | null
): Promise<{
  side1Total: number;
  side2Total: number;
  diff: number;
  diffPercent: number;
  side1Players: PlayerValue[];
  side2Players: PlayerValue[];
}> {
  const startTime = Date.now();

  // Combine all player IDs for single batch query
  const allPlayerIds = [...side1PlayerIds, ...side2PlayerIds];

  // Single batch query
  const valuesMap = await getValuesBatch(allPlayerIds, format, leagueProfileId);

  // Calculate totals
  let side1Total = 0;
  const side1Players: PlayerValue[] = [];

  side1PlayerIds.forEach((id) => {
    const playerValue = valuesMap.get(id);
    if (playerValue) {
      side1Total += playerValue.effectiveValue;
      side1Players.push(playerValue);
    }
  });

  let side2Total = 0;
  const side2Players: PlayerValue[] = [];

  side2PlayerIds.forEach((id) => {
    const playerValue = valuesMap.get(id);
    if (playerValue) {
      side2Total += playerValue.effectiveValue;
      side2Players.push(playerValue);
    }
  });

  const diff = side1Total - side2Total;
  const diffPercent = side2Total > 0 ? (diff / side2Total) * 100 : 0;

  const elapsed = Date.now() - startTime;
  if (elapsed > 50) {
    console.warn(`⚠️ Slow trade calc: ${elapsed}ms`);
  }

  return {
    side1Total,
    side2Total,
    diff,
    diffPercent,
    side1Players,
    side2Players,
  };
}

/**
 * Get values with adjustments (batch)
 */
export async function getValuesWithAdjustmentsBatch(
  playerIds: string[],
  format: 'dynasty' | 'redraft',
  leagueProfileId?: string | null
): Promise<Map<string, PlayerValue & { adjustments: number[] }>> {
  if (playerIds.length === 0) {
    return new Map();
  }

  try {
    // Get base values
    const valuesMap = await getValuesBatch(playerIds, format, leagueProfileId);

    // Get adjustments in single query
    let adjustmentsQuery = supabase
      .from('player_value_adjustments')
      .select('player_id, adjustment_amount')
      .in('player_id', playerIds)
      .eq('format', format);

    if (leagueProfileId) {
      adjustmentsQuery = adjustmentsQuery.eq('league_profile_id', leagueProfileId);
    } else {
      adjustmentsQuery = adjustmentsQuery.is('league_profile_id', null);
    }

    const { data: adjustments } = await adjustmentsQuery;

    // Group adjustments by player
    const adjustmentsByPlayer = new Map<string, number[]>();
    (adjustments || []).forEach((adj) => {
      if (!adjustmentsByPlayer.has(adj.player_id)) {
        adjustmentsByPlayer.set(adj.player_id, []);
      }
      adjustmentsByPlayer.get(adj.player_id)!.push(adj.adjustment_amount);
    });

    // Combine values and adjustments
    const result = new Map<string, PlayerValue & { adjustments: number[] }>();

    valuesMap.forEach((value, playerId) => {
      const playerAdjustments = adjustmentsByPlayer.get(playerId) || [];
      const totalAdjustment = playerAdjustments.reduce((sum, adj) => sum + adj, 0);

      result.set(playerId, {
        ...value,
        effectiveValue: value.effectiveValue + totalAdjustment,
        adjustments: playerAdjustments,
      });
    });

    return result;
  } catch (error) {
    console.error('Batch values with adjustments error:', error);
    return new Map();
  }
}

/**
 * Get pick values (batch)
 */
export async function getPickValuesBatch(
  picks: Array<{ year: number; round: number; pick?: number }>,
  format: 'dynasty' | 'redraft'
): Promise<Map<string, number>> {
  if (picks.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await supabase
      .from('rookie_pick_values')
      .select('draft_year, round, pick_number, value')
      .eq('format', format)
      .in(
        'draft_year',
        picks.map((p) => p.year)
      );

    if (error) {
      console.error('Pick values query error:', error);
      return new Map();
    }

    const pickValues = new Map<string, number>();

    picks.forEach((pick) => {
      const matchingRow = (data || []).find(
        (row) =>
          row.draft_year === pick.year &&
          row.round === pick.round &&
          (pick.pick === undefined || row.pick_number === pick.pick)
      );

      if (matchingRow) {
        const key = `${pick.year}-${pick.round}-${pick.pick || 0}`;
        pickValues.set(key, matchingRow.value || 0);
      }
    });

    return pickValues;
  } catch (error) {
    console.error('Pick values batch error:', error);
    return new Map();
  }
}

/**
 * Validate trade (fast check)
 */
export async function validateTradeBatch(
  playerIds: string[],
  format: 'dynasty' | 'redraft'
): Promise<{
  valid: boolean;
  missingPlayers: string[];
  stalePlayers: string[];
}> {
  if (playerIds.length === 0) {
    return { valid: true, missingPlayers: [], stalePlayers: [] };
  }

  try {
    const { data } = await supabase
      .from('latest_player_values')
      .select('player_id, is_stale')
      .in('player_id', playerIds)
      .eq('format', format)
      .is('league_profile_id', null);

    const foundIds = new Set((data || []).map((row) => row.player_id));
    const missingPlayers = playerIds.filter((id) => !foundIds.has(id));
    const stalePlayers = (data || []).filter((row) => row.is_stale).map((row) => row.player_id);

    return {
      valid: missingPlayers.length === 0 && stalePlayers.length === 0,
      missingPlayers,
      stalePlayers,
    };
  } catch (error) {
    console.error('Validate trade batch error:', error);
    return { valid: false, missingPlayers: [], stalePlayers: [] };
  }
}

/**
 * Get positional value totals (for roster analysis)
 */
export async function getPositionalValueTotals(
  playerIds: string[],
  format: 'dynasty' | 'redraft'
): Promise<Record<string, number>> {
  const valuesMap = await getValuesBatch(playerIds, format);

  const totals: Record<string, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
  };

  valuesMap.forEach((value) => {
    const pos = value.position || 'UNKNOWN';
    if (totals[pos] !== undefined) {
      totals[pos] += value.effectiveValue;
    }
  });

  return totals;
}
