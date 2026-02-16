import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PlayerValue {
  player_id: string;
  full_name: string;
  position: string;
  age: number | null;
  fdp_value: number;
  team: string | null;
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { league_id, sleeper_league_id, roster_id, force_refresh } = await req.json();

    if (!league_id && !sleeper_league_id) {
      return new Response(
        JSON.stringify({ error: 'league_id or sleeper_league_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let league = null;
    let actualSleeperLeagueId = sleeper_league_id;

    if (league_id) {
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', league_id)
        .maybeSingle();

      if (leagueData) {
        league = leagueData;
        actualSleeperLeagueId = leagueData.sleeper_league_id;
      }
    }

    if (!league && sleeper_league_id) {
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('*')
        .eq('sleeper_league_id', sleeper_league_id)
        .maybeSingle();

      if (leagueData) {
        league = leagueData;
      }
    }

    if (!actualSleeperLeagueId) {
      return new Response(
        JSON.stringify({ error: 'Could not determine Sleeper league ID' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rostersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${actualSleeperLeagueId}/rosters`
    );
    const rosters = await rostersResponse.json();

    const usersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${actualSleeperLeagueId}/users`
    );
    const users = await usersResponse.json();

    const userMap = new Map();
    users.forEach((user: any) => userMap.set(user.user_id, user));

    const { data: allPlayers, error: playersError } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, metadata, adjusted_value, team');

    if (playersError) {
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    const playerMap = new Map<string, PlayerValue>();
    allPlayers?.forEach((p: any) => {
      playerMap.set(p.player_id, {
        player_id: p.player_id,
        full_name: p.player_name,
        position: p.position,
        age: p.metadata?.age || null,
        fdp_value: p.adjusted_value || 0,
        team: p.team,
      });
    });

    const leagueSettings = {
      total_rosters: rosters.length,
      roster_positions: league?.roster_settings || {
        qb: 1,
        rb: 2,
        wr: 2,
        te: 1,
        flex: 2,
        superflex: 0,
      },
    };

    const allTeamRosters = rosters.map((roster: any) => {
      const players: PlayerValue[] = [];
      (roster.players || []).forEach((playerId: string) => {
        const player = playerMap.get(playerId);
        if (player) {
          players.push(player);
        }
      });
      return players;
    });

    const { evaluateTeamStrategy } = await import('/tmp/cc-agent/63293087/project/src/lib/analysis/teamStrategy.ts');

    const strategies = [];

    for (let i = 0; i < rosters.length; i++) {
      const roster = rosters[i];

      if (roster_id && roster.roster_id !== roster_id) {
        continue;
      }

      const teamRoster = allTeamRosters[i];
      const strategy = evaluateTeamStrategy(teamRoster, leagueSettings, allTeamRosters);

      const owner = userMap.get(roster.owner_id);
      const userId = null;

      const { error: upsertError } = await supabase
        .from('team_strategies')
        .upsert({
          league_id,
          roster_id: roster.roster_id,
          user_id: userId,
          strategy_window: strategy.window,
          confidence: strategy.confidence,
          strengths: strategy.strengths,
          weaknesses: strategy.weaknesses,
          recommendations: strategy.recommendations,
          metrics: strategy.metrics,
          calculated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        }, {
          onConflict: 'league_id,roster_id'
        });

      if (upsertError) {
        console.error('Error upserting strategy:', upsertError);
      }

      strategies.push({
        roster_id: roster.roster_id,
        owner_name: owner?.display_name || `Team ${roster.roster_id}`,
        ...strategy,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        league_id,
        strategies: roster_id ? strategies[0] : strategies,
        calculated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error calculating team strategy:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
