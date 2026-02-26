import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

let sleeperPlayersCache: Record<string, any> | null = null;
let sleeperPlayersCacheTime = 0;
const SLEEPER_CACHE_TTL = 60 * 60 * 1000;

async function getSleeperPlayers(): Promise<Record<string, any>> {
  const now = Date.now();
  if (sleeperPlayersCache && now - sleeperPlayersCacheTime < SLEEPER_CACHE_TTL) {
    return sleeperPlayersCache;
  }
  try {
    const res = await fetch(`${SLEEPER_BASE_URL}/players/nfl`);
    if (!res.ok) return {};
    const data = await res.json();
    sleeperPlayersCache = data;
    sleeperPlayersCacheTime = now;
    return data;
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const leagueId = url.searchParams.get('league_id');

    if (!leagueId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'league_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [rostersRes, usersRes] = await Promise.all([
      fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/rosters`),
      fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/users`),
    ]);

    if (!rostersRes.ok || !usersRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to fetch league data from Sleeper' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rosters = await rostersRes.json();
    const users = await usersRes.json();

    const allPlayerIds = new Set<string>();
    for (const roster of rosters) {
      for (const pid of roster.players || []) allPlayerIds.add(pid);
    }
    const playerIdList = Array.from(allPlayerIds);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [dbResult, sleeperPlayers] = await Promise.all([
      supabase
        .from('latest_player_values')
        .select('player_id, player_name, position, team, adjusted_value')
        .in('player_id', playerIdList),
      getSleeperPlayers(),
    ]);

    const playerMap = new Map<string, any>();
    for (const p of dbResult.data || []) {
      playerMap.set(p.player_id, p);
    }

    const userMap = new Map(users.map((u: any) => [u.user_id, u]));

    const enrichedRosters = rosters.map((roster: any) => {
      const owner = userMap.get(roster.owner_id);
      const players = (roster.players || []).map((playerId: string) => {
        const dbPlayer = playerMap.get(playerId);

        if (dbPlayer) {
          return {
            player_id: playerId,
            name: dbPlayer.player_name,
            position: dbPlayer.position,
            team: dbPlayer.team || null,
            fdp_value: dbPlayer.adjusted_value || 0,
            is_starter: (roster.starters || []).includes(playerId),
            headshot_url: `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`,
          };
        }

        const sleeperPlayer = sleeperPlayers[playerId];
        if (sleeperPlayer) {
          const fullName = sleeperPlayer.full_name ||
            `${sleeperPlayer.first_name || ''} ${sleeperPlayer.last_name || ''}`.trim();
          return {
            player_id: playerId,
            name: fullName || playerId,
            position: sleeperPlayer.position || 'N/A',
            team: sleeperPlayer.team || null,
            fdp_value: 0,
            is_starter: (roster.starters || []).includes(playerId),
            headshot_url: `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`,
          };
        }

        return {
          player_id: playerId,
          name: 'Unknown Player',
          position: 'N/A',
          team: null,
          fdp_value: 0,
          is_starter: (roster.starters || []).includes(playerId),
          headshot_url: `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`,
        };
      });

      const totalValue = players.reduce((sum: number, p: any) => sum + p.fdp_value, 0);

      return {
        roster_id: roster.roster_id,
        team_name: `Team ${roster.roster_id}`,
        owner_name: owner?.metadata?.team_name || owner?.display_name || owner?.username || 'Unknown',
        owner_id: roster.owner_id,
        players,
        total_value: Math.round(totalValue),
        record: {
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          ties: roster.settings?.ties || 0,
        },
      };
    });

    return new Response(
      JSON.stringify({ ok: true, league_id: leagueId, rosters: enrichedRosters }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in league-rosters function:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
