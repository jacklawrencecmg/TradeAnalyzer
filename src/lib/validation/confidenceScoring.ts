/**
 * Data Confidence Scoring
 *
 * Calculates confidence scores for incoming data batches.
 * Low confidence batches are skipped and previous epoch is retained.
 *
 * Scoring factors:
 * - Number of agreeing sources
 * - Anomaly count
 * - Missing players
 * - Cross-source consistency
 * - Historical reliability
 */

import { supabase } from '../supabase';

interface ConfidenceFactors {
  sourceAgreement: number;
  anomalyScore: number;
  completeness: number;
  crossSourceConsistency: number;
  historicalReliability: number;
}

interface ConfidenceResult {
  score: number;
  factors: ConfidenceFactors;
  recommendation: 'use' | 'skip' | 'manual_review';
  reason: string;
}

const CONFIDENCE_THRESHOLD = 0.7; // Minimum confidence to use batch
const MANUAL_REVIEW_THRESHOLD = 0.5; // Below this requires manual review

/**
 * Calculate overall confidence score for a batch
 */
export async function calculateBatchConfidence(
  batchId: string,
  tableName: string
): Promise<ConfidenceResult> {
  const factors: ConfidenceFactors = {
    sourceAgreement: 0,
    anomalyScore: 0,
    completeness: 0,
    crossSourceConsistency: 0,
    historicalReliability: 0,
  };

  // Get batch metadata
  const { data: batchMeta } = await supabase
    .from('data_batch_metadata')
    .select('*')
    .eq('batch_id', batchId)
    .single();

  if (!batchMeta) {
    return {
      score: 0,
      factors,
      recommendation: 'skip',
      reason: 'Batch metadata not found',
    };
  }

  const source = batchMeta.source;

  // Factor 1: Source agreement (if multiple sources available)
  factors.sourceAgreement = await calculateSourceAgreement(batchId, tableName);

  // Factor 2: Anomaly score (inverse of anomaly count)
  factors.anomalyScore = await calculateAnomalyScore(batchId);

  // Factor 3: Completeness (% of expected data present)
  factors.completeness = await calculateCompleteness(batchId, tableName);

  // Factor 4: Cross-source consistency
  factors.crossSourceConsistency = await calculateCrossSourceConsistency(batchId);

  // Factor 5: Historical reliability of source
  factors.historicalReliability = await calculateHistoricalReliability(source, tableName);

  // Weighted average
  const weights = {
    sourceAgreement: 0.15,
    anomalyScore: 0.25,
    completeness: 0.20,
    crossSourceConsistency: 0.25,
    historicalReliability: 0.15,
  };

  const score =
    factors.sourceAgreement * weights.sourceAgreement +
    factors.anomalyScore * weights.anomalyScore +
    factors.completeness * weights.completeness +
    factors.crossSourceConsistency * weights.crossSourceConsistency +
    factors.historicalReliability * weights.historicalReliability;

  // Determine recommendation
  let recommendation: 'use' | 'skip' | 'manual_review';
  let reason: string;

  if (score >= CONFIDENCE_THRESHOLD) {
    recommendation = 'use';
    reason = `High confidence (${(score * 100).toFixed(1)}%)`;
  } else if (score >= MANUAL_REVIEW_THRESHOLD) {
    recommendation = 'manual_review';
    reason = `Medium confidence (${(score * 100).toFixed(1)}%) - requires review`;
  } else {
    recommendation = 'skip';
    reason = `Low confidence (${(score * 100).toFixed(1)}%) - skip batch`;
  }

  return {
    score,
    factors,
    recommendation,
    reason,
  };
}

/**
 * Calculate source agreement score
 */
async function calculateSourceAgreement(
  batchId: string,
  tableName: string
): Promise<number> {
  // For now, return neutral score
  // In production, would compare with other concurrent sources
  return 0.8;
}

/**
 * Calculate anomaly score (inverse of validation errors)
 */
async function calculateAnomalyScore(batchId: string): Promise<number> {
  const { data: validationLogs } = await supabase
    .from('data_validation_log')
    .select('*')
    .eq('batch_id', batchId)
    .eq('severity', 'error');

  const errorCount = validationLogs?.length || 0;

  // More errors = lower score
  if (errorCount === 0) return 1.0;
  if (errorCount <= 2) return 0.9;
  if (errorCount <= 5) return 0.7;
  if (errorCount <= 10) return 0.5;
  return 0.3;
}

/**
 * Calculate completeness score
 */
async function calculateCompleteness(
  batchId: string,
  tableName: string
): Promise<number> {
  const { data: batchMeta } = await supabase
    .from('data_batch_metadata')
    .select('total_rows, rejected_rows')
    .eq('batch_id', batchId)
    .single();

  if (!batchMeta || batchMeta.total_rows === 0) return 0;

  const validRows = batchMeta.total_rows - (batchMeta.rejected_rows || 0);
  const completeness = validRows / batchMeta.total_rows;

  return completeness;
}

/**
 * Calculate cross-source consistency score
 */
async function calculateCrossSourceConsistency(batchId: string): Promise<number> {
  const { data: batchMeta } = await supabase
    .from('data_batch_metadata')
    .select('cross_source_check_status')
    .eq('batch_id', batchId)
    .single();

  const status = batchMeta?.cross_source_check_status;

  if (status === 'approve') return 1.0;
  if (status === 'quarantine') return 0.6;
  if (status === 'reject') return 0.2;

  // No cross-source check performed
  return 0.7;
}

/**
 * Calculate historical reliability of source
 */
async function calculateHistoricalReliability(
  source: string,
  tableName: string
): Promise<number> {
  const { data: sourceHealth } = await supabase
    .from('data_source_health')
    .select('*')
    .eq('source', source)
    .eq('table_name', tableName)
    .single();

  if (!sourceHealth) return 0.7; // Neutral for new sources

  const { reliability_score } = sourceHealth;
  return reliability_score || 0.7;
}

/**
 * Update batch confidence score
 */
export async function updateBatchConfidenceScore(
  batchId: string,
  score: number
): Promise<void> {
  await supabase
    .from('data_batch_metadata')
    .update({ confidence_score: score })
    .eq('batch_id', batchId);
}

/**
 * Update source health metrics
 */
export async function updateSourceHealth(
  source: string,
  tableName: string,
  success: boolean,
  confidenceScore: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('data_source_health')
    .select('*')
    .eq('source', source)
    .eq('table_name', tableName)
    .single();

  if (existing) {
    // Update existing record
    const totalBatches = existing.total_batches + 1;
    const successfulBatches = existing.successful_batches + (success ? 1 : 0);
    const failedBatches = existing.failed_batches + (success ? 0 : 1);

    // Running average of confidence
    const avgConfidence =
      (existing.avg_confidence_score * existing.total_batches + confidenceScore) /
      totalBatches;

    // Reliability score based on success rate
    const reliabilityScore = successfulBatches / totalBatches;

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
    if (reliabilityScore >= 0.9) status = 'healthy';
    else if (reliabilityScore >= 0.7) status = 'degraded';
    else if (reliabilityScore >= 0.5) status = 'unhealthy';
    else status = 'offline';

    await supabase
      .from('data_source_health')
      .update({
        total_batches: totalBatches,
        successful_batches: successfulBatches,
        failed_batches: failedBatches,
        avg_confidence_score: avgConfidence,
        reliability_score: reliabilityScore,
        status,
        last_successful_import: success ? new Date().toISOString() : existing.last_successful_import,
        last_failed_import: !success ? new Date().toISOString() : existing.last_failed_import,
        updated_at: new Date().toISOString(),
      })
      .eq('source', source)
      .eq('table_name', tableName);
  } else {
    // Create new record
    await supabase.from('data_source_health').insert({
      source,
      table_name: tableName,
      total_batches: 1,
      successful_batches: success ? 1 : 0,
      failed_batches: success ? 0 : 1,
      avg_confidence_score: confidenceScore,
      reliability_score: success ? 1.0 : 0,
      status: success ? 'healthy' : 'unhealthy',
      last_successful_import: success ? new Date().toISOString() : null,
      last_failed_import: !success ? new Date().toISOString() : null,
    });
  }
}

/**
 * Check if batch should be used for FDP rebuild
 */
export async function shouldUseBatchForFDP(batchId: string): Promise<{
  shouldUse: boolean;
  reason: string;
  confidence: number;
}> {
  const { data: batchMeta } = await supabase
    .from('data_batch_metadata')
    .select('confidence_score, processing_status')
    .eq('batch_id', batchId)
    .single();

  if (!batchMeta) {
    return {
      shouldUse: false,
      reason: 'Batch not found',
      confidence: 0,
    };
  }

  const confidence = batchMeta.confidence_score || 0;

  if (batchMeta.processing_status !== 'completed') {
    return {
      shouldUse: false,
      reason: 'Batch not completed',
      confidence,
    };
  }

  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      shouldUse: false,
      reason: `Confidence too low (${(confidence * 100).toFixed(1)}%)`,
      confidence,
    };
  }

  return {
    shouldUse: true,
    reason: 'Passed confidence threshold',
    confidence,
  };
}
