import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
  qbs: KTCPlayer[];
  count: number;
  minRank: number;
  maxRank: number;
  reason?: string;
}

async function scrapeKTCQBs(): Promise<ScrapeResult> {
  const qbsMap = new Map<string, KTCPlayer>();

  try {
    const ktcApiResponse = await fetch('https://keeptradecut.com/api/rankings/dynasty-superflex', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!ktcApiResponse.ok) {
      if (ktcApiResponse.status === 429 || ktcApiResponse.status === 403) {
        return { blocked: true, ok: false, qbs: [], count: 0, minRank: 0, maxRank: 0, reason: 'blocked' };
      }
      throw new Error(`HTTP error! status: ${ktcApiResponse.status}`);
    }

    const data = await ktcApiResponse.json();

    if (!Array.isArray(data)) {
      return { blocked: false, ok: false, qbs: [], count: 0, minRank: 0, maxRank: 0, reason: 'invalid_data' };
    }

    let qbRank = 1;
    for (const player of data) {
      if (player.position === 'QB' || player.pos === 'QB') {
        const name = (player.playerName || player.name || '').trim();
        const team = (player.team || '').trim() || null;
        const value = parseInt(player.value || '0', 10);

        if (name && value > 0) {
          const key = `${name}_${qbRank}`;

          if (!qbsMap.has(key)) {
            qbsMap.set(key, {
              full_name: name,
              position: 'QB',
              team: team,
              position_rank: qbRank,
              value: value,
            });
            qbRank++;
          }
        }
      }
    }

    const qbs = Array.from(qbsMap.values());

    if (qbs.length < 80) {
      return {
        blocked: false,
        ok: false,
        qbs: [],
        count: qbs.length,
        minRank: qbs.length > 0 ? 1 : 0,
        maxRank: qbs.length,
        reason: 'too_few_rows',
      };
    }

    const minRank = qbs.length > 0 ? Math.min(...qbs.map(q => q.position_rank)) : 0;
    const maxRank = qbs.length > 0 ? Math.max(...qbs.map(q => q.position_rank)) : 0;

    return {
      blocked: false,
      ok: true,
      qbs,
      count: qbs.length,
      minRank,
      maxRank,
    };
  } catch (error) {
    console.error('Scraping error:', error);
    return {
      blocked: true,
      ok: false,
      qbs: [],
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
    const secretParam = url.searchParams.get('secret');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (!secretParam || secretParam !== cronSecret) {
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

    const scrapeResult = await scrapeKTCQBs();

    if (scrapeResult.blocked) {
      return new Response(
        JSON.stringify({
          ok: false,
          blocked: true,
          reason: scrapeResult.reason,
        }),
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
          too_few_rows: scrapeResult.reason === 'too_few_rows',
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

    const qbs = scrapeResult.qbs;
    let successCount = 0;
    const capturedAt = new Date().toISOString();

    for (const qb of qbs) {
      const { data: existingPlayer } = await supabase
        .from('player_values')
        .select('player_id')
        .eq('player_name', qb.full_name)
        .eq('position', 'QB')
        .maybeSingle();

      let playerId = existingPlayer?.player_id;

      if (!playerId) {
        playerId = `ktc_${qb.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

        const { error: insertError } = await supabase
          .from('player_values')
          .insert({
            player_id: playerId,
            player_name: qb.full_name,
            position: 'QB',
            team: qb.team,
            ktc_value: qb.value,
            fdp_value: qb.value,
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
            team: qb.team,
            ktc_value: qb.value,
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
          full_name: qb.full_name,
          position: 'QB',
          team: qb.team,
          position_rank: qb.position_rank,
          ktc_value: qb.value,
          format: 'dynasty_sf',
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
        count: successCount,
        minRank: scrapeResult.minRank,
        maxRank: scrapeResult.maxRank,
        captured_at: capturedAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in cron sync function:', error);
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
