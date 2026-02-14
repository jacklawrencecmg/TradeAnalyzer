import { supabase } from '../supabase';
import type { HealthCheckResult } from './runHealthChecks';

export interface RecoveryAttempt {
  check_name: string;
  action_taken: string;
  success: boolean;
  message: string;
  error?: string;
}

async function triggerPlayerSync(): Promise<{ success: boolean; message: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/sync-sleeper-players`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return {
        success: false,
        message: `Player sync trigger failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      message: 'Player sync triggered successfully',
    };
  } catch (err) {
    return {
      success: false,
      message: `Player sync trigger error: ${String(err)}`,
    };
  }
}

async function triggerKTCSync(): Promise<{ success: boolean; message: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/sync-ktc-all`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return {
        success: false,
        message: `KTC sync trigger failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      message: 'KTC value sync triggered successfully',
    };
  } catch (err) {
    return {
      success: false,
      message: `KTC sync trigger error: ${String(err)}`,
    };
  }
}

async function backfillMissingTeamHistory(): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        INSERT INTO player_team_history (player_id, team, from_date, is_current, source)
        SELECT
          np.id,
          np.team,
          NOW(),
          true,
          'auto_recovery'
        FROM nfl_players np
        WHERE np.team IS NOT NULL
          AND np.status IN ('Active', 'Practice Squad', 'Injured Reserve')
          AND NOT EXISTS (
            SELECT 1 FROM player_team_history pth
            WHERE pth.player_id = np.id
          )
        RETURNING *
      `,
    });

    if (error) {
      return {
        success: false,
        message: `Team history backfill failed: ${error.message}`,
      };
    }

    const count = Array.isArray(data) ? data.length : 0;
    return {
      success: true,
      message: `Backfilled team history for ${count} players`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Team history backfill error: ${String(err)}`,
    };
  }
}

async function rerunPlayerResolver(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: unresolvedEntities, error } = await supabase
      .from('unresolved_entities')
      .select('id, name, position, source')
      .limit(50);

    if (error) {
      return {
        success: false,
        message: `Failed to fetch unresolved entities: ${error.message}`,
      };
    }

    if (!unresolvedEntities || unresolvedEntities.length === 0) {
      return {
        success: true,
        message: 'No unresolved entities to process',
      };
    }

    const { resolvePlayerId } = await import('../players/resolvePlayerId');
    let resolvedCount = 0;

    for (const entity of unresolvedEntities) {
      try {
        const result = await resolvePlayerId({
          name: entity.name,
          position: entity.position,
          source: entity.source || 'auto_recovery',
          autoQuarantine: false,
        });

        if (result.success && result.player_id) {
          await supabase
            .from('unresolved_entities')
            .delete()
            .eq('id', entity.id);
          resolvedCount++;
        }
      } catch (err) {
        console.error(`Error resolving entity ${entity.id}:`, err);
      }
    }

    return {
      success: true,
      message: `Resolved ${resolvedCount} of ${unresolvedEntities.length} unresolved entities`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Player resolver error: ${String(err)}`,
    };
  }
}

export async function attemptAutoFix(check: HealthCheckResult): Promise<RecoveryAttempt> {
  if (check.status === 'ok') {
    return {
      check_name: check.check_name,
      action_taken: 'none',
      success: true,
      message: 'Check is passing, no recovery needed',
    };
  }

  if (check.status === 'critical') {
    return {
      check_name: check.check_name,
      action_taken: 'none',
      success: false,
      message: 'Critical issues require manual intervention',
    };
  }

  let recoveryResult: { success: boolean; message: string } = {
    success: false,
    message: 'No recovery action defined for this check',
  };

  switch (check.check_name) {
    case 'player_sync_freshness':
      recoveryResult = await triggerPlayerSync();
      break;

    case 'value_snapshot_freshness':
      recoveryResult = await triggerKTCSync();
      break;

    case 'missing_team_history':
      recoveryResult = await backfillMissingTeamHistory();
      break;

    case 'unresolved_players_queue':
      recoveryResult = await rerunPlayerResolver();
      break;

    default:
      break;
  }

  const attempt: RecoveryAttempt = {
    check_name: check.check_name,
    action_taken: getActionName(check.check_name),
    success: recoveryResult.success,
    message: recoveryResult.message,
  };

  try {
    await supabase.from('player_events').insert({
      event_type: 'auto_recovery_attempted',
      metadata: {
        check_name: check.check_name,
        check_status: check.status,
        action_taken: attempt.action_taken,
        success: attempt.success,
        message: attempt.message,
      },
    });
  } catch (err) {
    console.error('Error logging recovery attempt:', err);
  }

  return attempt;
}

function getActionName(checkName: string): string {
  const actions: Record<string, string> = {
    player_sync_freshness: 'trigger_player_sync',
    value_snapshot_freshness: 'trigger_ktc_sync',
    missing_team_history: 'backfill_team_history',
    unresolved_players_queue: 'rerun_player_resolver',
    scraper_failures: 'trigger_player_sync',
  };

  return actions[checkName] || 'unknown';
}

export async function attemptAutoRecovery(): Promise<RecoveryAttempt[]> {
  try {
    const { data: failedChecks, error } = await supabase
      .from('current_system_health')
      .select('*')
      .eq('status', 'warning');

    if (error || !failedChecks) {
      console.error('Error fetching failed checks:', error);
      return [];
    }

    const attempts: RecoveryAttempt[] = [];

    for (const check of failedChecks) {
      const checkResult: HealthCheckResult = {
        check_name: check.check_name,
        status: check.status,
        message: check.message,
        meta: check.meta,
      };

      const attempt = await attemptAutoFix(checkResult);
      attempts.push(attempt);

      if (attempt.success) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return attempts;
  } catch (err) {
    console.error('Error attempting auto recovery:', err);
    return [];
  }
}

export async function getRecoveryHistory(limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('player_events')
      .select('*')
      .eq('event_type', 'auto_recovery_attempted')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recovery history:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}
