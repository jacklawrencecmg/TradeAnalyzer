import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const formatMultipliers: Record<string, Record<string, number>> = {
  dynasty_superflex: { QB: 1.35, RB: 1.15, WR: 1.0, TE: 1.10 },
  dynasty_sf: { QB: 1.35, RB: 1.15, WR: 1.0, TE: 1.10 },
  dynasty_1qb: { QB: 1.0, RB: 1.18, WR: 1.0, TE: 1.10 },
  dynasty_tep: { QB: 1.35, RB: 1.15, WR: 1.0, TE: 1.25 },
};

function calcFdpAdjustments(ctx: any): number {
  let adj = 0;
  if (ctx.age != null) {
    if (ctx.age <= 22) adj += 250;
    else if (ctx.age <= 24) adj += 150;
    else if (ctx.age <= 25) adj += 0;
    else if (ctx.age === 26) adj -= 300;
    else if (ctx.age === 27) adj -= 650;
    else if (ctx.age >= 28) adj -= 1100;
  }
  if (ctx.depth_role === 'feature') adj += 500;
  if (ctx.depth_role === 'lead_committee') adj += 200;
  if (ctx.depth_role === 'committee') adj -= 250;
  if (ctx.depth_role === 'handcuff') adj -= 450;
  if (ctx.depth_role === 'backup') adj -= 700;
  if (ctx.workload_tier === 'elite') adj += 350;
  if (ctx.workload_tier === 'solid') adj += 150;
  if (ctx.workload_tier === 'light') adj -= 250;
  if (ctx.injury_risk === 'medium') adj -= 150;
  if (ctx.injury_risk === 'high') adj -= 450;
  if (ctx.contract_security === 'high') adj += 200;
  if (ctx.contract_security === 'low') adj -= 250;
  return adj;
}

function rankToValue(rank: number, totalPlayers: number): number {
  const maxValue = 9500;
  const minValue = 300;
  if (totalPlayers <= 1) return maxValue;
  return Math.round(maxValue - ((rank - 1) / (totalPlayers - 1)) * (maxValue - minValue));
}

interface FDPPlayer {
  full_name: string;
  position: string;
  team: string | null;
  position_rank: number;
  value: number;
}

interface FetchResult {
  blocked: boolean;
  ok: boolean;
  players: FDPPlayer[];
  count: number;
  minRank: number;
  maxRank: number;
  reason?: string;
}

async function fetchFantasyProsRBs(format: string): Promise<FetchResult> {
  const rankingSlug = format.includes('1qb') ? 'dynasty-overall' : 'dynasty-superflex';
  const url = `https://www.fantasypros.com/nfl/rankings/${rankingSlug}.php?export=xls`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.fantasypros.com/',
      },
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 403) {
        return { blocked: true, ok: false, players: [], count: 0, minRank: 0, maxRank: 0, reason: 'blocked' };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      return { blocked: false, ok: false, players: [], count: 0, minRank: 0, maxRank: 0, reason: 'no_data' };
    }

    const allPlayers: FDPPlayer[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      const rankStr = (cols[0] || '').trim();
      const nameRaw = (cols[1] || cols[2] || '').trim();
      const teamRaw = (cols[3] || '').trim();
      const posRaw = (cols[4] || '').trim().toUpperCase();

      const rank = parseInt(rankStr.replace(/\D/g, ''), 10);
      const name = nameRaw.replace(/\([^)]*\)/g, '').replace(/[*†‡]/g, '').trim();

      if (!name || !rank) continue;

      const team = teamRaw.length >= 2 && teamRaw.length <= 3 ? teamRaw.toUpperCase() : null;
      allPlayers.push({ full_name: name, position: posRaw || 'RB', team, position_rank: rank, value: 0 });
    }

    const rbs = allPlayers.filter(p => p.position === 'RB');

    if (rbs.length < 30) {
      return { blocked: false, ok: false, players: [], count: rbs.length, minRank: 0, maxRank: 0, reason: 'too_few_rows' };
    }

    rbs.forEach((p, i) => { p.position_rank = i + 1; p.value = rankToValue(i + 1, rbs.length); });

    return { blocked: false, ok: true, players: rbs, count: rbs.length, minRank: 1, maxRank: rbs.length };
  } catch (error) {
    console.error('Fetch error:', error);
    return { blocked: true, ok: false, players: [], count: 0, minRank: 0, maxRank: 0, reason: error instanceof Error ? error.message : 'unknown_error' };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'dynasty-superflex';

    const authHeader = req.headers.get('Authorization');
    const secretParam = url.searchParams.get('secret');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');
    const cronSecret = Deno.env.get('CRON_SECRET');

    const isAuthorized =
      (authHeader && authHeader === `Bearer ${adminSecret}`) ||
      (secretParam && secretParam === cronSecret);

    if (!isAuthorized) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fetchResult = await fetchFantasyProsRBs(format);

    if (fetchResult.blocked) {
      return new Response(JSON.stringify({ ok: false, blocked: true, error: 'Request blocked', reason: fetchResult.reason }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!fetchResult.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Failed to fetch RB data', reason: fetchResult.reason, count: fetchResult.count }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const players = fetchResult.players;
    let successCount = 0;
    const capturedAt = new Date().toISOString();
    const formatKey = format.replace('-', '_');

    for (const player of players) {
      const { data: existingPlayer } = await supabase
        .from('player_values')
        .select('player_id, age, depth_role, workload_tier, injury_risk, contract_security')
        .eq('player_name', player.full_name)
        .eq('position', 'RB')
        .maybeSingle();

      let playerId = existingPlayer?.player_id;

      const ctx = existingPlayer ? {
        age: existingPlayer.age,
        depth_role: existingPlayer.depth_role,
        workload_tier: existingPlayer.workload_tier,
        injury_risk: existingPlayer.injury_risk,
        contract_security: existingPlayer.contract_security,
      } : {};

      const mult = formatMultipliers[formatKey]?.RB ?? 1;
      let baseFdpValue = Math.round(player.value * mult);

      if (ctx.age || ctx.depth_role || ctx.workload_tier || ctx.injury_risk || ctx.contract_security) {
        baseFdpValue += calcFdpAdjustments(ctx);
      }

      const fdpValue = Math.max(0, Math.min(10000, baseFdpValue));

      if (!playerId) {
        playerId = `fdp_${player.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

        const { error: insertError } = await supabase
          .from('player_values')
          .insert({
            player_id: playerId,
            player_name: player.full_name,
            position: 'RB',
            team: player.team,
            ktc_value: player.value,
            fdp_value: fdpValue,
            last_updated: capturedAt,
          });

        if (insertError) {
          console.error('Error inserting player:', insertError);
          continue;
        }
      } else {
        const { error: updateError } = await supabase
          .from('player_values')
          .update({ team: player.team, ktc_value: player.value, fdp_value: fdpValue, last_updated: capturedAt })
          .eq('player_id', playerId);

        if (updateError) console.error('Error updating player:', updateError);
      }

      const { error: snapshotError } = await supabase
        .from('ktc_value_snapshots')
        .insert({
          player_id: playerId,
          full_name: player.full_name,
          position: 'RB',
          team: player.team,
          position_rank: player.position_rank,
          ktc_value: player.value,
          fdp_value: fdpValue,
          format: formatKey,
          source: 'FDP',
          captured_at: capturedAt,
        });

      if (!snapshotError) {
        successCount++;
      } else {
        console.error('Error inserting snapshot:', snapshotError);
      }
    }

    try {
      const generateSuggestionsUrl = `${supabaseUrl}/functions/v1/generate-rb-context-suggestions`;
      fetch(generateSuggestionsUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
      }).catch(err => console.error('Background suggestion generation failed:', err));
    } catch (err) {
      console.error('Failed to trigger suggestion generation:', err);
    }

    return new Response(JSON.stringify({
      ok: true,
      position: 'RB',
      count: successCount,
      total: players.length,
      minRank: fetchResult.minRank,
      maxRank: fetchResult.maxRank,
      format: formatKey,
      captured_at: capturedAt,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in sync function:', error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
