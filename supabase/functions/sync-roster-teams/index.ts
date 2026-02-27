import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const sleeperRes = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!sleeperRes.ok) {
      throw new Error(`Sleeper API error: ${sleeperRes.status}`);
    }

    const players: Record<string, { team: string | null; position: string; full_name?: string; first_name?: string; last_name?: string; active?: boolean; status?: string }> = await sleeperRes.json();

    const teamMap: Record<string, string | null> = {};
    for (const [id, player] of Object.entries(players)) {
      teamMap[id] = player.team || null;
    }

    const playerIds = Object.keys(teamMap);

    let updated = 0;
    let unchanged = 0;

    const BATCH = 500;
    for (let i = 0; i < playerIds.length; i += BATCH) {
      const batch = playerIds.slice(i, i + BATCH);

      const { data: rows } = await supabase
        .from('player_values_canonical')
        .select('player_id, team')
        .in('player_id', batch);

      if (!rows) continue;

      for (const row of rows) {
        const newTeam = teamMap[row.player_id] || null;
        if (newTeam !== null && newTeam !== row.team) {
          const { error } = await supabase
            .from('player_values_canonical')
            .update({ team: newTeam })
            .eq('player_id', row.player_id);

          if (!error) updated++;
        } else {
          unchanged++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated, unchanged, total_sleeper_players: playerIds.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
