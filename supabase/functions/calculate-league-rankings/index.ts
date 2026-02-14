import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
  };
}

interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar?: string;
}

interface PlayerValue {
  player_id: string;
  full_name: string;
  position: string;
  fdp_value: number;
  is_idp: boolean;
}

interface TeamRanking {
  roster_id: number;
  team_name: string;
  owner_name: string;
  owner_avatar: string | null;
  offense_value: number;
  idp_value: number;
  total_value: number;
  rank: number;
  rank_change: number | null;
  player_count: number;
  top_player_name: string | null;
  top_player_value: number | null;
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

    const { league_id, week } = await req.json();

    if (!league_id) {
      return new Response(
        JSON.stringify({ error: 'league_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', league_id)
      .single();

    if (leagueError || !league) {
      return new Response(
        JSON.stringify({ error: 'League not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const currentWeek = week || (await supabase.rpc('get_current_nfl_week')).data || 0;

    // Fetch rosters from Sleeper
    const rostersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${league.sleeper_league_id}/rosters`
    );
    const rosters: SleeperRoster[] = await rostersResponse.json();

    // Fetch users from Sleeper
    const usersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${league.sleeper_league_id}/users`
    );
    const users: SleeperUser[] = await usersResponse.json();

    // Create user lookup map
    const userMap = new Map<string, SleeperUser>();
    users.forEach(user => userMap.set(user.user_id, user));

    // Fetch all player values from our database
    const { data: playerValues, error: valuesError } = await supabase
      .from('player_values')
      .select('player_id, full_name, position, fdp_value');

    if (valuesError) {
      throw new Error(`Failed to fetch player values: ${valuesError.message}`);
    }

    const playerValueMap = new Map<string, PlayerValue>();
    playerValues?.forEach((pv: any) => {
      const isIDP = ['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S'].includes(pv.position);
      playerValueMap.set(pv.player_id, {
        player_id: pv.player_id,
        full_name: pv.full_name,
        position: pv.position,
        fdp_value: pv.fdp_value || 0,
        is_idp: isIDP,
      });
    });

    // Calculate rankings for each roster
    const rankings: TeamRanking[] = rosters.map(roster => {
      const owner = userMap.get(roster.owner_id);
      const ownerName = owner?.display_name || `Team ${roster.roster_id}`;
      const ownerAvatar = owner?.avatar || null;

      let offenseValue = 0;
      let idpValue = 0;
      let topPlayer: { name: string; value: number } | null = null;

      const players = roster.players || [];

      players.forEach(playerId => {
        const playerValue = playerValueMap.get(playerId);
        if (playerValue && playerValue.fdp_value > 0) {
          if (playerValue.is_idp) {
            idpValue += playerValue.fdp_value;
          } else {
            offenseValue += playerValue.fdp_value;
          }

          if (!topPlayer || playerValue.fdp_value > topPlayer.value) {
            topPlayer = {
              name: playerValue.full_name,
              value: playerValue.fdp_value,
            };
          }
        }
      });

      const totalValue = offenseValue + idpValue;

      return {
        roster_id: roster.roster_id,
        team_name: `Team ${roster.roster_id}`,
        owner_name: ownerName,
        owner_avatar: ownerAvatar,
        offense_value: offenseValue,
        idp_value: idpValue,
        total_value: totalValue,
        rank: 0,
        rank_change: null,
        player_count: players.length,
        top_player_name: topPlayer?.name || null,
        top_player_value: topPlayer?.value || null,
      };
    });

    // Sort by total value and assign ranks
    rankings.sort((a, b) => b.total_value - a.total_value);
    rankings.forEach((team, index) => {
      team.rank = index + 1;
    });

    // Get previous week rankings for rank change calculation
    const { data: previousRankings } = await supabase.rpc('get_previous_week_rankings', {
      p_league_id: league_id,
      p_current_week: currentWeek,
    });

    const previousRankMap = new Map<number, number>();
    if (previousRankings) {
      previousRankings.forEach((pr: any) => {
        previousRankMap.set(pr.roster_id, pr.previous_rank);
      });
    }

    // Calculate rank changes
    rankings.forEach(team => {
      const previousRank = previousRankMap.get(team.roster_id);
      if (previousRank !== undefined) {
        team.rank_change = previousRank - team.rank;
      }
    });

    // Insert rankings into database
    const rankingsToInsert = rankings.map(team => ({
      league_id,
      week: currentWeek,
      roster_id: team.roster_id,
      team_name: team.team_name,
      owner_name: team.owner_name,
      owner_avatar: team.owner_avatar,
      offense_value: team.offense_value,
      idp_value: team.idp_value,
      total_value: team.total_value,
      rank: team.rank,
      rank_change: team.rank_change,
      player_count: team.player_count,
      top_player_name: team.top_player_name,
      top_player_value: team.top_player_value,
    }));

    const { error: insertError } = await supabase
      .from('league_rankings')
      .insert(rankingsToInsert);

    if (insertError) {
      throw new Error(`Failed to insert rankings: ${insertError.message}`);
    }

    // Update league last_sync_at
    await supabase
      .from('leagues')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', league_id);

    return new Response(
      JSON.stringify({
        ok: true,
        league_id,
        week: currentWeek,
        teams_ranked: rankings.length,
        rankings,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error calculating league rankings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
