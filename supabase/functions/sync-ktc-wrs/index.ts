import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const formatMultipliers: Record<string, Record<string, number>> = {
  dynasty_superflex: { QB: 1.35, RB: 1.15, WR: 1.0, TE: 1.10 },
  dynasty_1qb: { QB: 1.0, RB: 1.18, WR: 1.0, TE: 1.10 },
  dynasty_tep: { QB: 1.35, RB: 1.15, WR: 1.0, TE: 1.25 },
};

function calcFdpValue(ktcValue: number, position: string, format: string): number {
  const formatKey = format.replace(/-/g, '_');
  const multiplier = formatMultipliers[formatKey]?.[position] ?? 1;
  return Math.round(ktcValue * multiplier);
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

async function scrapeKTCWRs(format: string = 'dynasty-superflex'): Promise<ScrapeResult> {
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

    let wrRank = 1;
    for (const player of data) {
      if (player.position === 'WR' || player.pos === 'WR') {
        const name = (player.playerName || player.name || '').trim();
        const team = (player.team || '').trim() || null;
        const value = parseInt(player.value || '0', 10);

        if (name && value > 0) {
          const key = `${name}_${wrRank}`;

          if (!playersMap.has(key)) {
            playersMap.set(key, {
              full_name: name,
              position: 'WR',
              team: team,
              position_rank: wrRank,
              value: value,
            });
            wrRank++;
          }
        }
      }
    }

    const players = Array.from(playersMap.values());

    if (players.length < 60) {
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

    const scrapeResult = await scrapeKTCWRs(format);

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
          error: 'Failed to scrape WR data',
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
        .select('player_id')
        .eq('player_name', player.full_name)
        .eq('position', 'WR')
        .maybeSingle();

      let playerId = existingPlayer?.player_id;

      if (!playerId) {
        playerId = `ktc_${player.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

        const { error: insertError } = await supabase
          .from('player_values')
          .insert({
            player_id: playerId,
            player_name: player.full_name,
            position: 'WR',
            team: player.team,
            ktc_value: player.value,
            fdp_value: player.value,
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
            last_updated: capturedAt,
          })
          .eq('player_id', playerId);

        if (updateError) {
          console.error('Error updating player:', updateError);
        }
      }

      const fdpValue = calcFdpValue(player.value, 'WR', format);

      const { error: snapshotError } = await supabase
        .from('ktc_value_snapshots')
        .insert({
          player_id: playerId,
          full_name: player.full_name,
          position: 'WR',
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
        position: 'WR',
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
