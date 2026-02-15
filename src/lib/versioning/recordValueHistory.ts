/**
 * Epoch-Based Value History
 *
 * Records every player value change as an epoch snapshot.
 * Never loses historical values - enables time-travel queries.
 *
 * Flow:
 * 1. After rebuild completes
 * 2. Generate epoch identifier
 * 3. Insert all current values into player_values_versioned
 * 4. Calculate and store checksum
 * 5. Create system snapshot
 */

import { supabase } from '../supabase';

export interface EpochSnapshot {
  epoch: string;
  rowsInserted: number;
  checksum: string;
  timestamp: string;
}

/**
 * Record value history snapshot
 *
 * Call this after every successful rebuild
 */
export async function recordValueHistorySnapshot(epoch?: string): Promise<EpochSnapshot | null> {
  try {
    const generatedEpoch = epoch || generateEpoch();

    console.log(`Recording value history snapshot: ${generatedEpoch}`);

    // Get all current player values
    const { data: currentValues, error: fetchError } = await supabase
      .from('player_values')
      .select('*')
      .not('fdp_value', 'is', null);

    if (fetchError) {
      console.error('Error fetching current values:', fetchError);
      return null;
    }

    if (!currentValues || currentValues.length === 0) {
      console.warn('No values to snapshot');
      return null;
    }

    // Transform to versioned format
    const versionedValues = currentValues.map((v) => ({
      player_id: v.player_id,
      league_profile_id: v.league_profile_id,
      format: v.format,
      value: v.fdp_value,
      pos_rank: v.pos_rank,
      overall_rank: v.overall_rank,
      tier: v.tier,
      epoch: generatedEpoch,
      metadata: {
        base_value: v.base_value,
        market_rank: v.market_rank,
        scarcity_adjustment: v.scarcity_adjustment,
        profile: v.profile,
      },
    }));

    // Insert into versioned history
    const { error: insertError } = await supabase
      .from('player_values_versioned')
      .insert(versionedValues);

    if (insertError) {
      console.error('Error inserting versioned values:', insertError);
      return null;
    }

    // Calculate checksum
    const checksum = await calculateChecksum(currentValues);

    // Store checksum
    await supabase.from('data_integrity_checksums').insert({
      checksum_type: 'player_values',
      hash_value: checksum,
      epoch: generatedEpoch,
      row_count: currentValues.length,
    });

    console.log(`✅ Snapshot recorded: ${generatedEpoch} (${currentValues.length} values)`);

    return {
      epoch: generatedEpoch,
      rowsInserted: currentValues.length,
      checksum,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error recording value history:', error);
    return null;
  }
}

/**
 * Generate epoch identifier
 *
 * Format: YYYY-MM-DD-HH-MM-SS
 */
export function generateEpoch(): string {
  const now = new Date();
  return now
    .toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '-')
    .split('.')[0];
}

/**
 * Calculate checksum
 *
 * SHA256 hash of all player_id:value pairs
 */
async function calculateChecksum(values: any[]): Promise<string> {
  const sortedValues = values
    .sort((a, b) => a.player_id.localeCompare(b.player_id))
    .map((v) => `${v.player_id}:${v.fdp_value}`)
    .join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(sortedValues);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Get player value history
 *
 * Returns last N snapshots for a player
 */
export async function getPlayerValueHistory(
  playerId: string,
  format: 'dynasty' | 'redraft' = 'dynasty',
  limit: number = 30
): Promise<
  Array<{
    epoch: string;
    value: number;
    posRank: number | null;
    overallRank: number | null;
    tier: number | null;
    createdAt: string;
  }>
> {
  try {
    const { data, error } = await supabase
      .from('player_values_versioned')
      .select('epoch, value, pos_rank, overall_rank, tier, created_at')
      .eq('player_id', playerId)
      .eq('format', format)
      .is('league_profile_id', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching value history:', error);
      return [];
    }

    if (!data) return [];

    return data.map((d) => ({
      epoch: d.epoch,
      value: d.value,
      posRank: d.pos_rank,
      overallRank: d.overall_rank,
      tier: d.tier,
      createdAt: d.created_at,
    }));
  } catch (error) {
    console.error('Error getting player value history:', error);
    return [];
  }
}

/**
 * Get value at specific epoch
 */
export async function getValueAtEpoch(
  playerId: string,
  epoch: string,
  format: 'dynasty' | 'redraft' = 'dynasty'
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('player_values_versioned')
      .select('value')
      .eq('player_id', playerId)
      .eq('format', format)
      .eq('epoch', epoch)
      .is('league_profile_id', null)
      .maybeSingle();

    if (error || !data) return null;

    return data.value;
  } catch (error) {
    console.error('Error getting value at epoch:', error);
    return null;
  }
}

/**
 * Get biggest rise/fall
 */
export async function getPlayerVolatility(
  playerId: string,
  format: 'dynasty' | 'redraft' = 'dynasty',
  days: number = 30
): Promise<{
  biggestRise: { date: string; change: number } | null;
  biggestFall: { date: string; change: number } | null;
  volatilityScore: number;
}> {
  try {
    const history = await getPlayerValueHistory(playerId, format, days);

    if (history.length < 2) {
      return {
        biggestRise: null,
        biggestFall: null,
        volatilityScore: 0,
      };
    }

    let biggestRise = { date: '', change: 0 };
    let biggestFall = { date: '', change: 0 };
    const changes: number[] = [];

    for (let i = 1; i < history.length; i++) {
      const change = history[i - 1].value - history[i].value;
      changes.push(Math.abs(change));

      if (change > biggestRise.change) {
        biggestRise = {
          date: history[i - 1].createdAt,
          change,
        };
      }

      if (change < biggestFall.change) {
        biggestFall = {
          date: history[i - 1].createdAt,
          change: Math.abs(change),
        };
      }
    }

    // Calculate volatility score (average absolute change)
    const volatilityScore = changes.reduce((sum, c) => sum + c, 0) / changes.length;

    return {
      biggestRise: biggestRise.change > 0 ? biggestRise : null,
      biggestFall: biggestFall.change > 0 ? biggestFall : null,
      volatilityScore: Math.round(volatilityScore),
    };
  } catch (error) {
    console.error('Error calculating volatility:', error);
    return {
      biggestRise: null,
      biggestFall: null,
      volatilityScore: 0,
    };
  }
}

/**
 * Get latest epoch
 */
export async function getLatestEpoch(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('player_values_versioned')
      .select('epoch')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return data.epoch;
  } catch (error) {
    console.error('Error getting latest epoch:', error);
    return null;
  }
}

/**
 * Get epoch list
 */
export async function getEpochList(limit: number = 30): Promise<
  Array<{
    epoch: string;
    createdAt: string;
    valueCount: number;
  }>
> {
  try {
    const { data, error } = await supabase
      .from('player_values_versioned')
      .select('epoch, created_at')
      .order('created_at', { ascending: false })
      .limit(limit * 100); // Get more to group by

    if (error || !data) return [];

    // Group by epoch
    const epochs = new Map<string, { epoch: string; createdAt: string; count: number }>();

    data.forEach((d) => {
      if (!epochs.has(d.epoch)) {
        epochs.set(d.epoch, {
          epoch: d.epoch,
          createdAt: d.created_at,
          count: 0,
        });
      }
      epochs.get(d.epoch)!.count++;
    });

    return Array.from(epochs.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((e) => ({
        epoch: e.epoch,
        createdAt: e.createdAt,
        valueCount: e.count,
      }));
  } catch (error) {
    console.error('Error getting epoch list:', error);
    return [];
  }
}

/**
 * Verify checksum
 *
 * Compares current values against stored checksum
 */
export async function verifyChecksum(epoch: string): Promise<boolean> {
  try {
    // Get stored checksum
    const { data: checksumData, error: checksumError } = await supabase
      .from('data_integrity_checksums')
      .select('hash_value')
      .eq('epoch', epoch)
      .eq('checksum_type', 'player_values')
      .maybeSingle();

    if (checksumError || !checksumData) {
      console.error('Checksum not found for epoch:', epoch);
      return false;
    }

    // Get values from that epoch
    const { data: values, error: valuesError } = await supabase
      .from('player_values_versioned')
      .select('player_id, value')
      .eq('epoch', epoch);

    if (valuesError || !values) {
      console.error('Values not found for epoch:', epoch);
      return false;
    }

    // Calculate current checksum
    const currentChecksum = await calculateChecksum(
      values.map((v) => ({ player_id: v.player_id, fdp_value: v.value }))
    );

    return currentChecksum === checksumData.hash_value;
  } catch (error) {
    console.error('Error verifying checksum:', error);
    return false;
  }
}
