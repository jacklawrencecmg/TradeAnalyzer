import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const sleeperResp = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!sleeperResp.ok) {
      throw new Error(`Sleeper API error: ${sleeperResp.status}`);
    }

    const sleeperData: Record<string, {
      player_id: string;
      full_name?: string;
      first_name?: string;
      last_name?: string;
      position?: string;
      fantasy_positions?: string[];
    }> = await sleeperResp.json();

    const nameToSleeperId = new Map<string, string>();
    for (const [id, player] of Object.entries(sleeperData)) {
      const pos = player.position || (player.fantasy_positions?.[0] ?? '');
      if (!['QB', 'RB', 'WR', 'TE'].includes(pos)) continue;
      const fullName = player.full_name || `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim();
      if (!fullName) continue;
      const key = normalize(fullName);
      if (!nameToSleeperId.has(key)) {
        nameToSleeperId.set(key, id);
      }
    }

    const { data: snapshots, error: snapError } = await supabase
      .from('ktc_value_snapshots')
      .select('id, player_id, full_name, position')
      .in('position', ['QB', 'RB', 'WR', 'TE']);

    if (snapError) throw snapError;

    let updated = 0;
    let notFound = 0;
    const misses: string[] = [];

    for (const row of snapshots ?? []) {
      const key = normalize(row.full_name ?? '');
      const correctSleeperId = nameToSleeperId.get(key);

      if (!correctSleeperId) {
        notFound++;
        if (misses.length < 20) misses.push(row.full_name);
        continue;
      }

      if (row.player_id === correctSleeperId) continue;

      const { error } = await supabase
        .from('ktc_value_snapshots')
        .update({ player_id: correctSleeperId })
        .eq('id', row.id);

      if (!error) updated++;
    }

    return new Response(
      JSON.stringify({ ok: true, updated, notFound, misses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
