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

interface KTCPlayer {
  full_name: string;
  position: string;
  team: string | null;
  position_rank: number;
  value: number;
}

interface ScrapeResult {
  blocked: boolean;
  ok: boolean;
  players: KTCPlayer[];
  count: number;
  minRank: number;
  maxRank: number;
  reason?: string;
}

async function scrapeKTCRBs(format: string = 'dynasty-superflex'): Promise<ScrapeResult> {
  const playersMap = new Map<string, KTCPlayer>();

  try {
    const ktcApiResponse = await fetch(`https://keeptradecut.com/api/rankings/${format}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!ktcApiResponse.ok) {
      if (ktcApiResponse.status === 429 || ktcApiResponse.status === 403) {
        return { blocked: true, ok: false, players: [], count: 0, minRank: 0, maxRank: 0, reason: 'blocked' };
      }
      throw new Error(`HTTP error! status: ${ktcApiResponse.status}`);
    }

    const data = await ktcApiResponse.json();

    if (!Array.isArray(data)) {
      return { blocked: false, ok: false, players: [], count: 0, minRank: 0, maxRank: 0, reason: 'invalid_data' };
    }

    let rbRank = 1;
    for (const player of data) {
      if (player.position === 'RB' || player.pos === 'RB') {
        const name = (player.playerName || player.name || '').trim();
        const team = (player.team || '').trim() || null;
        const value = parseInt(player.value || '0', 10);

        if (name && value > 0) {
          const key = `${name}_${rbRank}`;

          if (!playersMap.has(key)) {
            playersMap.set(key, {
              full_name: name,
              position: 'RB',
              team: team,
              position_rank: rbRank,
              value: value,
            });
            rbRank++;
          }
        }
      }
    }

    const players = Array.from(playersMap.values());

    if (players.length < 150) {
      return {
        blocked: false,
        ok: false,
        players: [],
        count: players.length,
        minRank: players.length > 0 ? 1 : 0,
        maxRank: players.length,
        reason: 'too_few_rows',
      };
    }

    const minRank = players.length > 0 ? Math.min(...players.map(p => p.position_rank)) : 0;
    const maxRank = players.length > 0 ? Math.max(...players.map(p => p.position_rank)) : 0;

    return {
      blocked: false,
      ok: true,
      players,
      count: players.length,
      minRank,
      maxRank,
    };
  } catch (error) {
    console.error('Scraping error:', error);
    return {
      blocked: true,
      ok: false,
      players: [],
      count: 0,
      minRank: 0,
      maxRank: 0,
      reason: error instanceof Error ? error.message : 'unknown_error',
    };
  }
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
    const format = url.searchParams.get('format') || 'dynasty-superflex';

    const authHeader = req.headers.get('Authorization');
    const secretParam = url.searchParams.get('secret');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');
    const cronSecret = Deno.env.get('CRON_SECRET');

    const isAuthorized =
      (authHeader && authHeader === `Bearer ${adminSecret}`) ||
      (secretParam && secretParam === cronSecret);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const scrapeResult = await scrapeKTCRBs(format);

    if (scrapeResult.blocked) {
      return new Response(
        JSON.stringify({ ok: false, blocked: true, error: 'KTC blocked the request', reason: scrapeResult.reason }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!scrapeResult.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Failed to scrape RB data',
          reason: scrapeResult.reason,
          count: scrapeResult.count,
          maxRank: scrapeResult.maxRank,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const players = scrapeResult.players;
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
        playerId = `ktc_${player.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

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
          .update({
            team: player.team,
            ktc_value: player.value,
            fdp_value: fdpValue,
            last_updated: capturedAt,
          })
          .eq('player_id', playerId);

        if (updateError) {
          console.error('Error updating player:', updateError);
        }
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
          source: 'KTC',
          captured_at: capturedAt,
        });

      if (!snapshotError) {
        successCount++;
      } else {
        console.error('Error inserting snapshot:', snapshotError);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        position: 'RB',
        count: successCount,
        total: players.length,
        minRank: scrapeResult.minRank,
        maxRank: scrapeResult.maxRank,
        format: formatKey,
        captured_at: capturedAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync function:', error);
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
