/**
 * Transaction Feed Listener
 *
 * Syncs player transactions (trades, cuts, signings) and creates value adjustments.
 * Runs periodically to detect:
 * - Trades to better/worse situations
 * - Releases (creates opportunity for backups)
 * - Signings (may reduce other players' roles)
 * - Team changes
 */

import { supabase } from '../supabase';

export interface Transaction {
  player_id: string;
  player_name: string;
  position: string;
  transaction_type: 'trade' | 'release' | 'signing' | 'team_change';
  old_team: string | null;
  new_team: string | null;
  detected_at: Date;
  confidence: 1 | 2 | 3 | 4 | 5;
  impact_assessment: {
    delta_dynasty: number;
    delta_redraft: number;
    reason: string;
    affected_players?: string[]; // Other players impacted by this move
  };
}

export interface TransactionSyncResult {
  success: boolean;
  transactions_processed: number;
  adjustments_created: number;
  transactions: Transaction[];
  errors: string[];
}

/**
 * Main transaction sync function
 */
export async function syncTransactions(): Promise<TransactionSyncResult> {
  const startTime = Date.now();
  const transactions: Transaction[] = [];
  const errors: string[] = [];
  let adjustmentsCreated = 0;

  console.log('Starting transaction sync...');

  try {
    // 1. Detect team changes (by comparing current team with last known team)
    const teamChanges = await detectTeamChanges();
    transactions.push(...teamChanges);

    // 2. For each transaction, assess impact and create adjustments
    for (const txn of transactions) {
      try {
        const created = await createAdjustmentsForTransaction(txn);
        adjustmentsCreated += created;
      } catch (error) {
        const msg = `Error creating adjustment for ${txn.player_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // 3. Record sync status
    await supabase.from('sync_status').insert({
      sync_type: 'transaction_sync',
      status: errors.length > 0 ? 'partial_success' : 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      records_processed: transactions.length,
      records_created: adjustmentsCreated,
      metadata: {
        transactions_by_type: transactions.reduce((acc, t) => {
          acc[t.transaction_type] = (acc[t.transaction_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        errors: errors.slice(0, 5),
      },
    });

    console.log(`Transaction sync complete: ${transactions.length} transactions, ${adjustmentsCreated} adjustments`);

    return {
      success: errors.length === 0,
      transactions_processed: transactions.length,
      adjustments_created: adjustmentsCreated,
      transactions,
      errors,
    };
  } catch (error) {
    const msg = `Transaction sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(msg);
    errors.push(msg);

    return {
      success: false,
      transactions_processed: 0,
      adjustments_created: 0,
      transactions: [],
      errors,
    };
  }
}

/**
 * Detect team changes by comparing current team with historical data
 */
async function detectTeamChanges(): Promise<Transaction[]> {
  const transactions: Transaction[] = [];

  // Get recent team history changes
  // This would integrate with player_team_history table
  const { data: recentChanges } = await supabase
    .from('player_team_history')
    .select(`
      *,
      player:player_id (
        id,
        full_name,
        player_position,
        team
      )
    `)
    .gte('start_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('start_date', { ascending: false });

  if (!recentChanges) return transactions;

  // For each recent change, check if we've already processed it
  for (const change of recentChanges) {
    const player = change.player;
    if (!player) continue;

    // Check if already created adjustment for this transaction
    const { data: existing } = await supabase
      .from('adjustment_events')
      .select('*')
      .eq('player_id', player.id)
      .eq('event_type', 'team_change')
      .gte('detected_at', new Date(change.start_date).toISOString())
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Assess impact of team change
    const impact = assessTeamChangeImpact(
      player,
      change.team_abbr,
      change.previous_team || null
    );

    if (impact.delta_dynasty !== 0 || impact.delta_redraft !== 0) {
      transactions.push({
        player_id: player.id,
        player_name: player.full_name,
        position: player.player_position,
        transaction_type: 'team_change',
        old_team: change.previous_team || null,
        new_team: change.team_abbr,
        detected_at: new Date(change.start_date),
        confidence: 3,
        impact_assessment: impact,
      });
    }
  }

  return transactions;
}

/**
 * Assess impact of team change on player value
 */
function assessTeamChangeImpact(
  player: any,
  newTeam: string,
  oldTeam: string | null
): {
  delta_dynasty: number;
  delta_redraft: number;
  reason: string;
  affected_players?: string[];
} {
  // Team quality tiers (simplified - in production, use actual team metrics)
  const topOffenses = ['KC', 'SF', 'BUF', 'MIA', 'DAL', 'PHI'];
  const bottomOffenses = ['CAR', 'NYG', 'CHI', 'ARI', 'NE', 'LV'];

  const isUpgrade = topOffenses.includes(newTeam) && oldTeam && !topOffenses.includes(oldTeam);
  const isDowngrade = bottomOffenses.includes(newTeam) && oldTeam && !bottomOffenses.includes(oldTeam);

  let deltaDynasty = 0;
  let deltaRedraft = 0;
  let reason = `Traded to ${newTeam}`;

  if (isUpgrade) {
    // Better offense = more opportunities
    if (player.player_position === 'WR') {
      deltaDynasty = 300;
      deltaRedraft = 250;
      reason = `Traded to top offense ${newTeam} - opportunity boost`;
    } else if (player.player_position === 'RB') {
      deltaDynasty = 250;
      deltaRedraft = 200;
      reason = `Traded to top offense ${newTeam}`;
    } else if (player.player_position === 'QB') {
      deltaDynasty = 200;
      deltaRedraft = 300;
      reason = `Traded to top offense ${newTeam}`;
    } else if (player.player_position === 'TE') {
      deltaDynasty = 250;
      deltaRedraft = 200;
      reason = `Traded to top offense ${newTeam}`;
    }
  } else if (isDowngrade) {
    // Worse offense = fewer opportunities
    if (player.player_position === 'WR') {
      deltaDynasty = -200;
      deltaRedraft = -150;
      reason = `Traded to weak offense ${newTeam} - concern`;
    } else if (player.player_position === 'RB') {
      deltaDynasty = -150;
      deltaRedraft = -100;
      reason = `Traded to weak offense ${newTeam}`;
    } else if (player.player_position === 'QB') {
      deltaDynasty = -150;
      deltaRedraft = -200;
      reason = `Traded to weak offense ${newTeam}`;
    } else if (player.player_position === 'TE') {
      deltaDynasty = -150;
      deltaRedraft = -100;
      reason = `Traded to weak offense ${newTeam}`;
    }
  } else {
    // Lateral move - small hype bump
    deltaDynasty = 100;
    deltaRedraft = 50;
    reason = `Traded to ${newTeam} - new opportunity`;
  }

  return {
    delta_dynasty: deltaDynasty,
    delta_redraft: deltaRedraft,
    reason,
  };
}

/**
 * Create adjustments for a transaction
 */
async function createAdjustmentsForTransaction(txn: Transaction): Promise<number> {
  let created = 0;

  // Determine expiry (transactions have medium-term impact)
  const expiresHours = 72; // 3 days

  // Create dynasty adjustment
  if (txn.impact_assessment.delta_dynasty !== 0) {
    const { data: dynastyAdj, error: dynastyError } = await supabase.rpc('add_value_adjustment', {
      p_player_id: txn.player_id,
      p_format: 'dynasty',
      p_delta: txn.impact_assessment.delta_dynasty,
      p_reason: txn.impact_assessment.reason,
      p_confidence: txn.confidence,
      p_source: 'trade',
      p_expires_hours: expiresHours,
      p_metadata: {
        transaction_type: txn.transaction_type,
        old_team: txn.old_team,
        new_team: txn.new_team,
      },
    });

    if (!dynastyError && dynastyAdj) {
      created++;
    }
  }

  // Create redraft adjustment
  if (txn.impact_assessment.delta_redraft !== 0) {
    const { data: redraftAdj, error: redraftError } = await supabase.rpc('add_value_adjustment', {
      p_player_id: txn.player_id,
      p_format: 'redraft',
      p_delta: txn.impact_assessment.delta_redraft,
      p_reason: txn.impact_assessment.reason,
      p_confidence: txn.confidence,
      p_source: 'trade',
      p_expires_hours: expiresHours,
      p_metadata: {
        transaction_type: txn.transaction_type,
        old_team: txn.old_team,
        new_team: txn.new_team,
      },
    });

    if (!redraftError && redraftAdj) {
      created++;
    }
  }

  // Record transaction event
  await supabase.from('adjustment_events').insert({
    event_type: 'team_change',
    player_id: txn.player_id,
    old_value: { team: txn.old_team },
    new_value: { team: txn.new_team },
    metadata: {
      transaction_type: txn.transaction_type,
      confidence: txn.confidence,
      reason: txn.impact_assessment.reason,
      delta_dynasty: txn.impact_assessment.delta_dynasty,
      delta_redraft: txn.impact_assessment.delta_redraft,
    },
  });

  return created;
}

/**
 * Get recent transactions for display
 */
export async function getRecentTransactions(limit: number = 20) {
  const { data } = await supabase
    .from('adjustment_events')
    .select(`
      *,
      player:player_id (
        id,
        full_name,
        player_position,
        team
      )
    `)
    .eq('event_type', 'team_change')
    .order('detected_at', { ascending: false })
    .limit(limit);

  return data || [];
}
