/**
 * Runtime Request Validation
 *
 * Randomly samples API responses to validate data integrity.
 * Catches corruption that passes initial validation.
 *
 * Samples 1% of requests:
 * - Value matches ranking position
 * - Tier matches percentile
 * - No null values
 *
 * If fails → mark build suspect → trigger investigation
 */

import { supabase } from '../supabase';

const SAMPLE_RATE = 0.01; // 1% of requests

export interface ValidationSample {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
}

/**
 * Should sample this request?
 *
 * Returns true 1% of the time
 */
export function shouldSample(): boolean {
  return Math.random() < SAMPLE_RATE;
}

/**
 * Validate player value response
 *
 * Checks integrity of player value data
 */
export async function validatePlayerValue(
  playerId: string,
  value: number,
  rank: number,
  tier: number
): Promise<ValidationSample> {
  const checks: ValidationSample['checks'] = [];

  try {
    // Check 1: Value is not null
    checks.push({
      name: 'value_not_null',
      passed: value !== null && value !== undefined,
      message: value !== null && value !== undefined ? 'Value OK' : 'Value is null',
    });

    // Check 2: Value matches rank (higher value = better rank)
    // Get player's actual rank by value
    const { data: higherValuedPlayers, count } = await supabase
      .from('player_values')
      .select('*', { count: 'exact', head: true })
      .gt('fdp_value', value);

    const actualRank = (count || 0) + 1;
    const rankDiff = Math.abs(actualRank - rank);

    checks.push({
      name: 'value_matches_rank',
      passed: rankDiff <= 5, // Allow 5 position tolerance
      message:
        rankDiff <= 5
          ? `Rank OK (diff: ${rankDiff})`
          : `Rank mismatch: expected ~${actualRank}, got ${rank} (diff: ${rankDiff})`,
    });

    // Check 3: Tier matches percentile
    const { count: totalPlayers } = await supabase
      .from('player_values')
      .select('*', { count: 'exact', head: true })
      .not('fdp_value', 'is', null);

    const percentile = totalPlayers ? (rank / totalPlayers) * 100 : 0;

    let expectedTier = 6; // Default to lowest tier
    if (percentile <= 5) expectedTier = 1;
    else if (percentile <= 15) expectedTier = 2;
    else if (percentile <= 30) expectedTier = 3;
    else if (percentile <= 50) expectedTier = 4;
    else if (percentile <= 75) expectedTier = 5;

    const tierDiff = Math.abs(expectedTier - tier);

    checks.push({
      name: 'tier_matches_percentile',
      passed: tierDiff <= 1, // Allow 1 tier tolerance
      message:
        tierDiff <= 1
          ? `Tier OK (${tier})`
          : `Tier mismatch: expected ${expectedTier}, got ${tier} (percentile: ${percentile.toFixed(1)}%)`,
    });

    // Check 4: Value is in reasonable range
    checks.push({
      name: 'value_in_range',
      passed: value >= 0 && value <= 10000,
      message:
        value >= 0 && value <= 10000
          ? 'Value in range'
          : `Value out of range: ${value} (should be 0-10000)`,
    });

    const passed = checks.every((c) => c.passed);

    // Record sample
    await recordSample('player_value', passed, {
      playerId,
      value,
      rank,
      tier,
      checks: checks.map((c) => ({ name: c.name, passed: c.passed })),
    });

    // If failed, check failure rate
    if (!passed) {
      await checkFailureRate();
    }

    return { passed, checks };
  } catch (error) {
    console.error('Error validating player value:', error);

    checks.push({
      name: 'validation_error',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    return { passed: false, checks };
  }
}

/**
 * Validate ranking list response
 */
export async function validateRankingList(
  players: Array<{ playerId: string; value: number; rank: number }>
): Promise<ValidationSample> {
  const checks: ValidationSample['checks'] = [];

  try {
    // Check 1: Rankings are in order
    const isOrdered = players.every((p, i) => {
      if (i === 0) return true;
      return p.value <= players[i - 1].value; // Descending order
    });

    checks.push({
      name: 'rankings_ordered',
      passed: isOrdered,
      message: isOrdered ? 'Rankings in correct order' : 'Rankings out of order',
    });

    // Check 2: No duplicate ranks
    const ranks = players.map((p) => p.rank);
    const uniqueRanks = new Set(ranks);

    checks.push({
      name: 'no_duplicate_ranks',
      passed: ranks.length === uniqueRanks.size,
      message:
        ranks.length === uniqueRanks.size
          ? 'No duplicate ranks'
          : `Found ${ranks.length - uniqueRanks.size} duplicate ranks`,
    });

    // Check 3: No null values
    const hasNullValues = players.some((p) => p.value === null || p.value === undefined);

    checks.push({
      name: 'no_null_values',
      passed: !hasNullValues,
      message: hasNullValues ? 'Found null values' : 'No null values',
    });

    const passed = checks.every((c) => c.passed);

    // Record sample
    await recordSample('ranking_list', passed, {
      playerCount: players.length,
      checks: checks.map((c) => ({ name: c.name, passed: c.passed })),
    });

    return { passed, checks };
  } catch (error) {
    console.error('Error validating ranking list:', error);

    checks.push({
      name: 'validation_error',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    return { passed: false, checks };
  }
}

/**
 * Record validation sample
 */
async function recordSample(sampleType: string, passed: boolean, details: any) {
  try {
    await supabase.rpc('record_validation_sample', {
      p_sample_type: sampleType,
      p_passed: passed,
      p_details: details,
    });
  } catch (error) {
    console.error('Error recording validation sample:', error);
  }
}

/**
 * Check failure rate
 *
 * If failure rate exceeds threshold, trigger alert
 */
async function checkFailureRate() {
  try {
    const failureRate = await supabase.rpc('get_validation_failure_rate', {
      p_sample_type: 'player_value',
      p_hours: 24,
    });

    const rate = typeof failureRate === 'object' ? (failureRate as any).data : failureRate;

    console.log('Validation failure rate:', rate, '%');

    // If > 10% failures in last 24 hours, create alert
    if (rate && rate > 10) {
      await supabase.from('system_alerts').insert({
        severity: 'critical',
        message: `High validation failure rate: ${rate.toFixed(1)}%`,
        alert_type: 'high_validation_failure_rate',
        metadata: {
          failureRate: rate,
          threshold: 10,
        },
      });

      console.error('HIGH VALIDATION FAILURE RATE:', rate, '%');
    }
  } catch (error) {
    console.error('Error checking failure rate:', error);
  }
}

/**
 * Get validation failure rate
 */
export async function getValidationFailureRate(
  sampleType: string,
  hours: number = 24
): Promise<number> {
  try {
    const { data } = await supabase.rpc('get_validation_failure_rate', {
      p_sample_type: sampleType,
      p_hours: hours,
    });

    return typeof data === 'number' ? data : 0;
  } catch (error) {
    console.error('Error getting validation failure rate:', error);
    return 0;
  }
}

/**
 * Get validation statistics
 */
export async function getValidationStatistics(hours: number = 24): Promise<{
  totalSamples: number;
  passedSamples: number;
  failedSamples: number;
  failureRate: number;
  byType: Record<string, { total: number; passed: number; failed: number; rate: number }>;
}> {
  try {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const { data: samples } = await supabase
      .from('validation_samples')
      .select('sample_type, passed')
      .gte('created_at', startDate.toISOString());

    if (!samples || samples.length === 0) {
      return {
        totalSamples: 0,
        passedSamples: 0,
        failedSamples: 0,
        failureRate: 0,
        byType: {},
      };
    }

    const passedSamples = samples.filter((s) => s.passed).length;
    const failedSamples = samples.filter((s) => !s.passed).length;
    const failureRate = (failedSamples / samples.length) * 100;

    // Group by type
    const byType: Record<string, { total: number; passed: number; failed: number; rate: number }> =
      {};

    samples.forEach((s) => {
      if (!byType[s.sample_type]) {
        byType[s.sample_type] = { total: 0, passed: 0, failed: 0, rate: 0 };
      }

      byType[s.sample_type].total++;
      if (s.passed) {
        byType[s.sample_type].passed++;
      } else {
        byType[s.sample_type].failed++;
      }
    });

    // Calculate rates
    Object.keys(byType).forEach((type) => {
      byType[type].rate = (byType[type].failed / byType[type].total) * 100;
    });

    return {
      totalSamples: samples.length,
      passedSamples,
      failedSamples,
      failureRate: Math.round(failureRate * 10) / 10,
      byType,
    };
  } catch (error) {
    console.error('Error getting validation statistics:', error);
    return {
      totalSamples: 0,
      passedSamples: 0,
      failedSamples: 0,
      failureRate: 0,
      byType: {},
    };
  }
}
