/**
 * Model Performance Calculator
 *
 * The big metric: Does our advice actually help users?
 *
 * Computes daily/weekly performance scores:
 * - Prediction accuracy (advice outcomes)
 * - Trade accuracy (trade outcomes)
 * - Overall model confidence
 *
 * This is your safety net for detecting regressions after deploys.
 */

import { supabase } from '../supabase';
import { getAdviceSuccessRate } from './evaluateAdviceOutcome';
import { getTradeSuccessRate } from './evaluateTradeOutcome';

export interface ModelPerformance {
  date: string;
  accuracyScore: number; // 0-100
  adviceScore: number; // 0-100
  tradeScore: number; // 0-100
  confidence: number; // 0-100
  totalPredictions: number;
  totalTrades: number;
}

export interface PerformanceComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
  status: 'improved' | 'degraded' | 'stable';
}

/**
 * Calculate model performance for date
 */
export async function calculateModelPerformance(date: Date): Promise<ModelPerformance | null> {
  try {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Get advice success rate for day
    const adviceResult = await getAdviceSuccessRate({
      startWeek: getWeekFromDate(startDate),
      endWeek: getWeekFromDate(endDate),
    });

    // Get trade success rate for day
    const tradeResult = await getTradeSuccessRate(30, {
      startDate,
      endDate,
    });

    // Calculate overall accuracy (weighted average)
    // Advice is weighted higher (60%) than trades (40%)
    const accuracyScore =
      adviceResult.total > 0 && tradeResult.total > 0
        ? adviceResult.rate * 0.6 + tradeResult.rate * 0.4
        : adviceResult.total > 0
        ? adviceResult.rate
        : tradeResult.total > 0
        ? tradeResult.rate
        : 0;

    // Calculate confidence based on sample size
    // More predictions = higher confidence
    const totalSamples = adviceResult.total + tradeResult.total * 2; // Trades weighted 2x
    const confidence = Math.min(100, (totalSamples / 10) * 10); // 10 samples per 10% confidence

    const performance: ModelPerformance = {
      date: date.toISOString().split('T')[0],
      accuracyScore: Math.round(accuracyScore * 100) / 100,
      adviceScore: Math.round(adviceResult.rate * 100) / 100,
      tradeScore: Math.round(tradeResult.rate * 100) / 100,
      confidence: Math.round(confidence),
      totalPredictions: adviceResult.total,
      totalTrades: tradeResult.total,
    };

    return performance;
  } catch (err) {
    console.error('Exception calculating model performance:', err);
    return null;
  }
}

/**
 * Update model performance for date
 *
 * Calculates and stores performance in database
 */
export async function updateModelPerformance(date: Date): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('update_model_performance', {
      p_date: date.toISOString().split('T')[0],
    });

    if (error) {
      console.error('Error updating model performance:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception updating model performance:', err);
    return false;
  }
}

/**
 * Get model performance history
 */
export async function getModelPerformanceHistory(
  days: number = 30
): Promise<ModelPerformance[]> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('model_performance_history')
    .select('*')
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching performance history:', error);
    return [];
  }

  return (data || []).map((p) => ({
    date: p.date,
    accuracyScore: parseFloat(p.accuracy_score),
    adviceScore: parseFloat(p.advice_score),
    tradeScore: parseFloat(p.trade_score),
    confidence: parseFloat(p.confidence),
    totalPredictions: p.total_predictions,
    totalTrades: p.total_trades,
  }));
}

/**
 * Get latest model performance
 */
export async function getLatestModelPerformance(): Promise<ModelPerformance | null> {
  const { data, error } = await supabase
    .from('model_performance_history')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching latest performance:', error);
    return null;
  }

  return {
    date: data.date,
    accuracyScore: parseFloat(data.accuracy_score),
    adviceScore: parseFloat(data.advice_score),
    tradeScore: parseFloat(data.trade_score),
    confidence: parseFloat(data.confidence),
    totalPredictions: data.total_predictions,
    totalTrades: data.total_trades,
  };
}

/**
 * Compare current vs previous performance
 *
 * Detects regressions after deploys
 */
export async function comparePerformance(
  currentDate: Date,
  previousDate: Date
): Promise<PerformanceComparison[]> {
  const current = await calculateModelPerformance(currentDate);
  const previous = await calculateModelPerformance(previousDate);

  if (!current || !previous) {
    return [];
  }

  const comparisons: PerformanceComparison[] = [];

  // Compare accuracy
  comparisons.push(
    createComparison('Overall Accuracy', current.accuracyScore, previous.accuracyScore)
  );

  // Compare advice score
  comparisons.push(createComparison('Advice Score', current.adviceScore, previous.adviceScore));

  // Compare trade score
  comparisons.push(createComparison('Trade Score', current.tradeScore, previous.tradeScore));

  // Compare confidence
  comparisons.push(createComparison('Confidence', current.confidence, previous.confidence));

  return comparisons;
}

/**
 * Create performance comparison
 */
function createComparison(
  metric: string,
  current: number,
  previous: number
): PerformanceComparison {
  const change = current - previous;
  const changePercent = previous > 0 ? (change / previous) * 100 : 0;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(change) > 2) {
    // 2% threshold for significance
    direction = change > 0 ? 'up' : 'down';
  }

  let status: 'improved' | 'degraded' | 'stable' = 'stable';
  if (direction === 'up') {
    status = 'improved';
  } else if (direction === 'down') {
    status = 'degraded';
  }

  return {
    metric,
    current: Math.round(current * 100) / 100,
    previous: Math.round(previous * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    direction,
    status,
  };
}

/**
 * Detect performance regression
 *
 * Returns true if performance has significantly degraded
 */
export async function detectRegression(
  currentDate: Date,
  threshold: number = -5 // -5% change threshold
): Promise<{ hasRegression: boolean; degradedMetrics: string[] }> {
  const yesterday = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
  const comparisons = await comparePerformance(currentDate, yesterday);

  const degradedMetrics = comparisons
    .filter((c) => c.status === 'degraded' && c.changePercent < threshold)
    .map((c) => c.metric);

  return {
    hasRegression: degradedMetrics.length > 0,
    degradedMetrics,
  };
}

/**
 * Get performance trend
 */
export async function getPerformanceTrend(
  days: number = 7
): Promise<{
  trend: 'improving' | 'stable' | 'declining';
  averageChange: number;
  consistency: number;
}> {
  const history = await getModelPerformanceHistory(days);

  if (history.length < 2) {
    return { trend: 'stable', averageChange: 0, consistency: 0 };
  }

  // Calculate day-over-day changes
  const changes: number[] = [];
  for (let i = 0; i < history.length - 1; i++) {
    const change = history[i].accuracyScore - history[i + 1].accuracyScore;
    changes.push(change);
  }

  // Average change
  const averageChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;

  // Determine trend
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (Math.abs(averageChange) > 2) {
    trend = averageChange > 0 ? 'improving' : 'declining';
  }

  // Calculate consistency (lower std dev = more consistent)
  const mean = averageChange;
  const variance =
    changes.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / changes.length;
  const stdDev = Math.sqrt(variance);
  const consistency = Math.max(0, 100 - stdDev * 10); // Lower variance = higher consistency

  return {
    trend,
    averageChange: Math.round(averageChange * 100) / 100,
    consistency: Math.round(consistency),
  };
}

/**
 * Get performance summary
 */
export async function getPerformanceSummary(): Promise<{
  latest: ModelPerformance | null;
  trend: Awaited<ReturnType<typeof getPerformanceTrend>>;
  regression: Awaited<ReturnType<typeof detectRegression>>;
}> {
  const latest = await getLatestModelPerformance();
  const trend = await getPerformanceTrend(7);
  const today = new Date();
  const regression = await detectRegression(today);

  return {
    latest,
    trend,
    regression,
  };
}

/**
 * Calculate rolling average performance
 */
export async function getRollingAveragePerformance(
  days: number = 7
): Promise<{
  accuracyScore: number;
  adviceScore: number;
  tradeScore: number;
  confidence: number;
}> {
  const history = await getModelPerformanceHistory(days);

  if (history.length === 0) {
    return {
      accuracyScore: 0,
      adviceScore: 0,
      tradeScore: 0,
      confidence: 0,
    };
  }

  const sum = history.reduce(
    (acc, p) => ({
      accuracyScore: acc.accuracyScore + p.accuracyScore,
      adviceScore: acc.adviceScore + p.adviceScore,
      tradeScore: acc.tradeScore + p.tradeScore,
      confidence: acc.confidence + p.confidence,
    }),
    { accuracyScore: 0, adviceScore: 0, tradeScore: 0, confidence: 0 }
  );

  const count = history.length;

  return {
    accuracyScore: Math.round((sum.accuracyScore / count) * 100) / 100,
    adviceScore: Math.round((sum.adviceScore / count) * 100) / 100,
    tradeScore: Math.round((sum.tradeScore / count) * 100) / 100,
    confidence: Math.round(sum.confidence / count),
  };
}

/**
 * Helper: Get week number from date
 */
function getWeekFromDate(date: Date): number {
  const year = date.getFullYear();
  const seasonStart = new Date(year, 8, 1); // Sept 1
  const weeksSinceStart = Math.floor(
    (date.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  return Math.max(1, Math.min(18, weeksSinceStart + 1));
}

/**
 * Batch update performance for date range
 */
export async function batchUpdatePerformance(
  startDate: Date,
  endDate: Date
): Promise<number> {
  let updated = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const success = await updateModelPerformance(currentDate);
    if (success) updated++;

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return updated;
}
