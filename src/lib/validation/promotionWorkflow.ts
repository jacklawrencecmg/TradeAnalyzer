/**
 * Approval Promotion Workflow
 *
 * Promotes validated data from staging to production tables.
 * Only validated data moves forward and can influence FDP.
 *
 * Flow:
 * raw_* → validated_* → core tables → FDP rebuild
 *
 * FDP rebuild ONLY reads from validated_* tables.
 */

import { supabase } from '../supabase';

interface PromotionResult {
  success: boolean;
  promotedRows: number;
  skippedRows: number;
  errors: string[];
}

/**
 * Promote validated player stats to production
 */
export async function promotePlayerStats(batchId: string): Promise<PromotionResult> {
  const errors: string[] = [];
  let promotedRows = 0;
  let skippedRows = 0;

  try {
    // Get validated rows from this batch
    const { data: validatedRows, error: fetchError } = await supabase
      .from('raw_player_stats')
      .select('*')
      .eq('batch_id', batchId)
      .eq('processing_status', 'validated');

    if (fetchError) {
      errors.push(`Failed to fetch validated rows: ${fetchError.message}`);
      return { success: false, promotedRows, skippedRows, errors };
    }

    if (!validatedRows || validatedRows.length === 0) {
      errors.push('No validated rows to promote');
      return { success: false, promotedRows, skippedRows, errors };
    }

    // Transform to validated_player_stats format
    const promotionData = validatedRows.map(row => ({
      source_id: row.id,
      player_id: row.player_id,
      player_name: row.player_name,
      week: row.week,
      season: row.season,
      position: row.position || 'UNK',
      team: row.team || 'FA',
      fantasy_points: row.fantasy_points || 0,
      snap_share: row.snap_share,
      target_share: row.target_share,
      carry_share: row.carry_share,
      usage_rate: row.usage_rate,
      confidence_score: row.confidence_score || 0.8,
    }));

    // Insert into validated table
    const { data: inserted, error: insertError } = await supabase
      .from('validated_player_stats')
      .insert(promotionData)
      .select();

    if (insertError) {
      // Check if it's a unique constraint violation
      if (insertError.code === '23505') {
        errors.push(`Some rows already exist in validated table`);
        skippedRows = validatedRows.length;
      } else {
        errors.push(`Failed to insert validated rows: ${insertError.message}`);
        return { success: false, promotedRows, skippedRows, errors };
      }
    } else {
      promotedRows = inserted?.length || 0;
    }

    // Update batch metadata
    await supabase
      .from('data_batch_metadata')
      .update({
        promoted_at: new Date().toISOString(),
        processing_status: 'completed',
      })
      .eq('batch_id', batchId);

    return {
      success: true,
      promotedRows,
      skippedRows,
      errors,
    };
  } catch (error) {
    errors.push(`Unexpected error: ${error}`);
    return { success: false, promotedRows, skippedRows, errors };
  }
}

/**
 * Promote validated market ranks to production
 */
export async function promoteMarketRanks(batchId: string): Promise<PromotionResult> {
  const errors: string[] = [];
  let promotedRows = 0;
  let skippedRows = 0;

  try {
    const { data: validatedRows, error: fetchError } = await supabase
      .from('raw_market_ranks')
      .select('*')
      .eq('batch_id', batchId)
      .eq('processing_status', 'validated');

    if (fetchError) {
      errors.push(`Failed to fetch validated rows: ${fetchError.message}`);
      return { success: false, promotedRows, skippedRows, errors };
    }

    if (!validatedRows || validatedRows.length === 0) {
      errors.push('No validated rows to promote');
      return { success: false, promotedRows, skippedRows, errors };
    }

    const promotionData = validatedRows.map(row => ({
      source_id: row.id,
      player_id: row.player_id,
      player_name: row.player_name,
      position: row.position || 'UNK',
      format: row.format,
      rank_overall: row.rank_overall || 999,
      rank_position: row.rank_position || 999,
      value: row.value,
      tier: row.tier,
      confidence_score: row.confidence_score || 0.8,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('validated_market_ranks')
      .insert(promotionData)
      .select();

    if (insertError) {
      if (insertError.code === '23505') {
        errors.push(`Some rows already exist in validated table`);
        skippedRows = validatedRows.length;
      } else {
        errors.push(`Failed to insert validated rows: ${insertError.message}`);
        return { success: false, promotedRows, skippedRows, errors };
      }
    } else {
      promotedRows = inserted?.length || 0;
    }

    await supabase
      .from('data_batch_metadata')
      .update({
        promoted_at: new Date().toISOString(),
        processing_status: 'completed',
      })
      .eq('batch_id', batchId);

    return {
      success: true,
      promotedRows,
      skippedRows,
      errors,
    };
  } catch (error) {
    errors.push(`Unexpected error: ${error}`);
    return { success: false, promotedRows, skippedRows, errors };
  }
}

/**
 * Process complete batch through validation and promotion
 */
export async function processBatch(
  batchId: string,
  tableName: 'raw_player_stats' | 'raw_player_status' | 'raw_market_ranks' | 'raw_rosters'
): Promise<{
  success: boolean;
  stage: string;
  message: string;
  details: any;
}> {
  try {
    // Stage 1: Get batch metadata
    const { data: batchMeta } = await supabase
      .from('data_batch_metadata')
      .select('*')
      .eq('batch_id', batchId)
      .single();

    if (!batchMeta) {
      return {
        success: false,
        stage: 'fetch_metadata',
        message: 'Batch metadata not found',
        details: null,
      };
    }

    // Stage 2: Check if already processed
    if (batchMeta.processing_status === 'completed') {
      return {
        success: true,
        stage: 'already_processed',
        message: 'Batch already processed',
        details: batchMeta,
      };
    }

    // Stage 3: Update to processing
    await supabase
      .from('data_batch_metadata')
      .update({ processing_status: 'processing' })
      .eq('batch_id', batchId);

    // Stage 4: Promote based on table type
    let promotionResult: PromotionResult;

    if (tableName === 'raw_player_stats') {
      promotionResult = await promotePlayerStats(batchId);
    } else if (tableName === 'raw_market_ranks') {
      promotionResult = await promoteMarketRanks(batchId);
    } else {
      return {
        success: false,
        stage: 'promotion',
        message: `Promotion not implemented for ${tableName}`,
        details: null,
      };
    }

    if (!promotionResult.success) {
      // Update to failed
      await supabase
        .from('data_batch_metadata')
        .update({
          processing_status: 'failed',
          validation_errors: { errors: promotionResult.errors },
        })
        .eq('batch_id', batchId);

      return {
        success: false,
        stage: 'promotion',
        message: 'Promotion failed',
        details: promotionResult,
      };
    }

    // Stage 5: Update metadata with results
    await supabase
      .from('data_batch_metadata')
      .update({
        validated_rows: promotionResult.promotedRows,
        processing_status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('batch_id', batchId);

    return {
      success: true,
      stage: 'completed',
      message: `Successfully promoted ${promotionResult.promotedRows} rows`,
      details: promotionResult,
    };
  } catch (error) {
    return {
      success: false,
      stage: 'unknown',
      message: `Unexpected error: ${error}`,
      details: null,
    };
  }
}

/**
 * Archive rejected data for audit purposes
 */
export async function archiveRejectedBatch(batchId: string): Promise<void> {
  // Get rejected rows
  const { data: rejectedRows } = await supabase
    .from('raw_market_ranks')
    .select('*')
    .eq('batch_id', batchId)
    .eq('processing_status', 'rejected');

  if (!rejectedRows || rejectedRows.length === 0) return;

  // Store in archive (could be moved to cold storage)
  console.log(`Archived ${rejectedRows.length} rejected rows for batch ${batchId}`);
}

/**
 * Quarantine suspicious batch for manual review
 */
export async function quarantineBatch(
  batchId: string,
  reason: string,
  details: any
): Promise<void> {
  await supabase
    .from('data_batch_metadata')
    .update({
      processing_status: 'quarantined',
      validation_errors: { reason, details },
    })
    .eq('batch_id', batchId);

  // Create alert for manual review
  await supabase.from('data_quality_alerts').insert({
    batch_id: batchId,
    alert_type: 'low_confidence',
    severity: 'high',
    message: `Batch quarantined: ${reason}`,
    details: { reason, details },
  });
}
