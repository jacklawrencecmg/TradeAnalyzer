import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TradePlayer {
  name: string;
  pos: string;
}

interface TradeRequest {
  format: string;
  sideA: TradePlayer[];
  sideB: TradePlayer[];
}

interface PlayerValue {
  player_id: string;
  full_name: string;
  position: string;
  ktc_value: number;
  captured_at: string;
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w)).length;
  const maxWords = Math.max(words1.length, words2.length);

  return commonWords / maxWords;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: TradeRequest = await req.json();
    const { format = 'dynasty_sf', sideA, sideB } = body;

    if (!sideA || !sideB || !Array.isArray(sideA) || !Array.isArray(sideB)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid request format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: allSnapshots, error } = await supabase
      .from('ktc_value_snapshots')
      .select('player_id, full_name, position, ktc_value, captured_at')
      .eq('format', format)
      .order('captured_at', { ascending: false });

    if (error) {
      throw error;
    }

    const latestByPlayer = new Map<string, PlayerValue>();
    for (const snapshot of allSnapshots || []) {
      const key = `${snapshot.full_name}_${snapshot.position}`;
      if (!latestByPlayer.has(key)) {
        latestByPlayer.set(key, snapshot);
      }
    }

    const lookupPlayer = (name: string, pos: string) => {
      const key = `${name}_${pos}`;
      const exact = latestByPlayer.get(key);
      if (exact) return { found: true, value: exact.ktc_value, name: exact.full_name };

      let bestMatch: PlayerValue | null = null;
      let bestScore = 0;

      for (const [playerKey, player] of latestByPlayer.entries()) {
        if (player.position === pos) {
          const score = calculateSimilarity(name, player.full_name);
          if (score > bestScore && score > 0.6) {
            bestScore = score;
            bestMatch = player;
          }
        }
      }

      if (bestMatch) {
        const suggestions = Array.from(latestByPlayer.values())
          .filter(p => p.position === pos)
          .map(p => ({
            name: p.full_name,
            similarity: calculateSimilarity(name, p.full_name),
          }))
          .filter(s => s.similarity > 0.4)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5)
          .map(s => s.name);

        return { found: false, suggestions, searchedName: name, searchedPos: pos };
      }

      return { found: false, suggestions: [], searchedName: name, searchedPos: pos };
    };

    let sideATotal = 0;
    const sideADetails: any[] = [];
    const sideANotFound: any[] = [];

    for (const player of sideA) {
      const result = lookupPlayer(player.name, player.pos);
      if (result.found) {
        sideATotal += result.value;
        sideADetails.push({ name: result.name, pos: player.pos, value: result.value });
      } else {
        sideANotFound.push({ name: player.name, pos: player.pos, suggestions: result.suggestions });
      }
    }

    let sideBTotal = 0;
    const sideBDetails: any[] = [];
    const sideBNotFound: any[] = [];

    for (const player of sideB) {
      const result = lookupPlayer(player.name, player.pos);
      if (result.found) {
        sideBTotal += result.value;
        sideBDetails.push({ name: result.name, pos: player.pos, value: result.value });
      } else {
        sideBNotFound.push({ name: player.name, pos: player.pos, suggestions: result.suggestions });
      }
    }

    const difference = sideATotal - sideBTotal;
    let recommendation = '';

    if (Math.abs(difference) < 500) {
      recommendation = 'Fair trade - values are very close';
    } else if (difference > 0) {
      recommendation = `Side A is higher by ${difference} (add value to Side B)`;
    } else {
      recommendation = `Side B is higher by ${Math.abs(difference)} (add value to Side A)`;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sideA_total: sideATotal,
        sideB_total: sideBTotal,
        difference,
        recommendation,
        sideA_details: sideADetails,
        sideB_details: sideBDetails,
        sideA_not_found: sideANotFound,
        sideB_not_found: sideBNotFound,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in trade-eval function:', error);
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
