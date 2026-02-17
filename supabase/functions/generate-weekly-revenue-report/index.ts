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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(today);
    weekEnd.setHours(23, 59, 59, 999);

    const { data: insights, error: insightsError } = await supabaseClient.rpc(
      'get_revenue_insights',
      { p_days_back: 7 }
    );

    if (insightsError) {
      throw insightsError;
    }

    const insightData = insights?.[0] || {};

    let topConvertingTrigger = null;
    let topConvertingRate = 0;
    let worstConvertingTrigger = null;
    let worstConvertingRate = 100;

    if (insightData.upgrades_by_trigger) {
      const triggers = Object.entries(insightData.upgrades_by_trigger as Record<string, number>);
      const totalUpgrades = insightData.total_upgrades || 1;

      for (const [trigger, count] of triggers) {
        const rate = (count / totalUpgrades) * 100;
        if (rate > topConvertingRate) {
          topConvertingRate = rate;
          topConvertingTrigger = trigger;
        }
        if (rate < worstConvertingRate) {
          worstConvertingRate = rate;
          worstConvertingTrigger = trigger;
        }
      }
    }

    const weeklyInsights: Record<string, any> = {
      top_triggers: insightData.upgrades_by_trigger || {},
      best_cta: insightData.best_performing_cta || null,
      worst_cta: insightData.worst_performing_cta || null,
      conversion_rates: insightData.conversion_rate_by_trigger || {},
    };

    const { data: reportData, error: insertError } = await supabaseClient
      .from('weekly_revenue_reports')
      .insert({
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        total_upgrades: insightData.total_upgrades || 0,
        total_revenue: insightData.total_revenue || 0,
        top_converting_trigger: topConvertingTrigger,
        top_converting_trigger_rate: Math.round(topConvertingRate * 100) / 100,
        worst_converting_trigger: worstConvertingTrigger,
        worst_converting_trigger_rate: Math.round(worstConvertingRate * 100) / 100,
        avg_days_to_upgrade: insightData.avg_days_to_upgrade || 0,
        avg_actions_to_upgrade: insightData.avg_actions_to_upgrade || 0,
        best_performing_cta: insightData.best_performing_cta?.cta_text || null,
        insights: weeklyInsights,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Report already exists for this week', success: false }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        report: reportData,
        message: 'Weekly revenue report generated successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating weekly revenue report:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
