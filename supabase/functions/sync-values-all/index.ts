import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface KTCPlayer {
  position_rank: number;
  full_name: string;
  team: string;
  value: number;
}

interface ScrapeResult {
  blocked: boolean;
  count: number;
  maxRank: number;
  players: KTCPlayer[];
}

interface PositionThresholds {
  [key: string]: number;
}

const POSITION_THRESHOLDS: PositionThresholds = {
  QB: 60,
  RB: 150,
  WR: 200,
  TE: 80,
};

const KTC_URLS: Record<string, string> = {
  QB: 'https://keeptradecut.com/dynasty-rankings?page=0&filters=QB|0|1',
  RB: 'https://keeptradecut.com/dynasty-rankings?page=0&filters=RB|0|1',
  WR: 'https://keeptradecut.com/dynasty-rankings?page=0&filters=WR|0|1',
  TE: 'https://keeptradecut.com/dynasty-rankings?page=0&filters=TE|0|1',
};

function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  let normalized = name.trim().toLowerCase();
  normalized = normalized.replace(/'/g, '');
  normalized = normalized.replace(/\./g, ' ');
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'junior', 'senior'];
  const words = normalized.split(' ');
  const filteredWords = words.filter(word => word.length > 0 && !suffixes.includes(word));
  normalized = filteredWords.join(' ');

  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  normalized = normalized.replace(/\s+/g, '');

  return normalized;
}

async function scrapeKTCPosition(position: string): Promise<ScrapeResult> {
  const url = KTC_URLS[position];
  if (!url) {
    throw new Error(`No URL configured for position: ${position}`);
  }

  console.log(`Scraping KTC for ${position}...`);

  try {
    const response = await fetch(url);
    const html = await response.text();

    if (html.includes('captcha') || html.includes('blocked')) {
      return {
        blocked: true,
        count: 0,
        maxRank: 0,
        players: [],
      };
    }

    const players: KTCPlayer[] = [];
    const rankRegex = /<div class="onePlayer"[\s\S]*?rank.*?>(\d+)<[\s\S]*?playerName.*?>(.*?)<[\s\S]*?teamNameValue.*?>(.*?)<[\s\S]*?value.*?>(\d+)</gi;

    let match;
    while ((match = rankRegex.exec(html)) !== null) {
      const [, rankStr, name, team, valueStr] = match;

      players.push({
        position_rank: parseInt(rankStr, 10),
        full_name: name.trim(),
        team: team.trim(),
        value: parseInt(valueStr, 10),
      });
    }

    const maxRank = players.length > 0 ? Math.max(...players.map(p => p.position_rank)) : 0;

    return {
      blocked: false,
      count: players.length,
      maxRank,
      players,
    };
  } catch (error) {
    console.error(`Error scraping ${position}:`, error);
    return {
      blocked: false,
      count: 0,
      maxRank: 0,
      players: [],
    };
  }
}

async function resolvePlayerByName(
  supabase: any,
  name: string,
  position: string,
  team: string
): Promise<string | null> {
  const normalized = normalizeName(name);

  const { data: exactMatch } = await supabase
    .from('nfl_players')
    .select('id')
    .eq('search_name', normalized)
    .eq('player_position', position)
    .maybeSingle();

  if (exactMatch) {
    return exactMatch.id;
  }

  const { data: aliasMatch } = await supabase
    .from('player_aliases')
    .select('player_id, nfl_players!inner(player_position)')
    .eq('alias_normalized', normalized)
    .maybeSingle();

  if (aliasMatch && aliasMatch.nfl_players.player_position === position) {
    return aliasMatch.player_id;
  }

  const { data: fuzzyMatches } = await supabase
    .from('nfl_players')
    .select('id, full_name')
    .eq('player_position', position)
    .ilike('full_name', `%${name.split(' ')[1] || name}%`)
    .limit(5);

  if (fuzzyMatches && fuzzyMatches.length === 1) {
    return fuzzyMatches[0].id;
  }

  return null;
}

async function calcFdpValue(ktcValue: number, position: string): Promise<number> {
  let fdpValue = ktcValue;

  if (position === 'QB') {
    fdpValue = Math.floor(ktcValue * 1.05);
  } else if (position === 'RB') {
    fdpValue = Math.floor(ktcValue * 0.95);
  } else if (position === 'WR') {
    fdpValue = Math.floor(ktcValue * 1.0);
  } else if (position === 'TE') {
    fdpValue = Math.floor(ktcValue * 0.98);
  }

  return Math.max(0, Math.min(10000, fdpValue));
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
    const secret = url.searchParams.get('secret');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');

    if (secret !== cronSecret && req.headers.get('Authorization') !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting values sync pipeline...');

    const result = {
      positions: {} as Record<string, any>,
      totals: {
        inserted: 0,
        updated: 0,
        unresolved: 0,
        errors: 0,
      },
      timestamp: new Date().toISOString(),
    };

    for (const [position, threshold] of Object.entries(POSITION_THRESHOLDS)) {
      console.log(`\n=== Syncing ${position} ===`);

      const scrapeResult = await scrapeKTCPosition(position);

      if (scrapeResult.blocked) {
        result.positions[position] = {
          status: 'blocked',
          message: 'Scraping blocked by KTC',
        };
        continue;
      }

      if (scrapeResult.maxRank < threshold) {
        result.positions[position] = {
          status: 'failed',
          message: `Insufficient data: ${scrapeResult.maxRank} < ${threshold}`,
          scraped: scrapeResult.count,
          threshold,
        };
        continue;
      }

      let inserted = 0;
      let updated = 0;
      let unresolved = 0;
      let errors = 0;

      for (const player of scrapeResult.players) {
        try {
          const playerId = await resolvePlayerByName(
            supabase,
            player.full_name,
            position,
            player.team
          );

          if (!playerId) {
            await supabase.from('unresolved_entities').insert({
              raw_name: player.full_name,
              player_position: position,
              team: player.team,
              source: 'ktc_sync',
              status: 'open',
            });

            unresolved++;
            continue;
          }

          const fdpValue = await calcFdpValue(player.value, position);

          const { data: existing } = await supabase
            .from('ktc_value_snapshots')
            .select('id')
            .eq('player_id', playerId)
            .eq('format', 'dynasty_sf')
            .gte('captured_at', new Date(Date.now() - 3600000).toISOString())
            .maybeSingle();

          if (existing) {
            await supabase
              .from('ktc_value_snapshots')
              .update({
                position_rank: player.position_rank,
                ktc_value: player.value,
                fdp_value: fdpValue,
              })
              .eq('id', existing.id);

            updated++;
          } else {
            await supabase.from('ktc_value_snapshots').insert({
              player_id: playerId,
              source: 'KTC',
              format: 'dynasty_sf',
              player_position: position,
              position_rank: player.position_rank,
              ktc_value: player.value,
              fdp_value: fdpValue,
            });

            inserted++;
          }
        } catch (err) {
          console.error(`Error processing ${player.full_name}:`, err);
          errors++;
        }
      }

      result.positions[position] = {
        status: 'success',
        scraped: scrapeResult.count,
        maxRank: scrapeResult.maxRank,
        inserted,
        updated,
        unresolved,
        errors,
      };

      result.totals.inserted += inserted;
      result.totals.updated += updated;
      result.totals.unresolved += unresolved;
      result.totals.errors += errors;

      console.log(`${position} complete: +${inserted} updated:${updated} unresolved:${unresolved}`);
    }

    console.log('\nValues sync complete!');
    console.log('Totals:', result.totals);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error syncing values:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
