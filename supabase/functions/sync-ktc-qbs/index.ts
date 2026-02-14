import { createClient } from 'jsr:@supabase/supabase-js@2';
import { resolvePlayerId, addPlayerAlias } from '../_shared/playerResolver.ts';

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
    const format = url.searchParams.get('format') || 'dynasty-superflex';

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

    const scrapeResult = await scrapeKTCQBs();

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
          error: 'Failed to scrape QB data',
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
    let quarantinedCount = 0;
    let aliasesCreated = 0;
    const capturedAt = new Date().toISOString();
    const formatKey = format.replace(/-/g, '_');

    for (const qb of qbs) {
      const resolveResult = await resolvePlayerId(supabase, {
        name: qb.full_name,
        position: 'QB',
        team: qb.team || undefined,
        source: 'ktc',
        autoQuarantine: true,
      });

      if (!resolveResult.success) {
        console.warn(`Could not resolve QB: ${qb.full_name} (quarantined: ${resolveResult.quarantined})`);
        if (resolveResult.quarantined) {
          quarantinedCount++;
        }
        continue;
      }

      const playerId = resolveResult.player_id!;

      const aliasAdded = await addPlayerAlias(supabase, playerId, qb.full_name, 'ktc');
      if (aliasAdded) {
        aliasesCreated++;
      }

      const fdpValue = calcFdpValue(qb.value, 'QB', format);

      const { error: snapshotError } = await supabase
        .from('ktc_value_snapshots')
        .insert({
          player_id: playerId,
          full_name: qb.full_name,
          position: 'QB',
          team: qb.team,
          position_rank: qb.position_rank,
          base_value: qb.value,
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
        position: 'QB',
        count: successCount,
        total: qbs.length,
        quarantined: quarantinedCount,
        aliases_created: aliasesCreated,
        minRank: scrapeResult.minRank,
        maxRank: scrapeResult.maxRank,
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
