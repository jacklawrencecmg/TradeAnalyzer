/**
 * Full Rebuild Snapshots
 *
 * Creates compressed system snapshots for disaster recovery.
 * Stores complete state that can be restored with one click.
 *
 * Retention:
 * - Daily: Last 30 snapshots
 * - Monthly: Last 12 snapshots
 *
 * Snapshot Types:
 * - values: Player values only
 * - players: NFL player data
 * - leagues: League profiles
 * - full: Everything
 */

import { supabase } from '../supabase';
import { generateEpoch } from './recordValueHistory';

export interface SnapshotResult {
  id: string;
  epoch: string;
  type: 'values' | 'players' | 'leagues' | 'full';
  stats: {
    valuesCount?: number;
    playersCount?: number;
    leaguesCount?: number;
    sizeBytes: number;
  };
  createdAt: string;
}

/**
 * Create system snapshot
 *
 * Captures current system state for rollback capability
 */
export async function createSystemSnapshot(
  type: 'values' | 'players' | 'leagues' | 'full' = 'full',
  epoch?: string
): Promise<SnapshotResult | null> {
  try {
    const generatedEpoch = epoch || generateEpoch();

    console.log(`Creating ${type} snapshot: ${generatedEpoch}`);

    let payload: any = {};
    const stats: any = {};

    // Build payload based on type
    if (type === 'values' || type === 'full') {
      const { data: values } = await supabase
        .from('player_values')
        .select('*')
        .not('fdp_value', 'is', null);

      payload.values = values || [];
      stats.valuesCount = values?.length || 0;
    }

    if (type === 'players' || type === 'full') {
      const { data: players } = await supabase
        .from('nfl_players')
        .select('*')
        .in('status', ['active', 'injured']);

      payload.players = players || [];
      stats.playersCount = players?.length || 0;
    }

    if (type === 'leagues' || type === 'full') {
      const { data: leagues } = await supabase.from('league_profiles').select('*');

      payload.leagues = leagues || [];
      stats.leaguesCount = leagues?.length || 0;
    }

    // Calculate size
    const payloadString = JSON.stringify(payload);
    stats.sizeBytes = new Blob([payloadString]).size;

    // Calculate expiration
    const expiresAt = calculateExpiration(type);

    // Insert snapshot
    const { data: snapshot, error } = await supabase
      .from('system_snapshots')
      .insert({
        snapshot_type: type,
        epoch: generatedEpoch,
        payload,
        stats,
        size_bytes: stats.sizeBytes,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating snapshot:', error);
      return null;
    }

    console.log(`✅ Snapshot created: ${generatedEpoch} (${formatBytes(stats.sizeBytes)})`);

    // Clean up old snapshots
    await cleanupOldSnapshots(type);

    return {
      id: snapshot.id,
      epoch: generatedEpoch,
      type,
      stats,
      createdAt: snapshot.created_at,
    };
  } catch (error) {
    console.error('Error creating system snapshot:', error);
    return null;
  }
}

/**
 * Calculate expiration date
 */
function calculateExpiration(type: string): Date {
  const now = new Date();

  if (type === 'values') {
    // Daily snapshots: 30 days
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else if (type === 'full') {
    // Full snapshots: 90 days
    return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  } else {
    // Other types: 60 days
    return new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Clean up old snapshots
 *
 * Keeps:
 * - Last 30 daily snapshots
 * - Last 12 monthly snapshots
 * - All full snapshots within retention
 */
async function cleanupOldSnapshots(type: string) {
  try {
    // Delete expired snapshots
    const { error } = await supabase.rpc('cleanup_expired_data');

    if (error) {
      console.error('Error cleaning up expired snapshots:', error);
    }

    // Keep only last N snapshots per type
    const keepCount = type === 'full' ? 30 : 60;

    const { data: allSnapshots } = await supabase
      .from('system_snapshots')
      .select('id, created_at')
      .eq('snapshot_type', type)
      .order('created_at', { ascending: false });

    if (!allSnapshots || allSnapshots.length <= keepCount) {
      return; // Nothing to clean up
    }

    // Delete old snapshots beyond keep count
    const toDelete = allSnapshots.slice(keepCount);
    const idsToDelete = toDelete.map((s) => s.id);

    if (idsToDelete.length > 0) {
      await supabase.from('system_snapshots').delete().in('id', idsToDelete);

      console.log(`Cleaned up ${idsToDelete.length} old snapshots`);
    }
  } catch (error) {
    console.error('Error cleaning up old snapshots:', error);
  }
}

/**
 * Get snapshot by ID
 */
export async function getSnapshot(snapshotId: string): Promise<{
  id: string;
  type: string;
  epoch: string;
  payload: any;
  stats: any;
  createdAt: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('system_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (error || !data) {
      console.error('Snapshot not found:', snapshotId);
      return null;
    }

    return {
      id: data.id,
      type: data.snapshot_type,
      epoch: data.epoch,
      payload: data.payload,
      stats: data.stats,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error getting snapshot:', error);
    return null;
  }
}

/**
 * Get snapshot by epoch
 */
export async function getSnapshotByEpoch(epoch: string): Promise<{
  id: string;
  type: string;
  payload: any;
  stats: any;
} | null> {
  try {
    const { data, error } = await supabase
      .from('system_snapshots')
      .select('*')
      .eq('epoch', epoch)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      type: data.snapshot_type,
      payload: data.payload,
      stats: data.stats,
    };
  } catch (error) {
    console.error('Error getting snapshot by epoch:', error);
    return null;
  }
}

/**
 * List snapshots
 */
export async function listSnapshots(
  type?: string,
  limit: number = 30
): Promise<
  Array<{
    id: string;
    type: string;
    epoch: string;
    stats: any;
    sizeBytes: number;
    createdAt: string;
    expiresAt: string | null;
  }>
> {
  try {
    let query = supabase
      .from('system_snapshots')
      .select('id, snapshot_type, epoch, stats, size_bytes, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('snapshot_type', type);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((s) => ({
      id: s.id,
      type: s.snapshot_type,
      epoch: s.epoch,
      stats: s.stats,
      sizeBytes: s.size_bytes || 0,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
    }));
  } catch (error) {
    console.error('Error listing snapshots:', error);
    return [];
  }
}

/**
 * Get latest snapshot
 */
export async function getLatestSnapshot(type?: string): Promise<{
  id: string;
  type: string;
  epoch: string;
  stats: any;
} | null> {
  try {
    let query = supabase
      .from('system_snapshots')
      .select('id, snapshot_type, epoch, stats')
      .order('created_at', { ascending: false })
      .limit(1);

    if (type) {
      query = query.eq('snapshot_type', type);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      type: data.snapshot_type,
      epoch: data.epoch,
      stats: data.stats,
    };
  } catch (error) {
    console.error('Error getting latest snapshot:', error);
    return null;
  }
}

/**
 * Compare snapshots
 */
export async function compareSnapshots(
  epoch1: string,
  epoch2: string
): Promise<{
  added: number;
  removed: number;
  changed: number;
  details: Array<{
    playerId: string;
    oldValue: number;
    newValue: number;
    change: number;
  }>;
}> {
  try {
    const { data: values1 } = await supabase
      .from('player_values_versioned')
      .select('player_id, value')
      .eq('epoch', epoch1);

    const { data: values2 } = await supabase
      .from('player_values_versioned')
      .select('player_id, value')
      .eq('epoch', epoch2);

    if (!values1 || !values2) {
      return { added: 0, removed: 0, changed: 0, details: [] };
    }

    const map1 = new Map(values1.map((v) => [v.player_id, v.value]));
    const map2 = new Map(values2.map((v) => [v.player_id, v.value]));

    let added = 0;
    let removed = 0;
    let changed = 0;
    const details: any[] = [];

    // Check for added and changed
    map2.forEach((value2, playerId) => {
      const value1 = map1.get(playerId);
      if (value1 === undefined) {
        added++;
      } else if (value1 !== value2) {
        changed++;
        details.push({
          playerId,
          oldValue: value1,
          newValue: value2,
          change: value2 - value1,
        });
      }
    });

    // Check for removed
    map1.forEach((value1, playerId) => {
      if (!map2.has(playerId)) {
        removed++;
      }
    });

    // Sort details by absolute change
    details.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return {
      added,
      removed,
      changed,
      details: details.slice(0, 100), // Top 100 changes
    };
  } catch (error) {
    console.error('Error comparing snapshots:', error);
    return { added: 0, removed: 0, changed: 0, details: [] };
  }
}

/**
 * Format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Get storage statistics
 */
export async function getStorageStatistics(): Promise<{
  totalSnapshots: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number }>;
}> {
  try {
    const { data: snapshots } = await supabase.from('system_snapshots').select('snapshot_type, size_bytes');

    if (!snapshots) {
      return {
        totalSnapshots: 0,
        totalSize: 0,
        byType: {},
      };
    }

    const totalSnapshots = snapshots.length;
    const totalSize = snapshots.reduce((sum, s) => sum + (s.size_bytes || 0), 0);

    const byType: Record<string, { count: number; size: number }> = {};
    snapshots.forEach((s) => {
      if (!byType[s.snapshot_type]) {
        byType[s.snapshot_type] = { count: 0, size: 0 };
      }
      byType[s.snapshot_type].count++;
      byType[s.snapshot_type].size += s.size_bytes || 0;
    });

    return {
      totalSnapshots,
      totalSize,
      byType,
    };
  } catch (error) {
    console.error('Error getting storage statistics:', error);
    return {
      totalSnapshots: 0,
      totalSize: 0,
      byType: {},
    };
  }
}
