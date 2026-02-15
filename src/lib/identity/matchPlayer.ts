/**
 * Player Identity Matching System
 *
 * Matches incoming players from data sources to existing player identities.
 * Uses multi-step matching strategy:
 * 1. Exact external ID match
 * 2. Normalized name + team match
 * 3. Normalized name + position match
 * 4. Fuzzy name similarity > 0.92
 * 5. Create new identity candidate
 */

import { supabase } from '../supabase';
import {
  normalizeName,
  nameSimilarity,
  scoreNameMatch,
  getNormalizedName,
} from './normalizeName';

export interface IncomingPlayer {
  name: string;
  team?: string;
  position: string;
  sleeper_id?: string;
  espn_id?: string;
  gsis_id?: string;
  fantasypros_id?: string;
  birth_date?: string;
  birth_year?: number;
  source: string;
}

export interface PlayerIdentity {
  player_id: string;
  sleeper_id: string | null;
  espn_id: string | null;
  gsis_id: string | null;
  fantasypros_id: string | null;
  full_name: string;
  normalized_name: string;
  birth_date: string | null;
  birth_year: number | null;
  team: string | null;
  position: string;
  sub_position: string | null;
  status: string;
  last_seen_source: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  matched: boolean;
  player_id: string | null;
  confidence: number;
  method: string;
  existing_player?: PlayerIdentity;
  should_create: boolean;
  conflicts?: Array<{
    player_id: string;
    reason: string;
    confidence: number;
  }>;
}

/**
 * Match incoming player to existing identity
 */
export async function matchIncomingPlayer(
  incoming: IncomingPlayer
): Promise<MatchResult> {
  // Step 1: Try exact external ID match
  const idMatch = await matchByExternalId(incoming);
  if (idMatch.matched) {
    return idMatch;
  }

  // Step 2: Try normalized name + team match
  if (incoming.team) {
    const nameTeamMatch = await matchByNameAndTeam(
      incoming.name,
      incoming.team,
      incoming.position
    );
    if (nameTeamMatch.matched) {
      return nameTeamMatch;
    }
  }

  // Step 3: Try normalized name + position match
  const namePositionMatch = await matchByNameAndPosition(
    incoming.name,
    incoming.position
  );
  if (namePositionMatch.matched) {
    return namePositionMatch;
  }

  // Step 4: Try fuzzy name matching
  const fuzzyMatch = await matchByFuzzyName(
    incoming.name,
    incoming.position,
    incoming.team
  );
  if (fuzzyMatch.matched) {
    return fuzzyMatch;
  }

  // Step 5: No match found - create new identity candidate
  return {
    matched: false,
    player_id: null,
    confidence: 0,
    method: 'no_match',
    should_create: true,
  };
}

/**
 * Match by external ID (highest confidence)
 */
async function matchByExternalId(
  incoming: IncomingPlayer
): Promise<MatchResult> {
  const conditions: string[] = [];

  if (incoming.sleeper_id) {
    const { data, error } = await supabase
      .from('player_identity')
      .select('*')
      .eq('sleeper_id', incoming.sleeper_id)
      .maybeSingle();

    if (!error && data) {
      return {
        matched: true,
        player_id: data.player_id,
        confidence: 1.0,
        method: 'sleeper_id',
        existing_player: data,
        should_create: false,
      };
    }
  }

  if (incoming.espn_id) {
    const { data, error } = await supabase
      .from('player_identity')
      .select('*')
      .eq('espn_id', incoming.espn_id)
      .maybeSingle();

    if (!error && data) {
      return {
        matched: true,
        player_id: data.player_id,
        confidence: 1.0,
        method: 'espn_id',
        existing_player: data,
        should_create: false,
      };
    }
  }

  if (incoming.gsis_id) {
    const { data, error } = await supabase
      .from('player_identity')
      .select('*')
      .eq('gsis_id', incoming.gsis_id)
      .maybeSingle();

    if (!error && data) {
      return {
        matched: true,
        player_id: data.player_id,
        confidence: 1.0,
        method: 'gsis_id',
        existing_player: data,
        should_create: false,
      };
    }
  }

  if (incoming.fantasypros_id) {
    const { data, error } = await supabase
      .from('player_identity')
      .select('*')
      .eq('fantasypros_id', incoming.fantasypros_id)
      .maybeSingle();

    if (!error && data) {
      return {
        matched: true,
        player_id: data.player_id,
        confidence: 1.0,
        method: 'fantasypros_id',
        existing_player: data,
        should_create: false,
      };
    }
  }

  return {
    matched: false,
    player_id: null,
    confidence: 0,
    method: 'no_external_id_match',
    should_create: false,
  };
}

/**
 * Match by normalized name + team
 */
async function matchByNameAndTeam(
  name: string,
  team: string,
  position: string
): Promise<MatchResult> {
  const normalized = normalizeName(name);

  const { data, error } = await supabase
    .from('player_identity')
    .select('*')
    .eq('normalized_name', normalized)
    .eq('team', team)
    .eq('position', position);

  if (error || !data || data.length === 0) {
    return {
      matched: false,
      player_id: null,
      confidence: 0,
      method: 'name_team_no_match',
      should_create: false,
    };
  }

  if (data.length === 1) {
    return {
      matched: true,
      player_id: data[0].player_id,
      confidence: 0.98,
      method: 'name_team_position',
      existing_player: data[0],
      should_create: false,
    };
  }

  // Multiple matches - conflict
  return {
    matched: false,
    player_id: null,
    confidence: 0,
    method: 'name_team_multiple_matches',
    should_create: false,
    conflicts: data.map((p) => ({
      player_id: p.player_id,
      reason: 'Multiple players with same name/team/position',
      confidence: 0.8,
    })),
  };
}

/**
 * Match by normalized name + position
 */
async function matchByNameAndPosition(
  name: string,
  position: string
): Promise<MatchResult> {
  const normalized = normalizeName(name);

  const { data, error } = await supabase
    .from('player_identity')
    .select('*')
    .eq('normalized_name', normalized)
    .eq('position', position);

  if (error || !data || data.length === 0) {
    return {
      matched: false,
      player_id: null,
      confidence: 0,
      method: 'name_position_no_match',
      should_create: false,
    };
  }

  if (data.length === 1) {
    return {
      matched: true,
      player_id: data[0].player_id,
      confidence: 0.95,
      method: 'name_position',
      existing_player: data[0],
      should_create: false,
    };
  }

  // Multiple matches - could be same-name players at different teams
  // Don't match without team confirmation
  return {
    matched: false,
    player_id: null,
    confidence: 0,
    method: 'name_position_multiple_matches',
    should_create: false,
    conflicts: data.map((p) => ({
      player_id: p.player_id,
      reason: 'Multiple players with same name/position',
      confidence: 0.6,
    })),
  };
}

/**
 * Match by fuzzy name similarity
 */
async function matchByFuzzyName(
  name: string,
  position: string,
  team?: string
): Promise<MatchResult> {
  const normalized = normalizeName(name);
  const parsed = getNormalizedName(name);

  // Get candidates with same position and similar last name
  const { data, error } = await supabase
    .from('player_identity')
    .select('*')
    .eq('position', position)
    .ilike('normalized_name', `%${parsed.lastName}%`)
    .limit(50);

  if (error || !data || data.length === 0) {
    return {
      matched: false,
      player_id: null,
      confidence: 0,
      method: 'fuzzy_no_match',
      should_create: false,
    };
  }

  // Score each candidate
  const scoredCandidates = data
    .map((candidate) => {
      const matchScore = scoreNameMatch(name, candidate.full_name);
      let finalScore = matchScore.score;

      // Boost score if team matches
      if (team && candidate.team === team) {
        finalScore = Math.min(1.0, finalScore + 0.05);
      }

      return {
        ...candidate,
        matchScore: finalScore,
        matchReason: matchScore.reason,
        matchConfidence: matchScore.confidence,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const bestMatch = scoredCandidates[0];

  // Require high confidence for fuzzy match (0.92+)
  if (bestMatch.matchScore >= 0.92) {
    // Check if there are other close matches (ambiguous)
    const closeMatches = scoredCandidates.filter(
      (c) => c.matchScore >= 0.90 && c.player_id !== bestMatch.player_id
    );

    if (closeMatches.length > 0) {
      // Ambiguous match
      return {
        matched: false,
        player_id: null,
        confidence: bestMatch.matchScore,
        method: 'fuzzy_ambiguous',
        should_create: false,
        conflicts: [bestMatch, ...closeMatches].map((c) => ({
          player_id: c.player_id,
          reason: `Fuzzy match: ${c.matchReason}`,
          confidence: c.matchScore,
        })),
      };
    }

    return {
      matched: true,
      player_id: bestMatch.player_id,
      confidence: bestMatch.matchScore,
      method: 'fuzzy_high_confidence',
      existing_player: bestMatch,
      should_create: false,
    };
  }

  // Low confidence fuzzy matches
  if (bestMatch.matchScore >= 0.85) {
    return {
      matched: false,
      player_id: null,
      confidence: bestMatch.matchScore,
      method: 'fuzzy_low_confidence',
      should_create: false,
      conflicts: [
        {
          player_id: bestMatch.player_id,
          reason: `Possible match: ${bestMatch.matchReason}`,
          confidence: bestMatch.matchScore,
        },
      ],
    };
  }

  return {
    matched: false,
    player_id: null,
    confidence: 0,
    method: 'fuzzy_no_match',
    should_create: false,
  };
}

/**
 * Create or update player identity
 */
export async function upsertPlayerIdentity(
  incoming: IncomingPlayer
): Promise<{ player_id: string; created: boolean }> {
  // Try to match existing player
  const matchResult = await matchIncomingPlayer(incoming);

  if (matchResult.matched && matchResult.player_id) {
    // Update existing player with new information
    const updates: Partial<PlayerIdentity> = {
      last_seen_source: incoming.source,
      last_seen_at: new Date().toISOString(),
    };

    // Add any missing external IDs
    if (incoming.sleeper_id && !matchResult.existing_player?.sleeper_id) {
      updates.sleeper_id = incoming.sleeper_id;
    }
    if (incoming.espn_id && !matchResult.existing_player?.espn_id) {
      updates.espn_id = incoming.espn_id;
    }
    if (incoming.gsis_id && !matchResult.existing_player?.gsis_id) {
      updates.gsis_id = incoming.gsis_id;
    }
    if (
      incoming.fantasypros_id &&
      !matchResult.existing_player?.fantasypros_id
    ) {
      updates.fantasypros_id = incoming.fantasypros_id;
    }

    // Update team if changed
    if (incoming.team && incoming.team !== matchResult.existing_player?.team) {
      updates.team = incoming.team;
    }

    await supabase
      .from('player_identity')
      .update(updates)
      .eq('player_id', matchResult.player_id);

    return {
      player_id: matchResult.player_id,
      created: false,
    };
  }

  if (matchResult.conflicts && matchResult.conflicts.length > 0) {
    // Don't auto-create if there are conflicts
    throw new Error(
      `Cannot create player: Conflicts detected for ${incoming.name}`
    );
  }

  // Create new player identity
  const { data, error } = await supabase
    .from('player_identity')
    .insert({
      sleeper_id: incoming.sleeper_id,
      espn_id: incoming.espn_id,
      gsis_id: incoming.gsis_id,
      fantasypros_id: incoming.fantasypros_id,
      full_name: incoming.name,
      normalized_name: normalizeName(incoming.name),
      birth_date: incoming.birth_date,
      birth_year: incoming.birth_year,
      team: incoming.team,
      position: incoming.position,
      status: 'active',
      last_seen_source: incoming.source,
      last_seen_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    player_id: data.player_id,
    created: true,
  };
}

/**
 * Batch match players
 */
export async function batchMatchPlayers(
  players: IncomingPlayer[]
): Promise<
  Array<{
    incoming: IncomingPlayer;
    match: MatchResult;
  }>
> {
  const results = await Promise.all(
    players.map(async (player) => ({
      incoming: player,
      match: await matchIncomingPlayer(player),
    }))
  );

  return results;
}

/**
 * Get match statistics
 */
export function getMatchStatistics(results: MatchResult[]): {
  totalPlayers: number;
  matched: number;
  unmatched: number;
  conflicts: number;
  matchRates: Record<string, number>;
} {
  const stats = {
    totalPlayers: results.length,
    matched: 0,
    unmatched: 0,
    conflicts: 0,
    matchRates: {} as Record<string, number>,
  };

  for (const result of results) {
    if (result.matched) {
      stats.matched++;
      stats.matchRates[result.method] =
        (stats.matchRates[result.method] || 0) + 1;
    } else if (result.conflicts && result.conflicts.length > 0) {
      stats.conflicts++;
    } else {
      stats.unmatched++;
    }
  }

  return stats;
}
