/**
 * Update Model Performance Edge Function
 *
 * Cron job that runs daily to calculate and store model performance metrics.
 * This is your safety net for detecting regressions after deploys.
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

    // Get date parameter from query or use yesterday
    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    const date = dateParam ? new Date(dateParam) : getYesterday();

    // Use database function to update performance
    const { error } = await supabase.rpc('update_model_performance', {
      p_date: date.toISOString().split('T')[0],
    });

    if (error) {
      throw new Error(`Error updating performance: ${error.message}`);
    }

    // Get the updated performance
    const { data: performance, error: fetchError } = await supabase
      .from('model_performance_history')
      .select('*')
      .eq('date', date.toISOString().split('T')[0])
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Error fetching performance: ${fetchError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: date.toISOString().split('T')[0],
        performance: performance || null,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error updating model performance:', error);

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

function getYesterday(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(0, 0, 0, 0);
  return date;
}
