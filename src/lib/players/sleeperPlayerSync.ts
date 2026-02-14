import { supabase } from '../supabase';
import { normalizeName, generateAliases } from './normalizeName';

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
  sport?: string;
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
  aliases_created?: number;
}

const RELEVANT_STATUSES = [
  'Active',
  'Practice Squad',
  'Injured Reserve',
  'Reserve/Injured',
  'IR',
  'Out',
  'Questionable',
  'Doubtful',
  'Probable',
  'Suspension',
  'Non-Football Injury',
  'Non-Football Illness',
  'Physically Unable to Perform',
  'PUP',
  'COVID-19',
  ''
];

const IGNORE_STATUSES = ['Retired'];

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

async function seedPlayerAliases(
  playerId: string,
  fullName: string,
  firstName?: string,
  lastName?: string
): Promise<number> {
  let aliasesCreated = 0;

  try {
    const aliases = generateAliases(fullName, firstName, lastName);

    for (const alias of aliases) {
      const normalized = normalizeName(alias);

      if (!normalized || normalized.length < 2) {
        continue;
      }

      try {
        await supabase.rpc('add_player_alias', {
          p_player_id: playerId,
          p_alias: alias,
          p_alias_normalized: normalized,
          p_source: 'sleeper',
        });

        aliasesCreated++;
      } catch (err) {
        // Ignore duplicate alias errors
      }
    }

    return aliasesCreated;
  } catch (err) {
    console.error('Error seeding player aliases:', err);
    return aliasesCreated;
  }
}

export async function syncSleeperPlayers(): Promise<SyncResult> {
  const result: SyncResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    aliases_created: 0,
  };

  try {
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

        const playerUuid = playerId || (await getPlayerIdByExternalId(player.player_id));

        if (playerUuid) {
          const aliasCount = await seedPlayerAliases(
            playerUuid,
            fullName,
            player.first_name,
            player.last_name
          );
          result.aliases_created = (result.aliases_created || 0) + aliasCount;
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
    return result;
  } catch (error) {
    console.error('Error syncing Sleeper players:', error);
    throw error;
  }
}

export async function getPlayerIdByName(
  name: string,
  position?: string
): Promise<{ id: string; name: string; position: string; team: string | null } | null> {
  try {
    const { data, error } = await supabase.rpc('get_player_by_name', {
      p_name: name,
      p_position: position || null,
    });

    if (error) {
      console.error('Error looking up player:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const bestMatch = data[0];
    return {
      id: bestMatch.id,
      name: bestMatch.full_name,
      position: bestMatch.player_position,
      team: bestMatch.team,
    };
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function getPlayerIdByExternalId(externalId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_player_by_external_id', {
      p_external_id: externalId,
    });

    if (error) {
      console.error('Error looking up player by external ID:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0].id;
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function ensurePlayerExists(
  name: string,
  position?: string,
  team?: string
): Promise<string | null> {
  const { resolvePlayerId } = await import('./resolvePlayerId');

  const result = await resolvePlayerId({
    name,
    position,
    team,
    source: 'user',
    autoQuarantine: false,
  });

  if (result.success && result.player_id) {
    return result.player_id;
  }

  console.log(`Player not found: ${name}. Triggering sync...`);

  try {
    await syncSleeperPlayers();

    const retryResult = await resolvePlayerId({
      name,
      position,
      team,
      source: 'user',
      autoQuarantine: false,
    });

    if (retryResult.success && retryResult.player_id) {
      return retryResult.player_id;
    }

    console.warn(`Player still not found after sync: ${name}`);

    const { data, error } = await supabase
      .from('nfl_players')
      .insert({
        full_name: name,
        player_position: position || 'UNKNOWN',
        status: 'Unknown',
        external_id: `temp_${Date.now()}_${name.replace(/\s/g, '_')}`,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating placeholder player:', error);
      return null;
    }

    console.log(`Created placeholder player for: ${name}`);
    return data.id;
  } catch (err) {
    console.error('Error ensuring player exists:', err);
    return null;
  }
}

export async function getPlayersByTeam(team: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('nfl_players')
      .select('*')
      .eq('team', team)
      .eq('status', 'Active')
      .order('player_position');

    if (error) {
      console.error('Error fetching players by team:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

export async function getPlayersByPosition(position: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('nfl_players')
      .select('*')
      .eq('player_position', position)
      .eq('status', 'Active')
      .order('team');

    if (error) {
      console.error('Error fetching players by position:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

export async function getRookies(year?: number): Promise<any[]> {
  const targetYear = year || new Date().getFullYear();

  try {
    const { data, error } = await supabase
      .from('nfl_players')
      .select('*')
      .eq('rookie_year', targetYear)
      .order('full_name');

    if (error) {
      console.error('Error fetching rookies:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

export async function getRecentPlayerEvents(limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('player_events')
      .select(`
        *,
        nfl_players (
          full_name,
          player_position,
          team
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching player events:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}
