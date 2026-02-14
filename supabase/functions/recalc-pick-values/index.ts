import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type SeasonPhase =
  | 'playoffs'
  | 'pre_draft_hype'
  | 'rookie_fever'
  | 'post_draft_correction'
  | 'camp_battles'
  | 'season'
  | 'trade_deadline_push';

function getSeasonPhase(date: Date = new Date()): SeasonPhase {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 1 || (month === 2 && day <= 15)) {
    return 'playoffs';
  }
  if (month === 2 || month === 3) {
    return 'pre_draft_hype';
  }
  if (month === 4 && day <= 30) {
    return 'rookie_fever';
  }
  if (month === 5 || month === 6) {
    return 'post_draft_correction';
  }
  if (month === 7 || month === 8) {
    return 'camp_battles';
  }
  if (month === 9 || month === 10) {
    return 'season';
  }
  return 'trade_deadline_push';
}

const phaseMultipliers: Record<SeasonPhase, number> = {
  playoffs: 0.92,
  pre_draft_hype: 1.08,
  rookie_fever: 1.18,
  post_draft_correction: 1.02,
  camp_battles: 1.05,
  season: 0.95,
  trade_deadline_push: 1.00,
};

function getPhaseMultiplier(phase: SeasonPhase): number {
  return phaseMultipliers[phase] || 1.0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const currentPhase = getSeasonPhase();
    const multiplier = getPhaseMultiplier(currentPhase);

    const { data: picks, error: fetchError } = await supabase
      .from('rookie_pick_values')
      .select('*')
      .order('season', { ascending: true });

    if (fetchError) throw fetchError;

    if (!picks || picks.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No pick values found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const pick of picks) {
      if (pick.manual_override) {
        continue;
      }

      const adjustedValue = Math.round(pick.base_value * multiplier);

      const { error: updateError } = await supabase
        .from('rookie_pick_values')
        .update({
          adjusted_value: adjustedValue,
          phase: currentPhase,
          updated_at: now,
        })
        .eq('id', pick.id);

      if (updateError) {
        console.error('Error updating pick:', updateError);
        continue;
      }

      updatedCount++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        updated_count: updatedCount,
        total_picks: picks.length,
        current_phase: currentPhase,
        multiplier: multiplier,
        timestamp: now,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error recalculating pick values:', error);
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
