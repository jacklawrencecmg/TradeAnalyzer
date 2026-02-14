import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  position: string;
  team: string | null;
  status: string;
  years_exp: number;
  age: number;
  birth_date?: string;
  college?: string;
  active: boolean;
  injury_status?: string;
  depth_chart_position?: number;
  depth_chart_order?: number;
  fantasy_positions?: string[];
  number?: number;
  height?: string;
  weight?: string;
}

interface SyncResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  inactive_marked?: number;
}

function normalizeStatus(sleeperPlayer: SleeperPlayer): string {
  if (!sleeperPlayer.active && sleeperPlayer.status === 'Retired') {
    return 'Retired';
  }

  if (sleeperPlayer.injury_status) {
    if (sleeperPlayer.injury_status.includes('IR') || sleeperPlayer.injury_status.includes('Injured Reserve')) {
      return 'Injured Reserve';
    }
    if (sleeperPlayer.injury_status.includes('Out')) {
      return 'IR';
    }
  }

  if (sleeperPlayer.status) {
    if (sleeperPlayer.status.includes('Practice Squad')) {
      return 'Practice Squad';
    }
    if (sleeperPlayer.status === 'Inactive' || sleeperPlayer.status === 'Suspended') {
      return 'Inactive';
    }
  }

  if (!sleeperPlayer.team) {
    return 'Free Agent';
  }

  return 'Active';
}

function shouldIncludePlayer(player: SleeperPlayer): boolean {
  if (!player.first_name && !player.last_name && !player.full_name) {
    return false;
  }

  const currentYear = new Date().getFullYear();
  const yearsAgo = currentYear - (player.years_exp || 0);

  if (player.status === 'Retired' && yearsAgo > 2) {
    return false;
  }

  if (!player.position || player.position === 'DEF') {
    if (player.position !== 'DEF') {
      return false;
    }
  }

  const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];
  if (player.position && !validPositions.includes(player.position)) {
    if (!player.fantasy_positions || player.fantasy_positions.length === 0) {
      return false;
    }
  }

  return true;
}

function getRookieYear(player: SleeperPlayer): number | null {
  const currentYear = new Date().getFullYear();

  if (player.years_exp === 0) {
    return currentYear;
  }

  if (player.years_exp > 0) {
    return currentYear - player.years_exp;
  }

  return null;
}

function parseBirthdate(birthdate?: string): string | null {
  if (!birthdate) return null;

  try {
    const date = new Date(birthdate);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
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
    const secret = url.searchParams.get('secret');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (secret !== cronSecret) {
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

    const result: SyncResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    console.log('Fetching players from Sleeper API...');
    const response = await fetch('https://api.sleeper.app/v1/players/nfl');

    if (!response.ok) {
      throw new Error(`Sleeper API returned ${response.status}`);
    }

    const playersData = await response.json();
    const players: SleeperPlayer[] = Object.values(playersData);

    console.log(`Fetched ${players.length} players from Sleeper`);

    let processed = 0;

    for (const player of players) {
      try {
        if (!shouldIncludePlayer(player)) {
          result.skipped++;
          continue;
        }

        const fullName = player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim();

        if (!fullName) {
          result.skipped++;
          continue;
        }

        const status = normalizeStatus(player);
        const rookieYear = getRookieYear(player);
        const birthdate = parseBirthdate(player.birth_date);

        const { data: playerId, error } = await supabase.rpc('upsert_player_from_sync', {
          p_external_id: player.player_id,
          p_full_name: fullName,
          p_position: player.position || 'UNKNOWN',
          p_team: player.team || null,
          p_status: status,
          p_rookie_year: rookieYear,
          p_birthdate: birthdate,
          p_metadata: {
            years_exp: player.years_exp,
            age: player.age,
            college: player.college,
            injury_status: player.injury_status,
            depth_chart_position: player.depth_chart_position,
            depth_chart_order: player.depth_chart_order,
            number: player.number,
            height: player.height,
            weight: player.weight,
          },
        });

        if (error) {
          console.error(`Error syncing player ${fullName}:`, error);
          result.errors++;
          continue;
        }

        if (playerId) {
          result.updated++;
        } else {
          result.inserted++;
        }

        processed++;

        if (processed % 100 === 0) {
          console.log(`Processed ${processed}/${players.length} players...`);
        }
      } catch (err) {
        console.error(`Error processing player:`, err);
        result.errors++;
      }
    }

    console.log('Marking inactive players...');
    const { data: inactiveCount, error: inactiveError } = await supabase.rpc('mark_inactive_players');

    if (inactiveError) {
      console.error('Error marking inactive players:', inactiveError);
    } else {
      result.inactive_marked = inactiveCount || 0;
      console.log(`Marked ${inactiveCount} players as inactive`);
    }

    console.log('Sync complete:', result);

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
    console.error('Error syncing Sleeper players:', error);
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
