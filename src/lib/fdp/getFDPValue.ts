/**
 * FDP CANONICAL VALUE INTERFACE
 *
 * FDP values are the single source of truth for all player valuation.
 * Any computation outside this module is a bug.
 *
 * This module is the ONLY legal entry point for player values.
 * All features, exports, calculations, and displays MUST use these functions.
 *
 * NO direct database queries to value tables are allowed elsewhere.
 * NO fallback math or hidden recalculations are permitted.
 * NO future features can bypass this interface.
 *
 * TYPE SAFETY ENFORCEMENT:
 * - FDPValueBundle uses branded types (FDPValue, FDPTier, FDPRank)
 * - UI cannot render raw numbers as values
 * - TypeScript errors if non-FDP values are used
 * - Only this module can create branded types
 */

import { supabase } from '../supabase';
import type { FDPValueBundle, FDPValueMap, FDPProvider } from './types';
import { createFDPBundle, createFDPBundles } from './brand';

export type { FDPValueBundle, FDPValueMap, FDPProvider } from './types';

/**
 * Get canonical FDP value for a single player
 *
 * This is the ONLY legal way to retrieve a player value.
 * Returns branded FDPValueBundle that cannot be constructed from raw numbers.
 *
 * @returns FDPValueBundle with branded types or null if not found
 */
export async function getFDPValue(
  playerId: string,
  leagueProfileId?: string,
  format: string = 'dynasty_1qb'
): Promise<FDPValueBundle | null> {
  try {
    const { data, error } = await supabase
      .from('latest_player_values')
      .select('*')
      .eq('player_id', playerId)
      .eq('format', format)
      .maybeSingle();

    if (error) {
      console.error('FDP_VALUE_QUERY_ERROR:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return createFDPBundle({
      player_id: data.player_id,
      player_name: data.player_name || 'Unknown',
      position: data.position || 'UNK',
      team: data.team,
      base_value: data.base_value || 0,
      adjusted_value: data.adjusted_value || data.base_value || 0,
      market_value: data.market_value || data.base_value || 0,
      tier: data.tier || '5',
      rank_overall: data.rank_overall || 999,
      rank_position: data.rank_position || 999,
      value_epoch_id: data.value_epoch_id || crypto.randomUUID(),
      updated_at: data.updated_at || new Date().toISOString(),
      league_profile_id: leagueProfileId,
      format,
    });
  } catch (error) {
    console.error('FDP_VALUE_ERROR:', error);
    return null;
  }
}

/**
 * Get canonical FDP values for multiple players (batch operation)
 *
 * More efficient than calling getFDPValue repeatedly.
 * Returns FDPValueMap with branded types for O(1) lookups.
 *
 * @returns Map of player_id to FDPValueBundle with branded types
 */
export async function getFDPValuesBatch(
  playerIds: string[],
  leagueProfileId?: string,
  format: string = 'dynasty_1qb'
): Promise<FDPValueMap> {
  if (playerIds.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await supabase
      .from('latest_player_values')
      .select('*')
      .in('player_id', playerIds)
      .eq('format', format);

    if (error) {
      console.error('FDP_VALUE_BATCH_ERROR:', error);
      return new Map();
    }

    if (!data) {
      return new Map();
    }

    const rawResponses = data.map(row => ({
      player_id: row.player_id,
      player_name: row.player_name || 'Unknown',
      position: row.position || 'UNK',
      team: row.team,
      base_value: row.base_value || 0,
      adjusted_value: row.adjusted_value || row.base_value || 0,
      market_value: row.market_value || row.base_value || 0,
      tier: row.tier || '5',
      rank_overall: row.rank_overall || 999,
      rank_position: row.rank_position || 999,
      value_epoch_id: row.value_epoch_id || crypto.randomUUID(),
      updated_at: row.updated_at || new Date().toISOString(),
      league_profile_id: leagueProfileId,
      format,
    }));

    return createFDPBundles(rawResponses);
  } catch (error) {
    console.error('FDP_VALUE_BATCH_ERROR:', error);
    return new Map();
  }
}

/**
 * Create an FDP value provider for dependency injection
 *
 * Use this to inject value lookups into trade calculators, advice engines, etc.
 * Engines should accept FDPProvider, not raw numbers.
 *
 * @example
 * const provider = createFDPProvider(leagueId, 'dynasty_superflex');
 * const tradeResult = await evaluateTrade(trade, provider);
 */
export function createFDPProvider(
  leagueProfileId?: string,
  format: string = 'dynasty_1qb'
): FDPProvider {
  return {
    getValue: (playerId: string) => getFDPValue(playerId, leagueProfileId, format),
    getValues: (playerIds: string[]) => getFDPValuesBatch(playerIds, leagueProfileId, format),
    getLeagueProfile: () => ({ league_profile_id: leagueProfileId || null, format }),
  };
}

/**
 * Verify that a value matches the canonical FDP value
 * Used for runtime consistency checks
 *
 * Note: Accepts raw number for verification, but compares against branded canonical
 */
export async function verifyFDPValue(
  playerId: string,
  claimedValue: number,
  leagueProfileId?: string,
  format?: string
): Promise<{
  valid: boolean;
  canonical: number;
  difference: number;
}> {
  const canonicalBundle = await getFDPValue(playerId, leagueProfileId, format);

  if (!canonicalBundle) {
    return {
      valid: false,
      canonical: 0,
      difference: claimedValue,
    };
  }

  const canonicalNum = canonicalBundle.value as number;
  const difference = Math.abs(claimedValue - canonicalNum);
  const valid = difference === 0;

  if (!valid) {
    console.warn('FDP_VALUE_MISMATCH:', {
      player_id: playerId,
      claimed: claimedValue,
      canonical: canonicalNum,
      difference,
    });
  }

  return {
    valid,
    canonical: canonicalNum,
    difference,
  };
}

/**
 * Verify multiple values (used for response validation)
 *
 * Note: Accepts raw numbers for verification, but compares against branded canonical
 */
export async function verifyFDPValuesBatch(
  values: Array<{ player_id: string; value: number }>,
  leagueProfileId?: string,
  format?: string
): Promise<{
  valid: boolean;
  mismatches: Array<{
    player_id: string;
    claimed: number;
    canonical: number;
    difference: number;
  }>;
}> {
  const playerIds = values.map(v => v.player_id);
  const canonical = await getFDPValuesBatch(playerIds, leagueProfileId, format);

  const mismatches = [];

  for (const { player_id, value } of values) {
    const canonicalBundle = canonical.get(player_id);
    if (!canonicalBundle) continue;

    const canonicalNum = canonicalBundle.value as number;
    const difference = Math.abs(value - canonicalNum);
    if (difference > 0) {
      mismatches.push({
        player_id,
        claimed: value,
        canonical: canonicalNum,
        difference,
      });

      console.warn('FDP_VALUE_MISMATCH:', {
        player_id,
        claimed: value,
        canonical: canonicalNum,
        difference,
      });
    }
  }

  return {
    valid: mismatches.length === 0,
    mismatches,
  };
}
