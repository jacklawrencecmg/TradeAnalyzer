/**
 * Advanced Doctor Checks
 *
 * Additional comprehensive health checks:
 * - Cache key validation
 * - Orphaned data repair
 * - Stale epoch detection
 * - Ranking integrity
 * - Adjustment sanity
 * - Market anchor validation
 */

import { supabase } from '../supabase';
import type { DoctorFinding } from './runDoctorAudit';

/**
 * Check for stale or mixed epochs
 */
export async function checkEpochConsistency(): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  try {
    // Get all unique epochs currently active
    const { data: epochs } = await supabase
      .from('player_values')
      .select('value_epoch')
      .not('value_epoch', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1000);

    const uniqueEpochs = new Set(epochs?.map((e) => e.value_epoch) || []);

    if (uniqueEpochs.size > 2) {
      findings.push({
        id: 'epoch_multiple_active',
        severity: 'critical',
        title: 'Multiple Epochs Active',
        details: `Found ${uniqueEpochs.size} different epochs active (should be 1-2 during transition)`,
        fix_available: true,
        metadata: { epochs: Array.from(uniqueEpochs), count: uniqueEpochs.size },
      });
    } else if (uniqueEpochs.size === 0) {
      findings.push({
        id: 'epoch_missing',
        severity: 'critical',
        title: 'No Epochs Found',
        details: 'No value_epoch set on any player_values',
        fix_available: true,
      });
    } else {
      findings.push({
        id: 'epoch_consistent',
        severity: 'pass',
        title: 'Epoch Consistency Good',
        details: `${uniqueEpochs.size} epoch(s) active`,
        fix_available: false,
      });
    }

    // Check for values without epoch (should be rare)
    const { count: noEpochCount } = await supabase
      .from('player_values')
      .select('*', { count: 'exact', head: true })
      .is('value_epoch', null);

    if ((noEpochCount || 0) > 50) {
      findings.push({
        id: 'epoch_missing_many',
        severity: 'critical',
        title: 'Many Values Missing Epoch',
        details: `${noEpochCount} values have null epoch`,
        fix_available: true,
        metadata: { count: noEpochCount },
      });
    } else if ((noEpochCount || 0) > 0) {
      findings.push({
        id: 'epoch_missing_few',
        severity: 'warning',
        title: 'Some Values Missing Epoch',
        details: `${noEpochCount} values have null epoch`,
        fix_available: true,
        metadata: { count: noEpochCount },
      });
    }
  } catch (error) {
    findings.push({
      id: 'epoch_check_failed',
      severity: 'warning',
      title: 'Epoch Check Failed',
      details: `Error: ${error}`,
      fix_available: false,
    });
  }

  return findings;
}

/**
 * Check for ranking integrity issues
 */
export async function checkRankingIntegrity(): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  try {
    // Check for duplicate ranks
    const { data: duplicateRanks } = await supabase.rpc('execute_sql', {
      query: `
        SELECT overall_rank, COUNT(*) as count
        FROM player_values
        WHERE format = 'dynasty'
          AND league_profile_id IS NULL
          AND overall_rank IS NOT NULL
        GROUP BY overall_rank
        HAVING COUNT(*) > 1
        LIMIT 10;
      `,
    });

    if (duplicateRanks && duplicateRanks.length > 0) {
      findings.push({
        id: 'ranking_duplicates',
        severity: 'critical',
        title: 'Duplicate Ranking Values',
        details: `Found ${duplicateRanks.length} ranks assigned to multiple players`,
        fix_available: true,
        metadata: { duplicates: duplicateRanks },
      });
    } else {
      findings.push({
        id: 'ranking_unique',
        severity: 'pass',
        title: 'Rankings Are Unique',
        details: 'No duplicate ranks detected',
        fix_available: false,
      });
    }

    // Check rank ordering matches value ordering
    const { data: rankOrderCheck } = await supabase.rpc('execute_sql', {
      query: `
        WITH ranked_by_value AS (
          SELECT
            player_id,
            overall_rank,
            base_value,
            ROW_NUMBER() OVER (ORDER BY base_value DESC) as expected_rank
          FROM player_values
          WHERE format = 'dynasty'
            AND league_profile_id IS NULL
            AND overall_rank IS NOT NULL
          LIMIT 100
        )
        SELECT COUNT(*) as mismatches
        FROM ranked_by_value
        WHERE overall_rank != expected_rank;
      `,
    });

    const mismatches = rankOrderCheck?.[0]?.mismatches || 0;

    if (mismatches > 10) {
      findings.push({
        id: 'ranking_order_wrong',
        severity: 'critical',
        title: 'Ranking Order Mismatches Value Order',
        details: `${mismatches} players have ranks that don't match their value order`,
        fix_available: true,
        metadata: { mismatches },
      });
    } else if (mismatches > 0) {
      findings.push({
        id: 'ranking_order_minor',
        severity: 'warning',
        title: 'Minor Ranking Order Issues',
        details: `${mismatches} players have slight rank/value mismatches`,
        fix_available: true,
        metadata: { mismatches },
      });
    } else {
      findings.push({
        id: 'ranking_order_correct',
        severity: 'pass',
        title: 'Ranking Order Matches Value Order',
        details: 'Ranks correctly ordered by value',
        fix_available: false,
      });
    }
  } catch (error) {
    findings.push({
      id: 'ranking_check_failed',
      severity: 'warning',
      title: 'Ranking Integrity Check Failed',
      details: `Error: ${error}`,
      fix_available: false,
    });
  }

  return findings;
}

/**
 * Check adjustment sanity (reasonable ranges)
 */
export async function checkAdjustmentSanity(): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  try {
    // Find players with extreme adjustments
    const { data: extremeAdjustments } = await supabase.rpc('execute_sql', {
      query: `
        SELECT
          player_id,
          position,
          scarcity_adjustment,
          league_adjustment,
          (COALESCE(scarcity_adjustment, 0) + COALESCE(league_adjustment, 0)) as total_adjustment
        FROM player_values
        WHERE format = 'dynasty'
          AND league_profile_id IS NULL
          AND ABS(COALESCE(scarcity_adjustment, 0) + COALESCE(league_adjustment, 0)) > 1500
        LIMIT 20;
      `,
    });

    if (extremeAdjustments && extremeAdjustments.length > 0) {
      findings.push({
        id: 'adjustment_extreme',
        severity: 'critical',
        title: 'Extreme Adjustments Detected',
        details: `Found ${extremeAdjustments.length} players with total adjustments > ±1500`,
        fix_available: true,
        metadata: { extreme: extremeAdjustments },
      });
    }

    // Check for unreasonable scarcity adjustments
    const { data: extremeScarcity } = await supabase.rpc('execute_sql', {
      query: `
        SELECT COUNT(*) as count
        FROM player_values
        WHERE format = 'dynasty'
          AND league_profile_id IS NULL
          AND ABS(COALESCE(scarcity_adjustment, 0)) > 500;
      `,
    });

    const scarcityCount = extremeScarcity?.[0]?.count || 0;

    if (scarcityCount > 50) {
      findings.push({
        id: 'adjustment_scarcity_extreme',
        severity: 'warning',
        title: 'Extreme Scarcity Adjustments',
        details: `${scarcityCount} players have scarcity adjustment > ±500`,
        fix_available: true,
        metadata: { count: scarcityCount },
      });
    }

    // Check for unreasonable league adjustments
    const { data: extremeLeague } = await supabase.rpc('execute_sql', {
      query: `
        SELECT COUNT(*) as count
        FROM player_values
        WHERE format = 'dynasty'
          AND league_profile_id IS NULL
          AND ABS(COALESCE(league_adjustment, 0)) > 1000;
      `,
    });

    const leagueCount = extremeLeague?.[0]?.count || 0;

    if (leagueCount > 20) {
      findings.push({
        id: 'adjustment_league_extreme',
        severity: 'warning',
        title: 'Extreme League Adjustments',
        details: `${leagueCount} players have league adjustment > ±1000`,
        fix_available: true,
        metadata: { count: leagueCount },
      });
    }

    if (
      extremeAdjustments?.length === 0 &&
      scarcityCount < 50 &&
      leagueCount < 20
    ) {
      findings.push({
        id: 'adjustment_reasonable',
        severity: 'pass',
        title: 'Adjustments Within Reasonable Ranges',
        details: 'All adjustments are reasonable',
        fix_available: false,
      });
    }
  } catch (error) {
    findings.push({
      id: 'adjustment_check_failed',
      severity: 'warning',
      title: 'Adjustment Sanity Check Failed',
      details: `Error: ${error}`,
      fix_available: false,
    });
  }

  return findings;
}

/**
 * Check for orphaned data across tables
 */
export async function checkOrphanedData(): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  try {
    // Values for missing players (player_identity)
    const { data: orphanedValues } = await supabase.rpc('execute_sql', {
      query: `
        SELECT COUNT(*) as count
        FROM player_values pv
        LEFT JOIN player_identity pi ON pi.player_id = pv.player_id
        WHERE pi.player_id IS NULL;
      `,
    });

    const orphanedValueCount = orphanedValues?.[0]?.count || 0;

    if (orphanedValueCount > 100) {
      findings.push({
        id: 'orphaned_values',
        severity: 'critical',
        title: 'Values For Missing Players',
        details: `${orphanedValueCount} player_values rows have no matching player`,
        fix_available: true,
        metadata: { count: orphanedValueCount },
      });
    } else if (orphanedValueCount > 0) {
      findings.push({
        id: 'orphaned_values_minor',
        severity: 'warning',
        title: 'Some Orphaned Values',
        details: `${orphanedValueCount} values have no matching player`,
        fix_available: true,
        metadata: { count: orphanedValueCount },
      });
    }

    // Players missing values (active players with no values)
    const { data: noValues } = await supabase.rpc('execute_sql', {
      query: `
        SELECT COUNT(*) as count
        FROM player_identity pi
        LEFT JOIN player_values pv ON pv.player_id = pi.player_id AND pv.format = 'dynasty'
        WHERE pi.status = 'active'
          AND pi.position IN ('QB', 'RB', 'WR', 'TE')
          AND pv.player_id IS NULL;
      `,
    });

    const noValueCount = noValues?.[0]?.count || 0;

    if (noValueCount > 50) {
      findings.push({
        id: 'players_missing_values',
        severity: 'critical',
        title: 'Active Players Missing Values',
        details: `${noValueCount} active players have no dynasty values`,
        fix_available: true,
        metadata: { count: noValueCount },
      });
    } else if (noValueCount > 20) {
      findings.push({
        id: 'players_missing_values_minor',
        severity: 'warning',
        title: 'Some Players Missing Values',
        details: `${noValueCount} active players missing values`,
        fix_available: true,
        metadata: { count: noValueCount },
      });
    }

    // Duplicate player_id + format + profile combinations
    const { data: duplicates } = await supabase.rpc('execute_sql', {
      query: `
        SELECT player_id, format, league_profile_id, COUNT(*) as count
        FROM player_values
        GROUP BY player_id, format, league_profile_id
        HAVING COUNT(*) > 1
        LIMIT 20;
      `,
    });

    if (duplicates && duplicates.length > 0) {
      findings.push({
        id: 'duplicate_values',
        severity: 'critical',
        title: 'Duplicate Value Entries',
        details: `Found ${duplicates.length} duplicate (player, format, profile) combinations`,
        fix_available: true,
        metadata: { duplicates },
      });
    }

    if (orphanedValueCount === 0 && noValueCount < 20 && (!duplicates || duplicates.length === 0)) {
      findings.push({
        id: 'no_orphaned_data',
        severity: 'pass',
        title: 'No Orphaned Data Detected',
        details: 'All data relationships are intact',
        fix_available: false,
      });
    }
  } catch (error) {
    findings.push({
      id: 'orphaned_check_failed',
      severity: 'warning',
      title: 'Orphaned Data Check Failed',
      details: `Error: ${error}`,
      fix_available: false,
    });
  }

  return findings;
}

/**
 * Check market anchor sanity (extreme outliers)
 */
export async function checkMarketAnchor(): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];

  try {
    // Find players where our value drastically differs from market consensus
    // This would integrate with your market_consensus table if it exists

    // For now, check for extreme value outliers by position
    const { data: outliers } = await supabase.rpc('execute_sql', {
      query: `
        WITH position_stats AS (
          SELECT
            position,
            AVG(base_value) as avg_value,
            STDDEV(base_value) as stddev_value
          FROM player_values
          WHERE format = 'dynasty'
            AND league_profile_id IS NULL
            AND base_value > 0
          GROUP BY position
        )
        SELECT
          pv.player_id,
          pv.position,
          pv.base_value,
          ps.avg_value,
          ps.stddev_value,
          ABS(pv.base_value - ps.avg_value) / NULLIF(ps.stddev_value, 0) as z_score
        FROM player_values pv
        JOIN position_stats ps ON ps.position = pv.position
        WHERE pv.format = 'dynasty'
          AND pv.league_profile_id IS NULL
          AND ABS(pv.base_value - ps.avg_value) / NULLIF(ps.stddev_value, 0) > 3
        LIMIT 20;
      `,
    });

    if (outliers && outliers.length > 10) {
      findings.push({
        id: 'market_extreme_outliers',
        severity: 'warning',
        title: 'Extreme Value Outliers Detected',
        details: `Found ${outliers.length} players with values >3σ from position average`,
        fix_available: false, // Manual review needed
        metadata: { outliers },
      });
    } else if (outliers && outliers.length > 0) {
      findings.push({
        id: 'market_some_outliers',
        severity: 'pass',
        title: 'Some Value Outliers Detected',
        details: `Found ${outliers.length} outliers (expected for elite/rookie players)`,
        fix_available: false,
        metadata: { outliers },
      });
    } else {
      findings.push({
        id: 'market_no_outliers',
        severity: 'pass',
        title: 'Value Distribution Normal',
        details: 'No extreme outliers detected',
        fix_available: false,
      });
    }
  } catch (error) {
    findings.push({
      id: 'market_check_failed',
      severity: 'warning',
      title: 'Market Anchor Check Failed',
      details: `Error: ${error}`,
      fix_available: false,
    });
  }

  return findings;
}
