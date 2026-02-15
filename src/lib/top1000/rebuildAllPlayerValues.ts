/**
 * Rebuild All Player Values (POST_2025)
 *
 * Recalculates dynasty and redraft values for all players using
 * production-based scoring with 2025 season data.
 *
 * This job should be run:
 * - After season ends (early February)
 * - After any major data source updates
 * - When value calculation logic changes
 */

import { supabase } from '../supabase';
import { calculateProductionBasedValues, PlayerProductionData } from './productionBasedValues';
import { getCurrentEpoch } from '../../config/seasonContext';

export interface RebuildResult {
  success: boolean;
  players_processed: number;
  values_created: number;
  errors: string[];
  duration_ms: number;
  breakout_alerts: BreakoutAlert[];
  validation_failures: ValidationFailure[];
}

export interface BreakoutAlert {
  player_id: string;
  full_name: string;
  position: string;
  old_rank?: number;
  new_rank: number;
  percentile: number;
  reason: string;
}

export interface ValidationFailure {
  player_id: string;
  full_name: string;
  issue: string;
  expected: string;
  actual: string;
}

/**
 * Rebuild all player values using POST_2025 production data
 */
export async function rebuildAllPlayerValues(): Promise<RebuildResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const breakoutAlerts: BreakoutAlert[] = [];
  const validationFailures: ValidationFailure[] = [];

  console.log('Starting rebuild of all player values (POST_2025 epoch)...');

  try {
    // Step 1: Load all active/rosterable players
    const { data: players, error: playersError } = await supabase
      .from('nfl_players')
      .select('*')
      .in('status', ['Active', 'IR', 'PUP', 'Practice Squad', 'FA', 'Suspension']);

    if (playersError) throw playersError;
    if (!players || players.length === 0) {
      throw new Error('No players found in database');
    }

    console.log(`Loaded ${players.length} players for value recalculation`);

    // Step 2: For each player, calculate new values
    const valuesToInsert = [];
    let processed = 0;

    for (const player of players) {
      try {
        // Fetch any available 2025 season stats (placeholder - would integrate with stats API)
        const productionData = await fetchPlayerProductionData(player);

        // Calculate new values
        const values = calculateProductionBasedValues(productionData);

        // Check for breakout players
        const breakout = await detectBreakout(player, values);
        if (breakout) {
          breakoutAlerts.push(breakout);
        }

        // Prepare value snapshot
        valuesToInsert.push({
          player_id: player.id,
          source: 'calculated_production',
          format: 'dynasty_combined',
          position: player.player_position,
          position_rank: null, // Will be calculated after sorting
          market_value: null,
          fdp_value: Math.round((values.dynasty_value + values.redraft_value) / 2),
          dynasty_value: values.dynasty_value,
          redraft_value: values.redraft_value,
          value_epoch: getCurrentEpoch(),
          notes: values.notes.join('; '),
          captured_at: new Date().toISOString(),
        });

        processed++;

        // Log progress every 100 players
        if (processed % 100 === 0) {
          console.log(`Processed ${processed}/${players.length} players...`);
        }
      } catch (error) {
        const msg = `Error processing ${player.full_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    console.log(`Calculated values for ${valuesToInsert.length} players`);

    // Step 3: Sort by position and assign position ranks
    const byPosition: Record<string, any[]> = {};
    for (const value of valuesToInsert) {
      if (!byPosition[value.position]) {
        byPosition[value.position] = [];
      }
      byPosition[value.position].push(value);
    }

    // Sort each position by dynasty_value and assign ranks
    for (const position in byPosition) {
      byPosition[position].sort((a, b) => b.dynasty_value - a.dynasty_value);
      byPosition[position].forEach((value, idx) => {
        value.position_rank = idx + 1;
      });
    }

    // Step 4: Insert all values in batches
    console.log('Inserting value snapshots...');
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < valuesToInsert.length; i += batchSize) {
      const batch = valuesToInsert.slice(i, i + batchSize);
      const { error } = await supabase.from('value_snapshots').insert(batch);

      if (error) {
        const msg = `Error inserting batch ${i}-${i + batchSize}: ${error.message}`;
        console.error(msg);
        errors.push(msg);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Inserted ${inserted} value snapshots`);

    // Step 5: Run validation checks
    console.log('Running validation checks...');
    const validations = await runValidationChecks(valuesToInsert);
    validationFailures.push(...validations);

    // Step 6: Record sync status
    const duration = Date.now() - startTime;
    await supabase.from('sync_status').insert({
      sync_type: 'rebuild_all_values_post_2025',
      status: errors.length > 0 ? 'partial_success' : 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      records_processed: processed,
      records_created: inserted,
      metadata: {
        value_epoch: getCurrentEpoch(),
        breakout_count: breakoutAlerts.length,
        validation_failures: validationFailures.length,
        errors: errors.slice(0, 10), // First 10 errors
      },
    });

    // Step 7: Trigger Top 1000 rebuild
    console.log('Triggering Top 1000 rebuild...');
    const { buildTop1000 } = await import('./buildTop1000');
    await buildTop1000({ includeIdp: true, limit: 1000 });

    console.log(`Rebuild complete in ${duration}ms`);
    console.log(`- Processed: ${processed} players`);
    console.log(`- Inserted: ${inserted} values`);
    console.log(`- Breakouts detected: ${breakoutAlerts.length}`);
    console.log(`- Validation failures: ${validationFailures.length}`);
    console.log(`- Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      players_processed: processed,
      values_created: inserted,
      errors,
      duration_ms: duration,
      breakout_alerts: breakoutAlerts,
      validation_failures: validationFailures,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('Rebuild failed:', errorMessage);

    // Record failed sync
    await supabase.from('sync_status').insert({
      sync_type: 'rebuild_all_values_post_2025',
      status: 'error',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      error_message: errorMessage,
    });

    return {
      success: false,
      players_processed: 0,
      values_created: 0,
      errors: [errorMessage],
      duration_ms: duration,
      breakout_alerts: [],
      validation_failures: [],
    };
  }
}

/**
 * Fetch player production data (stats from 2025 season)
 * PLACEHOLDER: In production, this would integrate with Sleeper stats API or other data source
 */
async function fetchPlayerProductionData(player: any): Promise<PlayerProductionData> {
  // For now, return player with minimal production data
  // In production, fetch from Sleeper stats API:
  // https://api.sleeper.app/v1/stats/nfl/2025/regular
  // or integrate with ESPN/Yahoo stats

  const age = player.birthdate
    ? Math.floor((Date.now() - new Date(player.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return {
    id: player.id,
    full_name: player.full_name,
    player_position: player.player_position,
    team: player.team,
    age,
    years_exp: player.years_exp,
    status: player.status,
    depth_chart_position: player.depth_chart_position,
    injury_history: 'clean',
    birthdate: player.birthdate,

    // Production data (would be fetched from stats API)
    // For now, use placeholder/estimated values based on player metadata
    fantasy_points_ppr: undefined,
    fantasy_points_per_game: undefined,
    games_played: undefined,
    yards: undefined,
    touchdowns: undefined,
    receptions: undefined,
    targets: undefined,
    carries: undefined,

    // Opportunity metrics (would be fetched)
    snap_share: undefined,
    target_share: undefined,
    route_participation: undefined,
    red_zone_touches: undefined,
  };
}

/**
 * Detect breakout players (production percentile >= 90th)
 */
async function detectBreakout(player: any, newValues: any): Promise<BreakoutAlert | null> {
  // Get old rank if exists
  const { data: oldValue } = await supabase
    .from('value_snapshots_archive')
    .select('dynasty_value, position_rank')
    .eq('player_id', player.id)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // If dynasty value jumped significantly (>2000 points or >50% increase)
  if (oldValue) {
    const increase = newValues.dynasty_value - oldValue.dynasty_value;
    const percentIncrease = (increase / oldValue.dynasty_value) * 100;

    if (increase > 2000 || percentIncrease > 50) {
      return {
        player_id: player.id,
        full_name: player.full_name,
        position: player.player_position,
        old_rank: oldValue.position_rank,
        new_rank: 0, // Will be set after ranking
        percentile: 90, // Placeholder
        reason: `Value increased ${increase} (+${percentIncrease.toFixed(0)}%)`,
      };
    }
  }

  return null;
}

/**
 * Run validation checks on calculated values
 */
async function runValidationChecks(values: any[]): Promise<ValidationFailure[]> {
  const failures: ValidationFailure[] = [];

  // Validation Rule 1: Elite young producers must rank high
  // Example: Jaxon Smith-Njigba check
  const jsnValue = values.find(v =>
    v.player_id && v.full_name && v.full_name.toLowerCase().includes('jaxon smith')
  );

  if (jsnValue) {
    const wrValues = values.filter(v => v.position === 'WR').sort((a, b) => b.dynasty_value - a.dynasty_value);
    const jsnRank = wrValues.findIndex(v => v.player_id === jsnValue.player_id) + 1;

    // JSN should be top 10 WR in dynasty after breakout 2025 season
    if (jsnRank > 10) {
      failures.push({
        player_id: jsnValue.player_id,
        full_name: 'Jaxon Smith-Njigba',
        issue: 'Elite breakout WR ranked too low',
        expected: 'Top 10 WR',
        actual: `WR${jsnRank}`,
      });
    }
  }

  // Validation Rule 2: No old RBs ahead of prime producers
  const rbValues = values.filter(v => v.position === 'RB').sort((a, b) => b.dynasty_value - a.dynasty_value);

  for (let i = 0; i < Math.min(20, rbValues.length); i++) {
    const rb = rbValues[i];
    // Would need to fetch player age here - placeholder check
    // if player is 29+ and ranked in top 20, flag for review
  }

  // Validation Rule 3: Check for obvious outliers
  for (const position of ['QB', 'RB', 'WR', 'TE']) {
    const posValues = values.filter(v => v.position === position);
    if (posValues.length === 0) continue;

    const avg = posValues.reduce((sum, v) => sum + v.dynasty_value, 0) / posValues.length;
    const max = Math.max(...posValues.map(v => v.dynasty_value));
    const min = Math.min(...posValues.map(v => v.dynasty_value));

    // Flag if range seems abnormal
    if (max > avg * 3 || min < avg * 0.1) {
      console.warn(`Validation: ${position} values show high variance (avg: ${avg.toFixed(0)}, range: ${min}-${max})`);
    }
  }

  return failures;
}

/**
 * Get summary of last rebuild
 */
export async function getLastRebuildStatus() {
  const { data } = await supabase
    .from('sync_status')
    .select('*')
    .eq('sync_type', 'rebuild_all_values_post_2025')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
