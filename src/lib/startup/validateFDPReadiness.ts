/**
 * Production Startup FDP Readiness Gate
 *
 * Validates FDP values are fresh before allowing production traffic.
 *
 * On server boot, checks:
 * - latest_player_values has rows for required formats
 * - updated_at < 48 hours (values are fresh)
 * - value_epoch exists and is consistent
 *
 * If validation fails:
 * - Start in maintenance mode
 * - Block value endpoints
 * - Return 503 Service Unavailable
 */

import { supabase } from '../supabase';

export interface FDPReadinessResult {
  ready: boolean;
  checks: {
    hasValues: boolean;
    isFresh: boolean;
    hasEpoch: boolean;
    formatsCovered: boolean;
  };
  details: {
    totalPlayers: number;
    lastUpdated: string | null;
    ageHours: number;
    valueEpoch: string | null;
    missingFormats: string[];
  };
  errors: string[];
}

const REQUIRED_FORMATS = ['dynasty_1qb', 'dynasty_superflex', 'redraft'];
const MAX_AGE_HOURS = 48;
const MIN_PLAYERS = 500;

/**
 * Validate FDP values are ready for production
 */
export async function validateFDPReadiness(): Promise<FDPReadinessResult> {
  const result: FDPReadinessResult = {
    ready: false,
    checks: {
      hasValues: false,
      isFresh: false,
      hasEpoch: false,
      formatsCovered: false,
    },
    details: {
      totalPlayers: 0,
      lastUpdated: null,
      ageHours: 0,
      valueEpoch: null,
      missingFormats: [],
    },
    errors: [],
  };

  try {
    // Check 1: Has values
    const { data: allValues, error: countError } = await supabase
      .from('latest_player_values')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      result.errors.push(`Database query error: ${countError.message}`);
      return result;
    }

    const count = allValues?.length || 0;
    result.details.totalPlayers = count;
    result.checks.hasValues = count >= MIN_PLAYERS;

    if (!result.checks.hasValues) {
      result.errors.push(
        `Insufficient players: ${count} found, ${MIN_PLAYERS} required`
      );
    }

    // Check 2: Is fresh (updated within 48 hours)
    const { data: latestValue } = await supabase
      .from('latest_player_values')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestValue?.updated_at) {
      result.details.lastUpdated = latestValue.updated_at;
      const now = Date.now();
      const updated = new Date(latestValue.updated_at).getTime();
      const ageMs = now - updated;
      const ageHours = ageMs / (1000 * 60 * 60);
      result.details.ageHours = Math.round(ageHours * 10) / 10;
      result.checks.isFresh = ageHours < MAX_AGE_HOURS;

      if (!result.checks.isFresh) {
        result.errors.push(
          `Values are stale: ${result.details.ageHours}h old, max ${MAX_AGE_HOURS}h`
        );
      }
    } else {
      result.errors.push('No updated_at timestamp found');
    }

    // Check 3: Has value_epoch
    const { data: epochCheck } = await supabase
      .from('latest_player_values')
      .select('value_epoch_id')
      .not('value_epoch_id', 'is', null)
      .limit(1)
      .maybeSingle();

    result.checks.hasEpoch = !!epochCheck?.value_epoch_id;
    result.details.valueEpoch = epochCheck?.value_epoch_id || null;

    if (!result.checks.hasEpoch) {
      result.errors.push('No value_epoch_id found');
    }

    // Check 4: Required formats covered
    const { data: formatCheck } = await supabase
      .from('latest_player_values')
      .select('format')
      .in('format', REQUIRED_FORMATS);

    const availableFormats = new Set(formatCheck?.map(f => f.format) || []);
    const missingFormats = REQUIRED_FORMATS.filter(f => !availableFormats.has(f));

    result.details.missingFormats = missingFormats;
    result.checks.formatsCovered = missingFormats.length === 0;

    if (!result.checks.formatsCovered) {
      result.errors.push(`Missing formats: ${missingFormats.join(', ')}`);
    }

    // Overall readiness
    result.ready =
      result.checks.hasValues &&
      result.checks.isFresh &&
      result.checks.hasEpoch &&
      result.checks.formatsCovered;

    return result;
  } catch (error) {
    result.errors.push(`Validation error: ${error}`);
    return result;
  }
}

/**
 * Block value endpoints if FDP not ready
 */
export function createMaintenanceModeMiddleware(readiness: FDPReadinessResult) {
  return (req: Request): Response | null => {
    if (readiness.ready) {
      return null; // Allow through
    }

    // Block value-related endpoints
    const url = new URL(req.url);
    const blockedPaths = [
      '/api/player-values',
      '/api/rankings',
      '/api/trade',
      '/api/advice',
      '/functions/v1/player-value',
      '/functions/v1/trade-eval',
      '/functions/v1/ktc-rankings',
    ];

    const isBlocked = blockedPaths.some(path => url.pathname.includes(path));

    if (isBlocked) {
      return new Response(
        JSON.stringify({
          error: 'Service Unavailable',
          message: 'FDP values are not ready. System in maintenance mode.',
          details: {
            checks: readiness.checks,
            errors: readiness.errors,
          },
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '3600', // 1 hour
          },
        }
      );
    }

    return null;
  };
}

/**
 * Log readiness status on startup
 */
export async function logFDPReadiness(): Promise<void> {
  const readiness = await validateFDPReadiness();

  console.log('\n===========================================');
  console.log('       FDP READINESS CHECK');
  console.log('===========================================\n');

  if (readiness.ready) {
    console.log('✓ FDP VALUES READY FOR PRODUCTION');
    console.log(`✓ Players: ${readiness.details.totalPlayers}`);
    console.log(`✓ Last Updated: ${readiness.details.lastUpdated}`);
    console.log(`✓ Age: ${readiness.details.ageHours}h`);
    console.log(`✓ Epoch: ${readiness.details.valueEpoch}`);
    console.log(`✓ Formats: All required formats available\n`);
  } else {
    console.error('✗ FDP VALUES NOT READY');
    console.error(`✗ Players: ${readiness.details.totalPlayers} (min ${MIN_PLAYERS})`);
    console.error(`✗ Last Updated: ${readiness.details.lastUpdated || 'N/A'}`);
    console.error(`✗ Age: ${readiness.details.ageHours}h (max ${MAX_AGE_HOURS}h)`);
    console.error(`✗ Epoch: ${readiness.details.valueEpoch || 'Missing'}`);

    if (readiness.details.missingFormats.length > 0) {
      console.error(`✗ Missing Formats: ${readiness.details.missingFormats.join(', ')}`);
    }

    console.error('\nErrors:');
    readiness.errors.forEach(err => console.error(`  - ${err}`));

    console.error('\n⚠ STARTING IN MAINTENANCE MODE');
    console.error('⚠ Value endpoints will return 503\n');
  }

  console.log('===========================================\n');

  // Log to database
  try {
    await supabase.from('system_health_metrics').insert({
      metric_name: 'fdp_readiness_check',
      metric_value: readiness.ready ? 1 : 0,
      status: readiness.ready ? 'healthy' : 'critical',
      details: {
        checks: readiness.checks,
        details: readiness.details,
        errors: readiness.errors,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to log readiness to database:', error);
  }
}

/**
 * Get current FDP readiness status
 */
export async function getFDPStatus(): Promise<{
  status: 'ready' | 'maintenance';
  readiness: FDPReadinessResult;
}> {
  const readiness = await validateFDPReadiness();

  return {
    status: readiness.ready ? 'ready' : 'maintenance',
    readiness,
  };
}
