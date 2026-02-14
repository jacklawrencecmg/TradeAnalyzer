import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const formatMultipliers: Record<string, Record<string, number>> = {
  dynasty_superflex: { QB: 1.35, RB: 1.15, WR: 1.0, TE: 1.10 },
  dynasty_sf: { QB: 1.35, RB: 1.15, WR: 1.0, TE: 1.10 },
  dynasty_1qb: { QB: 1.0, RB: 1.18, WR: 1.0, TE: 1.10 },
  dynasty_tep: { QB: 1.35, RB: 1.15, WR: 1.0, TE: 1.25 },
};

function calcFdpAdjustments(ctx: any): number {
  let adj = 0;

  if (ctx.age != null) {
    if (ctx.age <= 22) adj += 250;
    else if (ctx.age <= 24) adj += 150;
    else if (ctx.age <= 25) adj += 0;
    else if (ctx.age === 26) adj -= 300;
    else if (ctx.age === 27) adj -= 650;
    else if (ctx.age >= 28) adj -= 1100;
  }

  if (ctx.depth_role === 'feature') adj += 500;
  if (ctx.depth_role === 'lead_committee') adj += 200;
  if (ctx.depth_role === 'committee') adj -= 250;
  if (ctx.depth_role === 'handcuff') adj -= 450;
  if (ctx.depth_role === 'backup') adj -= 700;

  if (ctx.workload_tier === 'elite') adj += 350;
  if (ctx.workload_tier === 'solid') adj += 150;
  if (ctx.workload_tier === 'light') adj -= 250;

  if (ctx.injury_risk === 'medium') adj -= 150;
  if (ctx.injury_risk === 'high') adj -= 450;

  if (ctx.contract_security === 'high') adj += 200;
  if (ctx.contract_security === 'low') adj -= 250;

  return adj;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');

    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'dynasty_sf';
    const formatKey = format.replace(/-/g, '_');

    const { data: players, error: playersError } = await supabase
      .from('player_values')
      .select('player_id, player_name, team, ktc_value, position, age, depth_role, workload_tier, injury_risk, contract_security')
      .eq('position', 'RB');

    if (playersError) {
      throw playersError;
    }

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No RB players found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const capturedAt = new Date().toISOString();
    let successCount = 0;
    let updatedCount = 0;
    let manualContextCount = 0;
    let suggestedContextCount = 0;
    let multiplierOnlyCount = 0;

    for (const player of players) {
      const hasManualContext = player.depth_role || player.workload_tier || player.contract_security;

      let ctx = {
        age: player.age,
        depth_role: player.depth_role,
        workload_tier: player.workload_tier,
        injury_risk: player.injury_risk,
        contract_security: player.contract_security,
      };

      if (!hasManualContext) {
        const { data: suggestion } = await supabase
          .from('player_context_suggestions')
          .select('suggested_depth_role, suggested_workload_tier, suggested_contract_security, confidence')
          .eq('player_id', player.player_id)
          .eq('status', 'pending')
          .gte('confidence', 0.75)
          .gt('expires_at', capturedAt)
          .maybeSingle();

        if (suggestion) {
          ctx = {
            age: player.age,
            depth_role: suggestion.suggested_depth_role,
            workload_tier: suggestion.suggested_workload_tier,
            injury_risk: player.injury_risk,
            contract_security: suggestion.suggested_contract_security,
          };
          suggestedContextCount++;
        }
      } else {
        manualContextCount++;
      }

      const mult = formatMultipliers[formatKey]?.RB ?? 1;
      let baseFdpValue = Math.round(player.ktc_value * mult);

      if (ctx.age || ctx.depth_role || ctx.workload_tier || ctx.injury_risk || ctx.contract_security) {
        baseFdpValue += calcFdpAdjustments(ctx);
      } else {
        multiplierOnlyCount++;
      }

      const fdpValue = Math.max(0, Math.min(10000, baseFdpValue));

      const { error: updateError } = await supabase
        .from('player_values')
        .update({
          fdp_value: fdpValue,
          last_updated: capturedAt,
        })
        .eq('player_id', player.player_id);

      if (updateError) {
        console.error('Error updating player:', updateError);
        continue;
      }

      updatedCount++;

      const { data: latestSnapshot } = await supabase
        .from('ktc_value_snapshots')
        .select('position_rank')
        .eq('player_id', player.player_id)
        .eq('format', formatKey)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const positionRank = latestSnapshot?.position_rank || 999;

      const { error: snapshotError } = await supabase
        .from('ktc_value_snapshots')
        .insert({
          player_id: player.player_id,
          full_name: player.player_name,
          position: 'RB',
          team: player.team,
          position_rank: positionRank,
          ktc_value: player.ktc_value,
          fdp_value: fdpValue,
          format: formatKey,
          source: 'KTC',
          captured_at: capturedAt,
        });

      if (!snapshotError) {
        successCount++;
      } else {
        console.error('Error inserting snapshot:', snapshotError);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        players_updated: updatedCount,
        snapshots_created: successCount,
        total_players: players.length,
        context_sources: {
          manual: manualContextCount,
          suggested: suggestedContextCount,
          multiplier_only: multiplierOnlyCount,
        },
        format: formatKey,
        timestamp: capturedAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in recalculate function:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
