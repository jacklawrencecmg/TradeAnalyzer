/**
 * Player Data Reconciliation
 *
 * When different data sources disagree about team/position:
 * - Use priority order: Official roster > league provider > ranking > market
 * - Handle EDGE position cases (DL/LB hybrids)
 * - Track changes in history
 * - Never silently overwrite without confidence
 */

import { supabase } from '../supabase';
import type { PlayerIdentity } from './matchPlayer';

export type DataSource =
  | 'official_roster'
  | 'sleeper'
  | 'espn'
  | 'fantasypros'
  | 'ktc'
  | 'user_input'
  | 'unknown';

export interface PlayerUpdate {
  player_id: string;
  team?: string;
  position?: string;
  sub_position?: string;
  source: DataSource;
  confidence: number;
}

export interface ReconciliationResult {
  updated: boolean;
  changes: Array<{
    field: string;
    old_value: any;
    new_value: any;
    reason: string;
  }>;
  rejected: Array<{
    field: string;
    attempted_value: any;
    reason: string;
  }>;
}

/**
 * Data source priority (higher = more authoritative)
 */
const SOURCE_PRIORITY: Record<DataSource, number> = {
  official_roster: 100,
  sleeper: 80,
  espn: 80,
  fantasypros: 60,
  ktc: 60,
  user_input: 40,
  unknown: 0,
};

/**
 * EDGE positions (can be DL or LB depending on scheme)
 */
const EDGE_POSITIONS = new Set(['EDGE', 'DE', 'OLB']);

/**
 * Position groups
 */
const POSITION_GROUPS = {
  offense: new Set(['QB', 'RB', 'WR', 'TE', 'K']),
  defense: new Set(['DL', 'LB', 'DB']),
  special: new Set(['K', 'P']),
};

/**
 * Reconcile player data from multiple sources
 */
export async function reconcilePlayerData(
  player_id: string,
  updates: PlayerUpdate
): Promise<ReconciliationResult> {
  // Get current player state
  const { data: current, error } = await supabase
    .from('player_identity')
    .select('*')
    .eq('player_id', player_id)
    .single();

  if (error || !current) {
    throw new Error(`Player ${player_id} not found`);
  }

  const changes: ReconciliationResult['changes'] = [];
  const rejected: ReconciliationResult['rejected'] = [];

  // Reconcile team
  if (updates.team && updates.team !== current.team) {
    const shouldUpdate = shouldUpdateField(
      current.last_seen_source as DataSource,
      updates.source,
      updates.confidence
    );

    if (shouldUpdate) {
      changes.push({
        field: 'team',
        old_value: current.team,
        new_value: updates.team,
        reason: `Source ${updates.source} (priority ${SOURCE_PRIORITY[updates.source]}) > ${current.last_seen_source}`,
      });
    } else {
      rejected.push({
        field: 'team',
        attempted_value: updates.team,
        reason: `Source ${updates.source} has lower priority than ${current.last_seen_source}`,
      });
    }
  }

  // Reconcile position
  if (updates.position && updates.position !== current.position) {
    const positionUpdate = reconcilePosition(
      current,
      updates.position,
      updates.sub_position,
      updates.source,
      updates.confidence
    );

    if (positionUpdate.allowed) {
      changes.push({
        field: 'position',
        old_value: {
          position: current.position,
          sub_position: current.sub_position,
        },
        new_value: {
          position: updates.position,
          sub_position: updates.sub_position,
        },
        reason: positionUpdate.reason,
      });
    } else {
      rejected.push({
        field: 'position',
        attempted_value: {
          position: updates.position,
          sub_position: updates.sub_position,
        },
        reason: positionUpdate.reason,
      });
    }
  }

  // Apply changes if any
  if (changes.length > 0) {
    const updateData: Partial<PlayerIdentity> = {
      last_seen_source: updates.source,
      last_seen_at: new Date().toISOString(),
    };

    for (const change of changes) {
      if (change.field === 'team') {
        updateData.team = change.new_value;
      } else if (change.field === 'position') {
        updateData.position = change.new_value.position;
        updateData.sub_position = change.new_value.sub_position;
      }
    }

    await supabase
      .from('player_identity')
      .update(updateData)
      .eq('player_id', player_id);
  }

  return {
    updated: changes.length > 0,
    changes,
    rejected,
  };
}

/**
 * Determine if field should be updated based on source priority
 */
function shouldUpdateField(
  currentSource: DataSource | null,
  newSource: DataSource,
  confidence: number
): boolean {
  if (!currentSource) return true;

  const currentPriority = SOURCE_PRIORITY[currentSource] || 0;
  const newPriority = SOURCE_PRIORITY[newSource] || 0;

  // New source has higher priority
  if (newPriority > currentPriority) return true;

  // Same priority - require high confidence
  if (newPriority === currentPriority && confidence >= 0.95) return true;

  return false;
}

/**
 * Reconcile position changes (handles EDGE cases)
 */
function reconcilePosition(
  current: PlayerIdentity,
  newPosition: string,
  newSubPosition: string | undefined,
  source: DataSource,
  confidence: number
): { allowed: boolean; reason: string } {
  const currentPos = current.position;
  const currentSubPos = current.sub_position;

  // Same position - allow
  if (newPosition === currentPos) {
    if (newSubPosition && newSubPosition !== currentSubPos) {
      return {
        allowed: true,
        reason: 'Sub-position update',
      };
    }
    return {
      allowed: false,
      reason: 'No change needed',
    };
  }

  // Check if position change crosses offense/defense boundary
  const currentGroup = getPositionGroup(currentPos);
  const newGroup = getPositionGroup(newPosition);

  if (
    currentGroup &&
    newGroup &&
    currentGroup !== newGroup &&
    currentGroup !== 'special' &&
    newGroup !== 'special'
  ) {
    // Drastic position change (e.g., WR → DB)
    // Only allow with official roster source and high confidence
    if (source === 'official_roster' && confidence >= 0.95) {
      return {
        allowed: true,
        reason: 'Official roster confirms position group change',
      };
    }

    return {
      allowed: false,
      reason: `Position group change (${currentGroup} → ${newGroup}) requires official confirmation`,
    };
  }

  // Handle EDGE position cases
  if (EDGE_POSITIONS.has(currentSubPos || '')) {
    // Player is currently labeled as EDGE
    if (newPosition === 'DL' || newPosition === 'LB') {
      return {
        allowed: true,
        reason: `EDGE player scheme change to ${newPosition}`,
      };
    }
  }

  if (EDGE_POSITIONS.has(newSubPosition || '')) {
    // New data says player is EDGE
    if (currentPos === 'DL' || currentPos === 'LB') {
      return {
        allowed: true,
        reason: `Scheme change to EDGE from ${currentPos}`,
      };
    }
  }

  // Check source priority
  const shouldUpdate = shouldUpdateField(
    current.last_seen_source as DataSource,
    source,
    confidence
  );

  if (shouldUpdate) {
    return {
      allowed: true,
      reason: `Source ${source} has priority`,
    };
  }

  return {
    allowed: false,
    reason: `Source ${source} has insufficient priority for position change`,
  };
}

/**
 * Get position group
 */
function getPositionGroup(
  position: string
): 'offense' | 'defense' | 'special' | null {
  if (POSITION_GROUPS.offense.has(position)) return 'offense';
  if (POSITION_GROUPS.defense.has(position)) return 'defense';
  if (POSITION_GROUPS.special.has(position)) return 'special';
  return null;
}

/**
 * Batch reconcile multiple players
 */
export async function batchReconcilePlayers(
  updates: PlayerUpdate[]
): Promise<
  Array<{
    player_id: string;
    result: ReconciliationResult;
  }>
> {
  const results = await Promise.all(
    updates.map(async (update) => ({
      player_id: update.player_id,
      result: await reconcilePlayerData(update.player_id, update),
    }))
  );

  return results;
}

/**
 * Get reconciliation statistics
 */
export function getReconciliationStats(
  results: Array<{ player_id: string; result: ReconciliationResult }>
): {
  totalPlayers: number;
  updated: number;
  unchanged: number;
  totalChanges: number;
  totalRejections: number;
  changesByField: Record<string, number>;
} {
  const stats = {
    totalPlayers: results.length,
    updated: 0,
    unchanged: 0,
    totalChanges: 0,
    totalRejections: 0,
    changesByField: {} as Record<string, number>,
  };

  for (const { result } of results) {
    if (result.updated) {
      stats.updated++;
    } else {
      stats.unchanged++;
    }

    stats.totalChanges += result.changes.length;
    stats.totalRejections += result.rejected.length;

    for (const change of result.changes) {
      stats.changesByField[change.field] =
        (stats.changesByField[change.field] || 0) + 1;
    }
  }

  return stats;
}

/**
 * Detect position conflicts requiring review
 */
export async function detectPositionConflicts(): Promise<
  Array<{
    player_id: string;
    player_name: string;
    current_position: string;
    conflicting_sources: Array<{
      source: string;
      position: string;
      confidence: number;
    }>;
  }>
> {
  // This would query recent sync attempts that were rejected
  // For now, return empty array (implement based on your logging)
  return [];
}

/**
 * Manual position override (admin)
 */
export async function overridePlayerPosition(
  player_id: string,
  position: string,
  sub_position: string | null,
  reason: string,
  admin_id: string
): Promise<void> {
  const { data: current } = await supabase
    .from('player_identity')
    .select('*')
    .eq('player_id', player_id)
    .single();

  if (!current) {
    throw new Error(`Player ${player_id} not found`);
  }

  // Update player
  await supabase
    .from('player_identity')
    .update({
      position,
      sub_position,
      last_seen_source: 'official_roster',
      last_seen_at: new Date().toISOString(),
    })
    .eq('player_id', player_id);

  // Log override in history
  await supabase.from('player_identity_history').insert({
    player_id,
    change_type: 'position_change',
    old_value: {
      position: current.position,
      sub_position: current.sub_position,
    },
    new_value: {
      position,
      sub_position,
    },
    source: 'official_roster',
    confidence: 1.0,
    metadata: {
      manual_override: true,
      admin_id,
      reason,
    },
  });
}
