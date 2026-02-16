/**
 * Data Validation Engine
 *
 * Validates all external data before it can influence FDP values.
 * Bad data is rejected and never reaches the valuation pipeline.
 *
 * Validation Rules:
 * - No negative fantasy points
 * - Snap share <= 100%
 * - Player exists in identity table
 * - No duplicate player rows same week
 * - Not too many missing teams
 * - No extreme rank jumps
 * - Valid injury status transitions
 */

import { supabase } from '../supabase';

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  confidenceScore: number;
}

interface ValidationError {
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  affectedRows: number;
  details?: any;
}

interface ValidationWarning {
  rule: string;
  message: string;
  details?: any;
}

interface RawPlayerStat {
  id: string;
  player_id: string;
  player_name: string;
  week?: number;
  season: number;
  position?: string;
  team?: string;
  fantasy_points?: number;
  snap_share?: number;
  target_share?: number;
  carry_share?: number;
  usage_rate?: number;
}

interface RawPlayerStatus {
  id: string;
  player_id: string;
  player_name: string;
  position?: string;
  team?: string;
  injury_status?: string;
  practice_status?: string;
  depth_chart_position?: number;
  roster_status?: string;
}

interface RawMarketRank {
  id: string;
  player_id: string;
  player_name: string;
  position?: string;
  format: string;
  rank_overall?: number;
  rank_position?: number;
  value?: number;
  tier?: string;
  previous_rank_overall?: number;
}

/**
 * Validate player stats batch
 */
export async function validatePlayerStats(
  batchId: string,
  stats: RawPlayerStat[]
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Rule 1: No negative fantasy points
  const negativePoints = stats.filter(s => s.fantasy_points && s.fantasy_points < 0);
  if (negativePoints.length > 0) {
    errors.push({
      rule: 'negative_fantasy_points',
      message: `${negativePoints.length} players have negative fantasy points`,
      severity: 'error',
      affectedRows: negativePoints.length,
      details: { playerIds: negativePoints.map(p => p.player_id).slice(0, 10) },
    });
  }

  // Rule 2: Snap share <= 100%
  const invalidSnapShare = stats.filter(s => s.snap_share && s.snap_share > 100);
  if (invalidSnapShare.length > 0) {
    errors.push({
      rule: 'invalid_snap_share',
      message: `${invalidSnapShare.length} players have snap share > 100%`,
      severity: 'error',
      affectedRows: invalidSnapShare.length,
      details: { playerIds: invalidSnapShare.map(p => p.player_id).slice(0, 10) },
    });
  }

  // Rule 3: Target/carry share <= 100%
  const invalidTargetShare = stats.filter(s => s.target_share && s.target_share > 100);
  const invalidCarryShare = stats.filter(s => s.carry_share && s.carry_share > 100);
  if (invalidTargetShare.length > 0 || invalidCarryShare.length > 0) {
    errors.push({
      rule: 'invalid_usage_share',
      message: `Players have target/carry share > 100%`,
      severity: 'error',
      affectedRows: invalidTargetShare.length + invalidCarryShare.length,
    });
  }

  // Rule 4: Check player identity
  const playerIds = stats.map(s => s.player_id);
  const { data: identityCheck } = await supabase
    .from('nfl_players')
    .select('player_id')
    .in('player_id', playerIds);

  const knownPlayerIds = new Set(identityCheck?.map(p => p.player_id) || []);
  const unknownPlayers = stats.filter(s => !knownPlayerIds.has(s.player_id));

  if (unknownPlayers.length > stats.length * 0.1) {
    errors.push({
      rule: 'unknown_players',
      message: `${unknownPlayers.length} players not in identity registry (${((unknownPlayers.length / stats.length) * 100).toFixed(1)}%)`,
      severity: 'error',
      affectedRows: unknownPlayers.length,
      details: { playerIds: unknownPlayers.map(p => p.player_id).slice(0, 10) },
    });
  } else if (unknownPlayers.length > 0) {
    warnings.push({
      rule: 'unknown_players',
      message: `${unknownPlayers.length} players not in identity registry`,
      details: { playerIds: unknownPlayers.map(p => p.player_id).slice(0, 5) },
    });
  }

  // Rule 5: Check for missing teams
  const missingTeam = stats.filter(s => !s.team || s.team.trim() === '');
  if (missingTeam.length > stats.length * 0.4) {
    errors.push({
      rule: 'missing_teams',
      message: `${missingTeam.length} players missing team (${((missingTeam.length / stats.length) * 100).toFixed(1)}%)`,
      severity: 'error',
      affectedRows: missingTeam.length,
    });
  }

  // Rule 6: Check for duplicate player/week combinations
  const duplicates = new Map<string, number>();
  stats.forEach(s => {
    const key = `${s.player_id}_${s.week}_${s.season}`;
    duplicates.set(key, (duplicates.get(key) || 0) + 1);
  });

  const duplicateCount = Array.from(duplicates.values()).filter(count => count > 1).length;
  if (duplicateCount > 0) {
    errors.push({
      rule: 'duplicate_player_week',
      message: `${duplicateCount} duplicate player/week combinations found`,
      severity: 'error',
      affectedRows: duplicateCount,
    });
  }

  // Calculate confidence score
  const errorWeight = errors.filter(e => e.severity === 'error').length * 0.2;
  const warningWeight = warnings.length * 0.05;
  const confidenceScore = Math.max(0, 1 - errorWeight - warningWeight);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    confidenceScore,
  };
}

/**
 * Validate player status batch
 */
export async function validatePlayerStatus(
  batchId: string,
  statuses: RawPlayerStatus[]
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Rule 1: Valid injury statuses
  const validInjuryStatuses = ['Healthy', 'Questionable', 'Doubtful', 'Out', 'IR', 'PUP', 'Suspended', ''];
  const invalidInjury = statuses.filter(
    s => s.injury_status && !validInjuryStatuses.includes(s.injury_status)
  );

  if (invalidInjury.length > 0) {
    warnings.push({
      rule: 'invalid_injury_status',
      message: `${invalidInjury.length} players have non-standard injury status`,
      details: { statuses: [...new Set(invalidInjury.map(p => p.injury_status))] },
    });
  }

  // Rule 2: Check for invalid injury transitions
  // Get previous statuses
  const playerIds = statuses.map(s => s.player_id);
  const { data: previousStatuses } = await supabase
    .from('raw_player_status')
    .select('player_id, injury_status, received_at')
    .in('player_id', playerIds)
    .eq('processing_status', 'validated')
    .order('received_at', { ascending: false });

  const previousStatusMap = new Map<string, string>();
  previousStatuses?.forEach(ps => {
    if (!previousStatusMap.has(ps.player_id)) {
      previousStatusMap.set(ps.player_id, ps.injury_status);
    }
  });

  // Invalid: Out → Healthy in same timestamp (should be gradual)
  const suspiciousTransitions = statuses.filter(s => {
    const prev = previousStatusMap.get(s.player_id);
    return prev === 'Out' && s.injury_status === 'Healthy';
  });

  if (suspiciousTransitions.length > 10) {
    warnings.push({
      rule: 'suspicious_injury_transitions',
      message: `${suspiciousTransitions.length} players went from Out to Healthy instantly`,
      details: { playerIds: suspiciousTransitions.map(p => p.player_id).slice(0, 10) },
    });
  }

  // Rule 3: Check player identity
  const { data: identityCheck } = await supabase
    .from('nfl_players')
    .select('player_id')
    .in('player_id', playerIds);

  const knownPlayerIds = new Set(identityCheck?.map(p => p.player_id) || []);
  const unknownPlayers = statuses.filter(s => !knownPlayerIds.has(s.player_id));

  if (unknownPlayers.length > statuses.length * 0.1) {
    errors.push({
      rule: 'unknown_players',
      message: `${unknownPlayers.length} players not in identity registry`,
      severity: 'error',
      affectedRows: unknownPlayers.length,
    });
  }

  const confidenceScore = Math.max(0, 1 - warnings.length * 0.1);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    confidenceScore,
  };
}

/**
 * Validate market ranks batch
 */
export async function validateMarketRanks(
  batchId: string,
  ranks: RawMarketRank[]
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Rule 1: Check for extreme rank jumps (>300 positions)
  const extremeJumps = ranks.filter(r => {
    if (!r.previous_rank_overall || !r.rank_overall) return false;
    const jump = Math.abs(r.rank_overall - r.previous_rank_overall);
    return jump > 300;
  });

  if (extremeJumps.length > 10) {
    errors.push({
      rule: 'extreme_rank_jumps',
      message: `${extremeJumps.length} players have rank jumps > 300 positions`,
      severity: 'error',
      affectedRows: extremeJumps.length,
      details: { playerIds: extremeJumps.map(p => p.player_id).slice(0, 10) },
    });
  } else if (extremeJumps.length > 0) {
    warnings.push({
      rule: 'extreme_rank_jumps',
      message: `${extremeJumps.length} players have large rank jumps`,
      details: { playerIds: extremeJumps.map(p => p.player_id).slice(0, 5) },
    });
  }

  // Rule 2: Check for duplicate players
  const playerCounts = new Map<string, number>();
  ranks.forEach(r => {
    const key = `${r.player_id}_${r.format}`;
    playerCounts.set(key, (playerCounts.get(key) || 0) + 1);
  });

  const duplicates = Array.from(playerCounts.entries()).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    errors.push({
      rule: 'duplicate_rankings',
      message: `${duplicates.length} players appear multiple times for same format`,
      severity: 'error',
      affectedRows: duplicates.length,
    });
  }

  // Rule 3: Check player identity
  const playerIds = ranks.map(r => r.player_id);
  const { data: identityCheck } = await supabase
    .from('nfl_players')
    .select('player_id')
    .in('player_id', playerIds);

  const knownPlayerIds = new Set(identityCheck?.map(p => p.player_id) || []);
  const unknownPlayers = ranks.filter(r => !knownPlayerIds.has(r.player_id));

  if (unknownPlayers.length > ranks.length * 0.05) {
    errors.push({
      rule: 'unknown_players',
      message: `${unknownPlayers.length} players not in identity registry`,
      severity: 'error',
      affectedRows: unknownPlayers.length,
    });
  }

  // Rule 4: Sanity check on rank distribution
  const ranksPerPosition = new Map<string, number[]>();
  ranks.forEach(r => {
    if (!r.position || !r.rank_overall) return;
    if (!ranksPerPosition.has(r.position)) {
      ranksPerPosition.set(r.position, []);
    }
    ranksPerPosition.get(r.position)!.push(r.rank_overall);
  });

  // Check if any position has suspicious distribution
  ranksPerPosition.forEach((rankList, position) => {
    const avg = rankList.reduce((sum, r) => sum + r, 0) / rankList.length;
    if (avg < 50 || avg > 500) {
      warnings.push({
        rule: 'suspicious_rank_distribution',
        message: `${position} has unusual average rank: ${avg.toFixed(0)}`,
      });
    }
  });

  const errorWeight = errors.filter(e => e.severity === 'error').length * 0.25;
  const warningWeight = warnings.length * 0.05;
  const confidenceScore = Math.max(0, 1 - errorWeight - warningWeight);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    confidenceScore,
  };
}

/**
 * Log validation results to database
 */
export async function logValidationResults(
  batchId: string,
  tableName: string,
  result: ValidationResult
): Promise<void> {
  const logs = [
    ...result.errors.map(error => ({
      batch_id: batchId,
      table_name: tableName,
      rule_name: error.rule,
      severity: error.severity,
      affected_rows: error.affectedRows,
      message: error.message,
      details: error.details,
    })),
    ...result.warnings.map(warning => ({
      batch_id: batchId,
      table_name: tableName,
      rule_name: warning.rule,
      severity: 'warning' as const,
      affected_rows: 0,
      message: warning.message,
      details: warning.details,
    })),
  ];

  if (logs.length > 0) {
    await supabase.from('data_validation_log').insert(logs);
  }
}

/**
 * Update processing status based on validation
 */
export async function updateProcessingStatus(
  tableName: string,
  batchId: string,
  valid: boolean,
  errors: ValidationError[]
): Promise<void> {
  const status = valid ? 'validated' : 'rejected';
  const validationErrors = errors.length > 0 ? errors : null;

  await supabase
    .from(tableName)
    .update({
      processing_status: status,
      validation_errors: validationErrors,
      processed_at: new Date().toISOString(),
    })
    .eq('batch_id', batchId);
}
