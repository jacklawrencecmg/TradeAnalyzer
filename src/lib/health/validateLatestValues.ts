/**
 * Value Integrity Validator
 *
 * Runs after every rebuild to validate player values quality.
 * Prevents bad data from reaching users.
 *
 * Checks:
 * - Coverage (minimum player counts)
 * - Position minimums (QB >= 40, RB >= 120, etc.)
 * - Range sanity (values between 0-10000)
 * - Duplicate guard (no duplicate player+profile+format)
 * - Tier sanity (top tier <= 5% of pool)
 *
 * If any fail → CRITICAL status → triggers safe mode
 */

import { supabase } from '../supabase';

export interface ValidationResult {
  passed: boolean;
  status: 'ok' | 'warning' | 'critical';
  checks: ValidationCheck[];
  summary: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'critical';
  expected: number | string;
  actual: number | string;
  message: string;
}

const MINIMUM_THRESHOLDS = {
  totalPlayersDynasty: 900,
  totalPlayersRedraft: 700,
  QB: 40,
  RB: 120,
  WR: 150,
  TE: 50,
  maxValue: 10000,
  minValue: 0,
  topTierPercentMax: 5,
};

/**
 * Validate latest player values
 *
 * Main validation entry point - runs all checks
 */
export async function validateLatestValues(): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];

  try {
    // 1. Coverage check
    const coverageChecks = await validateCoverage();
    checks.push(...coverageChecks);

    // 2. Position minimums
    const positionChecks = await validatePositionMinimums();
    checks.push(...positionChecks);

    // 3. Range sanity
    const rangeChecks = await validateValueRanges();
    checks.push(...rangeChecks);

    // 4. Duplicate guard
    const duplicateChecks = await validateNoDuplicates();
    checks.push(...duplicateChecks);

    // 5. Tier sanity
    const tierChecks = await validateTierDistribution();
    checks.push(...tierChecks);

    // Determine overall status
    const criticalFailures = checks.filter((c) => !c.passed && c.severity === 'critical');
    const warnings = checks.filter((c) => !c.passed && c.severity === 'warning');

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    let summary = 'All validation checks passed';

    if (criticalFailures.length > 0) {
      status = 'critical';
      summary = `${criticalFailures.length} critical validation failures detected`;
    } else if (warnings.length > 0) {
      status = 'warning';
      summary = `${warnings.length} validation warnings detected`;
    }

    const result: ValidationResult = {
      passed: criticalFailures.length === 0,
      status,
      checks,
      summary,
    };

    // Record health check
    await recordHealthCheck('value_integrity', status, {
      checks: checks.map((c) => ({
        name: c.name,
        passed: c.passed,
        severity: c.severity,
        message: c.message,
      })),
      summary,
    });

    return result;
  } catch (error) {
    console.error('Error validating values:', error);

    await recordHealthCheck('value_integrity', 'critical', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      passed: false,
      status: 'critical',
      checks,
      summary: 'Validation failed with error',
    };
  }
}

/**
 * Validate player coverage
 */
async function validateCoverage(): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  // Dynasty count
  const { count: dynastyCount } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .eq('format', 'dynasty')
    .not('fdp_value', 'is', null);

  checks.push({
    name: 'Dynasty Player Coverage',
    passed: (dynastyCount || 0) >= MINIMUM_THRESHOLDS.totalPlayersDynasty,
    severity: 'critical',
    expected: `>= ${MINIMUM_THRESHOLDS.totalPlayersDynasty}`,
    actual: dynastyCount || 0,
    message:
      (dynastyCount || 0) >= MINIMUM_THRESHOLDS.totalPlayersDynasty
        ? `Dynasty coverage OK: ${dynastyCount} players`
        : `Dynasty coverage LOW: only ${dynastyCount} players (need ${MINIMUM_THRESHOLDS.totalPlayersDynasty})`,
  });

  // Redraft count
  const { count: redraftCount } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .eq('format', 'redraft')
    .not('fdp_value', 'is', null);

  checks.push({
    name: 'Redraft Player Coverage',
    passed: (redraftCount || 0) >= MINIMUM_THRESHOLDS.totalPlayersRedraft,
    severity: 'critical',
    expected: `>= ${MINIMUM_THRESHOLDS.totalPlayersRedraft}`,
    actual: redraftCount || 0,
    message:
      (redraftCount || 0) >= MINIMUM_THRESHOLDS.totalPlayersRedraft
        ? `Redraft coverage OK: ${redraftCount} players`
        : `Redraft coverage LOW: only ${redraftCount} players (need ${MINIMUM_THRESHOLDS.totalPlayersRedraft})`,
  });

  return checks;
}

/**
 * Validate position minimums
 */
async function validatePositionMinimums(): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];
  const positions = ['QB', 'RB', 'WR', 'TE'];

  for (const position of positions) {
    const { count } = await supabase
      .from('player_values')
      .select('*', { count: 'exact', head: true })
      .eq('position', position)
      .not('fdp_value', 'is', null);

    const minimum = MINIMUM_THRESHOLDS[position as keyof typeof MINIMUM_THRESHOLDS] as number;

    checks.push({
      name: `${position} Position Minimum`,
      passed: (count || 0) >= minimum,
      severity: 'critical',
      expected: `>= ${minimum}`,
      actual: count || 0,
      message:
        (count || 0) >= minimum
          ? `${position} count OK: ${count} players`
          : `${position} count LOW: only ${count} players (need ${minimum})`,
    });
  }

  return checks;
}

/**
 * Validate value ranges
 */
async function validateValueRanges(): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  // Check max value
  const { data: maxValueData } = await supabase
    .from('player_values')
    .select('fdp_value')
    .order('fdp_value', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxValue = maxValueData?.fdp_value || 0;

  checks.push({
    name: 'Maximum Value Sanity',
    passed: maxValue <= MINIMUM_THRESHOLDS.maxValue,
    severity: 'critical',
    expected: `<= ${MINIMUM_THRESHOLDS.maxValue}`,
    actual: maxValue,
    message:
      maxValue <= MINIMUM_THRESHOLDS.maxValue
        ? `Max value OK: ${maxValue}`
        : `Max value EXCESSIVE: ${maxValue} (limit ${MINIMUM_THRESHOLDS.maxValue})`,
  });

  // Check min value (should be >= 0)
  const { data: minValueData } = await supabase
    .from('player_values')
    .select('fdp_value')
    .order('fdp_value', { ascending: true })
    .limit(1)
    .maybeSingle();

  const minValue = minValueData?.fdp_value || 0;

  checks.push({
    name: 'Minimum Value Sanity',
    passed: minValue >= MINIMUM_THRESHOLDS.minValue,
    severity: 'critical',
    expected: `>= ${MINIMUM_THRESHOLDS.minValue}`,
    actual: minValue,
    message:
      minValue >= MINIMUM_THRESHOLDS.minValue
        ? `Min value OK: ${minValue}`
        : `Min value NEGATIVE: ${minValue} (should be >= ${MINIMUM_THRESHOLDS.minValue})`,
  });

  // Check for null values
  const { count: nullCount } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .is('fdp_value', null);

  checks.push({
    name: 'Null Value Check',
    passed: (nullCount || 0) === 0,
    severity: 'warning',
    expected: '0',
    actual: nullCount || 0,
    message:
      (nullCount || 0) === 0
        ? 'No null values found'
        : `Found ${nullCount} null values (should recalculate)`,
  });

  return checks;
}

/**
 * Validate no duplicates
 */
async function validateNoDuplicates(): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  // Check for duplicate (player_id, profile, format) combinations
  const { data: duplicates } = await supabase.rpc('check_value_duplicates');

  const duplicateCount = duplicates?.length || 0;

  checks.push({
    name: 'Duplicate Value Check',
    passed: duplicateCount === 0,
    severity: 'critical',
    expected: '0',
    actual: duplicateCount,
    message:
      duplicateCount === 0
        ? 'No duplicate values found'
        : `Found ${duplicateCount} duplicate player+profile+format combinations (data corruption!)`,
  });

  return checks;
}

/**
 * Validate tier distribution
 */
async function validateTierDistribution(): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  // Get total player count
  const { count: totalCount } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .not('fdp_value', 'is', null);

  // Get top tier count (tier 1)
  const { count: topTierCount } = await supabase
    .from('player_values')
    .select('*', { count: 'exact', head: true })
    .eq('tier', 1);

  const topTierPercent = totalCount ? ((topTierCount || 0) / totalCount) * 100 : 0;

  checks.push({
    name: 'Top Tier Distribution',
    passed: topTierPercent <= MINIMUM_THRESHOLDS.topTierPercentMax,
    severity: 'warning',
    expected: `<= ${MINIMUM_THRESHOLDS.topTierPercentMax}%`,
    actual: `${topTierPercent.toFixed(1)}%`,
    message:
      topTierPercent <= MINIMUM_THRESHOLDS.topTierPercentMax
        ? `Top tier OK: ${topTierPercent.toFixed(1)}% of players`
        : `Top tier EXCESSIVE: ${topTierPercent.toFixed(1)}% of players (should be <= ${MINIMUM_THRESHOLDS.topTierPercentMax}%)`,
  });

  return checks;
}

/**
 * Record health check result
 */
async function recordHealthCheck(
  checkName: string,
  status: 'ok' | 'warning' | 'critical',
  details: any
) {
  try {
    await supabase.from('system_health_checks').insert({
      check_name: checkName,
      status,
      meta: details,
      checked_at: new Date().toISOString(),
    });

    // If critical, trigger safe mode
    if (status === 'critical') {
      await triggerSafeMode(checkName, details);
    }
  } catch (error) {
    console.error('Error recording health check:', error);
  }
}

/**
 * Trigger safe mode
 */
async function triggerSafeMode(reason: string, details: any) {
  try {
    await supabase
      .from('system_safe_mode')
      .update({
        enabled: true,
        reason: `Critical validation failure: ${reason}`,
        critical_issues: details,
        enabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1); // Assuming singleton with id=1

    // Create alert
    await supabase.from('system_alerts').insert({
      severity: 'critical',
      message: `Safe mode activated: ${reason}`,
      alert_type: 'safe_mode_activated',
      metadata: details,
    });

    console.error('SAFE MODE ACTIVATED:', reason);
  } catch (error) {
    console.error('Error triggering safe mode:', error);
  }
}

/**
 * Quick validation (lighter checks for runtime)
 */
export async function quickValidate(): Promise<boolean> {
  try {
    // Just check if we have recent values
    const { count } = await supabase
      .from('player_values')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    return (count || 0) > 500; // At least 500 recent values
  } catch (error) {
    console.error('Quick validation error:', error);
    return false;
  }
}

/**
 * Get latest validation result
 */
export async function getLatestValidation(): Promise<{
  status: string;
  details: any;
  checkedAt: string;
} | null> {
  try {
    const { data } = await supabase
      .from('system_health_checks')
      .select('*')
      .eq('check_name', 'value_integrity')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    return {
      status: data.status,
      details: data.meta,
      checkedAt: data.checked_at,
    };
  } catch (error) {
    console.error('Error getting latest validation:', error);
    return null;
  }
}
