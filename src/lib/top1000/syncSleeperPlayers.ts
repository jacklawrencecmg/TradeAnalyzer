/**
 * Sleeper Player Sync
 *
 * Syncs the canonical player universe from Sleeper's NFL players directory.
 * This is the source of truth for all players including offense and IDP positions.
 */

import { supabase } from '../supabase';
import { normalizeName, generateNameVariants } from './normalizeName';

interface SleeperPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  fantasy_positions?: string[];
  team?: string | null;
  status?: string;
  age?: number;
  years_exp?: number;
  depth_chart_order?: number;
  injury_status?: string;
  birth_date?: string;
  [key: string]: any;
}

/**
 * Sync all fantasy-relevant players from Sleeper
 * Returns count of players processed and created/updated
 */
export async function syncSleeperPlayers(): Promise<{
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    console.log('Fetching Sleeper NFL players...');

    // Fetch players from Sleeper API
    const response = await fetch('https://api.sleeper.app/v1/players/nfl', {
      headers: {
        'User-Agent': 'FantasyDraftPros/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
    }

    const playersObj: Record<string, SleeperPlayer> = await response.json();
    const players = Object.values(playersObj);

    console.log(`Fetched ${players.length} players from Sleeper`);

    // Filter to fantasy-relevant players
    const relevantPlayers = players.filter(isFantasyRelevant);

    console.log(`Found ${relevantPlayers.length} fantasy-relevant players`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < relevantPlayers.length; i += batchSize) {
      const batch = relevantPlayers.slice(i, i + batchSize);

      for (const player of batch) {
        try {
          const result = await upsertPlayer(player);
          if (result === 'created') created++;
          else if (result === 'updated') updated++;
          else skipped++;
        } catch (error) {
          console.error(`Error upserting player ${player.player_id}:`, error);
          skipped++;
        }
      }

      // Log progress
      if ((i + batchSize) % 500 === 0 || i + batchSize >= relevantPlayers.length) {
        console.log(`Processed ${Math.min(i + batchSize, relevantPlayers.length)}/${relevantPlayers.length} players`);
      }
    }

    const duration = Date.now() - startTime;

    // Record sync status
    await supabase.from('sync_status').insert({
      sync_type: 'sleeper_players',
      status: 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      records_processed: relevantPlayers.length,
      records_created: created,
      records_updated: updated,
      metadata: { skipped },
    });

    console.log(`Sleeper sync complete: ${created} created, ${updated} updated, ${skipped} skipped in ${duration}ms`);

    return {
      success: true,
      processed: relevantPlayers.length,
      created,
      updated,
      skipped,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('Sleeper sync failed:', errorMessage);

    // Record failed sync
    await supabase.from('sync_status').insert({
      sync_type: 'sleeper_players',
      status: 'error',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      error_message: errorMessage,
    });

    return {
      success: false,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      error: errorMessage,
    };
  }
}

/**
 * Check if a player is fantasy-relevant
 */
function isFantasyRelevant(player: SleeperPlayer): boolean {
  // Must have a player_id
  if (!player.player_id) return false;

  // Get position from fantasy_positions or position field
  const positions = player.fantasy_positions || [];
  const position = positions[0] || player.position;

  // Keep only fantasy positions
  const fantasyPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB', 'DEF'];
  if (!position || !fantasyPositions.includes(position)) {
    return false;
  }

  // Keep active, roster-able, or recently seen players
  const status = (player.status || '').toLowerCase();
  const rosterableStatuses = [
    'active',
    'practice squad',
    'injured reserve',
    'pup',
    'suspension',
    'cov',
  ];

  // Include if status is rosterable OR if they're a recent draft pick
  const isRosterable = rosterableStatuses.some(s => status.includes(s));
  const isRecentDraftPick = player.years_exp !== undefined && player.years_exp <= 2;

  return isRosterable || isRecentDraftPick || !player.status;
}

/**
 * Upsert a single player into nfl_players
 */
async function upsertPlayer(player: SleeperPlayer): Promise<'created' | 'updated' | 'skipped'> {
  // Build full name
  let fullName = player.full_name;
  if (!fullName && player.first_name && player.last_name) {
    fullName = `${player.first_name} ${player.last_name}`;
  }
  if (!fullName) {
    console.warn(`Player ${player.player_id} has no name, skipping`);
    return 'skipped';
  }

  // Determine position (prefer fantasy_positions)
  const positions = player.fantasy_positions || [];
  const position = positions[0] || player.position || 'UNKNOWN';

  // Normalize search name
  const searchName = normalizeName(fullName);

  // Calculate age from birth_date if available
  let age = player.age;
  if (!age && player.birth_date) {
    try {
      const birthDate = new Date(player.birth_date);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
    } catch (e) {
      // Invalid date, ignore
    }
  }

  // Normalize status
  let status = (player.status || 'Active').trim();
  if (status === '') status = 'Active';

  // Check if player exists
  const { data: existing } = await supabase
    .from('nfl_players')
    .select('id, full_name, updated_at')
    .eq('provider', 'sleeper')
    .eq('external_id', player.player_id)
    .maybeSingle();

  const playerData = {
    provider: 'sleeper',
    external_id: player.player_id,
    full_name: fullName,
    search_name: searchName,
    player_position: position,
    team: player.team || null,
    status: status,
    years_exp: player.years_exp || null,
    depth_chart_position: player.depth_chart_order || null,
    injury_status: player.injury_status || null,
    metadata: {
      age: age || null,
      birth_date: player.birth_date || null,
      fantasy_positions: player.fantasy_positions || [],
    },
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    // Update existing player
    const { error } = await supabase
      .from('nfl_players')
      .update(playerData)
      .eq('id', existing.id);

    if (error) {
      console.error(`Error updating player ${player.player_id}:`, error);
      return 'skipped';
    }

    // Seed aliases if needed
    await seedPlayerAliases(existing.id, fullName);

    return 'updated';
  } else {
    // Insert new player
    const { data: newPlayer, error } = await supabase
      .from('nfl_players')
      .insert({
        ...playerData,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error inserting player ${player.player_id}:`, error);
      return 'skipped';
    }

    // Seed aliases for new player
    if (newPlayer) {
      await seedPlayerAliases(newPlayer.id, fullName);
    }

    return 'created';
  }
}

/**
 * Seed aliases for a player
 * Creates common name variations for matching
 */
async function seedPlayerAliases(playerId: string, fullName: string): Promise<void> {
  const variants = generateNameVariants(fullName);

  // Filter out the exact search_name (already in nfl_players)
  const searchName = normalizeName(fullName);
  const aliasVariants = variants.filter(v => v !== searchName);

  if (aliasVariants.length === 0) return;

  // Insert aliases (ignore conflicts)
  const aliases = aliasVariants.map(variant => ({
    player_id: playerId,
    alias: variant,
    alias_normalized: variant,
    source: 'sleeper',
  }));

  const { error } = await supabase.from('player_aliases').upsert(aliases, {
    onConflict: 'alias_normalized',
    ignoreDuplicates: true,
  });

  if (error && error.code !== '23505') {
    // Ignore unique constraint violations
    console.error(`Error seeding aliases for player ${playerId}:`, error);
  }
}

/**
 * Get last Sleeper sync status
 */
export async function getLastSleeperSync() {
  const { data } = await supabase
    .from('sync_status')
    .select('*')
    .eq('sync_type', 'sleeper_players')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
