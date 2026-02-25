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

function calcFdpValue(baseValue: number, position: string, format: string): number {
  const formatKey = format.replace(/-/g, '_');
  const multiplier = formatMultipliers[formatKey]?.[position] ?? 1;
  return Math.round(baseValue * multiplier);
}

function rankToValue(rank: number, totalPlayers: number): number {
  const maxValue = 9500;
  const minValue = 500;
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

async function fetchFantasyProsQBs(format: string): Promise<FetchResult> {
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
      allPlayers.push({ full_name: name, position: posRaw || 'QB', team, position_rank: rank, value: 0 });
    }

    const qbs = allPlayers.filter(p => p.position === 'QB');

    if (qbs.length < 10) {
      return { blocked: false, ok: false, players: [], count: qbs.length, minRank: 0, maxRank: 0, reason: 'too_few_rows' };
    }

    qbs.forEach((p, i) => { p.position_rank = i + 1; p.value = rankToValue(i + 1, qbs.length); });

    return { blocked: false, ok: true, players: qbs, count: qbs.length, minRank: 1, maxRank: qbs.length };
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
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');

    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fetchResult = await fetchFantasyProsQBs(format);

    if (fetchResult.blocked) {
      return new Response(JSON.stringify({ ok: false, blocked: true, error: 'Request blocked', reason: fetchResult.reason }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!fetchResult.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Failed to fetch QB data', reason: fetchResult.reason, count: fetchResult.count }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const qbs = fetchResult.players;
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
        source: 'fantasypros',
        autoQuarantine: true,
      });

      if (!resolveResult.success) {
        if (resolveResult.quarantined) quarantinedCount++;
        continue;
      }

      const playerId = resolveResult.player_id!;
      const aliasAdded = await addPlayerAlias(supabase, playerId, qb.full_name, 'fantasypros');
      if (aliasAdded) aliasesCreated++;

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
          source: 'FDP',
          captured_at: capturedAt,
        });

      if (!snapshotError) {
        successCount++;
      } else {
        console.error('Error inserting snapshot:', snapshotError);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      position: 'QB',
      count: successCount,
      total: qbs.length,
      quarantined: quarantinedCount,
      aliases_created: aliasesCreated,
      minRank: fetchResult.minRank,
      maxRank: fetchResult.maxRank,
      timestamp: capturedAt,
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
