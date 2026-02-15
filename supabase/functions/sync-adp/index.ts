import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AdpEntry {
  player_name: string;
  position: string;
  team: string;
  adp_overall: number;
}

function parseAdpCsv(csvText: string): AdpEntry[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('player'));
  const posIdx = headers.findIndex((h) => h.includes('pos'));
  const teamIdx = headers.findIndex((h) => h.includes('team'));
  const adpIdx = headers.findIndex((h) => h.includes('adp') || h.includes('avg'));

  if (nameIdx === -1 || adpIdx === -1) {
    return [];
  }

  const entries: AdpEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));

    if (cols.length > Math.max(nameIdx, adpIdx)) {
      const adp = parseFloat(cols[adpIdx]);
      if (!isNaN(adp) && adp > 0) {
        entries.push({
          player_name: cols[nameIdx],
          position: posIdx >= 0 ? cols[posIdx] : '',
          team: teamIdx >= 0 ? cols[teamIdx] : '',
          adp_overall: adp,
        });
      }
    }
  }

  return entries;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

    if (secret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const adpUrl = Deno.env.get('ADP_SOURCE_URL');

    if (!adpUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ADP_SOURCE_URL not configured',
          imported: 0,
          unresolved: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Fetching ADP data from: ${adpUrl}`);

    const response = await fetch(adpUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ADP data: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    let adpData: AdpEntry[] = [];

    if (contentType?.includes('application/json')) {
      adpData = await response.json();
    } else {
      const text = await response.text();
      try {
        adpData = JSON.parse(text);
      } catch {
        adpData = parseAdpCsv(text);
      }
    }

    console.log(`Parsed ${adpData.length} ADP entries`);

    const today = new Date().toISOString().split('T')[0];
    const source = new URL(adpUrl).hostname;

    let imported = 0;
    let unresolved = 0;
    const errors: string[] = [];

    for (const entry of adpData) {
      try {
        if (!entry.player_name || !entry.adp_overall) {
          continue;
        }

        const normalizedName = normalizeName(entry.player_name);

        const { data: players, error: searchError } = await supabase
          .from('nfl_players_registry')
          .select('player_id, full_name')
          .ilike('full_name', `%${entry.player_name}%`)
          .limit(5);

        if (searchError) {
          errors.push(`Search error for ${entry.player_name}: ${searchError.message}`);
          continue;
        }

        let playerId: string | null = null;

        if (players && players.length > 0) {
          if (players.length === 1) {
            playerId = players[0].player_id;
          } else {
            const exactMatch = players.find(
              (p) => normalizeName(p.full_name) === normalizedName
            );
            if (exactMatch) {
              playerId = exactMatch.player_id;
            } else {
              playerId = players[0].player_id;
            }
          }
        }

        if (playerId) {
          const { error: upsertError } = await supabase.from('player_adp').upsert(
            {
              player_id: playerId,
              adp: entry.adp_overall,
              as_of_date: today,
              source,
            },
            { onConflict: 'player_id,as_of_date' }
          );

          if (upsertError) {
            errors.push(`Upsert error for ${entry.player_name}: ${upsertError.message}`);
          } else {
            imported++;
          }
        } else {
          await supabase.from('unresolved_entities').insert({
            entity_type: 'player',
            raw_name: entry.player_name,
            normalized_name: normalizedName,
            context: {
              position: entry.position,
              team: entry.team,
              adp: entry.adp_overall,
              source: 'adp',
            },
          });
          unresolved++;
        }
      } catch (err) {
        errors.push(
          `Error processing ${entry.player_name}: ${err instanceof Error ? err.message : 'Unknown'}`
        );
      }
    }

    console.log(`ADP sync complete: ${imported} imported, ${unresolved} unresolved`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        unresolved,
        total: adpData.length,
        errors: errors.slice(0, 10),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('ADP sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        imported: 0,
        unresolved: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
