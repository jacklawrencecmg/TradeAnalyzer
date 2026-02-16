import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const leagueId = url.searchParams.get('league_id');

    if (!leagueId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'league_id required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cacheKey = `rosters_${leagueId}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(
        JSON.stringify(cached.data),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const [rostersRes, usersRes, playersRes] = await Promise.all([
      fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/rosters`),
      fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/users`),
      fetch(`${SLEEPER_BASE_URL}/players/nfl`),
    ]);

    const rosters = await rostersRes.json();
    const users = await usersRes.json();
    const sleeperPlayers = await playersRes.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: dbPlayers, error } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, team, adjusted_value')
      .eq('format', 'dynasty');

    if (error) throw error;

    const latestByPlayer = new Map<string, any>();
    for (const player of dbPlayers || []) {
      latestByPlayer.set(player.player_id, {
        player_id: player.player_id,
        full_name: player.player_name,
        position: player.position,
        team: player.team,
        fdp_value: player.adjusted_value
      });
    }

    function normalizePlayerName(name: string): string {
      return name
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function matchPlayer(sleeperPlayerId: string): any {
      const sleeperPlayer = sleeperPlayers[sleeperPlayerId];
      if (!sleeperPlayer) return null;

      const sleeperName = normalizePlayerName(sleeperPlayer.full_name || `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`);
      const sleeperPos = sleeperPlayer.position;

      for (const [playerId, dbPlayer] of latestByPlayer.entries()) {
        const dbName = normalizePlayerName(dbPlayer.full_name);

        if (dbName === sleeperName && dbPlayer.position === sleeperPos) {
          return dbPlayer;
        }
      }

      for (const [playerId, dbPlayer] of latestByPlayer.entries()) {
        const dbName = normalizePlayerName(dbPlayer.full_name);

        if ((dbName.includes(sleeperName) || sleeperName.includes(dbName)) && dbPlayer.position === sleeperPos) {
          return dbPlayer;
        }
      }

      return null;
    }

    const userMap = new Map(users.map((u: any) => [u.user_id, u]));

    const enrichedRosters = rosters.map((roster: any) => {
      const owner = userMap.get(roster.owner_id);
      const players = (roster.players || []).map((playerId: string) => {
        const dbPlayer = matchPlayer(playerId);
        const sleeperPlayer = sleeperPlayers[playerId];

        return {
          player_id: dbPlayer?.player_id || playerId,
          name: dbPlayer?.full_name || sleeperPlayer?.full_name || 'Unknown Player',
          position: dbPlayer?.position || sleeperPlayer?.position || 'NA',
          team: dbPlayer?.team || sleeperPlayer?.team || null,
          fdp_value: dbPlayer?.fdp_value || 0,
          is_starter: (roster.starters || []).includes(playerId),
        };
      });

      const totalValue = players.reduce((sum: number, p: any) => sum + p.fdp_value, 0);

      return {
        roster_id: roster.roster_id,
        team_name: `Team ${roster.roster_id}`,
        owner_name: owner?.display_name || owner?.username || 'Unknown',
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

    const result = {
      ok: true,
      league_id: leagueId,
      rosters: enrichedRosters,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in league-rosters function:', error);
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
