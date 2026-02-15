/**
 * Season Rollover System
 *
 * Automatically handles transition between NFL seasons:
 * - Increments last_completed_season
 * - Updates value_epoch
 * - Invalidates old values
 * - Triggers full rebuild
 * - Regenerates exports
 *
 * Should run automatically when regular season + playoffs end (early February)
 */

import { supabase } from '../supabase';
import { SEASON_CONTEXT } from '../../config/seasonContext';
import { rebuildAllPlayerValues } from './rebuildAllPlayerValues';

export interface RolloverResult {
  success: boolean;
  from_season: number;
  to_season: number;
  from_epoch: string;
  to_epoch: string;
  invalidated_values: number;
  rebuild_result?: any;
  duration_ms: number;
  errors: string[];
}

/**
 * Check if season rollover is needed
 * Returns true if we're past the season end date and haven't rolled over yet
 */
export function needsSeasonRollover(): boolean {
  const now = new Date();
  const seasonEnd = new Date(SEASON_CONTEXT.season_end_date);

  // Check if we're past season end
  if (now < seasonEnd) {
    return false;
  }

  // Check if we're still on the old epoch
  // If current year is greater than last_completed_season + 1, we need rollover
  const currentYear = now.getFullYear();
  const expectedCompletedSeason = currentYear - 1; // If it's 2026, last completed should be 2025

  return SEASON_CONTEXT.last_completed_season < expectedCompletedSeason;
}

/**
 * Perform season rollover
 * WARNING: This is a destructive operation that invalidates all current values
 */
export async function performSeasonRollover(): Promise<RolloverResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  const fromSeason = SEASON_CONTEXT.last_completed_season;
  const fromEpoch = SEASON_CONTEXT.value_epoch;
  const toSeason = fromSeason + 1;
  const toEpoch = `POST_${toSeason}`;

  console.log(`Starting season rollover: ${fromSeason} → ${toSeason}`);
  console.log(`Epoch change: ${fromEpoch} → ${toEpoch}`);

  try {
    // Step 1: Archive all current values
    console.log('Step 1: Archiving current values...');
    const { data: currentValues } = await supabase
      .from('value_snapshots')
      .select('*');

    if (currentValues && currentValues.length > 0) {
      const archiveRecords = currentValues.map(v => ({
        ...v,
        archived_at: new Date().toISOString(),
        archive_reason: `SEASON_ROLLOVER_${toSeason}`,
      }));

      const { error: archiveError } = await supabase
        .from('value_snapshots_archive')
        .insert(archiveRecords);

      if (archiveError) {
        errors.push(`Archive error: ${archiveError.message}`);
      }
    }

    const archivedCount = currentValues?.length || 0;
    console.log(`Archived ${archivedCount} value snapshots`);

    // Step 2: Delete all current values
    console.log('Step 2: Clearing current values...');
    const { error: deleteError } = await supabase
      .from('value_snapshots')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      errors.push(`Delete error: ${deleteError.message}`);
    }

    // Step 3: Clear top_1000_current
    console.log('Step 3: Clearing Top 1000 cache...');
    const { error: top1000Error } = await supabase
      .from('top_1000_current')
      .delete()
      .neq('as_of_date', '1900-01-01'); // Delete all

    if (top1000Error) {
      errors.push(`Top 1000 clear error: ${top1000Error.message}`);
    }

    // Step 4: Update season context in database (create settings table if needed)
    console.log('Step 4: Updating season context...');
    await updateSeasonContextInDb(toSeason, toEpoch);

    // Step 5: Trigger full value rebuild
    console.log('Step 5: Rebuilding all values with new season data...');
    const rebuildResult = await rebuildAllPlayerValues();

    if (!rebuildResult.success) {
      errors.push(...rebuildResult.errors);
    }

    // Step 6: Record rollover in sync_status
    const duration = Date.now() - startTime;
    await supabase.from('sync_status').insert({
      sync_type: 'season_rollover',
      status: errors.length > 0 ? 'partial_success' : 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      metadata: {
        from_season: fromSeason,
        to_season: toSeason,
        from_epoch: fromEpoch,
        to_epoch: toEpoch,
        invalidated_count: archivedCount,
        rebuild_success: rebuildResult.success,
        errors: errors.slice(0, 10),
      },
    });

    console.log(`Season rollover complete in ${duration}ms`);
    console.log(`- Invalidated ${archivedCount} old values`);
    console.log(`- Rebuilt ${rebuildResult.values_created} new values`);
    console.log(`- Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      from_season: fromSeason,
      to_season: toSeason,
      from_epoch: fromEpoch,
      to_epoch: toEpoch,
      invalidated_values: archivedCount,
      rebuild_result: rebuildResult,
      duration_ms: duration,
      errors,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('Season rollover failed:', errorMessage);
    errors.push(errorMessage);

    // Record failed rollover
    await supabase.from('sync_status').insert({
      sync_type: 'season_rollover',
      status: 'error',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      error_message: errorMessage,
      metadata: {
        from_season: fromSeason,
        to_season: toSeason,
        errors: errors,
      },
    });

    return {
      success: false,
      from_season: fromSeason,
      to_season: toSeason,
      from_epoch: fromEpoch,
      to_epoch: toEpoch,
      invalidated_values: 0,
      duration_ms: duration,
      errors,
    };
  }
}

/**
 * Update season context in database
 * Creates system_settings table if needed
 */
async function updateSeasonContextInDb(newSeason: number, newEpoch: string): Promise<void> {
  // Create system_settings table if not exists
  const { error: tableError } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS system_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz DEFAULT now()
      );
    `,
  });

  // Upsert season context
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key: 'season_context',
      value: {
        league_year: newSeason + 1,
        last_completed_season: newSeason,
        value_epoch: newEpoch,
        updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    });

  if (error && !error.message.includes('does not exist')) {
    console.warn('Could not update season context in database:', error);
  }
}

/**
 * Get last rollover status
 */
export async function getLastRolloverStatus() {
  const { data } = await supabase
    .from('sync_status')
    .select('*')
    .eq('sync_type', 'season_rollover')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/**
 * Schedule next rollover check
 * Returns date when next rollover should be checked
 */
export function getNextRolloverCheckDate(): Date {
  // Check 7 days after season end date
  const seasonEnd = new Date(SEASON_CONTEXT.season_end_date);
  const nextCheck = new Date(seasonEnd);
  nextCheck.setDate(nextCheck.getDate() + 7);
  return nextCheck;
}

/**
 * Get rollover preview (dry run)
 * Shows what would happen without making changes
 */
export async function previewSeasonRollover() {
  const fromSeason = SEASON_CONTEXT.last_completed_season;
  const toSeason = fromSeason + 1;
  const fromEpoch = SEASON_CONTEXT.value_epoch;
  const toEpoch = `POST_${toSeason}`;

  // Count current values
  const { count: currentValuesCount } = await supabase
    .from('value_snapshots')
    .select('*', { count: 'exact', head: true });

  // Count top 1000 entries
  const { count: top1000Count } = await supabase
    .from('top_1000_current')
    .select('*', { count: 'exact', head: true });

  return {
    from_season: fromSeason,
    to_season: toSeason,
    from_epoch: fromEpoch,
    to_epoch: toEpoch,
    current_values_count: currentValuesCount || 0,
    top1000_entries: top1000Count || 0,
    estimated_duration_minutes: 5,
    warnings: [
      'This will archive all current values',
      'This will clear the Top 1000 cache',
      'This will trigger a full rebuild',
      'This process cannot be undone (but values are archived)',
    ],
  };
}
