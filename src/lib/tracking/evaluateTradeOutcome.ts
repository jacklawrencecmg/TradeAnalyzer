/**
 * Trade Outcome Evaluation
 *
 * Evaluates trades after 14 and 30 days to see if recommendations were correct.
 * Compares fantasy points gained by each team.
 */

import { supabase } from '../supabase';

export type TradeWinner = 'team_a' | 'team_b' | 'tie';

export interface TradeOutcome {
  id: string;
  tradeId: string;
  evaluationWindow: number; // 14 or 30 days
  teamAPointsGained: number;
  teamBPointsGained: number;
  winner?: TradeWinner;
  modelPredictionCorrect?: boolean;
  confidenceAtTrade?: number;
  createdAt: string;
  evaluatedAt: string;
}

export interface TradeEvaluation {
  tradeId: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  teamAValueGiven: number;
  teamBValueGiven: number;
  modelPredictedWinner: TradeWinner;
  confidence: number;
  evaluationDate: Date;
}

/**
 * Schedule trade evaluation
 *
 * Call this when a trade is accepted to schedule future evaluation
 */
export async function scheduleTradeEvaluation(
  tradeId: string,
  teamAPlayers: string[],
  teamBPlayers: string[],
  teamAValueGiven: number,
  teamBValueGiven: number,
  confidence: number = 50
): Promise<boolean> {
  try {
    // Determine model prediction
    const valueDiff = teamBValueGiven - teamAValueGiven;
    let predictedWinner: TradeWinner;

    if (Math.abs(valueDiff) < 100) {
      predictedWinner = 'tie';
    } else if (valueDiff > 0) {
      predictedWinner = 'team_a'; // Team A got more value
    } else {
      predictedWinner = 'team_b';
    }

    // Store evaluation metadata
    const evaluation: TradeEvaluation = {
      tradeId,
      teamAPlayers,
      teamBPlayers,
      teamAValueGiven,
      teamBValueGiven,
      modelPredictedWinner: predictedWinner,
      confidence,
      evaluationDate: new Date(),
    };

    // TODO: Schedule background job for +14 and +30 days
    // For now, store in metadata table or use edge function with cron

    console.log('Trade evaluation scheduled:', evaluation);

    return true;
  } catch (err) {
    console.error('Exception scheduling trade evaluation:', err);
    return false;
  }
}

/**
 * Evaluate trade outcome
 *
 * Run this 14 or 30 days after trade
 */
export async function evaluateTradeOutcome(
  tradeId: string,
  evaluationWindow: 14 | 30
): Promise<TradeOutcome | null> {
  try {
    // Get trade details
    // TODO: Fetch from trades table
    const tradeDetails = await getTradeDetails(tradeId);

    if (!tradeDetails) {
      console.error('Trade not found:', tradeId);
      return null;
    }

    // Calculate points gained by each team
    const teamAPoints = await calculatePointsGained(
      tradeDetails.teamAPlayers,
      tradeDetails.evaluationDate,
      evaluationWindow
    );

    const teamBPoints = await calculatePointsGained(
      tradeDetails.teamBPlayers,
      tradeDetails.evaluationDate,
      evaluationWindow
    );

    // Determine winner
    let winner: TradeWinner;
    const pointsDiff = teamAPoints - teamBPoints;

    if (Math.abs(pointsDiff) < 10) {
      winner = 'tie';
    } else if (pointsDiff > 0) {
      winner = 'team_a';
    } else {
      winner = 'team_b';
    }

    // Check if model prediction was correct
    const modelCorrect = winner === tradeDetails.modelPredictedWinner;

    // Store outcome
    const { data, error } = await supabase
      .from('trade_outcomes')
      .insert({
        trade_id: tradeId,
        evaluation_window: evaluationWindow,
        team_a_points_gained: teamAPoints,
        team_b_points_gained: teamBPoints,
        winner,
        model_prediction_correct: modelCorrect,
        confidence_at_trade: tradeDetails.confidence,
        evaluated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing trade outcome:', error);
      return null;
    }

    return {
      id: data.id,
      tradeId: data.trade_id,
      evaluationWindow: data.evaluation_window,
      teamAPointsGained: parseFloat(data.team_a_points_gained),
      teamBPointsGained: parseFloat(data.team_b_points_gained),
      winner: data.winner as TradeWinner,
      modelPredictionCorrect: data.model_prediction_correct,
      confidenceAtTrade: data.confidence_at_trade,
      createdAt: data.created_at,
      evaluatedAt: data.evaluated_at,
    };
  } catch (err) {
    console.error('Exception evaluating trade outcome:', err);
    return null;
  }
}

/**
 * Calculate fantasy points gained by players over period
 */
async function calculatePointsGained(
  playerIds: string[],
  startDate: Date,
  days: number
): Promise<number> {
  // TODO: Implement actual stats lookup from Sleeper or sportsdata API
  // For now, use value changes as proxy

  let totalPoints = 0;

  for (const playerId of playerIds) {
    const points = await getPlayerPointsForPeriod(playerId, startDate, days);
    totalPoints += points;
  }

  return totalPoints;
}

/**
 * Get player fantasy points for period
 */
async function getPlayerPointsForPeriod(
  playerId: string,
  startDate: Date,
  days: number
): Promise<number> {
  try {
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    // TODO: Fetch actual stats
    // For now, use value change as proxy
    const { data: beforeValue } = await supabase
      .from('player_values')
      .select('fdp_value')
      .eq('player_id', playerId)
      .lte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: afterValue } = await supabase
      .from('player_values')
      .select('fdp_value')
      .eq('player_id', playerId)
      .gte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!beforeValue || !afterValue) {
      return 0;
    }

    // Return value change (positive = gained points)
    return afterValue.fdp_value - beforeValue.fdp_value;
  } catch (err) {
    console.error('Exception getting player points:', err);
    return 0;
  }
}

/**
 * Get trade details for evaluation
 */
async function getTradeDetails(tradeId: string): Promise<TradeEvaluation | null> {
  // TODO: Implement actual trade lookup from database
  // For now, return mock data
  return null;
}

/**
 * Get trade success rate
 */
export async function getTradeSuccessRate(
  evaluationWindow: 14 | 30 = 30,
  options?: {
    startDate?: Date;
    endDate?: Date;
    minConfidence?: number;
  }
): Promise<{ total: number; successful: number; rate: number }> {
  let query = supabase
    .from('trade_outcomes')
    .select('model_prediction_correct')
    .eq('evaluation_window', evaluationWindow)
    .not('model_prediction_correct', 'is', null);

  if (options?.startDate) {
    query = query.gte('evaluated_at', options.startDate.toISOString());
  }

  if (options?.endDate) {
    query = query.lte('evaluated_at', options.endDate.toISOString());
  }

  if (options?.minConfidence) {
    query = query.gte('confidence_at_trade', options.minConfidence);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error getting trade success rate:', error);
    return { total: 0, successful: 0, rate: 0 };
  }

  const total = data?.length || 0;
  const successful = data?.filter((o) => o.model_prediction_correct === true).length || 0;
  const rate = total > 0 ? (successful / total) * 100 : 0;

  return { total, successful, rate };
}

/**
 * Get trade success rate by confidence level
 */
export async function getTradeSuccessByConfidence(
  evaluationWindow: 14 | 30 = 30
): Promise<Array<{ confidenceRange: string; total: number; successful: number; rate: number }>> {
  const { data, error } = await supabase
    .from('trade_outcomes')
    .select('confidence_at_trade, model_prediction_correct')
    .eq('evaluation_window', evaluationWindow)
    .not('model_prediction_correct', 'is', null)
    .not('confidence_at_trade', 'is', null);

  if (error) {
    console.error('Error getting trade success by confidence:', error);
    return [];
  }

  // Group by confidence ranges
  const ranges = [
    { label: '0-25%', min: 0, max: 25 },
    { label: '26-50%', min: 26, max: 50 },
    { label: '51-75%', min: 51, max: 75 },
    { label: '76-100%', min: 76, max: 100 },
  ];

  return ranges.map((range) => {
    const inRange = (data || []).filter(
      (o) => o.confidence_at_trade >= range.min && o.confidence_at_trade <= range.max
    );

    const total = inRange.length;
    const successful = inRange.filter((o) => o.model_prediction_correct === true).length;
    const rate = total > 0 ? (successful / total) * 100 : 0;

    return {
      confidenceRange: range.label,
      total,
      successful,
      rate,
    };
  });
}

/**
 * Get recent trade outcomes
 */
export async function getRecentTradeOutcomes(
  limit: number = 20,
  evaluationWindow: 14 | 30 = 30
): Promise<TradeOutcome[]> {
  const { data, error } = await supabase
    .from('trade_outcomes')
    .select('*')
    .eq('evaluation_window', evaluationWindow)
    .order('evaluated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent trade outcomes:', error);
    return [];
  }

  return (data || []).map((o) => ({
    id: o.id,
    tradeId: o.trade_id,
    evaluationWindow: o.evaluation_window,
    teamAPointsGained: parseFloat(o.team_a_points_gained),
    teamBPointsGained: parseFloat(o.team_b_points_gained),
    winner: o.winner as TradeWinner,
    modelPredictionCorrect: o.model_prediction_correct,
    confidenceAtTrade: o.confidence_at_trade,
    createdAt: o.created_at,
    evaluatedAt: o.evaluated_at,
  }));
}

/**
 * Get trades pending evaluation
 */
export async function getTradesPendingEvaluation(
  evaluationWindow: 14 | 30
): Promise<string[]> {
  // TODO: Implement actual query from trades table
  // For now, return empty array
  return [];
}

/**
 * Batch evaluate pending trades
 */
export async function batchEvaluateTrades(evaluationWindow: 14 | 30): Promise<number> {
  const pendingTradeIds = await getTradesPendingEvaluation(evaluationWindow);

  let evaluated = 0;

  for (const tradeId of pendingTradeIds) {
    const outcome = await evaluateTradeOutcome(tradeId, evaluationWindow);
    if (outcome) evaluated++;
  }

  return evaluated;
}
