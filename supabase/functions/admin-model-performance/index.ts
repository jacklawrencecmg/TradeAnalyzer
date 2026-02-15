/**
 * Admin Model Performance API
 *
 * Endpoint for viewing model performance metrics:
 * - Buy low hit rate
 * - Trade win rate
 * - Most helpful features
 * - Regressions after deploys
 * - Active experiments
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    // Get performance history
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const { data: history, error: historyError } = await supabase
      .from('model_performance_history')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (historyError) {
      throw new Error(`Error fetching history: ${historyError.message}`);
    }

    // Get latest performance
    const latest = history && history.length > 0 ? history[0] : null;

    // Calculate buy low hit rate
    const buyLowRate = await getAdviceSuccessRate(supabase, 'up', startDate, endDate);

    // Calculate sell high hit rate
    const sellHighRate = await getAdviceSuccessRate(supabase, 'down', startDate, endDate);

    // Get trade win rate
    const tradeWinRate = await getTradeSuccessRate(supabase, startDate, endDate);

    // Get active experiments
    const { data: experiments } = await supabase
      .from('feature_experiments')
      .select('*')
      .eq('active', true);

    // Check for regressions
    const regression = await detectRegression(supabase, history || []);

    // Get top user actions
    const { data: actions } = await supabase
      .from('user_actions')
      .select('action_type')
      .gte('created_at', startDate.toISOString())
      .limit(1000);

    const actionCounts = actions?.reduce((acc: Record<string, number>, a: any) => {
      acc[a.action_type] = (acc[a.action_type] || 0) + 1;
      return acc;
    }, {});

    const topActions = Object.entries(actionCounts || {})
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          latest: latest
            ? {
                date: latest.date,
                accuracyScore: parseFloat(latest.accuracy_score),
                adviceScore: parseFloat(latest.advice_score),
                tradeScore: parseFloat(latest.trade_score),
                confidence: parseFloat(latest.confidence),
                totalPredictions: latest.total_predictions,
                totalTrades: latest.total_trades,
              }
            : null,
          buyLowHitRate: buyLowRate,
          sellHighHitRate: sellHighRate,
          tradeWinRate: tradeWinRate,
          hasRegression: regression.hasRegression,
          degradedMetrics: regression.degradedMetrics,
        },
        history: history?.map((h: any) => ({
          date: h.date,
          accuracyScore: parseFloat(h.accuracy_score),
          adviceScore: parseFloat(h.advice_score),
          tradeScore: parseFloat(h.trade_score),
          confidence: parseFloat(h.confidence),
          totalPredictions: h.total_predictions,
          totalTrades: h.total_trades,
        })),
        experiments: experiments || [],
        topActions,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching model performance:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function getAdviceSuccessRate(
  supabase: any,
  direction: 'up' | 'down',
  startDate: Date,
  endDate: Date
): Promise<number> {
  const { data } = await supabase
    .from('advice_outcomes')
    .select('success')
    .eq('predicted_direction', direction)
    .not('success', 'is', null)
    .gte('evaluated_at', startDate.toISOString())
    .lte('evaluated_at', endDate.toISOString());

  if (!data || data.length === 0) return 0;

  const successful = data.filter((o: any) => o.success === true).length;
  return (successful / data.length) * 100;
}

async function getTradeSuccessRate(
  supabase: any,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const { data } = await supabase
    .from('trade_outcomes')
    .select('model_prediction_correct')
    .eq('evaluation_window', 30)
    .not('model_prediction_correct', 'is', null)
    .gte('evaluated_at', startDate.toISOString())
    .lte('evaluated_at', endDate.toISOString());

  if (!data || data.length === 0) return 0;

  const successful = data.filter((o: any) => o.model_prediction_correct === true).length;
  return (successful / data.length) * 100;
}

async function detectRegression(
  supabase: any,
  history: any[]
): Promise<{ hasRegression: boolean; degradedMetrics: string[] }> {
  if (history.length < 2) {
    return { hasRegression: false, degradedMetrics: [] };
  }

  const latest = history[0];
  const previous = history[1];

  const degradedMetrics: string[] = [];
  const threshold = -5; // -5% threshold

  const accuracyChange =
    ((parseFloat(latest.accuracy_score) - parseFloat(previous.accuracy_score)) /
      parseFloat(previous.accuracy_score)) *
    100;
  if (accuracyChange < threshold) {
    degradedMetrics.push('Overall Accuracy');
  }

  const adviceChange =
    ((parseFloat(latest.advice_score) - parseFloat(previous.advice_score)) /
      parseFloat(previous.advice_score)) *
    100;
  if (adviceChange < threshold) {
    degradedMetrics.push('Advice Score');
  }

  const tradeChange =
    ((parseFloat(latest.trade_score) - parseFloat(previous.trade_score)) /
      parseFloat(previous.trade_score)) *
    100;
  if (tradeChange < threshold) {
    degradedMetrics.push('Trade Score');
  }

  return {
    hasRegression: degradedMetrics.length > 0,
    degradedMetrics,
  };
}
