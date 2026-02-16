import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
const VALUE_TOLERANCE = 1200;

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

    const cacheKey = `suggestions_${leagueId}`;
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
      return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
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

    const teams = rosters.map((roster: any) => {
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
      }).filter((p: any) => p.fdp_value > 0);

      const positionalStrength = {
        qb: 0,
        rb: 0,
        wr: 0,
        te: 0,
      };

      const qbs = players.filter((p: any) => p.position === 'QB').sort((a: any, b: any) => b.fdp_value - a.fdp_value);
      const rbs = players.filter((p: any) => p.position === 'RB').sort((a: any, b: any) => b.fdp_value - a.fdp_value);
      const wrs = players.filter((p: any) => p.position === 'WR').sort((a: any, b: any) => b.fdp_value - a.fdp_value);
      const tes = players.filter((p: any) => p.position === 'TE').sort((a: any, b: any) => b.fdp_value - a.fdp_value);

      positionalStrength.qb = qbs.slice(0, 2).reduce((sum: number, p: any) => sum + p.fdp_value, 0);
      positionalStrength.rb = rbs.slice(0, 3).reduce((sum: number, p: any) => sum + p.fdp_value, 0);
      positionalStrength.wr = wrs.slice(0, 3).reduce((sum: number, p: any) => sum + p.fdp_value, 0);
      positionalStrength.te = tes.slice(0, 2).reduce((sum: number, p: any) => sum + p.fdp_value, 0);

      const needs: string[] = [];
      if (positionalStrength.qb < 12000) needs.push('QB');
      if (positionalStrength.rb < 10000) needs.push('RB');
      if (positionalStrength.wr < 12000) needs.push('WR');
      if (positionalStrength.te < 5000) needs.push('TE');

      const surplus: string[] = [];
      if (positionalStrength.qb > 18000 && qbs.length > 2) surplus.push('QB');
      if (positionalStrength.rb > 15000 && rbs.length > 5) surplus.push('RB');
      if (positionalStrength.wr > 18000 && wrs.length > 6) surplus.push('WR');
      if (positionalStrength.te > 8000 && tes.length > 3) surplus.push('TE');

      return {
        roster_id: roster.roster_id,
        team_name: `Team ${roster.roster_id}`,
        owner_name: owner?.display_name || owner?.username || 'Unknown',
        players,
        needs,
        surplus,
      };
    });

    const suggestions: any[] = [];

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const teamA = teams[i];
        const teamB = teams[j];

        for (const playerA of teamA.players) {
          if (playerA.fdp_value < 1000) continue;

          for (const playerB of teamB.players) {
            if (playerB.fdp_value < 1000) continue;

            const valueDiff = Math.abs(playerA.fdp_value - playerB.fdp_value);
            if (valueDiff > VALUE_TOLERANCE) continue;

            const aGetsNeeds = teamA.needs.includes(playerB.position);
            const bGetsNeeds = teamB.needs.includes(playerA.position);

            if (!aGetsNeeds && !bGetsNeeds) continue;

            const fairness = Math.max(60, Math.round(100 - (valueDiff / VALUE_TOLERANCE) * 20));
            const improvesBoth = aGetsNeeds && bGetsNeeds;

            suggestions.push({
              team_a: {
                roster_id: teamA.roster_id,
                team_name: teamA.team_name,
                owner_name: teamA.owner_name,
              },
              team_b: {
                roster_id: teamB.roster_id,
                team_name: teamB.team_name,
                owner_name: teamB.owner_name,
              },
              team_a_gives: [playerA],
              team_a_receives: [playerB],
              team_b_gives: [playerB],
              team_b_receives: [playerA],
              value_difference: valueDiff,
              fairness_score: fairness,
              improves_both: improvesBoth,
              trade_type: '1-for-1',
              score: (fairness * 0.4) + (improvesBoth ? 40 : 20),
            });
          }
        }
      }
    }

    const topSuggestions = suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const result = {
      ok: true,
      league_id: leagueId,
      suggestions: topSuggestions,
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
    console.error('Error in league-suggestions function:', error);
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
