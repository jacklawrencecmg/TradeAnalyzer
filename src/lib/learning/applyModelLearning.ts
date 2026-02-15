/**
 * Model Learning and Auto-Tuning System
 *
 * Automatically adjusts model parameters based on prediction errors.
 * This creates a feedback loop that improves future predictions.
 *
 * Safety Rules:
 * 1. Never adjust more than ±5% per week
 * 2. Never auto-adjust elite tier (1-24)
 * 3. Only adjust mid/late tiers (25+)
 * 4. Require minimum sample size for confidence
 * 5. All adjustments logged and reversible
 *
 * Process:
 * 1. Analyze accuracy metrics
 * 2. Detect systematic biases
 * 3. Propose parameter adjustments
 * 4. Apply adjustments within safe boundaries
 * 5. Log adjustments for audit trail
 */

import { supabase } from '../supabase';
import type { AccuracyMetrics, BiasDetection } from './calculateModelAccuracy';

export interface ParameterAdjustment {
  parameter: string;
  current_value: number;
  proposed_adjustment: number;
  new_value: number;
  reason: string;
  confidence: number;
  safe: boolean;
}

export interface LearningResult {
  season: number;
  week: number;
  adjustments_proposed: number;
  adjustments_applied: number;
  adjustments: ParameterAdjustment[];
  warnings: string[];
}

/**
 * Maximum adjustment per week (±5%)
 */
const MAX_ADJUSTMENT_PER_WEEK = 0.05;

/**
 * Minimum sample size for confident adjustment
 */
const MIN_SAMPLE_SIZE = 30;

/**
 * Minimum confidence threshold for auto-apply
 */
const MIN_CONFIDENCE = 0.7;

/**
 * Apply model learning based on recent accuracy metrics
 *
 * @param season - Current season
 * @param week - Current week
 * @returns Learning result with applied adjustments
 */
export async function applyModelLearning(
  season: number,
  week: number
): Promise<LearningResult> {
  const result: LearningResult = {
    season,
    week,
    adjustments_proposed: 0,
    adjustments_applied: 0,
    adjustments: [],
    warnings: [],
  };

  try {
    // Step 1: Get recent accuracy metrics (last 4 weeks)
    const recentMetrics = await getRecentAccuracyMetrics(4);

    if (recentMetrics.length === 0) {
      result.warnings.push('No recent accuracy metrics found');
      return result;
    }

    // Step 2: Detect biases and propose adjustments
    const proposedAdjustments = await detectBiasesAndProposeAdjustments(recentMetrics);
    result.adjustments = proposedAdjustments;
    result.adjustments_proposed = proposedAdjustments.length;

    // Step 3: Apply safe adjustments
    for (const adjustment of proposedAdjustments) {
      if (adjustment.safe && adjustment.confidence >= MIN_CONFIDENCE) {
        const applied = await applyParameterAdjustment(
          adjustment.parameter,
          adjustment.proposed_adjustment,
          adjustment.reason,
          season,
          week
        );

        if (applied) {
          result.adjustments_applied++;
        } else {
          result.warnings.push(`Failed to apply adjustment to ${adjustment.parameter}`);
        }
      } else {
        if (!adjustment.safe) {
          result.warnings.push(
            `Skipped unsafe adjustment to ${adjustment.parameter} (exceeds ±5% limit)`
          );
        } else {
          result.warnings.push(
            `Skipped low-confidence adjustment to ${adjustment.parameter} (confidence: ${adjustment.confidence})`
          );
        }
      }
    }

    console.log(
      `Applied ${result.adjustments_applied}/${result.adjustments_proposed} adjustments for ${season} Week ${week}`
    );
  } catch (error) {
    result.warnings.push(
      `Error applying model learning: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Get recent accuracy metrics
 */
async function getRecentAccuracyMetrics(weeks: number): Promise<AccuracyMetrics[]> {
  const { data, error } = await supabase
    .from('model_accuracy_history')
    .select('*')
    .order('season', { ascending: false })
    .order('week', { ascending: false })
    .limit(weeks * 8); // 4 positions × 2 formats

  if (error || !data) {
    return [];
  }

  return data as AccuracyMetrics[];
}

/**
 * Detect biases and propose adjustments
 */
async function detectBiasesAndProposeAdjustments(
  metrics: AccuracyMetrics[]
): Promise<ParameterAdjustment[]> {
  const adjustments: ParameterAdjustment[] = [];

  // Group by position
  const byPosition = new Map<string, AccuracyMetrics[]>();
  for (const metric of metrics) {
    if (!byPosition.has(metric.position)) {
      byPosition.set(metric.position, []);
    }
    byPosition.get(metric.position)!.push(metric);
  }

  // Analyze each position
  for (const [position, posMetrics] of byPosition.entries()) {
    const totalSamples = posMetrics.reduce((sum, m) => sum + m.sample_size, 0);

    if (totalSamples < MIN_SAMPLE_SIZE) {
      continue; // Not enough data
    }

    // Calculate average biases
    const avgOvervaluedBias =
      posMetrics.reduce((sum, m) => sum + m.overvalued_bias * m.sample_size, 0) / totalSamples;
    const avgUndervaluedBias =
      posMetrics.reduce((sum, m) => sum + m.undervalued_bias * m.sample_size, 0) / totalSamples;

    const confidence = Math.min(1, totalSamples / 100); // More samples = higher confidence

    // Detect RB age decay issues
    if (position === 'RB' && avgOvervaluedBias > 0.65) {
      // We consistently rank RBs too high = they decline faster than expected
      const adjustment = calculateSafeAdjustment(0.015); // Increase age decay by 1.5%

      adjustments.push(
        await proposeAdjustment(
          'rb_age_decay',
          adjustment,
          `RBs consistently underperform (${Math.round(avgOvervaluedBias * 100)}% overvalued bias)`,
          confidence
        )
      );
    }

    // Detect young WR breakouts
    if (position === 'WR' && avgUndervaluedBias > 0.65) {
      // We consistently rank young WRs too low = breakouts happening more often
      const adjustment = calculateSafeAdjustment(0.02); // Increase breakout weight by 2%

      adjustments.push(
        await proposeAdjustment(
          'young_wr_breakout_weight',
          adjustment,
          `Young WRs consistently outperform (${Math.round(avgUndervaluedBias * 100)}% undervalued bias)`,
          confidence
        )
      );
    }

    // Detect QB age decay
    if (position === 'QB' && avgOvervaluedBias > 0.65) {
      const adjustment = calculateSafeAdjustment(0.01); // Increase QB age decay

      adjustments.push(
        await proposeAdjustment(
          'qb_age_decay',
          adjustment,
          `QBs consistently underperform (${Math.round(avgOvervaluedBias * 100)}% overvalued bias)`,
          confidence
        )
      );
    }

    // Detect TE volatility
    if (position === 'TE' && avgOvervaluedBias > 0.6) {
      const adjustment = calculateSafeAdjustment(0.015);

      adjustments.push(
        await proposeAdjustment(
          'te_age_decay',
          adjustment,
          `TEs consistently underperform (${Math.round(avgOvervaluedBias * 100)}% overvalued bias)`,
          confidence
        )
      );
    }
  }

  // Analyze rookie-specific biases
  const rookieAdjustments = await analyzeRookieBiases(metrics);
  adjustments.push(...rookieAdjustments);

  return adjustments;
}

/**
 * Analyze rookie-specific biases
 */
async function analyzeRookieBiases(metrics: AccuracyMetrics[]): Promise<ParameterAdjustment[]> {
  const adjustments: ParameterAdjustment[] = [];

  // TODO: Implement rookie-specific analysis
  // This would require tracking rookie status in predictions/outcomes
  // For now, returning empty array

  return adjustments;
}

/**
 * Propose a parameter adjustment
 */
async function proposeAdjustment(
  parameter: string,
  adjustment: number,
  reason: string,
  confidence: number
): Promise<ParameterAdjustment> {
  // Get current parameter value
  const { data, error } = await supabase
    .from('model_tuning_parameters')
    .select('value, min_value, max_value')
    .eq('parameter', parameter)
    .single();

  if (error || !data) {
    return {
      parameter,
      current_value: 1.0,
      proposed_adjustment: 0,
      new_value: 1.0,
      reason: 'Parameter not found',
      confidence: 0,
      safe: false,
    };
  }

  const currentValue = data.value;
  const newValue = currentValue + adjustment;

  // Check if adjustment is safe
  const safe =
    Math.abs(adjustment) <= MAX_ADJUSTMENT_PER_WEEK &&
    newValue >= data.min_value &&
    newValue <= data.max_value;

  return {
    parameter,
    current_value: currentValue,
    proposed_adjustment: adjustment,
    new_value: Math.max(data.min_value, Math.min(data.max_value, newValue)),
    reason,
    confidence,
    safe,
  };
}

/**
 * Calculate safe adjustment within ±5% limit
 */
function calculateSafeAdjustment(idealAdjustment: number): number {
  return Math.max(
    -MAX_ADJUSTMENT_PER_WEEK,
    Math.min(MAX_ADJUSTMENT_PER_WEEK, idealAdjustment)
  );
}

/**
 * Apply parameter adjustment to database
 */
async function applyParameterAdjustment(
  parameter: string,
  adjustment: number,
  reason: string,
  season: number,
  week: number
): Promise<boolean> {
  try {
    // Use database function for safe application
    const { data, error } = await supabase.rpc('apply_parameter_adjustment', {
      p_parameter: parameter,
      p_adjustment: adjustment,
      p_reason: reason,
      p_season: season,
      p_week: week,
      p_auto_applied: true,
    });

    if (error) {
      console.error(`Error applying adjustment: ${error.message}`);
      return false;
    }

    console.log(`Applied adjustment to ${parameter}: ${adjustment > 0 ? '+' : ''}${adjustment}`);
    return true;
  } catch (error) {
    console.error(`Exception applying adjustment:`, error);
    return false;
  }
}

/**
 * Get tuning parameter value
 */
export async function getTuningParameter(parameter: string): Promise<number> {
  const { data, error } = await supabase
    .from('model_tuning_parameters')
    .select('value')
    .eq('parameter', parameter)
    .single();

  if (error || !data) {
    console.warn(`Parameter ${parameter} not found, using default 1.0`);
    return 1.0;
  }

  return data.value;
}

/**
 * Get all tuning parameters
 */
export async function getAllTuningParameters(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('model_tuning_parameters')
    .select('parameter, value');

  if (error || !data) {
    return new Map();
  }

  const params = new Map<string, number>();
  for (const row of data) {
    params.set(row.parameter, row.value);
  }

  return params;
}

/**
 * Reset parameter to default value
 */
export async function resetParameter(parameter: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('model_tuning_parameters')
    .select('default_value')
    .eq('parameter', parameter)
    .single();

  if (error || !data) {
    return false;
  }

  const { error: updateError } = await supabase
    .from('model_tuning_parameters')
    .update({
      value: data.default_value,
      last_adjustment: 0,
      last_adjusted_at: new Date().toISOString(),
      last_adjusted_by: 'manual_reset',
      reason: 'Reset to default value',
    })
    .eq('parameter', parameter);

  return !updateError;
}

/**
 * Reset all parameters to defaults
 */
export async function resetAllParameters(): Promise<number> {
  const { data, error } = await supabase
    .from('model_tuning_parameters')
    .update({
      value: supabase.raw('default_value'),
      last_adjustment: 0,
      last_adjusted_at: new Date().toISOString(),
      last_adjusted_by: 'manual_reset',
      reason: 'Mass reset to defaults',
    })
    .neq('parameter', ''); // Update all rows

  if (error) {
    return 0;
  }

  return data?.length || 0;
}

/**
 * Get parameter adjustment history
 */
export async function getParameterHistory(
  parameter: string,
  limit: number = 20
): Promise<
  Array<{
    old_value: number;
    new_value: number;
    adjustment: number;
    reason: string;
    season: number;
    week: number | null;
    auto_applied: boolean;
    created_at: string;
  }>
> {
  const { data, error } = await supabase
    .from('model_learning_audit')
    .select('*')
    .eq('parameter', parameter)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Get summary of all parameter adjustments
 */
export async function getParameterSummary(): Promise<
  Array<{
    parameter: string;
    category: string;
    current_value: number;
    default_value: number;
    total_adjustment: number;
    adjustment_count: number;
    last_adjusted_at: string | null;
  }>
> {
  const { data, error } = await supabase.from('parameter_adjustment_summary').select('*');

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Manually apply adjustment (admin override)
 */
export async function manuallyAdjustParameter(
  parameter: string,
  adjustment: number,
  reason: string
): Promise<boolean> {
  const { season, week } = getCurrentSeasonWeek();

  try {
    const { data, error } = await supabase.rpc('apply_parameter_adjustment', {
      p_parameter: parameter,
      p_adjustment: adjustment,
      p_reason: reason,
      p_season: season,
      p_week: week,
      p_auto_applied: false,
    });

    if (error) {
      console.error(`Error applying manual adjustment: ${error.message}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Exception applying manual adjustment:`, error);
    return false;
  }
}

/**
 * Scheduled learning job
 *
 * Runs weekly after accuracy calculation (Tuesday afternoon).
 */
export async function scheduledModelLearning(): Promise<LearningResult> {
  const { season, week } = getCurrentSeasonWeek();

  console.log(`Running scheduled model learning for ${season} Week ${week}...`);

  return applyModelLearning(season, week);
}

/**
 * Get current NFL season and week
 */
function getCurrentSeasonWeek(): { season: number; week: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const season = month >= 9 ? year : year - 1;
  const seasonStart = new Date(season, 8, 1);
  const daysSinceStart = Math.floor(
    (now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const week = Math.min(18, Math.max(1, Math.floor(daysSinceStart / 7) + 1));

  return { season, week };
}

/**
 * Validate learning system health
 */
export async function validateLearningSystem(): Promise<{
  healthy: boolean;
  warnings: string[];
  stats: {
    total_parameters: number;
    auto_tune_enabled: number;
    parameters_adjusted: number;
    avg_adjustment: number;
    recent_accuracy: number | null;
  };
}> {
  const warnings: string[] = [];

  // Check parameters
  const { data: params, error: paramsError } = await supabase
    .from('model_tuning_parameters')
    .select('*');

  if (paramsError || !params) {
    warnings.push('Failed to fetch tuning parameters');
    return {
      healthy: false,
      warnings,
      stats: {
        total_parameters: 0,
        auto_tune_enabled: 0,
        parameters_adjusted: 0,
        avg_adjustment: 0,
        recent_accuracy: null,
      },
    };
  }

  const autoTuneEnabled = params.filter((p) => p.auto_tune).length;
  const parametersAdjusted = params.filter((p) => p.adjustment_count > 0).length;
  const avgAdjustment =
    params.reduce((sum, p) => sum + Math.abs(p.value - p.default_value), 0) / params.length;

  // Check recent accuracy
  const { data: recentAccuracy } = await supabase
    .from('model_accuracy_history')
    .select('accuracy_score')
    .order('season', { ascending: false })
    .order('week', { ascending: false })
    .limit(1)
    .maybeSingle();

  const recentAccuracyScore = recentAccuracy?.accuracy_score || null;

  // Validation checks
  if (autoTuneEnabled === 0) {
    warnings.push('No parameters enabled for auto-tuning');
  }

  if (recentAccuracyScore && recentAccuracyScore < 0.5) {
    warnings.push(`Low recent accuracy: ${recentAccuracyScore}`);
  }

  if (avgAdjustment > 0.3) {
    warnings.push(`Large average adjustment: ${avgAdjustment.toFixed(3)}`);
  }

  return {
    healthy: warnings.length === 0,
    warnings,
    stats: {
      total_parameters: params.length,
      auto_tune_enabled: autoTuneEnabled,
      parameters_adjusted: parametersAdjusted,
      avg_adjustment: Math.round(avgAdjustment * 1000) / 1000,
      recent_accuracy: recentAccuracyScore,
    },
  };
}
