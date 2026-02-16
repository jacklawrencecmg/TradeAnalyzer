/**
 * Data Replay Capability
 *
 * Stores compressed raw payloads and allows reprocessing.
 * Enables fixing mapping/logic issues without losing history.
 *
 * Features:
 * - Compressed payload storage
 * - Replay with updated logic
 * - Audit trail of replays
 */

import { supabase } from '../supabase';

interface ReplayResult {
  success: boolean;
  batchId: string;
  rowsProcessed: number;
  errors: string[];
}

/**
 * Archive batch for replay capability
 */
export async function archiveBatchForReplay(
  batchId: string,
  source: string,
  tableName: string,
  rawData: any[]
): Promise<void> {
  try {
    // Convert data to JSON string
    const jsonPayload = JSON.stringify(rawData);
    const originalSize = jsonPayload.length;

    // Simple compression (in production, use pako or similar)
    const compressed = compressString(jsonPayload);
    const compressedSize = compressed.length;

    // Calculate checksum
    const checksum = calculateChecksum(jsonPayload);

    // Store in archive
    await supabase.from('data_replay_archive').insert({
      batch_id: batchId,
      source,
      table_name: tableName,
      compressed_payload: compressed,
      row_count: rawData.length,
      original_size_bytes: originalSize,
      compressed_size_bytes: compressedSize,
      checksum,
      can_replay: true,
    });

    console.log(
      `Archived batch ${batchId}: ${rawData.length} rows, ` +
        `${originalSize} → ${compressedSize} bytes ` +
        `(${((compressedSize / originalSize) * 100).toFixed(1)}% of original)`
    );
  } catch (error) {
    console.error(`Failed to archive batch ${batchId}:`, error);
  }
}

/**
 * Replay a batch with updated processing logic
 */
export async function replayBatch(batchId: string): Promise<ReplayResult> {
  const errors: string[] = [];

  try {
    // Get archived batch
    const { data: archived, error: fetchError } = await supabase
      .from('data_replay_archive')
      .select('*')
      .eq('batch_id', batchId)
      .single();

    if (fetchError || !archived) {
      errors.push('Archived batch not found');
      return {
        success: false,
        batchId,
        rowsProcessed: 0,
        errors,
      };
    }

    if (!archived.can_replay) {
      errors.push('Batch marked as non-replayable');
      return {
        success: false,
        batchId,
        rowsProcessed: 0,
        errors,
      };
    }

    // Decompress payload
    const decompressed = decompressString(archived.compressed_payload);
    const rawData = JSON.parse(decompressed);

    // Verify checksum
    const checksum = calculateChecksum(decompressed);
    if (checksum !== archived.checksum) {
      errors.push('Checksum mismatch - data may be corrupted');
      return {
        success: false,
        batchId,
        rowsProcessed: 0,
        errors,
      };
    }

    // Create new batch ID for replay
    const newBatchId = crypto.randomUUID();

    // Re-insert data into raw table with new batch ID
    const tableName = archived.table_name;
    const dataWithNewBatch = rawData.map((row: any) => ({
      ...row,
      id: crypto.randomUUID(), // New ID
      batch_id: newBatchId,
      received_at: new Date().toISOString(),
      processing_status: 'pending',
      processed_at: null,
    }));

    const { error: insertError } = await supabase
      .from(tableName)
      .insert(dataWithNewBatch);

    if (insertError) {
      errors.push(`Failed to insert replayed data: ${insertError.message}`);
      return {
        success: false,
        batchId: newBatchId,
        rowsProcessed: 0,
        errors,
      };
    }

    // Create batch metadata for new batch
    await supabase.from('data_batch_metadata').insert({
      batch_id: newBatchId,
      source: archived.source,
      table_name: tableName,
      total_rows: rawData.length,
      processing_status: 'pending',
    });

    // Update replay count
    await supabase
      .from('data_replay_archive')
      .update({
        replay_count: (archived.replay_count || 0) + 1,
        last_replayed_at: new Date().toISOString(),
      })
      .eq('batch_id', batchId);

    return {
      success: true,
      batchId: newBatchId,
      rowsProcessed: rawData.length,
      errors: [],
    };
  } catch (error) {
    errors.push(`Unexpected error: ${error}`);
    return {
      success: false,
      batchId,
      rowsProcessed: 0,
      errors,
    };
  }
}

/**
 * Get replay history for a batch
 */
export async function getReplayHistory(originalBatchId: string): Promise<{
  original_batch_id: string;
  replay_count: number;
  last_replayed_at: string | null;
  archived_at: string;
}> {
  const { data } = await supabase
    .from('data_replay_archive')
    .select('batch_id, replay_count, last_replayed_at, archived_at')
    .eq('batch_id', originalBatchId)
    .single();

  return {
    original_batch_id: originalBatchId,
    replay_count: data?.replay_count || 0,
    last_replayed_at: data?.last_replayed_at || null,
    archived_at: data?.archived_at || new Date().toISOString(),
  };
}

/**
 * List all archived batches available for replay
 */
export async function listReplayableBatches(): Promise<
  Array<{
    batch_id: string;
    source: string;
    table_name: string;
    row_count: number;
    archived_at: string;
    replay_count: number;
  }>
> {
  const { data } = await supabase
    .from('data_replay_archive')
    .select('batch_id, source, table_name, row_count, archived_at, replay_count')
    .eq('can_replay', true)
    .order('archived_at', { ascending: false })
    .limit(100);

  return data || [];
}

/**
 * Mark batch as non-replayable (if data is corrupt or obsolete)
 */
export async function markBatchNonReplayable(
  batchId: string,
  reason: string
): Promise<void> {
  await supabase
    .from('data_replay_archive')
    .update({
      can_replay: false,
    })
    .eq('batch_id', batchId);

  console.log(`Marked batch ${batchId} as non-replayable: ${reason}`);
}

/**
 * Simple string compression (LZ-based)
 * In production, use a library like pako
 */
function compressString(str: string): string {
  // Simple run-length encoding for demo
  // In production, use proper compression
  return str; // Placeholder - use pako.deflate in production
}

/**
 * Simple string decompression
 */
function decompressString(str: string): string {
  // Placeholder - use pako.inflate in production
  return str;
}

/**
 * Calculate checksum for data integrity
 */
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
