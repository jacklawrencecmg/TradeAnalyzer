/**
 * Evaluate Advice Outcomes Edge Function
 *
 * Cron job that runs daily to evaluate pending advice outcomes.
 * Checks if predictions (buy low, sell high, breakouts) were correct.
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

    // Get week parameter from query or use current week
    const url = new URL(req.url);
    const week = parseInt(url.searchParams.get('week') || String(getCurrentWeek()));

    // Get unevaluated outcomes for this week
    const { data: outcomes, error: fetchError } = await supabase
      .from('advice_outcomes')
      .select('*')
      .eq('week', week)
      .is('evaluated_at', null)
      .limit(100);

    if (fetchError) {
      throw new Error(`Error fetching outcomes: ${fetchError.message}`);
    }

    if (!outcomes || outcomes.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          evaluated: 0,
          message: 'No outcomes to evaluate',
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let evaluated = 0;

    // Evaluate each outcome
    for (const outcome of outcomes) {
      // Get player direction (simplified - uses value change)
      const actualDirection = await getPlayerDirection(supabase, outcome.player_id, outcome.week);

      // Determine success
      const success = outcome.predicted_direction === actualDirection;

      // Update outcome
      const { error: updateError } = await supabase
        .from('advice_outcomes')
        .update({
          actual_direction: actualDirection,
          success,
          evaluated_at: new Date().toISOString(),
        })
        .eq('id', outcome.id);

      if (!updateError) {
        evaluated++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        week,
        evaluated,
        total: outcomes.length,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error evaluating advice outcomes:', error);

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

async function getPlayerDirection(
  supabase: any,
  playerId: string,
  week: number
): Promise<'up' | 'down' | 'neutral'> {
  try {
    const beforeDate = getWeekStartDate(week);
    const afterDate = getWeekEndDate(week);

    const { data: beforeValue } = await supabase
      .from('player_values')
      .select('fdp_value')
      .eq('player_id', playerId)
      .lte('created_at', beforeDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: afterValue } = await supabase
      .from('player_values')
      .select('fdp_value')
      .eq('player_id', playerId)
      .gte('created_at', afterDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!beforeValue || !afterValue) {
      return 'neutral';
    }

    const valueDiff = afterValue.fdp_value - beforeValue.fdp_value;
    const percentChange = (valueDiff / beforeValue.fdp_value) * 100;

    if (percentChange > 5) return 'up';
    if (percentChange < -5) return 'down';
    return 'neutral';
  } catch (err) {
    console.error('Error getting player direction:', err);
    return 'neutral';
  }
}

function getCurrentWeek(): number {
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 8, 1);
  const weeksSinceStart = Math.floor(
    (now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  return Math.max(1, Math.min(18, weeksSinceStart + 1));
}

function getWeekStartDate(week: number): Date {
  const year = new Date().getFullYear();
  const seasonStart = new Date(year, 8, 1);
  return new Date(seasonStart.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
}

function getWeekEndDate(week: number): Date {
  const start = getWeekStartDate(week);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
}
