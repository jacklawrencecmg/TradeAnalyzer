import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface KTCPlayer {
  full_name: string;
  position: string;
  team: string | null;
  position_rank: number;
  value: number;
}

async function scrapeKTCQBs(): Promise<{ blocked: boolean; qbs: KTCPlayer[] }> {
  try {
    const response = await fetch('https://keeptradecut.com/dynasty-rankings', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 403) {
        return { blocked: true, qbs: [] };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    if (html.includes('blocked') || html.includes('captcha') || html.includes('cloudflare')) {
      return { blocked: true, qbs: [] };
    }

    const qbs: KTCPlayer[] = [];

    const playerRegex = /<div[^>]*class="[^"]*player-name[^"]*"[^>]*>([^<]+)<\/div>/gi;
    const valueRegex = /<div[^>]*class="[^"]*value[^"]*"[^>]*>(\d+)<\/div>/gi;
    const teamRegex = /<div[^>]*class="[^"]*team[^"]*"[^>]*>([^<]+)<\/div>/gi;

    let playerMatch;
    let rank = 1;
    while ((playerMatch = playerRegex.exec(html)) !== null) {
      const name = playerMatch[1].trim();

      if (!name.toLowerCase().includes('qb') && rank <= 50) {
        continue;
      }

      const valueMatch = valueRegex.exec(html);
      const teamMatch = teamRegex.exec(html);

      if (name && valueMatch) {
        qbs.push({
          full_name: name,
          position: 'QB',
          team: teamMatch ? teamMatch[1].trim() : null,
          position_rank: rank,
          value: parseInt(valueMatch[1], 10),
        });
        rank++;
      }

      if (qbs.length >= 80) break;
    }

    if (qbs.length === 0) {
      try {
        const ktcApiResponse = await fetch('https://keeptradecut.com/api/rankings/dynasty-superflex', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        });

        if (ktcApiResponse.ok) {
          const data = await ktcApiResponse.json();

          if (Array.isArray(data)) {
            let qbRank = 1;
            for (const player of data) {
              if (player.position === 'QB') {
                qbs.push({
                  full_name: player.playerName || player.name,
                  position: 'QB',
                  team: player.team || null,
                  position_rank: qbRank++,
                  value: player.value || 0,
                });

                if (qbs.length >= 80) break;
              }
            }
          }
        }
      } catch (apiError) {
        console.error('API fallback failed:', apiError);
      }
    }

    return { blocked: qbs.length === 0, qbs };
  } catch (error) {
    console.error('Scraping error:', error);
    return { blocked: true, qbs: [] };
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
    const authHeader = req.headers.get('Authorization');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');

    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
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

    const { blocked, qbs } = await scrapeKTCQBs();

    if (blocked) {
      return new Response(
        JSON.stringify({ ok: false, blocked: true, error: 'KTC blocked the request' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (qbs.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No QB data found' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
        total: qbs.length,
        timestamp: capturedAt,
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
