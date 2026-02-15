/**
 * Duplicate Player Detection
 *
 * Detects potential duplicate players and identity conflicts:
 * - Same normalized name + same birth year
 * - Same external ID attached to multiple players
 * - Drastic position changes (WR → DB)
 * - Same name at same team but different IDs
 *
 * Blocks rebuild if high confidence conflicts found.
 */

import { supabase } from '../supabase';
import { nameSimilarity, scoreNameMatch } from './normalizeName';
import type { PlayerIdentity } from './matchPlayer';

export interface DuplicateConflict {
  player_a_id: string;
  player_b_id: string;
  conflict_type: string;
  reason: string;
  confidence: number;
  player_a: PlayerIdentity;
  player_b: PlayerIdentity;
}

export interface DuplicateDetectionResult {
  conflicts: DuplicateConflict[];
  highConfidence: DuplicateConflict[];
  mediumConfidence: DuplicateConflict[];
  lowConfidence: DuplicateConflict[];
  shouldBlockRebuild: boolean;
}

const OFFENSIVE_POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const DEFENSIVE_POSITIONS = ['DL', 'LB', 'DB'];

/**
 * Detect all duplicate players
 */
export async function detectDuplicatePlayers(): Promise<DuplicateDetectionResult> {
  const conflicts: DuplicateConflict[] = [];

  // Run all detection checks
  conflicts.push(...(await detectSameNameBirthYear()));
  conflicts.push(...(await detectDuplicateExternalIds()));
  conflicts.push(...(await detectPositionConflicts()));
  conflicts.push(...(await detectSameTeamNameConflicts()));
  conflicts.push(...(await detectFuzzyDuplicates()));

  // Categorize by confidence
  const highConfidence = conflicts.filter((c) => c.confidence >= 0.9);
  const mediumConfidence = conflicts.filter(
    (c) => c.confidence >= 0.7 && c.confidence < 0.9
  );
  const lowConfidence = conflicts.filter((c) => c.confidence < 0.7);

  // Block rebuild if high confidence conflicts exist
  const shouldBlockRebuild = highConfidence.length > 0;

  return {
    conflicts,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    shouldBlockRebuild,
  };
}

/**
 * Detect players with same normalized name and birth year
 */
async function detectSameNameBirthYear(): Promise<DuplicateConflict[]> {
  const { data: players, error } = await supabase
    .from('player_identity')
    .select('*')
    .not('birth_year', 'is', null)
    .eq('status', 'active')
    .order('normalized_name');

  if (error || !players) return [];

  const conflicts: DuplicateConflict[] = [];
  const nameYearMap = new Map<string, PlayerIdentity[]>();

  // Group by normalized name + birth year
  for (const player of players) {
    const key = `${player.normalized_name}_${player.birth_year}`;
    if (!nameYearMap.has(key)) {
      nameYearMap.set(key, []);
    }
    nameYearMap.get(key)!.push(player);
  }

  // Find duplicates
  for (const [key, group] of nameYearMap.entries()) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];

          // Check if they share any external IDs
          const sharedIds = getSharedExternalIds(a, b);

          conflicts.push({
            player_a_id: a.player_id,
            player_b_id: b.player_id,
            conflict_type: 'duplicate_name',
            reason: `Same name "${a.full_name}" and birth year ${a.birth_year}${
              sharedIds.length > 0 ? ` (shared IDs: ${sharedIds.join(', ')})` : ''
            }`,
            confidence: sharedIds.length > 0 ? 0.99 : 0.95,
            player_a: a,
            player_b: b,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect same external ID attached to multiple players
 */
async function detectDuplicateExternalIds(): Promise<DuplicateConflict[]> {
  const conflicts: DuplicateConflict[] = [];

  // Check each external ID type
  const idFields = ['sleeper_id', 'espn_id', 'gsis_id', 'fantasypros_id'];

  for (const field of idFields) {
    const { data: players, error } = await supabase
      .from('player_identity')
      .select('*')
      .not(field, 'is', null)
      .order(field);

    if (error || !players) continue;

    // Group by ID
    const idMap = new Map<string, PlayerIdentity[]>();

    for (const player of players) {
      const id = (player as any)[field];
      if (!id) continue;

      if (!idMap.has(id)) {
        idMap.set(id, []);
      }
      idMap.get(id)!.push(player);
    }

    // Find duplicates
    for (const [id, group] of idMap.entries()) {
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];

            conflicts.push({
              player_a_id: a.player_id,
              player_b_id: b.player_id,
              conflict_type: 'duplicate_external_id',
              reason: `Same ${field}: ${id}`,
              confidence: 1.0,
              player_a: a,
              player_b: b,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect drastic position changes (WR → DB)
 */
async function detectPositionConflicts(): Promise<DuplicateConflict[]> {
  const { data: players, error } = await supabase
    .from('player_identity')
    .select('*')
    .eq('status', 'active')
    .order('normalized_name');

  if (error || !players) return [];

  const conflicts: DuplicateConflict[] = [];
  const nameMap = new Map<string, PlayerIdentity[]>();

  // Group by normalized name
  for (const player of players) {
    if (!nameMap.has(player.normalized_name)) {
      nameMap.set(player.normalized_name, []);
    }
    nameMap.get(player.normalized_name)!.push(player);
  }

  // Find position conflicts
  for (const [name, group] of nameMap.entries()) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];

          // Check if positions are in different groups
          const aOffensive = OFFENSIVE_POSITIONS.includes(a.position);
          const bOffensive = OFFENSIVE_POSITIONS.includes(b.position);
          const aDefensive = DEFENSIVE_POSITIONS.includes(a.position);
          const bDefensive = DEFENSIVE_POSITIONS.includes(b.position);

          if (
            (aOffensive && bDefensive) ||
            (aDefensive && bOffensive)
          ) {
            conflicts.push({
              player_a_id: a.player_id,
              player_b_id: b.player_id,
              conflict_type: 'position_mismatch',
              reason: `Same name "${a.full_name}" but drastically different positions: ${a.position} vs ${b.position}`,
              confidence: 0.85,
              player_a: a,
              player_b: b,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect same name at same team but different player IDs
 */
async function detectSameTeamNameConflicts(): Promise<DuplicateConflict[]> {
  const { data: players, error } = await supabase
    .from('player_identity')
    .select('*')
    .eq('status', 'active')
    .not('team', 'is', null)
    .order('team');

  if (error || !players) return [];

  const conflicts: DuplicateConflict[] = [];
  const teamNameMap = new Map<string, PlayerIdentity[]>();

  // Group by team + normalized name
  for (const player of players) {
    const key = `${player.team}_${player.normalized_name}`;
    if (!teamNameMap.has(key)) {
      teamNameMap.set(key, []);
    }
    teamNameMap.get(key)!.push(player);
  }

  // Find duplicates
  for (const [key, group] of teamNameMap.entries()) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];

          conflicts.push({
            player_a_id: a.player_id,
            player_b_id: b.player_id,
            conflict_type: 'team_mismatch',
            reason: `Same name "${a.full_name}" at same team ${a.team}`,
            confidence: 0.98,
            player_a: a,
            player_b: b,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect fuzzy name duplicates
 */
async function detectFuzzyDuplicates(): Promise<DuplicateConflict[]> {
  const { data: players, error } = await supabase
    .from('player_identity')
    .select('*')
    .eq('status', 'active')
    .order('position');

  if (error || !players) return [];

  const conflicts: DuplicateConflict[] = [];

  // Group by position to reduce comparisons
  const positionMap = new Map<string, PlayerIdentity[]>();

  for (const player of players) {
    if (!positionMap.has(player.position)) {
      positionMap.set(player.position, []);
    }
    positionMap.get(player.position)!.push(player);
  }

  // Compare within each position group
  for (const [position, group] of positionMap.entries()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];

        // Skip if already detected via other methods
        const sharedIds = getSharedExternalIds(a, b);
        if (sharedIds.length > 0) continue;

        // Check name similarity
        const matchScore = scoreNameMatch(a.full_name, b.full_name);

        if (matchScore.score >= 0.90 && matchScore.score < 0.99) {
          // Similar but not exact match
          let confidence = matchScore.score;

          // Boost confidence if team matches
          if (a.team && b.team && a.team === b.team) {
            confidence = Math.min(1.0, confidence + 0.05);
          }

          // Boost confidence if birth years match
          if (
            a.birth_year &&
            b.birth_year &&
            a.birth_year === b.birth_year
          ) {
            confidence = Math.min(1.0, confidence + 0.03);
          }

          conflicts.push({
            player_a_id: a.player_id,
            player_b_id: b.player_id,
            conflict_type: 'possible_duplicate',
            reason: `Similar names: "${a.full_name}" vs "${b.full_name}" (${matchScore.reason})`,
            confidence,
            player_a: a,
            player_b: b,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Get shared external IDs between two players
 */
function getSharedExternalIds(a: PlayerIdentity, b: PlayerIdentity): string[] {
  const shared: string[] = [];

  if (a.sleeper_id && a.sleeper_id === b.sleeper_id) {
    shared.push('sleeper_id');
  }
  if (a.espn_id && a.espn_id === b.espn_id) {
    shared.push('espn_id');
  }
  if (a.gsis_id && a.gsis_id === b.gsis_id) {
    shared.push('gsis_id');
  }
  if (a.fantasypros_id && a.fantasypros_id === b.fantasypros_id) {
    shared.push('fantasypros_id');
  }

  return shared;
}

/**
 * Save conflicts to database
 */
export async function saveConflicts(
  conflicts: DuplicateConflict[]
): Promise<void> {
  // Get existing conflicts
  const { data: existingConflicts } = await supabase
    .from('player_identity_conflicts')
    .select('player_a_id, player_b_id, resolved')
    .eq('resolved', false);

  const existingSet = new Set(
    (existingConflicts || []).map(
      (c) => `${c.player_a_id}_${c.player_b_id}`
    )
  );

  // Filter out already-saved conflicts
  const newConflicts = conflicts.filter((c) => {
    const key1 = `${c.player_a_id}_${c.player_b_id}`;
    const key2 = `${c.player_b_id}_${c.player_a_id}`;
    return !existingSet.has(key1) && !existingSet.has(key2);
  });

  if (newConflicts.length === 0) return;

  // Insert new conflicts
  await supabase.from('player_identity_conflicts').insert(
    newConflicts.map((c) => ({
      player_a_id: c.player_a_id,
      player_b_id: c.player_b_id,
      conflict_type: c.conflict_type,
      reason: c.reason,
      confidence: c.confidence,
      resolved: false,
    }))
  );
}

/**
 * Run duplicate detection and save results
 */
export async function runDuplicateDetection(): Promise<DuplicateDetectionResult> {
  console.log('🔍 Running duplicate player detection...');

  const result = await detectDuplicatePlayers();

  console.log(`   Found ${result.conflicts.length} potential conflicts`);
  console.log(`   High confidence: ${result.highConfidence.length}`);
  console.log(`   Medium confidence: ${result.mediumConfidence.length}`);
  console.log(`   Low confidence: ${result.lowConfidence.length}`);

  // Save conflicts to database
  await saveConflicts(result.conflicts);

  if (result.shouldBlockRebuild) {
    console.warn('⚠️  HIGH CONFIDENCE CONFLICTS DETECTED - REBUILD BLOCKED');
    result.highConfidence.forEach((c) => {
      console.warn(`   ${c.reason}`);
    });
  }

  return result;
}

/**
 * Get unresolved conflicts
 */
export async function getUnresolvedConflicts(): Promise<
  Array<{
    id: string;
    player_a_id: string;
    player_b_id: string;
    conflict_type: string;
    reason: string;
    confidence: number;
    detected_at: string;
    player_a: PlayerIdentity | null;
    player_b: PlayerIdentity | null;
  }>
> {
  const { data: conflicts, error } = await supabase
    .from('player_identity_conflicts')
    .select('*')
    .eq('resolved', false)
    .order('confidence', { ascending: false });

  if (error || !conflicts) return [];

  // Fetch player details
  const results = await Promise.all(
    conflicts.map(async (conflict) => {
      const { data: playerA } = await supabase
        .from('player_identity')
        .select('*')
        .eq('player_id', conflict.player_a_id)
        .maybeSingle();

      const { data: playerB } = await supabase
        .from('player_identity')
        .select('*')
        .eq('player_id', conflict.player_b_id)
        .maybeSingle();

      return {
        ...conflict,
        player_a: playerA,
        player_b: playerB,
      };
    })
  );

  return results;
}

/**
 * Resolve conflict (mark as reviewed)
 */
export async function resolveConflict(
  conflictId: string,
  action: string,
  reviewedBy: string
): Promise<void> {
  await supabase
    .from('player_identity_conflicts')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolution_action: action,
      reviewed_by: reviewedBy,
    })
    .eq('id', conflictId);
}
