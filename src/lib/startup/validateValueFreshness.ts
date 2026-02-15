/**
 * Value Freshness Gate
 *
 * Validates player values are fresh and complete before allowing app to start.
 * Prevents serving stale or incomplete data to users.
 *
 * Rules:
 * - Values must be < 48 hours old
 * - Must have values for both dynasty and redraft
 * - Must have at least 100 players with values
 */

import { supabase } from '../supabase';

export interface ValueFreshnessResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalPlayers: number;
    dynastyCount: number;
    redraftCount: number;
    lastUpdated: string | null;
    ageHours: number | null;
  };
}

const MAX_AGE_HOURS = 48;
const MIN_PLAYERS = 100;

/**
 * Validate value freshness
 */
export async function validateValueFreshness(): Promise<ValueFreshnessResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = {
    totalPlayers: 0,
    dynastyCount: 0,
    redraftCount: 0,
    lastUpdated: null as string | null,
    ageHours: null as number | null,
  };

  console.log('🔍 Validating player value freshness...');

  try {
    // Check if player_values table exists and has data
    const { data: values, error } = await supabase
      .from('player_values')
      .select('player_id, format, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) {
      errors.push(`❌ Failed to query player_values: ${error.message}`);
      return { valid: false, errors, warnings, stats };
    }

    if (!values || values.length === 0) {
      errors.push('❌ No player values found! Run rebuild before deploying.');
      return { valid: false, errors, warnings, stats };
    }

    // Count values by format
    const dynastyValues = values.filter((v) => v.format === 'dynasty');
    const redraftValues = values.filter((v) => v.format === 'redraft');

    stats.totalPlayers = values.length;
    stats.dynastyCount = dynastyValues.length;
    stats.redraftCount = redraftValues.length;

    // Check minimum player count
    if (stats.totalPlayers < MIN_PLAYERS) {
      errors.push(
        `❌ Only ${stats.totalPlayers} player values found (expected ${MIN_PLAYERS}+)`
      );
    }

    // Check both formats exist
    if (stats.dynastyCount === 0) {
      errors.push('❌ No dynasty values found!');
    }

    if (stats.redraftCount === 0) {
      errors.push('❌ No redraft values found!');
    }

    // Check freshness
    const mostRecentValue = values[0];
    if (mostRecentValue && mostRecentValue.updated_at) {
      const lastUpdated = new Date(mostRecentValue.updated_at);
      const now = new Date();
      const ageMs = now.getTime() - lastUpdated.getTime();
      const ageHours = ageMs / (1000 * 60 * 60);

      stats.lastUpdated = lastUpdated.toISOString();
      stats.ageHours = Math.round(ageHours * 10) / 10;

      if (ageHours > MAX_AGE_HOURS) {
        errors.push(
          `❌ Player values are stale (${stats.ageHours} hours old, max ${MAX_AGE_HOURS}h).\n   Last updated: ${lastUpdated.toLocaleString()}\n   Run rebuild before deploying!`
        );
      } else if (ageHours > MAX_AGE_HOURS * 0.75) {
        warnings.push(
          `⚠️  Player values are ${stats.ageHours} hours old (approaching ${MAX_AGE_HOURS}h limit)`
        );
      }
    } else {
      errors.push('❌ Cannot determine value freshness (no updated_at timestamp)');
    }

    // Check top players exist (sanity check)
    const sanityCheck = await validateTopPlayers();
    if (!sanityCheck.valid) {
      errors.push(...sanityCheck.errors);
    }

    const valid = errors.length === 0;

    // Log results
    if (valid) {
      console.log('✅ Value freshness validated');
      console.log(`   Total players: ${stats.totalPlayers}`);
      console.log(`   Dynasty: ${stats.dynastyCount}, Redraft: ${stats.redraftCount}`);
      console.log(`   Age: ${stats.ageHours}h (max ${MAX_AGE_HOURS}h)`);
      console.log(`   Last updated: ${stats.lastUpdated}`);

      if (warnings.length > 0) {
        warnings.forEach((w) => console.warn(`   ${w}`));
      }
    } else {
      console.error('❌ Value freshness validation FAILED');
      errors.forEach((e) => console.error(`   ${e}`));
    }

    return { valid, errors, warnings, stats };
  } catch (error) {
    console.error('Error validating value freshness:', error);
    return {
      valid: false,
      errors: ['Failed to validate value freshness: ' + String(error)],
      warnings: [],
      stats,
    };
  }
}

/**
 * Validate top players exist (sanity check)
 */
async function validateTopPlayers(): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    // Check for top dynasty QB
    const { data: topQB } = await supabase
      .from('player_values')
      .select('player_id, fdp_value')
      .eq('format', 'dynasty')
      .eq('position', 'QB')
      .order('fdp_value', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!topQB) {
      errors.push('❌ No dynasty QB values found!');
    } else if (topQB.fdp_value < 100) {
      errors.push(`⚠️  Top dynasty QB value is unusually low: ${topQB.fdp_value}`);
    }

    // Check for top dynasty RB
    const { data: topRB } = await supabase
      .from('player_values')
      .select('player_id, fdp_value')
      .eq('format', 'dynasty')
      .eq('position', 'RB')
      .order('fdp_value', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!topRB) {
      errors.push('❌ No dynasty RB values found!');
    } else if (topRB.fdp_value < 100) {
      errors.push(`⚠️  Top dynasty RB value is unusually low: ${topRB.fdp_value}`);
    }

    return {
      valid: errors.filter((e) => e.startsWith('❌')).length === 0,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: ['Failed to validate top players'],
    };
  }
}

/**
 * Require valid value freshness or throw
 */
export async function requireFreshValues(): Promise<void> {
  const result = await validateValueFreshness();

  if (!result.valid) {
    const errorMessage = [
      '',
      '═══════════════════════════════════════════════════',
      '🚨 PLAYER VALUES ARE STALE OR INCOMPLETE',
      '═══════════════════════════════════════════════════',
      '',
      'Cannot start application with stale/incomplete values:',
      '',
      ...result.errors.map((e) => `  ${e}`),
      '',
      'Run the following before deploying:',
      '',
      '  npm run rebuild:values',
      '',
      'Or manually trigger rebuild via admin endpoint.',
      '',
      '═══════════════════════════════════════════════════',
      '',
    ].join('\n');

    console.error(errorMessage);

    throw new Error('Value freshness validation failed. Cannot start application.');
  }
}

/**
 * Get value freshness status
 */
export async function getValueFreshnessStatus(): Promise<{
  fresh: boolean;
  ageHours: number | null;
  lastUpdated: string | null;
  totalPlayers: number;
  hasWarnings: boolean;
}> {
  const result = await validateValueFreshness();

  return {
    fresh: result.valid,
    ageHours: result.stats.ageHours,
    lastUpdated: result.stats.lastUpdated,
    totalPlayers: result.stats.totalPlayers,
    hasWarnings: result.warnings.length > 0,
  };
}

/**
 * Check if rebuild is needed
 */
export async function needsRebuild(): Promise<{
  needed: boolean;
  reason?: string;
}> {
  const result = await validateValueFreshness();

  if (!result.valid) {
    return {
      needed: true,
      reason: result.errors[0],
    };
  }

  if (result.warnings.length > 0) {
    return {
      needed: false,
      reason: result.warnings[0],
    };
  }

  return { needed: false };
}

/**
 * Get recommended rebuild schedule
 */
export function getRecommendedRebuildSchedule(): {
  frequency: string;
  maxAgeHours: number;
  description: string;
} {
  return {
    frequency: 'daily',
    maxAgeHours: MAX_AGE_HOURS,
    description: `Values should be rebuilt at least daily to stay within ${MAX_AGE_HOURS}h freshness window`,
  };
}
