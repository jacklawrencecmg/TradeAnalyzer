/**
 * Canonical Value Source
 *
 * THE ONLY valid source of truth for player values in tests.
 * All endpoints MUST return values that match this source.
 *
 * Uses the same query as production getPlayerValue() but designed for testing.
 */

import { supabase } from '../supabase';

export interface CanonicalValue {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  format: string;
  league_profile_id: string | null;

  // Core value
  base_value: number;
  effective_value: number;

  // Adjustments
  scarcity_adjustment: number;
  league_adjustment: number;
  total_adjustment: number;

  // Metadata
  value_source: string;
  value_epoch: string | null;
  updated_at: string;

  // Confidence
  confidence: number;
}

export interface ValueConsistencyConfig {
  format: 'dynasty' | 'redraft';
  league_profile_id?: string;
  use_default_profile?: boolean;
}

/**
 * Fetch canonical value for a player
 * This is the ONLY source of truth for tests
 */
export async function fetchCanonicalValue(
  player_id: string,
  config: ValueConsistencyConfig
): Promise<CanonicalValue | null> {
  const { format, league_profile_id, use_default_profile = true } = config;

  // Get player identity
  const { data: player, error: playerError } = await supabase
    .from('player_identity')
    .select('player_id, full_name, position, team')
    .eq('player_id', player_id)
    .maybeSingle();

  if (playerError || !player) {
    console.error(`Player ${player_id} not found:`, playerError);
    return null;
  }

  // Get effective value (same query as production)
  let query = supabase
    .from('player_values')
    .select(`
      player_id,
      format,
      league_profile_id,
      base_value,
      fdp_value,
      scarcity_adjustment,
      league_adjustment,
      value_source,
      value_epoch,
      updated_at,
      confidence
    `)
    .eq('player_id', player_id)
    .eq('format', format);

  if (use_default_profile && !league_profile_id) {
    query = query.is('league_profile_id', null);
  } else if (league_profile_id) {
    query = query.eq('league_profile_id', league_profile_id);
  }

  const { data: value, error: valueError } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (valueError || !value) {
    console.error(`Value not found for ${player_id}:`, valueError);
    return null;
  }

  // Calculate effective value (base + adjustments)
  const scarcity_adjustment = value.scarcity_adjustment || 0;
  const league_adjustment = value.league_adjustment || 0;
  const total_adjustment = scarcity_adjustment + league_adjustment;
  const effective_value = (value.base_value || 0) + total_adjustment;

  return {
    player_id: player.player_id,
    player_name: player.full_name,
    position: player.position,
    team: player.team,
    format: value.format,
    league_profile_id: value.league_profile_id,
    base_value: value.base_value || 0,
    effective_value,
    scarcity_adjustment,
    league_adjustment,
    total_adjustment,
    value_source: value.value_source || 'unknown',
    value_epoch: value.value_epoch,
    updated_at: value.updated_at,
    confidence: value.confidence || 1.0,
  };
}

/**
 * Fetch canonical values for multiple players (batch)
 */
export async function fetchCanonicalValues(
  player_ids: string[],
  config: ValueConsistencyConfig
): Promise<Map<string, CanonicalValue>> {
  const results = new Map<string, CanonicalValue>();

  await Promise.all(
    player_ids.map(async (player_id) => {
      const value = await fetchCanonicalValue(player_id, config);
      if (value) {
        results.set(player_id, value);
      }
    })
  );

  return results;
}

/**
 * Get sample players for testing
 * Returns deterministic set of players across tiers
 */
export async function getSamplePlayers(): Promise<{
  top25: string[];
  midTier: string[];
  deep: string[];
  idp: string[];
  all: string[];
}> {
  // Get top 25 overall (highest values)
  const { data: top25Data } = await supabase
    .from('player_values')
    .select('player_id')
    .eq('format', 'dynasty')
    .is('league_profile_id', null)
    .order('base_value', { ascending: false })
    .limit(25);

  const top25 = top25Data?.map((p) => p.player_id) || [];

  // Get mid-tier (rank 100-110)
  const { data: midTierData } = await supabase
    .from('player_values')
    .select('player_id')
    .eq('format', 'dynasty')
    .is('league_profile_id', null)
    .order('base_value', { ascending: false })
    .range(99, 109);

  const midTier = midTierData?.map((p) => p.player_id) || [];

  // Get deep players (rank 500-510)
  const { data: deepData } = await supabase
    .from('player_values')
    .select('player_id')
    .eq('format', 'dynasty')
    .is('league_profile_id', null)
    .order('base_value', { ascending: false })
    .range(499, 509);

  const deep = deepData?.map((p) => p.player_id) || [];

  // Get IDP players (if any)
  const { data: idpData } = await supabase
    .from('player_identity')
    .select('player_id')
    .in('position', ['DL', 'LB', 'DB'])
    .eq('status', 'active')
    .limit(10);

  const idp = idpData?.map((p) => p.player_id) || [];

  const all = [...new Set([...top25, ...midTier, ...deep, ...idp])];

  return {
    top25,
    midTier,
    deep,
    idp,
    all,
  };
}

/**
 * Get current value epoch
 */
export async function getCurrentValueEpoch(): Promise<string | null> {
  const { data } = await supabase
    .from('player_values')
    .select('value_epoch')
    .not('value_epoch', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.value_epoch || null;
}

/**
 * Check if values are from same epoch
 */
export function isSameEpoch(epoch1: string | null, epoch2: string | null): boolean {
  if (!epoch1 || !epoch2) return false;
  return epoch1 === epoch2;
}

/**
 * Calculate value difference percentage
 */
export function calculateValueDrift(
  canonical: number,
  actual: number
): {
  drift: number;
  driftPercent: number;
  isDrifted: boolean;
} {
  const drift = Math.abs(canonical - actual);
  const driftPercent = canonical > 0 ? (drift / canonical) * 100 : 0;

  // Allow 0.01% tolerance for floating point errors
  const isDrifted = driftPercent > 0.01;

  return {
    drift,
    driftPercent,
    isDrifted,
  };
}

/**
 * Value comparison result
 */
export interface ValueComparison {
  player_id: string;
  player_name: string;
  source: string;
  canonical_value: number;
  actual_value: number;
  drift: number;
  drift_percent: number;
  matches: boolean;
  canonical_epoch: string | null;
  actual_epoch: string | null;
  epoch_matches: boolean;
}

/**
 * Compare actual value against canonical
 */
export function compareValue(
  canonical: CanonicalValue,
  actual_value: number,
  actual_epoch: string | null,
  source: string
): ValueComparison {
  const { drift, driftPercent, isDrifted } = calculateValueDrift(
    canonical.effective_value,
    actual_value
  );

  return {
    player_id: canonical.player_id,
    player_name: canonical.player_name,
    source,
    canonical_value: canonical.effective_value,
    actual_value,
    drift,
    drift_percent: driftPercent,
    matches: !isDrifted,
    canonical_epoch: canonical.value_epoch,
    actual_epoch,
    epoch_matches: isSameEpoch(canonical.value_epoch, actual_epoch),
  };
}
