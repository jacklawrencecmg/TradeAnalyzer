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
 */

import { supabase } from '../supabase';

export interface FDPValue {
  player_id: string;
  value: number;
  tier: string;
  overall_rank: number;
  pos_rank: number;
  position: string;
  value_epoch: number;
  updated_at: string;
  league_profile_id?: string;
  format?: string;
  adjustments?: {
    injury_discount?: number;
    availability_modifier?: number;
    temporary_boost?: number;
  };
}

export interface FDPValueProvider {
  getValue(playerId: string, leagueProfileId?: string, format?: string): Promise<FDPValue | null>;
  getValuesBatch(playerIds: string[], leagueProfileId?: string, format?: string): Promise<Map<string, FDPValue>>;
}

/**
 * Get canonical FDP value for a single player
 *
 * This is the ONLY legal way to retrieve a player value.
 * Returns value from latest_player_values with applied adjustments.
 */
export async function getFDPValue(
  playerId: string,
  leagueProfileId?: string,
  format: string = 'dynasty_1qb'
): Promise<FDPValue | null> {
  try {
    const { data, error } = await supabase
      .from('latest_player_values')
      .select('*')
      .eq('player_id', playerId)
      .maybeSingle();

    if (error) {
      console.error('FDP_VALUE_QUERY_ERROR:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const adjustments = await getPlayerAdjustments(playerId);

    let adjustedValue = data.value || 0;
    if (adjustments.injury_discount) {
      adjustedValue *= (1 - adjustments.injury_discount);
    }
    if (adjustments.availability_modifier) {
      adjustedValue *= adjustments.availability_modifier;
    }
    if (adjustments.temporary_boost) {
      adjustedValue += adjustments.temporary_boost;
    }

    return {
      player_id: data.player_id,
      value: Math.round(adjustedValue),
      tier: data.tier || 'Unknown',
      overall_rank: data.overall_rank || 999,
      pos_rank: data.pos_rank || 999,
      position: data.position || 'UNK',
      value_epoch: data.value_epoch || Date.now(),
      updated_at: data.updated_at || new Date().toISOString(),
      league_profile_id: leagueProfileId,
      format,
      adjustments: Object.keys(adjustments).length > 0 ? adjustments : undefined,
    };
  } catch (error) {
    console.error('FDP_VALUE_ERROR:', error);
    return null;
  }
}

/**
 * Get canonical FDP values for multiple players (batch operation)
 *
 * More efficient than calling getFDPValue repeatedly.
 * Returns a Map for O(1) lookups.
 */
export async function getFDPValuesBatch(
  playerIds: string[],
  leagueProfileId?: string,
  format: string = 'dynasty_1qb'
): Promise<Map<string, FDPValue>> {
  const result = new Map<string, FDPValue>();

  if (playerIds.length === 0) {
    return result;
  }

  try {
    const { data, error } = await supabase
      .from('latest_player_values')
      .select('*')
      .in('player_id', playerIds);

    if (error) {
      console.error('FDP_VALUE_BATCH_ERROR:', error);
      return result;
    }

    if (!data) {
      return result;
    }

    const adjustmentsMap = await getPlayerAdjustmentsBatch(playerIds);

    for (const row of data) {
      const adjustments = adjustmentsMap.get(row.player_id) || {};

      let adjustedValue = row.value || 0;
      if (adjustments.injury_discount) {
        adjustedValue *= (1 - adjustments.injury_discount);
      }
      if (adjustments.availability_modifier) {
        adjustedValue *= adjustments.availability_modifier;
      }
      if (adjustments.temporary_boost) {
        adjustedValue += adjustments.temporary_boost;
      }

      result.set(row.player_id, {
        player_id: row.player_id,
        value: Math.round(adjustedValue),
        tier: row.tier || 'Unknown',
        overall_rank: row.overall_rank || 999,
        pos_rank: row.pos_rank || 999,
        position: row.position || 'UNK',
        value_epoch: row.value_epoch || Date.now(),
        updated_at: row.updated_at || new Date().toISOString(),
        league_profile_id: leagueProfileId,
        format,
        adjustments: Object.keys(adjustments).length > 0 ? adjustments : undefined,
      });
    }

    return result;
  } catch (error) {
    console.error('FDP_VALUE_BATCH_ERROR:', error);
    return result;
  }
}

/**
 * Create an FDP value provider for dependency injection
 *
 * Use this to inject value lookups into trade calculators, advice engines, etc.
 */
export function createFDPProvider(
  leagueProfileId?: string,
  format: string = 'dynasty_1qb'
): FDPValueProvider {
  return {
    getValue: (playerId: string) => getFDPValue(playerId, leagueProfileId, format),
    getValuesBatch: (playerIds: string[]) => getFDPValuesBatch(playerIds, leagueProfileId, format),
  };
}

/**
 * Get player adjustments (injuries, availability, temporary modifiers)
 */
async function getPlayerAdjustments(playerId: string): Promise<{
  injury_discount?: number;
  availability_modifier?: number;
  temporary_boost?: number;
}> {
  try {
    const { data } = await supabase
      .from('player_value_adjustments')
      .select('*')
      .eq('player_id', playerId)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!data) {
      return {};
    }

    return {
      injury_discount: data.injury_discount,
      availability_modifier: data.availability_modifier,
      temporary_boost: data.temporary_boost,
    };
  } catch (error) {
    return {};
  }
}

/**
 * Get adjustments for multiple players (batch)
 */
async function getPlayerAdjustmentsBatch(
  playerIds: string[]
): Promise<Map<string, any>> {
  const result = new Map();

  try {
    const { data } = await supabase
      .from('player_value_adjustments')
      .select('*')
      .in('player_id', playerIds)
      .gte('expires_at', new Date().toISOString());

    if (data) {
      for (const row of data) {
        result.set(row.player_id, {
          injury_discount: row.injury_discount,
          availability_modifier: row.availability_modifier,
          temporary_boost: row.temporary_boost,
        });
      }
    }
  } catch (error) {
    console.error('Error fetching adjustments:', error);
  }

  return result;
}

/**
 * Verify that a value matches the canonical FDP value
 * Used for runtime consistency checks
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
  const canonicalValue = await getFDPValue(playerId, leagueProfileId, format);

  if (!canonicalValue) {
    return {
      valid: false,
      canonical: 0,
      difference: claimedValue,
    };
  }

  const difference = Math.abs(claimedValue - canonicalValue.value);
  const valid = difference === 0;

  if (!valid) {
    console.warn('FDP_VALUE_MISMATCH:', {
      player_id: playerId,
      claimed: claimedValue,
      canonical: canonicalValue.value,
      difference,
    });
  }

  return {
    valid,
    canonical: canonicalValue.value,
    difference,
  };
}

/**
 * Verify multiple values (used for response validation)
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
    const canonicalValue = canonical.get(player_id);
    if (!canonicalValue) continue;

    const difference = Math.abs(value - canonicalValue.value);
    if (difference > 0) {
      mismatches.push({
        player_id,
        claimed: value,
        canonical: canonicalValue.value,
        difference,
      });

      console.warn('FDP_VALUE_MISMATCH:', {
        player_id,
        claimed: value,
        canonical: canonicalValue.value,
        difference,
      });
    }
  }

  return {
    valid: mismatches.length === 0,
    mismatches,
  };
}
