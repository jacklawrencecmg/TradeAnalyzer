import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const searchCache = new Map<string, { data: any; timestamp: number }>();
const SEARCH_CACHE_TTL = 30 * 1000;

let sleeperPlayersCache: Record<string, any> | null = null;
let sleeperPlayersCacheTime = 0;
const SLEEPER_CACHE_TTL = 30 * 60 * 1000;

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S', 'IDP_FLEX']);

async function getSleeperPlayers(): Promise<Record<string, any>> {
  const now = Date.now();
  if (sleeperPlayersCache && now - sleeperPlayersCacheTime < SLEEPER_CACHE_TTL) {
    return sleeperPlayersCache;
  }
  try {
    const res = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!res.ok) return sleeperPlayersCache || {};
    const data = await res.json();
    sleeperPlayersCache = data;
    sleeperPlayersCacheTime = now;
    return data;
  } catch {
    return sleeperPlayersCache || {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ ok: true, results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cacheKey = `search_${query.toLowerCase().trim()}_${limit}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
      return new Response(
        JSON.stringify(cached.data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const searchTerm = query.trim().toLowerCase();

    const [dbResult, sleeperPlayers] = await Promise.all([
      supabase
        .from('latest_player_values')
        .select('player_id, player_name, position, team, adjusted_value')
        .eq('format', 'dynasty')
        .ilike('player_name', `%${searchTerm}%`)
        .order('adjusted_value', { ascending: false })
        .limit(50),
      getSleeperPlayers(),
    ]);

    const dbPlayers = dbResult.data || [];

    const dbPlayerIds = new Set(dbPlayers.map((p: any) => p.player_id));

    const dbMatches = dbPlayers
      .sort((a: any, b: any) => {
        const aStarts = a.player_name.toLowerCase().startsWith(searchTerm);
        const bStarts = b.player_name.toLowerCase().startsWith(searchTerm);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        return b.adjusted_value - a.adjusted_value;
      })
      .slice(0, limit)
      .map((p: any) => ({
        id: p.player_id,
        name: p.player_name,
        position: p.position,
        team: p.team,
        value: p.adjusted_value,
      }));

    const remaining = limit - dbMatches.length;
    const sleeperMatches: any[] = [];

    if (remaining > 0 && Object.keys(sleeperPlayers).length > 0) {
      const sleeperResults: Array<{ id: string; name: string; position: string; team: string | null; value: number; startsWithTerm: boolean }> = [];

      for (const [pid, p] of Object.entries(sleeperPlayers) as [string, any][]) {
        if (dbPlayerIds.has(pid)) continue;
        if (!SKILL_POSITIONS.has(p.position)) continue;
        if (p.status === 'Inactive' || p.status === 'Retired') continue;

        const fullName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
        if (!fullName) continue;

        const nameLower = fullName.toLowerCase();
        if (!nameLower.includes(searchTerm)) continue;

        sleeperResults.push({
          id: pid,
          name: fullName,
          position: p.position || 'N/A',
          team: p.team || null,
          value: 0,
          startsWithTerm: nameLower.startsWith(searchTerm),
        });
      }

      sleeperResults
        .sort((a, b) => {
          if (a.startsWithTerm && !b.startsWithTerm) return -1;
          if (b.startsWithTerm && !a.startsWithTerm) return 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, remaining)
        .forEach(p => {
          sleeperMatches.push({
            id: p.id,
            name: p.name,
            position: p.position,
            team: p.team,
            value: p.value,
          });
        });
    }

    const results = [...dbMatches, ...sleeperMatches];
    const result = { ok: true, results };

    searchCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in player-search function:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error', results: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
