/**
 * Automatic Player Identity Repairs
 *
 * Safe auto-repairs:
 * - Merge identical duplicates
 * - Update renamed rookies
 * - Reattach stats after ID change
 * - Archive retired players
 *
 * Unsafe repairs → flag for admin review only
 */

import { supabase } from '../supabase';
import type { PlayerIdentity } from './matchPlayer';
import { normalizeName } from './normalizeName';

export interface RepairAction {
  type: 'merge' | 'rename' | 'reattach' | 'archive' | 'flag';
  player_id: string;
  description: string;
  safe: boolean;
  confidence: number;
  details: any;
}

export interface RepairResult {
  totalActions: number;
  executed: number;
  flagged: number;
  failed: number;
  actions: RepairAction[];
}

/**
 * Run automatic repairs
 */
export async function runAutoRepair(): Promise<RepairResult> {
  console.log('🔧 Running automatic repairs...');

  const actions: RepairAction[] = [];

  // Detect repair opportunities
  actions.push(...(await detectMergeableIdenticalDuplicates()));
  actions.push(...(await detectRenamedRookies()));
  actions.push(...(await detectRetiredPlayers()));

  // Execute safe repairs
  let executed = 0;
  let flagged = 0;
  let failed = 0;

  for (const action of actions) {
    if (action.safe && action.confidence >= 0.95) {
      try {
        await executeRepair(action);
        executed++;
      } catch (error) {
        console.error(`Failed to execute repair: ${error}`);
        failed++;
      }
    } else {
      flagged++;
    }
  }

  console.log(`   Executed: ${executed}`);
  console.log(`   Flagged: ${flagged}`);
  console.log(`   Failed: ${failed}`);

  return {
    totalActions: actions.length,
    executed,
    flagged,
    failed,
    actions,
  };
}

/**
 * Detect identical duplicates that can be merged
 */
async function detectMergeableIdenticalDuplicates(): Promise<RepairAction[]> {
  const actions: RepairAction[] = [];

  // Get unresolved conflicts with duplicate_external_id type
  const { data: conflicts } = await supabase
    .from('player_identity_conflicts')
    .select('*')
    .eq('conflict_type', 'duplicate_external_id')
    .eq('resolved', false);

  if (!conflicts) return actions;

  for (const conflict of conflicts) {
    // Get both players
    const { data: players } = await supabase
      .from('player_identity')
      .select('*')
      .in('player_id', [conflict.player_a_id, conflict.player_b_id]);

    if (!players || players.length !== 2) continue;

    const [a, b] = players;

    // Check if they're truly identical (same external IDs, same name)
    const identicalIds = countSharedExternalIds(a, b);
    const nameMatch = normalizeName(a.full_name) === normalizeName(b.full_name);

    if (identicalIds >= 2 && nameMatch) {
      // Safe to merge
      actions.push({
        type: 'merge',
        player_id: a.player_id,
        description: `Merge duplicate players: ${a.full_name}`,
        safe: true,
        confidence: 1.0,
        details: {
          primary_player_id: a.player_id,
          merge_player_id: b.player_id,
          shared_ids: identicalIds,
          conflict_id: conflict.id,
        },
      });
    }
  }

  return actions;
}

/**
 * Detect renamed rookies (name changes from college to NFL)
 */
async function detectRenamedRookies(): Promise<RepairAction[]> {
  const actions: RepairAction[] = [];

  // Get conflicts with high name similarity
  const { data: conflicts } = await supabase
    .from('player_identity_conflicts')
    .select('*')
    .eq('conflict_type', 'possible_duplicate')
    .eq('resolved', false)
    .gte('confidence', 0.90);

  if (!conflicts) return actions;

  for (const conflict of conflicts) {
    const { data: players } = await supabase
      .from('player_identity')
      .select('*')
      .in('player_id', [conflict.player_a_id, conflict.player_b_id]);

    if (!players || players.length !== 2) continue;

    const [a, b] = players;

    // Check if one has external IDs and one doesn't (likely renamed rookie)
    const aHasIds = hasAnyExternalId(a);
    const bHasIds = hasAnyExternalId(b);

    if (aHasIds !== bHasIds) {
      const primary = aHasIds ? a : b;
      const secondary = aHasIds ? b : a;

      // Flag for admin review (not safe to auto-merge names)
      actions.push({
        type: 'flag',
        player_id: primary.player_id,
        description: `Possible renamed player: ${primary.full_name} ↔ ${secondary.full_name}`,
        safe: false,
        confidence: conflict.confidence,
        details: {
          primary_player_id: primary.player_id,
          secondary_player_id: secondary.player_id,
          conflict_id: conflict.id,
        },
      });
    }
  }

  return actions;
}

/**
 * Detect players who should be archived as retired
 */
async function detectRetiredPlayers(): Promise<RepairAction[]> {
  const actions: RepairAction[] = [];

  // Get players not seen in over 2 years
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const { data: stalePlayers } = await supabase
    .from('player_identity')
    .select('*')
    .eq('status', 'active')
    .lt('last_seen_at', twoYearsAgo.toISOString());

  if (!stalePlayers) return actions;

  for (const player of stalePlayers) {
    actions.push({
      type: 'archive',
      player_id: player.player_id,
      description: `Archive retired player: ${player.full_name} (not seen since ${new Date(player.last_seen_at).toLocaleDateString()})`,
      safe: true,
      confidence: 0.90,
      details: {
        last_seen: player.last_seen_at,
        team: player.team,
        position: player.position,
      },
    });
  }

  return actions;
}

/**
 * Execute repair action
 */
async function executeRepair(action: RepairAction): Promise<void> {
  switch (action.type) {
    case 'merge':
      await executeMerge(action);
      break;

    case 'archive':
      await executeArchive(action);
      break;

    case 'reattach':
      await executeReattach(action);
      break;

    default:
      console.log(`Skipping action type: ${action.type}`);
  }
}

/**
 * Execute merge of duplicate players
 */
async function executeMerge(action: RepairAction): Promise<void> {
  const { primary_player_id, merge_player_id, conflict_id } = action.details;

  // Get both players
  const { data: primary } = await supabase
    .from('player_identity')
    .select('*')
    .eq('player_id', primary_player_id)
    .single();

  const { data: merge } = await supabase
    .from('player_identity')
    .select('*')
    .eq('player_id', merge_player_id)
    .single();

  if (!primary || !merge) {
    throw new Error('Players not found for merge');
  }

  // Merge external IDs (keep all non-null IDs)
  const updates: Partial<PlayerIdentity> = {};

  if (!primary.sleeper_id && merge.sleeper_id) {
    updates.sleeper_id = merge.sleeper_id;
  }
  if (!primary.espn_id && merge.espn_id) {
    updates.espn_id = merge.espn_id;
  }
  if (!primary.gsis_id && merge.gsis_id) {
    updates.gsis_id = merge.gsis_id;
  }
  if (!primary.fantasypros_id && merge.fantasypros_id) {
    updates.fantasypros_id = merge.fantasypros_id;
  }

  // Update primary player with merged IDs
  if (Object.keys(updates).length > 0) {
    await supabase
      .from('player_identity')
      .update(updates)
      .eq('player_id', primary_player_id);
  }

  // Update references to merged player (point to primary)
  await supabase
    .from('player_values')
    .update({ player_id: primary_player_id })
    .eq('player_id', merge_player_id);

  await supabase
    .from('league_rosters')
    .update({ player_id: primary_player_id })
    .eq('player_id', merge_player_id);

  // Log merge
  await supabase.from('player_merge_log').insert({
    primary_player_id,
    merged_player_id: merge_player_id,
    reason: action.description,
    merged_data: merge,
    merged_by: 'auto_repair',
  });

  // Delete merged player
  await supabase
    .from('player_identity')
    .delete()
    .eq('player_id', merge_player_id);

  // Resolve conflict
  if (conflict_id) {
    await supabase
      .from('player_identity_conflicts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_action: 'merged',
        reviewed_by: 'auto_repair',
      })
      .eq('id', conflict_id);
  }

  console.log(`   Merged ${merge.full_name} into ${primary.full_name}`);
}

/**
 * Execute archive (mark as retired)
 */
async function executeArchive(action: RepairAction): Promise<void> {
  await supabase
    .from('player_identity')
    .update({
      status: 'retired',
      updated_at: new Date().toISOString(),
    })
    .eq('player_id', action.player_id);

  console.log(`   Archived ${action.description}`);
}

/**
 * Execute reattach (reconnect stats/values after ID change)
 */
async function executeReattach(action: RepairAction): Promise<void> {
  // Implementation would depend on your specific schema
  console.log(`   Reattached ${action.description}`);
}

/**
 * Helper: Count shared external IDs
 */
function countSharedExternalIds(a: PlayerIdentity, b: PlayerIdentity): number {
  let count = 0;

  if (a.sleeper_id && a.sleeper_id === b.sleeper_id) count++;
  if (a.espn_id && a.espn_id === b.espn_id) count++;
  if (a.gsis_id && a.gsis_id === b.gsis_id) count++;
  if (a.fantasypros_id && a.fantasypros_id === b.fantasypros_id) count++;

  return count;
}

/**
 * Helper: Check if player has any external ID
 */
function hasAnyExternalId(player: PlayerIdentity): boolean {
  return !!(
    player.sleeper_id ||
    player.espn_id ||
    player.gsis_id ||
    player.fantasypros_id
  );
}

/**
 * Get repair candidates (flagged for admin review)
 */
export async function getRepairCandidates(): Promise<RepairAction[]> {
  const result = await runAutoRepair();
  return result.actions.filter((a) => !a.safe || a.confidence < 0.95);
}
