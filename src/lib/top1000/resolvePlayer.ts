/**
 * Player Resolver
 *
 * Resolves player names from external sources to canonical player_id in nfl_players table.
 * Uses exact matching, alias matching, and fuzzy fallback with position/team hints.
 */

import { supabase } from '../supabase';
import { normalizeName, calculateNameSimilarity } from './normalizeName';

export interface PlayerMatchContext {
  rawName: string;
  position?: string;
  team?: string;
  source: string;
}

export interface PlayerMatch {
  player_id: string;
  full_name: string;
  confidence: number;
  match_type: 'exact' | 'alias' | 'fuzzy';
}

/**
 * Resolve a player name to a player_id
 * Returns player_id on successful match, null if unresolved
 * Inserts into unresolved_entities if no match found
 */
export async function resolvePlayerId(
  context: PlayerMatchContext
): Promise<string | null> {
  const { rawName, position, team, source } = context;
  const normalized = normalizeName(rawName);

  if (!normalized) {
    console.warn('Empty name provided to resolvePlayerId');
    return null;
  }

  // Step 1: Try exact match on search_name
  const exactMatch = await tryExactMatch(normalized, position, team);
  if (exactMatch) {
    return exactMatch.player_id;
  }

  // Step 2: Try alias match
  const aliasMatch = await tryAliasMatch(normalized);
  if (aliasMatch) {
    return aliasMatch.player_id;
  }

  // Step 3: Try fuzzy match (with position/team hints)
  const fuzzyMatch = await tryFuzzyMatch(normalized, position, team);
  if (fuzzyMatch && fuzzyMatch.confidence >= 0.85) {
    return fuzzyMatch.player_id;
  }

  // No match found - insert into unresolved_entities
  await insertUnresolved(context);
  return null;
}

/**
 * Try exact match on search_name
 */
async function tryExactMatch(
  searchName: string,
  position?: string,
  team?: string
): Promise<PlayerMatch | null> {
  let query = supabase
    .from('nfl_players')
    .select('id, full_name, player_position, team')
    .eq('search_name', searchName);

  // Filter by position if provided
  if (position) {
    query = query.eq('player_position', position);
  }

  // Filter by team if provided (but not required)
  if (team) {
    query = query.eq('team', team);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error in tryExactMatch:', error);
    return null;
  }

  if (data) {
    return {
      player_id: data.id,
      full_name: data.full_name,
      confidence: 1.0,
      match_type: 'exact',
    };
  }

  return null;
}

/**
 * Try match via player_aliases table
 */
async function tryAliasMatch(searchName: string): Promise<PlayerMatch | null> {
  const { data, error } = await supabase
    .from('player_aliases')
    .select('player_id, nfl_players(id, full_name)')
    .eq('alias_normalized', searchName)
    .maybeSingle();

  if (error) {
    console.error('Error in tryAliasMatch:', error);
    return null;
  }

  if (data && data.nfl_players) {
    const player = Array.isArray(data.nfl_players)
      ? data.nfl_players[0]
      : data.nfl_players;

    return {
      player_id: player.id,
      full_name: player.full_name,
      confidence: 0.95,
      match_type: 'alias',
    };
  }

  return null;
}

/**
 * Try fuzzy match with similarity scoring
 * Prefers same position and team
 */
async function tryFuzzyMatch(
  searchName: string,
  position?: string,
  team?: string
): Promise<PlayerMatch | null> {
  // Get all active players (or filter by position if provided)
  let query = supabase
    .from('nfl_players')
    .select('id, full_name, search_name, player_position, team, status');

  if (position) {
    query = query.eq('player_position', position);
  }

  // Limit to active/rosterable players
  query = query.in('status', ['Active', 'IR', 'PUP', 'Practice Squad', 'FA']);

  const { data: players, error } = await query;

  if (error || !players || players.length === 0) {
    return null;
  }

  // Calculate similarity scores
  const matches = players.map(player => {
    let similarity = calculateNameSimilarity(searchName, player.search_name);

    // Boost if position matches
    if (position && player.player_position === position) {
      similarity += 0.1;
    }

    // Boost if team matches
    if (team && player.team === team) {
      similarity += 0.05;
    }

    return {
      player_id: player.id,
      full_name: player.full_name,
      confidence: Math.min(similarity, 1.0),
      match_type: 'fuzzy' as const,
    };
  });

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);

  // Return best match if above threshold
  const bestMatch = matches[0];
  if (bestMatch && bestMatch.confidence >= 0.75) {
    // Check for ambiguity - if top 2 matches are very close, return null
    const secondMatch = matches[1];
    if (secondMatch && Math.abs(bestMatch.confidence - secondMatch.confidence) < 0.1) {
      console.warn(
        `Ambiguous fuzzy match for "${searchName}": ${bestMatch.full_name} (${bestMatch.confidence.toFixed(2)}) vs ${secondMatch.full_name} (${secondMatch.confidence.toFixed(2)})`
      );
      return null;
    }

    return bestMatch;
  }

  return null;
}

/**
 * Insert unresolved entity into tracking table
 */
async function insertUnresolved(context: PlayerMatchContext): Promise<void> {
  const { rawName, position, team, source } = context;

  // Check if already exists
  const { data: existing } = await supabase
    .from('unresolved_entities')
    .select('id')
    .eq('raw_name', rawName)
    .eq('source', source)
    .eq('status', 'open')
    .maybeSingle();

  if (existing) {
    // Already tracked
    return;
  }

  // Insert new unresolved entity
  const { error } = await supabase.from('unresolved_entities').insert({
    raw_name: rawName,
    position: position || null,
    team: team || null,
    source,
    status: 'open',
  });

  if (error) {
    console.error('Error inserting unresolved entity:', error);
  } else {
    console.warn(`Unresolved player: "${rawName}" from ${source}`);
  }
}

/**
 * Batch resolve multiple players
 * Returns map of rawName -> player_id (null if unresolved)
 */
export async function resolvePlayersBatch(
  contexts: PlayerMatchContext[]
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  for (const context of contexts) {
    const playerId = await resolvePlayerId(context);
    results.set(context.rawName, playerId);
  }

  return results;
}

/**
 * Get unresolved entities for admin review
 */
export async function getUnresolvedEntities(limit: number = 100) {
  const { data, error } = await supabase
    .from('unresolved_entities')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching unresolved entities:', error);
    return [];
  }

  return data || [];
}

/**
 * Mark an unresolved entity as resolved
 */
export async function markResolved(
  unresolvedId: string,
  playerId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('unresolved_entities')
    .update({
      status: 'resolved',
      resolved_player_id: playerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', unresolvedId);

  if (error) {
    console.error('Error marking entity as resolved:', error);
    return false;
  }

  return true;
}
