/**
 * Automatic Rollback System
 *
 * Saves snapshots of player values before rebuilds.
 * Can restore last good state if validation fails.
 *
 * Flow:
 * 1. Before rebuild: Save snapshot
 * 2. After rebuild: Validate new values
 * 3. If validation fails: Restore snapshot + trigger safe mode
 * 4. Keep last 7 days of snapshots
 */

import { supabase } from '../supabase';

export interface Snapshot {
  id: string;
  epoch: string;
  stats: {
    totalPlayers: number;
    dynastyPlayers: number;
    redraftPlayers: number;
    avgValue: number;
    positions: Record<string, number>;
  };
  createdAt: string;
}

/**
 * Create value snapshot
 *
 * Saves current player values for potential rollback
 */
export async function createValueSnapshot(): Promise<string | null> {
  try {
    const epoch = new Date().toISOString();

    console.log('Creating value snapshot:', epoch);

    // Get all player values
    const { data: values } = await supabase
      .from('player_values')
      .select('*')
      .not('fdp_value', 'is', null);

    if (!values || values.length === 0) {
      console.error('No values to snapshot');
      return null;
    }

    // Calculate statistics
    const dynastyCount = values.filter((v) => v.format === 'dynasty').length;
    const redraftCount = values.filter((v) => v.format === 'redraft').length;
    const avgValue =
      values.reduce((sum, v) => sum + (v.fdp_value || 0), 0) / values.length;

    const positions: Record<string, number> = {};
    values.forEach((v) => {
      positions[v.position] = (positions[v.position] || 0) + 1;
    });

    const stats = {
      totalPlayers: values.length,
      dynastyPlayers: dynastyCount,
      redraftPlayers: redraftCount,
      avgValue: Math.round(avgValue),
      positions,
    };

    // Store snapshot
    const { data: snapshot, error } = await supabase
      .from('value_snapshots')
      .insert({
        epoch,
        data: values, // Store full data
        stats,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating snapshot:', error);
      return null;
    }

    console.log(`Snapshot created: ${epoch} (${values.length} players)`);

    // Clean up old snapshots (keep last 7 days)
    await cleanupOldSnapshots(7);

    return snapshot.id;
  } catch (error) {
    console.error('Error creating value snapshot:', error);
    return null;
  }
}

/**
 * Restore value snapshot
 *
 * Restores player values from snapshot
 */
export async function restoreValueSnapshot(snapshotId: string): Promise<boolean> {
  try {
    console.log('Restoring snapshot:', snapshotId);

    // Get snapshot
    const { data: snapshot, error: fetchError } = await supabase
      .from('value_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .maybeSingle();

    if (fetchError || !snapshot) {
      console.error('Error fetching snapshot:', fetchError);
      return false;
    }

    const values = snapshot.data as any[];

    if (!values || values.length === 0) {
      console.error('Snapshot has no data');
      return false;
    }

    // Delete current values
    const { error: deleteError } = await supabase
      .from('player_values')
      .delete()
      .not('id', 'is', null); // Delete all

    if (deleteError) {
      console.error('Error deleting current values:', deleteError);
      return false;
    }

    // Restore snapshot values
    const { error: insertError } = await supabase
      .from('player_values')
      .insert(values);

    if (insertError) {
      console.error('Error restoring snapshot values:', insertError);
      return false;
    }

    // Create alert
    await supabase.from('system_alerts').insert({
      severity: 'critical',
      message: `Values restored from snapshot: ${snapshot.epoch}`,
      alert_type: 'snapshot_restored',
      metadata: {
        snapshotId,
        epoch: snapshot.epoch,
        playersRestored: values.length,
      },
    });

    console.log(`Snapshot restored: ${snapshot.epoch} (${values.length} players)`);

    return true;
  } catch (error) {
    console.error('Error restoring snapshot:', error);
    return false;
  }
}

/**
 * Restore latest snapshot
 */
export async function restoreLatestSnapshot(): Promise<boolean> {
  try {
    const { data: snapshot } = await supabase
      .from('value_snapshots')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!snapshot) {
      console.error('No snapshots available');
      return false;
    }

    return await restoreValueSnapshot(snapshot.id);
  } catch (error) {
    console.error('Error restoring latest snapshot:', error);
    return false;
  }
}

/**
 * Get snapshot history
 */
export async function getSnapshotHistory(limit: number = 10): Promise<Snapshot[]> {
  try {
    const { data } = await supabase
      .from('value_snapshots')
      .select('id, epoch, stats, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map((s) => ({
      id: s.id,
      epoch: s.epoch,
      stats: s.stats as Snapshot['stats'],
      createdAt: s.created_at,
    }));
  } catch (error) {
    console.error('Error getting snapshot history:', error);
    return [];
  }
}

/**
 * Get latest snapshot
 */
export async function getLatestSnapshot(): Promise<Snapshot | null> {
  try {
    const { data } = await supabase
      .from('value_snapshots')
      .select('id, epoch, stats, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      epoch: data.epoch,
      stats: data.stats as Snapshot['stats'],
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error getting latest snapshot:', error);
    return null;
  }
}

/**
 * Clean up old snapshots
 */
async function cleanupOldSnapshots(daysToKeep: number = 7): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('value_snapshots')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      console.error('Error cleaning up old snapshots:', error);
    } else {
      console.log(`Cleaned up snapshots older than ${daysToKeep} days`);
    }
  } catch (error) {
    console.error('Error cleaning up old snapshots:', error);
  }
}

/**
 * Safe rebuild with automatic rollback
 *
 * Wraps rebuild process with snapshot/validation/rollback logic
 */
export async function safeRebuild(rebuildFn: () => Promise<void>): Promise<boolean> {
  let snapshotId: string | null = null;

  try {
    // Step 1: Create snapshot
    console.log('Step 1: Creating snapshot...');
    snapshotId = await createValueSnapshot();

    if (!snapshotId) {
      console.error('Failed to create snapshot - aborting rebuild');
      return false;
    }

    // Step 2: Run rebuild
    console.log('Step 2: Running rebuild...');
    const startTime = Date.now();

    try {
      await rebuildFn();
    } catch (rebuildError) {
      const duration = Date.now() - startTime;
      console.error('Rebuild failed:', rebuildError);

      // Record failure
      await supabase.rpc('record_rebuild_attempt', {
        p_status: 'failed',
        p_duration_ms: duration,
        p_error_message: rebuildError instanceof Error ? rebuildError.message : 'Unknown error',
      });

      // Restore snapshot
      console.log('Step 3a: Restoring snapshot after rebuild failure...');
      await restoreValueSnapshot(snapshotId);

      return false;
    }

    const duration = Date.now() - startTime;

    // Step 3: Validate new values
    console.log('Step 3: Validating new values...');
    const { validateLatestValues } = await import('./validateLatestValues');
    const validation = await validateLatestValues();

    if (!validation.passed || validation.status === 'critical') {
      console.error('Validation failed:', validation.summary);

      // Record failure
      await supabase.rpc('record_rebuild_attempt', {
        p_status: 'failed',
        p_duration_ms: duration,
        p_error_message: `Validation failed: ${validation.summary}`,
      });

      // Restore snapshot
      console.log('Step 4a: Restoring snapshot after validation failure...');
      await restoreValueSnapshot(snapshotId);

      // Trigger safe mode
      await triggerSafeMode('validation_failed', validation);

      return false;
    }

    // Success!
    console.log('Step 4: Rebuild successful and validated!');

    // Record success
    await supabase.rpc('record_rebuild_attempt', {
      p_status: 'success',
      p_duration_ms: duration,
    });

    return true;
  } catch (error) {
    console.error('Error in safe rebuild:', error);

    // Try to restore snapshot
    if (snapshotId) {
      console.log('Emergency: Restoring snapshot...');
      await restoreValueSnapshot(snapshotId);
    }

    return false;
  }
}

/**
 * Trigger safe mode
 */
async function triggerSafeMode(reason: string, metadata: any) {
  try {
    const { data: existingMode } = await supabase
      .from('system_safe_mode')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingMode) {
      await supabase
        .from('system_safe_mode')
        .update({
          enabled: true,
          reason: `Validation failed: ${reason}`,
          critical_issues: metadata,
          enabled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMode.id);
    } else {
      await supabase.from('system_safe_mode').insert({
        enabled: true,
        reason: `Validation failed: ${reason}`,
        critical_issues: metadata,
        enabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    console.error('SAFE MODE ACTIVATED:', reason);
  } catch (error) {
    console.error('Error triggering safe mode:', error);
  }
}

/**
 * Compare snapshot to current values
 */
export async function compareToSnapshot(snapshotId: string): Promise<{
  playersDiff: number;
  avgValueDiff: number;
  positionDiffs: Record<string, number>;
}> {
  try {
    const { data: snapshot } = await supabase
      .from('value_snapshots')
      .select('stats')
      .eq('id', snapshotId)
      .maybeSingle();

    if (!snapshot) {
      return { playersDiff: 0, avgValueDiff: 0, positionDiffs: {} };
    }

    const snapshotStats = snapshot.stats as Snapshot['stats'];

    // Get current stats
    const { count: currentCount } = await supabase
      .from('player_values')
      .select('*', { count: 'exact', head: true })
      .not('fdp_value', 'is', null);

    const { data: values } = await supabase
      .from('player_values')
      .select('fdp_value, position')
      .not('fdp_value', 'is', null);

    const currentAvg = values?.reduce((sum, v) => sum + (v.fdp_value || 0), 0) / (values?.length || 1) || 0;

    const currentPositions: Record<string, number> = {};
    values?.forEach((v) => {
      currentPositions[v.position] = (currentPositions[v.position] || 0) + 1;
    });

    const positionDiffs: Record<string, number> = {};
    Object.keys(snapshotStats.positions).forEach((pos) => {
      positionDiffs[pos] = (currentPositions[pos] || 0) - snapshotStats.positions[pos];
    });

    return {
      playersDiff: (currentCount || 0) - snapshotStats.totalPlayers,
      avgValueDiff: currentAvg - snapshotStats.avgValue,
      positionDiffs,
    };
  } catch (error) {
    console.error('Error comparing to snapshot:', error);
    return { playersDiff: 0, avgValueDiff: 0, positionDiffs: {} };
  }
}
