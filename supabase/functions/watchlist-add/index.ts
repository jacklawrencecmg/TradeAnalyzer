import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Session-Id',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sessionId = req.headers.get('X-Session-Id');
    if (!sessionId) {
      throw new Error('Session ID required');
    }

    const { player_id, notes } = await req.json();
    if (!player_id) {
      throw new Error('Player ID required');
    }

    const { data: watchlistId, error: watchlistError } = await supabase
      .rpc('get_or_create_watchlist', { p_session_id: sessionId });

    if (watchlistError) {
      throw new Error(`Failed to get watchlist: ${watchlistError.message}`);
    }

    const { data: existing } = await supabase
      .from('watchlist_players')
      .select('player_id')
      .eq('watchlist_id', watchlistId)
      .eq('player_id', player_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, message: 'Player already in watchlist', already_added: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: insertError } = await supabase
      .from('watchlist_players')
      .insert({
        watchlist_id: watchlistId,
        player_id,
        notes: notes || null,
      });

    if (insertError) {
      throw new Error(`Failed to add player: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Player added to watchlist' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
