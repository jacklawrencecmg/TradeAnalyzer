/**
 * FDP Value Drift Detection for Doctor Mode
 *
 * Scans endpoints, compares canonical vs served values
 * Auto-repairs cache if drift detected
 */

import { supabase } from '../supabase';
import { getFDPValuesBatch, verifyFDPValuesBatch } from '../fdp/getFDPValue';

export interface DriftCheckResult {
  passed: boolean;
  scannedPlayers: number;
  driftDetected: number;
  cacheInvalidated: number;
  errors: Array<{
    player_id: string;
    expected: number;
    actual: number;
    difference: number;
    source: string;
  }>;
}

/**
 * Check for value drift across all cached values
 */
export async function checkFDPValueDrift(): Promise<DriftCheckResult> {
  const result: DriftCheckResult = {
    passed: true,
    scannedPlayers: 0,
    driftDetected: 0,
    cacheInvalidated: 0,
    errors: [],
  };

  try {
    const { data: cachedValues, error } = await supabase
      .from('latest_player_values')
      .select('player_id, adjusted_value')
      .limit(100);

    if (error || !cachedValues) {
      console.error('Failed to fetch cached values:', error);
      return result;
    }

    result.scannedPlayers = cachedValues.length;

    const playerIds = cachedValues.map(v => v.player_id);
    const canonicalValues = await getFDPValuesBatch(playerIds);

    for (const cached of cachedValues) {
      const canonical = canonicalValues.get(cached.player_id);

      if (!canonical) continue;

      const cachedValue = cached.adjusted_value || 0;
      const difference = Math.abs(cachedValue - canonical.value);

      if (difference > 0) {
        result.driftDetected++;
        result.passed = false;

        result.errors.push({
          player_id: cached.player_id,
          expected: canonical.value,
          actual: cachedValue,
          difference,
          source: 'cache',
        });
      }
    }

    if (result.driftDetected > 0) {
      console.warn('FDP_DRIFT_DETECTED:', {
        scanned: result.scannedPlayers,
        drift: result.driftDetected,
        percentage: ((result.driftDetected / result.scannedPlayers) * 100).toFixed(1),
      });

      result.cacheInvalidated = await repairDriftedValues(result.errors);
    }

    return result;
  } catch (error) {
    console.error('FDP_DRIFT_CHECK_ERROR:', error);
    return result;
  }
}

/**
 * Check specific endpoints for value consistency
 */
export async function checkEndpointValueConsistency(
  endpoints: string[]
): Promise<DriftCheckResult> {
  const result: DriftCheckResult = {
    passed: true,
    scannedPlayers: 0,
    driftDetected: 0,
    cacheInvalidated: 0,
    errors: [],
  };

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      const data = await response.json();

      const players = extractPlayersFromResponse(data);
      result.scannedPlayers += players.length;

      const verification = await verifyFDPValuesBatch(players);

      if (!verification.valid) {
        result.passed = false;
        result.driftDetected += verification.mismatches.length;

        for (const mismatch of verification.mismatches) {
          result.errors.push({
            player_id: mismatch.player_id,
            expected: mismatch.canonical,
            actual: mismatch.claimed,
            difference: mismatch.difference,
            source: endpoint,
          });
        }
      }
    } catch (error) {
      console.error(`Endpoint check failed for ${endpoint}:`, error);
    }
  }

  if (result.driftDetected > 0) {
    console.warn('ENDPOINT_DRIFT_DETECTED:', {
      endpoints: endpoints.length,
      scanned: result.scannedPlayers,
      drift: result.driftDetected,
    });

    result.cacheInvalidated = await repairDriftedValues(result.errors);
  }

  return result;
}

/**
 * Repair drifted values by invalidating cache
 */
async function repairDriftedValues(
  errors: Array<{ player_id: string }>
): Promise<number> {
  let repaired = 0;

  try {
    const playerIds = [...new Set(errors.map(e => e.player_id))];

    for (const playerId of playerIds) {
      const cacheKeys = [
        `player_value_${playerId}`,
        `player_${playerId}`,
        `trade_value_${playerId}`,
      ];

      for (const key of cacheKeys) {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (e) {
          // Ignore storage errors
        }
      }

      repaired++;
    }

    console.log('FDP_CACHE_REPAIRED:', { players: repaired });

    await supabase.from('system_health_metrics').insert({
      metric_name: 'fdp_drift_repair',
      metric_value: repaired,
      status: 'warning',
      details: {
        repaired_players: repaired,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to repair drifted values:', error);
  }

  return repaired;
}

/**
 * Extract players with values from API response
 */
function extractPlayersFromResponse(
  data: any
): Array<{ player_id: string; value: number }> {
  const players: Array<{ player_id: string; value: number }> = [];

  const extract = (obj: any) => {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        extract(item);
      }
    } else if (obj && typeof obj === 'object') {
      if (
        ('player_id' in obj || 'playerId' in obj) &&
        'value' in obj &&
        typeof obj.value === 'number'
      ) {
        players.push({
          player_id: obj.player_id || obj.playerId,
          value: obj.value,
        });
      }

      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          extract(obj[key]);
        }
      }
    }
  };

  extract(data);
  return players;
}

/**
 * Generate drift report for doctor dashboard
 */
export async function generateDriftReport(): Promise<{
  summary: string;
  details: any;
  recommendations: string[];
}> {
  const driftCheck = await checkFDPValueDrift();

  const summary = driftCheck.passed
    ? `✓ No value drift detected (${driftCheck.scannedPlayers} players scanned)`
    : `⚠ Value drift detected in ${driftCheck.driftDetected} of ${driftCheck.scannedPlayers} players`;

  const recommendations: string[] = [];

  if (driftCheck.driftDetected > 0) {
    recommendations.push('Clear browser cache and reload');
    recommendations.push('Run value rebuild pipeline');
    recommendations.push('Check for outdated edge function deployments');

    if (driftCheck.driftDetected / driftCheck.scannedPlayers > 0.1) {
      recommendations.push('⚠ High drift rate - investigate value sync process');
    }
  }

  return {
    summary,
    details: {
      scanned: driftCheck.scannedPlayers,
      drift: driftCheck.driftDetected,
      repaired: driftCheck.cacheInvalidated,
      errors: driftCheck.errors.slice(0, 10),
    },
    recommendations,
  };
}
