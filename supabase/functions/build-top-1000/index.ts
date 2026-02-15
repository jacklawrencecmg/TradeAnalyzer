import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function adpToRedraftValue(adp: number): number {
  if (!adp || adp <= 0) return 0;
  const rawValue = 10000 * Math.exp(-0.018 * adp);
  return Math.max(0, Math.min(10000, Math.round(rawValue)));
}

function calculateIdpRedraftValue(
  position: string,
  age?: number,
  depthRole?: string,
  injuryRisk?: string
): number {
  const IDP_BASE: Record<string, number> = {
    LB: 4200,
    DL: 3900,
    DB: 3500,
    DE: 3900,
    DT: 3800,
    CB: 3600,
    S: 3400,
  };

  let baseValue = IDP_BASE[position.toUpperCase()] || 0;
  if (baseValue === 0) return 0;

  if (depthRole === 'starter' || depthRole === '1') baseValue += 600;
  if (age && age <= 25) baseValue += 250;
  else if (age && age >= 30) baseValue -= 400;
  if (injuryRisk === 'high') baseValue -= 300;
  else if (injuryRisk === 'elevated') baseValue -= 150;

  return Math.max(0, Math.min(10000, baseValue));
}

function isIdpPosition(position: string): boolean {
  const pos = position?.toUpperCase();
  return ['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S'].includes(pos);
}

function calculateHeuristicRedraftValue(
  position: string,
  age: number | undefined,
  baseValue: number
): number {
  let value = baseValue || 5000;

  if (position === 'QB') {
    if (age && age < 25) value *= 0.7;
    else if (age && age > 35) value *= 0.8;
  } else if (position === 'RB') {
    if (age && age < 24) value *= 1.1;
    else if (age && age > 28) value *= 0.6;
  } else if (position === 'WR') {
    if (age && age < 25) value *= 0.9;
    else if (age && age > 30) value *= 0.75;
  } else if (position === 'TE') {
    if (age && age < 25) value *= 0.85;
    else if (age && age > 30) value *= 0.8;
  }

  return Math.max(0, Math.min(10000, Math.round(value)));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (secret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Building Top-1000 player values...');

    const { data: players, error: fetchError } = await supabase
      .from('nfl_players_registry')
      .select('player_id, full_name, position, current_team, birth_date')
      .not('position', 'in', '(K,P,LS)')
      .order('full_name');

    if (fetchError) {
      throw new Error(`Failed to fetch players: ${fetchError.message}`);
    }

    if (!players || players.length === 0) {
      throw new Error('No players found in registry');
    }

    let processed = 0;
    const errors: string[] = [];

    for (const player of players) {
      try {
        const age = player.birth_date
          ? new Date().getFullYear() - new Date(player.birth_date).getFullYear()
          : undefined;

        const { data: existingValue } = await supabase
          .from('player_values')
          .select('base_value, fdp_value, depth_role, injury_risk')
          .eq('player_id', player.player_id)
          .order('last_updated', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: adpData } = await supabase
          .from('player_adp')
          .select('adp')
          .eq('player_id', player.player_id)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const adp = adpData?.adp;

        let redraftValue: number;
        let redraftValueSource: string;
        let dynastyValue: number;

        if (adp && adp > 0) {
          redraftValue = adpToRedraftValue(adp);
          redraftValueSource = 'adp';
        } else if (isIdpPosition(player.position)) {
          redraftValue = calculateIdpRedraftValue(
            player.position,
            age,
            existingValue?.depth_role,
            existingValue?.injury_risk
          );
          redraftValueSource = 'idp_tier';
        } else {
          redraftValue = calculateHeuristicRedraftValue(
            player.position,
            age,
            existingValue?.base_value || 0
          );
          redraftValueSource = 'heuristic';
        }

        dynastyValue = existingValue?.fdp_value || existingValue?.base_value || redraftValue;

        const { error: upsertError } = await supabase.from('player_values').upsert(
          {
            player_id: player.player_id,
            player_name: player.full_name,
            position: player.position,
            team: player.current_team,
            base_value: existingValue?.base_value || redraftValue,
            fdp_value: existingValue?.fdp_value || dynastyValue,
            dynasty_value: dynastyValue,
            redraft_value: redraftValue,
            redraft_value_source: redraftValueSource,
            age,
            last_updated: new Date().toISOString(),
          },
          { onConflict: 'player_id' }
        );

        if (upsertError) {
          errors.push(`${player.full_name}: ${upsertError.message}`);
        } else {
          processed++;
        }
      } catch (err) {
        errors.push(
          `${player.full_name}: ${err instanceof Error ? err.message : 'Unknown'}`
        );
      }
    }

    console.log(`Top-1000 build complete: ${processed} players processed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        total: players.length,
        errors: errors.slice(0, 10),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Top-1000 build error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processed: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
