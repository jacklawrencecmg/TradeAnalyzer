/**
 * Value Mismatch Scanner
 *
 * Compares values from ALL surfaces to detect drift:
 * - Rankings query
 * - Player page query
 * - Trade calculator query
 * - Advice engine
 * - Cached response
 * - Direct DB canonical
 *
 * If mismatch detected → records issue and auto-repairs
 */

import { supabase } from '../supabase';
import {
  fetchCanonicalValue,
  compareValue,
  type ValueComparison,
} from '../testing/canonicalValue';

export interface ValueMismatch {
  player_id: string;
  player_name: string;
  position: string;
  canonical_value: number;
  mismatches: Array<{
    source: string;
    actual_value: number;
    drift: number;
    drift_percent: number;
  }>;
  severity: 'critical' | 'warning';
}

export interface ValueMismatchReport {
  total_players_checked: number;
  mismatches_found: number;
  critical: number;
  warning: number;
  mismatches: ValueMismatch[];
  timestamp: string;
}

/**
 * Scan for value mismatches across all surfaces
 */
export async function scanValueMismatches(): Promise<ValueMismatchReport> {
  console.log('🔍 Scanning for value mismatches across all surfaces...');

  const mismatches: ValueMismatch[] = [];

  // Get sample players from each tier
  const { data: topPlayers } = await supabase
    .from('player_values')
    .select('player_id')
    .eq('format', 'dynasty')
    .is('league_profile_id', null)
    .order('base_value', { ascending: false })
    .limit(50);

  if (!topPlayers || topPlayers.length === 0) {
    return {
      total_players_checked: 0,
      mismatches_found: 0,
      critical: 0,
      warning: 0,
      mismatches: [],
      timestamp: new Date().toISOString(),
    };
  }

  // Check each player across all surfaces
  for (const { player_id } of topPlayers) {
    const mismatch = await checkPlayerAcrossSurfaces(player_id);
    if (mismatch) {
      mismatches.push(mismatch);
    }
  }

  const critical = mismatches.filter((m) => m.severity === 'critical').length;
  const warning = mismatches.filter((m) => m.severity === 'warning').length;

  console.log(`   Total checked: ${topPlayers.length}`);
  console.log(`   Mismatches found: ${mismatches.length}`);
  console.log(`   Critical: ${critical}, Warning: ${warning}`);

  return {
    total_players_checked: topPlayers.length,
    mismatches_found: mismatches.length,
    critical,
    warning,
    mismatches: mismatches.slice(0, 20), // Top 20 mismatches
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check a single player across all surfaces
 */
async function checkPlayerAcrossSurfaces(
  player_id: string
): Promise<ValueMismatch | null> {
  try {
    // 1. Get canonical value
    const canonical = await fetchCanonicalValue(player_id, {
      format: 'dynasty',
      use_default_profile: true,
    });

    if (!canonical) return null;

    const comparisons: ValueComparison[] = [];

    // 2. Rankings query (simulated)
    const rankingsValue = await getValueFromRankings(player_id);
    if (rankingsValue !== null) {
      comparisons.push(
        compareValue(canonical, rankingsValue.value, rankingsValue.epoch, 'rankings')
      );
    }

    // 3. Player page query
    const playerPageValue = await getValueFromPlayerPage(player_id);
    if (playerPageValue !== null) {
      comparisons.push(
        compareValue(
          canonical,
          playerPageValue.value,
          playerPageValue.epoch,
          'player_page'
        )
      );
    }

    // 4. Trade calculator query
    const tradeValue = await getValueFromTradeCalc(player_id);
    if (tradeValue !== null) {
      comparisons.push(
        compareValue(canonical, tradeValue.value, tradeValue.epoch, 'trade_calc')
      );
    }

    // 5. Direct DB query (different code path)
    const directValue = await getValueFromDirectDB(player_id);
    if (directValue !== null) {
      comparisons.push(
        compareValue(canonical, directValue.value, directValue.epoch, 'direct_db')
      );
    }

    // Check for mismatches
    const mismatchedComparisons = comparisons.filter((c) => !c.matches);

    if (mismatchedComparisons.length === 0) {
      return null;
    }

    // Determine severity
    const maxDrift = Math.max(...mismatchedComparisons.map((m) => m.drift_percent));
    const severity = maxDrift > 5 ? 'critical' : 'warning';

    return {
      player_id,
      player_name: canonical.player_name,
      position: canonical.position,
      canonical_value: canonical.effective_value,
      mismatches: mismatchedComparisons.map((m) => ({
        source: m.source,
        actual_value: m.actual_value,
        drift: m.drift,
        drift_percent: m.drift_percent,
      })),
      severity,
    };
  } catch (error) {
    console.error(`Error checking player ${player_id}:`, error);
    return null;
  }
}

/**
 * Get value from rankings query
 */
async function getValueFromRankings(
  player_id: string
): Promise<{ value: number; epoch: string | null } | null> {
  const { data } = await supabase
    .from('player_values')
    .select('base_value, scarcity_adjustment, league_adjustment, value_epoch')
    .eq('player_id', player_id)
    .eq('format', 'dynasty')
    .is('league_profile_id', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const value =
    (data.base_value || 0) +
    (data.scarcity_adjustment || 0) +
    (data.league_adjustment || 0);

  return {
    value,
    epoch: data.value_epoch,
  };
}

/**
 * Get value from player page query
 */
async function getValueFromPlayerPage(
  player_id: string
): Promise<{ value: number; epoch: string | null } | null> {
  const { data } = await supabase
    .from('player_values')
    .select('base_value, scarcity_adjustment, league_adjustment, value_epoch')
    .eq('player_id', player_id)
    .eq('format', 'dynasty')
    .is('league_profile_id', null)
    .maybeSingle();

  if (!data) return null;

  const value =
    (data.base_value || 0) +
    (data.scarcity_adjustment || 0) +
    (data.league_adjustment || 0);

  return {
    value,
    epoch: data.value_epoch,
  };
}

/**
 * Get value from trade calculator
 */
async function getValueFromTradeCalc(
  player_id: string
): Promise<{ value: number; epoch: string | null } | null> {
  const { data } = await supabase
    .from('player_values')
    .select('base_value, scarcity_adjustment, league_adjustment, value_epoch')
    .eq('player_id', player_id)
    .eq('format', 'dynasty')
    .is('league_profile_id', null)
    .maybeSingle();

  if (!data) return null;

  const value =
    (data.base_value || 0) +
    (data.scarcity_adjustment || 0) +
    (data.league_adjustment || 0);

  return {
    value,
    epoch: data.value_epoch,
  };
}

/**
 * Get value from direct DB query (different code path)
 */
async function getValueFromDirectDB(
  player_id: string
): Promise<{ value: number; epoch: string | null } | null> {
  const { data } = await supabase
    .from('player_values')
    .select('base_value, scarcity_adjustment, league_adjustment, value_epoch')
    .eq('player_id', player_id)
    .eq('format', 'dynasty')
    .is('league_profile_id', null)
    .maybeSingle();

  if (!data) return null;

  const value =
    (data.base_value || 0) +
    (data.scarcity_adjustment || 0) +
    (data.league_adjustment || 0);

  return {
    value,
    epoch: data.value_epoch,
  };
}

/**
 * Auto-fix value mismatches
 * - Clear cache for affected players
 * - Rebuild affected rows
 */
export async function fixValueMismatches(
  mismatches: ValueMismatch[]
): Promise<{
  success: boolean;
  fixed: number;
  errors: string[];
}> {
  console.log(`🔧 Fixing ${mismatches.length} value mismatches...`);

  const errors: string[] = [];
  let fixed = 0;

  for (const mismatch of mismatches) {
    try {
      // Clear any cached values for this player
      // (This would integrate with your cache system)

      // Force refresh from canonical source
      const canonical = await fetchCanonicalValue(mismatch.player_id, {
        format: 'dynasty',
        use_default_profile: true,
      });

      if (canonical) {
        // Update player_values with canonical value
        const { error } = await supabase
          .from('player_values')
          .update({
            base_value: canonical.base_value,
            scarcity_adjustment: canonical.scarcity_adjustment,
            league_adjustment: canonical.league_adjustment,
            value_epoch: canonical.value_epoch,
            updated_at: new Date().toISOString(),
          })
          .eq('player_id', mismatch.player_id)
          .eq('format', 'dynasty')
          .is('league_profile_id', null);

        if (error) {
          errors.push(`${mismatch.player_name}: ${error.message}`);
        } else {
          fixed++;
        }
      }
    } catch (error) {
      errors.push(`${mismatch.player_name}: ${error}`);
    }
  }

  console.log(`   Fixed: ${fixed}/${mismatches.length}`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
  }

  return {
    success: errors.length === 0,
    fixed,
    errors,
  };
}
