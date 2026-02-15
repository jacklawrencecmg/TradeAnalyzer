/**
 * Value Scarcity Debug Endpoint
 *
 * Admin endpoint for viewing scarcity adjustment details.
 * Shows:
 * - Raw value (before scarcity)
 * - Replacement value for position
 * - VOR (Value Over Replacement)
 * - Elasticity adjustment
 * - Final value
 * - Explanation
 *
 * GET /value-scarcity-debug?player_id=<uuid>&league_profile_id=<uuid>&format=dynasty
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ScarcityDebug {
  player_name: string;
  player_position: string;
  position_rank: number;
  final_value: number;
  raw_value: number;
  replacement_value: number;
  vor: number;
  elasticity_adj: number;
  total_adjustment: number;
  explanation: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get query parameters
    const url = new URL(req.url);
    const playerId = url.searchParams.get('player_id');
    const leagueProfileId = url.searchParams.get('league_profile_id');
    const format = url.searchParams.get('format') || 'dynasty';

    if (!playerId) {
      return new Response(
        JSON.stringify({ error: 'player_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!leagueProfileId) {
      return new Response(
        JSON.stringify({ error: 'league_profile_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get scarcity explanation using RPC
    const { data: explanation, error: explanationError } = await supabase
      .rpc('get_scarcity_explanation', {
        p_player_id: playerId,
        p_league_profile_id: leagueProfileId,
        p_format: format,
      });

    if (explanationError) {
      throw explanationError;
    }

    if (!explanation || explanation.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No scarcity data found for this player/profile',
          note: 'Debug data is only available after rebuild with debug flag enabled',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const debug: ScarcityDebug = explanation[0];

    // Get league profile info
    const { data: profile, error: profileError } = await supabase
      .from('league_profiles')
      .select('*')
      .eq('id', leagueProfileId)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Calculate additional metrics
    const pctChange = debug.raw_value > 0
      ? ((debug.final_value - debug.raw_value) / debug.raw_value) * 100
      : 0;

    const vorExplanation = debug.vor > 0
      ? `${debug.vor} points above replacement`
      : debug.vor < 0
      ? `${Math.abs(debug.vor)} points below replacement`
      : 'At replacement level';

    // Return comprehensive debug info
    return new Response(
      JSON.stringify({
        player: {
          name: debug.player_name,
          position: debug.player_position,
          position_rank: debug.position_rank,
        },
        profile: {
          id: leagueProfileId,
          name: profile.name,
          format_key: profile.format_key,
          is_superflex: profile.is_superflex,
          te_premium: profile.te_premium,
          idp_enabled: profile.idp_enabled,
        },
        values: {
          raw_value: debug.raw_value,
          final_value: debug.final_value,
          total_adjustment: debug.total_adjustment,
          pct_change: Math.round(pctChange * 10) / 10,
        },
        scarcity: {
          replacement_value: debug.replacement_value,
          vor: debug.vor,
          vor_explanation: vorExplanation,
          elasticity_adjustment: debug.elasticity_adj,
          explanation: debug.explanation,
        },
        breakdown: [
          {
            step: 1,
            description: 'Base value (from KTC/FP)',
            value: debug.raw_value,
          },
          {
            step: 2,
            description: 'VOR adjustment',
            value: debug.raw_value + debug.vor,
            delta: debug.vor,
          },
          {
            step: 3,
            description: 'Elasticity adjustment',
            value: debug.final_value,
            delta: debug.elasticity_adj,
          },
        ],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in value-scarcity-debug:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
