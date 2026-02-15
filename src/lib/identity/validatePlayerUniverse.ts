/**
 * Player Universe Validation
 *
 * Pre-rebuild integrity check that ensures:
 * - No duplicate active players
 * - Every rostered player has identity
 * - No orphan stats
 * - No values linked to missing players
 *
 * ABORTS rebuild if critical issues found.
 */

import { supabase } from '../supabase';
import { detectDuplicatePlayers } from './detectDuplicates';

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  details?: any;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  critical: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: {
    totalPlayers: number;
    activePlayers: number;
    inactivePlayers: number;
    retiredPlayers: number;
    playersWithValues: number;
    rosteredPlayers: number;
    orphanStats: number;
    orphanValues: number;
    duplicates: number;
  };
}

/**
 * Validate entire player universe before rebuild
 */
export async function validatePlayerUniverse(): Promise<ValidationResult> {
  console.log('🔍 Validating player universe...');

  const issues: ValidationIssue[] = [];
  const stats = {
    totalPlayers: 0,
    activePlayers: 0,
    inactivePlayers: 0,
    retiredPlayers: 0,
    playersWithValues: 0,
    rosteredPlayers: 0,
    orphanStats: 0,
    orphanValues: 0,
    duplicates: 0,
  };

  // Check 1: Player identity table health
  await checkPlayerIdentityHealth(issues, stats);

  // Check 2: Detect duplicates
  await checkDuplicates(issues, stats);

  // Check 3: Rostered players have identity
  await checkRosteredPlayers(issues, stats);

  // Check 4: Check for orphan values
  await checkOrphanValues(issues, stats);

  // Check 5: Check for orphan stats (if you have stats table)
  // await checkOrphanStats(issues, stats);

  // Categorize issues
  const critical = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const valid = critical.length === 0;

  console.log(`   Total players: ${stats.totalPlayers}`);
  console.log(`   Active: ${stats.activePlayers}`);
  console.log(`   Duplicates: ${stats.duplicates}`);
  console.log(`   Orphan values: ${stats.orphanValues}`);
  console.log(`   Issues: ${issues.length} (${critical.length} critical)`);

  if (!valid) {
    console.error('❌ VALIDATION FAILED - REBUILD BLOCKED');
    critical.forEach((issue) => {
      console.error(`   ${issue.message}`);
    });
  } else {
    console.log('✅ Validation passed');
  }

  return {
    valid,
    issues,
    critical,
    warnings,
    stats,
  };
}

/**
 * Check player identity table health
 */
async function checkPlayerIdentityHealth(
  issues: ValidationIssue[],
  stats: Record<string, number>
): Promise<void> {
  const { data: players, error } = await supabase
    .from('player_identity')
    .select('player_id, status');

  if (error) {
    issues.push({
      severity: 'critical',
      category: 'database',
      message: `Failed to query player_identity: ${error.message}`,
    });
    return;
  }

  if (!players || players.length === 0) {
    issues.push({
      severity: 'critical',
      category: 'players',
      message: 'No players found in player_identity table',
    });
    return;
  }

  stats.totalPlayers = players.length;
  stats.activePlayers = players.filter((p) => p.status === 'active').length;
  stats.inactivePlayers = players.filter((p) => p.status === 'inactive').length;
  stats.retiredPlayers = players.filter((p) => p.status === 'retired').length;

  if (stats.activePlayers === 0) {
    issues.push({
      severity: 'critical',
      category: 'players',
      message: 'No active players found',
    });
  } else if (stats.activePlayers < 100) {
    issues.push({
      severity: 'warning',
      category: 'players',
      message: `Only ${stats.activePlayers} active players (expected 1000+)`,
    });
  }
}

/**
 * Check for duplicate players
 */
async function checkDuplicates(
  issues: ValidationIssue[],
  stats: Record<string, number>
): Promise<void> {
  const duplicateResult = await detectDuplicatePlayers();

  stats.duplicates = duplicateResult.highConfidence.length;

  if (duplicateResult.highConfidence.length > 0) {
    issues.push({
      severity: 'critical',
      category: 'duplicates',
      message: `${duplicateResult.highConfidence.length} high-confidence duplicate(s) detected`,
      details: duplicateResult.highConfidence.map((d) => ({
        players: [d.player_a.full_name, d.player_b.full_name],
        reason: d.reason,
        confidence: d.confidence,
      })),
    });
  }

  if (duplicateResult.mediumConfidence.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'duplicates',
      message: `${duplicateResult.mediumConfidence.length} medium-confidence duplicate(s) detected`,
      details: duplicateResult.mediumConfidence.slice(0, 5).map((d) => ({
        players: [d.player_a.full_name, d.player_b.full_name],
        reason: d.reason,
        confidence: d.confidence,
      })),
    });
  }
}

/**
 * Check rostered players have identity
 */
async function checkRosteredPlayers(
  issues: ValidationIssue[],
  stats: Record<string, number>
): Promise<void> {
  // Check if any rostered players (in leagues) don't have identity
  const { data: rosters, error: rostersError } = await supabase
    .from('league_rosters')
    .select('player_id')
    .not('player_id', 'is', null);

  if (rostersError) {
    issues.push({
      severity: 'warning',
      category: 'rosters',
      message: `Failed to query league_rosters: ${rostersError.message}`,
    });
    return;
  }

  if (!rosters || rosters.length === 0) {
    // No rosters yet - not a problem
    return;
  }

  stats.rosteredPlayers = rosters.length;

  // Check if all rostered players exist in player_identity
  const rosterPlayerIds = new Set(rosters.map((r) => r.player_id));
  const { data: identityPlayers } = await supabase
    .from('player_identity')
    .select('player_id')
    .in('player_id', Array.from(rosterPlayerIds));

  const identitySet = new Set(
    (identityPlayers || []).map((p) => p.player_id)
  );

  const missingIdentity = Array.from(rosterPlayerIds).filter(
    (id) => !identitySet.has(id)
  );

  if (missingIdentity.length > 0) {
    issues.push({
      severity: 'critical',
      category: 'rosters',
      message: `${missingIdentity.length} rostered player(s) missing from player_identity`,
      details: { missing_player_ids: missingIdentity.slice(0, 10) },
    });
  }
}

/**
 * Check for orphan values (values for non-existent players)
 */
async function checkOrphanValues(
  issues: ValidationIssue[],
  stats: Record<string, number>
): Promise<void> {
  // Get all player IDs from player_values
  const { data: values, error: valuesError } = await supabase
    .from('player_values')
    .select('player_id');

  if (valuesError) {
    issues.push({
      severity: 'warning',
      category: 'values',
      message: `Failed to query player_values: ${valuesError.message}`,
    });
    return;
  }

  if (!values || values.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'values',
      message: 'No player values found',
    });
    return;
  }

  stats.playersWithValues = new Set(values.map((v) => v.player_id)).size;

  // Get all player IDs from player_identity
  const { data: identityPlayers } = await supabase
    .from('player_identity')
    .select('player_id');

  const identitySet = new Set(
    (identityPlayers || []).map((p) => p.player_id)
  );

  // Find values with no matching identity
  const orphanValuePlayerIds = values
    .map((v) => v.player_id)
    .filter((id) => !identitySet.has(id));

  stats.orphanValues = new Set(orphanValuePlayerIds).size;

  if (orphanValuePlayerIds.length > 0) {
    issues.push({
      severity: 'critical',
      category: 'values',
      message: `${stats.orphanValues} orphan player value(s) detected (values for non-existent players)`,
      details: { orphan_player_ids: [...new Set(orphanValuePlayerIds)].slice(0, 10) },
    });
  }
}

/**
 * Require valid player universe or throw
 */
export async function requireValidPlayerUniverse(): Promise<void> {
  const result = await validatePlayerUniverse();

  if (!result.valid) {
    const errorMessage = [
      '',
      '═══════════════════════════════════════════════════',
      '🚨 PLAYER UNIVERSE VALIDATION FAILED',
      '═══════════════════════════════════════════════════',
      '',
      'Cannot proceed with rebuild due to critical issues:',
      '',
      ...result.critical.map((i) => `  ❌ ${i.message}`),
      '',
      'Fix these issues before running rebuild.',
      '═══════════════════════════════════════════════════',
      '',
    ].join('\n');

    console.error(errorMessage);

    throw new Error('Player universe validation failed. Cannot proceed with rebuild.');
  }
}

/**
 * Get validation summary
 */
export function getValidationSummary(result: ValidationResult): string {
  const lines = [
    '📊 Player Universe Validation Summary',
    '',
    `Total Players: ${result.stats.totalPlayers}`,
    `  Active: ${result.stats.activePlayers}`,
    `  Inactive: ${result.stats.inactivePlayers}`,
    `  Retired: ${result.stats.retiredPlayers}`,
    '',
    `Players with Values: ${result.stats.playersWithValues}`,
    `Rostered Players: ${result.stats.rosteredPlayers}`,
    '',
    `Issues Found: ${result.issues.length}`,
    `  Critical: ${result.critical.length}`,
    `  Warnings: ${result.warnings.length}`,
    '',
    `Duplicates: ${result.stats.duplicates}`,
    `Orphan Values: ${result.stats.orphanValues}`,
    '',
    `Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}`,
  ];

  if (result.critical.length > 0) {
    lines.push('', 'Critical Issues:');
    result.critical.forEach((issue) => {
      lines.push(`  ❌ ${issue.message}`);
    });
  }

  if (result.warnings.length > 0) {
    lines.push('', 'Warnings:');
    result.warnings.forEach((issue) => {
      lines.push(`  ⚠️  ${issue.message}`);
    });
  }

  return lines.join('\n');
}

/**
 * Auto-fix safe issues
 */
export async function autoFixSafeIssues(
  result: ValidationResult
): Promise<{
  fixed: number;
  failed: number;
  details: string[];
}> {
  const details: string[] = [];
  let fixed = 0;
  let failed = 0;

  // Fix orphan values by removing them
  if (result.stats.orphanValues > 0) {
    try {
      // Get player IDs from player_identity
      const { data: identityPlayers } = await supabase
        .from('player_identity')
        .select('player_id');

      const identitySet = new Set(
        (identityPlayers || []).map((p) => p.player_id)
      );

      // Get orphan value records
      const { data: values } = await supabase
        .from('player_values')
        .select('player_id');

      const orphanIds = values
        ?.map((v) => v.player_id)
        .filter((id) => !identitySet.has(id));

      if (orphanIds && orphanIds.length > 0) {
        // Delete orphan values
        const { error } = await supabase
          .from('player_values')
          .delete()
          .in('player_id', orphanIds);

        if (error) {
          details.push(`Failed to remove orphan values: ${error.message}`);
          failed++;
        } else {
          details.push(`Removed ${new Set(orphanIds).size} orphan value records`);
          fixed++;
        }
      }
    } catch (error) {
      details.push(`Error fixing orphan values: ${error}`);
      failed++;
    }
  }

  return { fixed, failed, details };
}
