/**
 * Trusted Data Pipeline - Main Orchestration
 *
 * Complete pipeline for ingesting, validating, and promoting external data.
 * Ensures only trusted data can influence FDP values.
 *
 * Pipeline Flow:
 * 1. Ingest → raw_* tables (staging)
 * 2. Validate → run validation rules
 * 3. Cross-verify → compare across sources
 * 4. Score confidence → calculate trust score
 * 5. Alert monitoring → check for suspicious patterns
 * 6. Promote → move to validated_* tables
 * 7. Archive → store for replay
 * 8. FDP rebuild → only reads validated_* tables
 */

import { supabase } from '../supabase';
import {
  validatePlayerStats,
  validatePlayerStatus,
  validateMarketRanks,
  logValidationResults,
  updateProcessingStatus,
} from './validateIncomingData';
import {
  verifyMarketRanks,
  verifyPlayerStats,
  verifyTemporalConsistency,
  logCrossSourceResults,
} from './crossSourceVerification';
import {
  processBatch,
  quarantineBatch,
} from './promotionWorkflow';
import {
  calculateBatchConfidence,
  updateBatchConfidenceScore,
  updateSourceHealth,
} from './confidenceScoring';
import {
  sendAlertsForBatch,
} from './suspiciousDataAlerts';
import {
  archiveBatchForReplay,
} from './replayCapability';

export interface PipelineResult {
  success: boolean;
  batchId: string;
  stage: string;
  message: string;
  validationResult?: any;
  crossSourceResult?: any;
  confidenceResult?: any;
  promotionResult?: any;
  alerts?: any[];
}

/**
 * Process external data through complete trusted pipeline
 */
export async function processTrustedDataPipeline(
  batchId: string,
  source: string,
  tableName: 'raw_player_stats' | 'raw_player_status' | 'raw_market_ranks' | 'raw_rosters',
  rawData: any[]
): Promise<PipelineResult> {
  const stages: string[] = [];

  try {
    // Stage 1: Create batch metadata
    stages.push('create_metadata');
    await supabase.from('data_batch_metadata').insert({
      batch_id: batchId,
      source,
      table_name: tableName,
      total_rows: rawData.length,
      processing_status: 'pending',
    });

    // Stage 2: Insert into staging table
    stages.push('insert_staging');
    const { error: insertError } = await supabase
      .from(tableName)
      .insert(rawData);

    if (insertError) {
      await updateSourceHealth(source, tableName, false, 0);
      return {
        success: false,
        batchId,
        stage: 'insert_staging',
        message: `Failed to insert data: ${insertError.message}`,
      };
    }

    // Stage 3: Validate data
    stages.push('validate');
    let validationResult;

    if (tableName === 'raw_player_stats') {
      validationResult = await validatePlayerStats(batchId, rawData);
    } else if (tableName === 'raw_player_status') {
      validationResult = await validatePlayerStatus(batchId, rawData);
    } else if (tableName === 'raw_market_ranks') {
      validationResult = await validateMarketRanks(batchId, rawData);
    } else {
      validationResult = { valid: true, errors: [], warnings: [], confidenceScore: 0.8 };
    }

    // Log validation results
    await logValidationResults(batchId, tableName, validationResult);

    // Update processing status
    await updateProcessingStatus(tableName, batchId, validationResult.valid, validationResult.errors);

    if (!validationResult.valid) {
      await updateSourceHealth(source, tableName, false, validationResult.confidenceScore);
      return {
        success: false,
        batchId,
        stage: 'validate',
        message: `Validation failed: ${validationResult.errors.length} errors`,
        validationResult,
      };
    }

    // Stage 4: Cross-source verification
    stages.push('cross_verify');
    let crossSourceResult;

    if (tableName === 'raw_market_ranks') {
      // Get format from first row
      const format = rawData[0]?.format || 'dynasty';
      crossSourceResult = await verifyMarketRanks(batchId, format);
    } else if (tableName === 'raw_player_stats') {
      const week = rawData[0]?.week || 1;
      const season = rawData[0]?.season || new Date().getFullYear();
      crossSourceResult = await verifyPlayerStats(batchId, week, season);
    } else {
      crossSourceResult = await verifyTemporalConsistency(batchId, tableName);
    }

    await logCrossSourceResults(batchId, tableName, crossSourceResult);

    // Quarantine if cross-source check recommends it
    if (crossSourceResult.recommendation === 'quarantine') {
      await quarantineBatch(
        batchId,
        'Cross-source verification failed',
        crossSourceResult.discrepancies
      );

      await updateSourceHealth(source, tableName, false, crossSourceResult.confidence);

      return {
        success: false,
        batchId,
        stage: 'cross_verify',
        message: 'Batch quarantined due to cross-source conflicts',
        validationResult,
        crossSourceResult,
      };
    }

    // Reject if cross-source check recommends it
    if (crossSourceResult.recommendation === 'reject') {
      await updateSourceHealth(source, tableName, false, crossSourceResult.confidence);

      return {
        success: false,
        batchId,
        stage: 'cross_verify',
        message: 'Batch rejected due to severe cross-source conflicts',
        validationResult,
        crossSourceResult,
      };
    }

    // Stage 5: Calculate confidence score
    stages.push('confidence_score');
    const confidenceResult = await calculateBatchConfidence(batchId, tableName);
    await updateBatchConfidenceScore(batchId, confidenceResult.score);

    if (confidenceResult.recommendation === 'skip') {
      await updateSourceHealth(source, tableName, false, confidenceResult.score);

      return {
        success: false,
        batchId,
        stage: 'confidence_score',
        message: confidenceResult.reason,
        validationResult,
        crossSourceResult,
        confidenceResult,
      };
    }

    if (confidenceResult.recommendation === 'manual_review') {
      await quarantineBatch(
        batchId,
        'Low confidence - requires manual review',
        confidenceResult.factors
      );

      await updateSourceHealth(source, tableName, false, confidenceResult.score);

      return {
        success: false,
        batchId,
        stage: 'confidence_score',
        message: 'Batch requires manual review',
        validationResult,
        crossSourceResult,
        confidenceResult,
      };
    }

    // Stage 6: Alert monitoring
    stages.push('alert_monitoring');
    await sendAlertsForBatch(batchId, source, tableName);

    // Check if critical alerts quarantined the batch
    const { data: updatedBatch } = await supabase
      .from('data_batch_metadata')
      .select('processing_status')
      .eq('batch_id', batchId)
      .single();

    if (updatedBatch?.processing_status === 'quarantined') {
      await updateSourceHealth(source, tableName, false, confidenceResult.score);

      return {
        success: false,
        batchId,
        stage: 'alert_monitoring',
        message: 'Batch quarantined due to critical alerts',
        validationResult,
        crossSourceResult,
        confidenceResult,
      };
    }

    // Stage 7: Promote to validated tables
    stages.push('promote');
    const promotionResult = await processBatch(batchId, tableName);

    if (!promotionResult.success) {
      await updateSourceHealth(source, tableName, false, confidenceResult.score);

      return {
        success: false,
        batchId,
        stage: 'promote',
        message: promotionResult.message,
        validationResult,
        crossSourceResult,
        confidenceResult,
        promotionResult,
      };
    }

    // Stage 8: Archive for replay
    stages.push('archive');
    await archiveBatchForReplay(batchId, source, tableName, rawData);

    // Update source health (success)
    await updateSourceHealth(source, tableName, true, confidenceResult.score);

    // Success!
    return {
      success: true,
      batchId,
      stage: 'completed',
      message: `Successfully processed ${rawData.length} rows through trusted pipeline`,
      validationResult,
      crossSourceResult,
      confidenceResult,
      promotionResult,
    };
  } catch (error) {
    await updateSourceHealth(source, tableName, false, 0);

    return {
      success: false,
      batchId,
      stage: stages[stages.length - 1] || 'unknown',
      message: `Pipeline error: ${error}`,
    };
  }
}

/**
 * Ingest external data (entry point)
 */
export async function ingestExternalData(
  source: string,
  tableName: 'raw_player_stats' | 'raw_player_status' | 'raw_market_ranks' | 'raw_rosters',
  rawPayload: any[]
): Promise<PipelineResult> {
  // Generate batch ID
  const batchId = crypto.randomUUID();

  // Add metadata to each row
  const enrichedData = rawPayload.map(row => ({
    ...row,
    batch_id: batchId,
    source,
    checksum: generateChecksum(row),
    received_at: new Date().toISOString(),
    processing_status: 'pending',
  }));

  // Process through pipeline
  return await processTrustedDataPipeline(batchId, source, tableName, enrichedData);
}

/**
 * Generate checksum for a row
 */
function generateChecksum(row: any): string {
  const payload = JSON.stringify(row);
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get pipeline status for a batch
 */
export async function getPipelineStatus(batchId: string): Promise<{
  batchId: string;
  status: string;
  confidence: number;
  stage: string;
  errors: any;
}> {
  const { data } = await supabase
    .from('data_batch_metadata')
    .select('*')
    .eq('batch_id', batchId)
    .single();

  return {
    batchId,
    status: data?.processing_status || 'unknown',
    confidence: data?.confidence_score || 0,
    stage: data?.processing_status || 'unknown',
    errors: data?.validation_errors || null,
  };
}
