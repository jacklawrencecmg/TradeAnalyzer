/**
 * Value Change Tracker
 *
 * Detects significant value changes during nightly rebuild.
 * Generates and stores explanations for changes ≥150 points.
 *
 * Integrates with rebuild pipeline to capture before/after state.
 */

import { supabase } from '../supabase';
import { buildValueReasoning, buildBasicReasoning, type ValueContext } from './buildValueReasoning';
import { renderExplanation } from './renderExplanation';

export interface ValueChangeRecord {
  playerId: string;
  playerName: string;
  position: string;
  format: 'dynasty' | 'redraft';
  leagueProfileId?: string;
  oldValue: number;
  newValue: number;
  delta: number;
  oldRank: number;
  newRank: number;
  context?: ValueContext;
}

const CHANGE_THRESHOLD = 150; // Minimum delta to track

/**
 * Track value changes during rebuild
 *
 * Call this after calculating new values but before writing to database.
 *
 * @param changes - Array of value changes
 * @param epoch - Rebuild epoch identifier
 * @returns Number of explanations generated
 */
export async function trackValueChanges(
  changes: ValueChangeRecord[],
  epoch: string
): Promise<number> {
  let explanationsGenerated = 0;

  // Filter for significant changes
  const significantChanges = changes.filter(
    (change) => Math.abs(change.delta) >= CHANGE_THRESHOLD
  );

  if (significantChanges.length === 0) {
    console.log('No significant value changes to track');
    return 0;
  }

  console.log(`Tracking ${significantChanges.length} significant value changes...`);

  // Process in batches
  const batchSize = 50;
  for (let i = 0; i < significantChanges.length; i += batchSize) {
    const batch = significantChanges.slice(i, i + batchSize);

    const explanations = batch.map((change) => {
      const reasoning = change.context
        ? buildValueReasoning(change.context)
        : buildBasicReasoning(change.oldValue, change.newValue);

      // Fill in player details
      reasoning.playerId = change.playerId;
      reasoning.playerName = change.playerName;
      reasoning.position = change.position;
      reasoning.format = change.format;

      const explanationText = renderExplanation(reasoning);

      return {
        player_id: change.playerId,
        league_profile_id: change.leagueProfileId || null,
        format: change.format,
        old_value: change.oldValue,
        new_value: change.newValue,
        delta: change.delta,
        primary_reason: reasoning.primaryReason,
        primary_reason_delta: reasoning.primaryReasonDelta,
        secondary_reasons: JSON.stringify(reasoning.secondaryReasons),
        explanation_text: explanationText,
        rank_change: change.newRank - change.oldRank,
        epoch,
      };
    });

    // Insert batch
    const { error } = await supabase.from('player_value_explanations').insert(explanations);

    if (error) {
      console.error(`Error inserting explanation batch: ${error.message}`);
    } else {
      explanationsGenerated += explanations.length;
    }
  }

  console.log(`Generated ${explanationsGenerated} explanations`);
  return explanationsGenerated;
}

/**
 * Get recent explanations for a player
 *
 * @param playerId - Player ID
 * @param format - Dynasty or redraft
 * @param limit - Number of explanations to return
 * @returns Array of explanations
 */
export async function getPlayerExplanations(
  playerId: string,
  format: 'dynasty' | 'redraft',
  limit: number = 5
): Promise<
  Array<{
    oldValue: number;
    newValue: number;
    delta: number;
    explanationText: string;
    primaryReason: string;
    rankChange: number | null;
    generatedAt: string;
  }>
> {
  const { data, error } = await supabase
    .from('player_value_explanations')
    .select('*')
    .eq('player_id', playerId)
    .eq('format', format)
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    oldValue: row.old_value,
    newValue: row.new_value,
    delta: row.delta,
    explanationText: row.explanation_text,
    primaryReason: row.primary_reason,
    rankChange: row.rank_change,
    generatedAt: row.generated_at,
  }));
}

/**
 * Get latest explanation for a player
 *
 * @param playerId - Player ID
 * @param format - Dynasty or redraft
 * @returns Latest explanation or null
 */
export async function getLatestExplanation(
  playerId: string,
  format: 'dynasty' | 'redraft'
): Promise<{
  explanationText: string;
  delta: number;
  primaryReason: string;
  generatedAt: string;
} | null> {
  const explanations = await getPlayerExplanations(playerId, format, 1);

  if (explanations.length === 0) {
    return null;
  }

  return explanations[0];
}

/**
 * Compute daily value changes
 *
 * Identifies biggest movers for homepage feed.
 * Call this after nightly rebuild completes.
 *
 * @param changes - All value changes from rebuild
 * @param format - Dynasty or redraft
 * @returns Number of daily changes stored
 */
export async function computeDailyChanges(
  changes: ValueChangeRecord[],
  format: 'dynasty' | 'redraft'
): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  // Sort by absolute delta
  const sortedChanges = [...changes].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Take top risers and fallers
  const risers = sortedChanges.filter((c) => c.delta > 0).slice(0, 25);
  const fallers = sortedChanges.filter((c) => c.delta < 0).slice(0, 25);

  const allMovers = [...risers, ...fallers];

  const dailyChanges = allMovers.map((change) => {
    const reasoning = change.context
      ? buildValueReasoning(change.context)
      : buildBasicReasoning(change.oldValue, change.newValue);

    reasoning.playerId = change.playerId;
    reasoning.playerName = change.playerName;
    reasoning.position = change.position;
    reasoning.format = change.format;

    const explanationText = renderExplanation(reasoning);

    const percentChange =
      change.oldValue > 0 ? (change.delta / change.oldValue) * 100 : 0;

    return {
      change_date: today,
      player_id: change.playerId,
      format,
      old_value: change.oldValue,
      new_value: change.newValue,
      delta: change.delta,
      percent_change: percentChange,
      old_rank: change.oldRank,
      new_rank: change.newRank,
      rank_change: change.newRank - change.oldRank,
      explanation_text: explanationText,
      primary_reason: reasoning.primaryReason,
      change_type: change.delta > 0 ? 'riser' : 'faller',
    };
  });

  // Delete existing for today
  await supabase.from('daily_value_changes').delete().eq('change_date', today).eq('format', format);

  // Insert new
  const { error } = await supabase.from('daily_value_changes').insert(dailyChanges);

  if (error) {
    console.error(`Error inserting daily changes: ${error.message}`);
    return 0;
  }

  console.log(`Stored ${dailyChanges.length} daily changes for ${format}`);
  return dailyChanges.length;
}

/**
 * Get today's movers
 *
 * @param format - Dynasty or redraft
 * @param changeType - Risers, fallers, or all
 * @param limit - Number of players to return
 * @returns Array of movers
 */
export async function getTodaysMovers(
  format: 'dynasty' | 'redraft',
  changeType?: 'riser' | 'faller',
  limit: number = 10
): Promise<
  Array<{
    playerId: string;
    playerName: string;
    position: string;
    delta: number;
    percentChange: number;
    rankChange: number;
    explanationText: string;
    primaryReason: string;
  }>
> {
  const today = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('daily_value_changes')
    .select(
      `
      player_id,
      delta,
      percent_change,
      rank_change,
      explanation_text,
      primary_reason,
      nfl_players!inner (
        full_name,
        player_position
      )
    `
    )
    .eq('change_date', today)
    .eq('format', format)
    .order('delta', { ascending: false })
    .limit(limit);

  if (changeType) {
    query = query.eq('change_type', changeType);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    playerId: row.player_id,
    playerName: (row.nfl_players as any).full_name,
    position: (row.nfl_players as any).player_position,
    delta: row.delta,
    percentChange: row.percent_change,
    rankChange: row.rank_change,
    explanationText: row.explanation_text,
    primaryReason: row.primary_reason,
  }));
}

/**
 * Get explanation statistics
 *
 * @param days - Number of days to analyze
 * @returns Statistics summary
 */
export async function getExplanationStats(days: number = 7): Promise<{
  totalExplanations: number;
  uniquePlayers: number;
  avgDelta: number;
  mostCommonReason: string;
  biggestGainer: {
    playerName: string;
    delta: number;
    explanation: string;
  } | null;
  biggestLoser: {
    playerName: string;
    delta: number;
    explanation: string;
  } | null;
}> {
  const { data, error } = await supabase.rpc('get_explanation_statistics', {
    p_days: days,
  });

  if (error || !data || data.length === 0) {
    return {
      totalExplanations: 0,
      uniquePlayers: 0,
      avgDelta: 0,
      mostCommonReason: 'Unknown',
      biggestGainer: null,
      biggestLoser: null,
    };
  }

  const stats = data[0];

  return {
    totalExplanations: stats.total_explanations || 0,
    uniquePlayers: stats.unique_players || 0,
    avgDelta: stats.avg_delta || 0,
    mostCommonReason: stats.most_common_reason || 'Unknown',
    biggestGainer: stats.biggest_gainer
      ? {
          playerName: stats.biggest_gainer.player_name,
          delta: stats.biggest_gainer.delta,
          explanation: stats.biggest_gainer.explanation,
        }
      : null,
    biggestLoser: stats.biggest_loser
      ? {
          playerName: stats.biggest_loser.player_name,
          delta: stats.biggest_loser.delta,
          explanation: stats.biggest_loser.explanation,
        }
      : null,
  };
}

/**
 * Get value history with explanations
 *
 * @param playerId - Player ID
 * @param format - Dynasty or redraft
 * @param limit - Number of historical points
 * @returns Value history
 */
export async function getValueHistory(
  playerId: string,
  format: 'dynasty' | 'redraft',
  limit: number = 10
): Promise<
  Array<{
    value: number;
    delta: number;
    explanation: string;
    reason: string;
    date: string;
  }>
> {
  const { data, error } = await supabase.rpc('get_player_value_history', {
    p_player_id: playerId,
    p_format: format,
    p_limit: limit,
  });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    value: row.value,
    delta: row.delta,
    explanation: row.explanation,
    reason: row.primary_reason,
    date: row.changed_at,
  }));
}

/**
 * Detect trending patterns
 *
 * Identifies players with consistent directional movement.
 *
 * @param format - Dynasty or redraft
 * @param days - Days to analyze
 * @returns Trending players
 */
export async function detectTrendingPlayers(
  format: 'dynasty' | 'redraft',
  days: number = 7
): Promise<
  Array<{
    playerId: string;
    playerName: string;
    position: string;
    trendDirection: 'up' | 'down';
    totalChange: number;
    changeCount: number;
    latestExplanation: string;
  }>
> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const { data, error } = await supabase
    .from('player_value_explanations')
    .select(
      `
      player_id,
      delta,
      explanation_text,
      nfl_players!inner (
        full_name,
        player_position
      )
    `
    )
    .eq('format', format)
    .gte('generated_at', sinceDate.toISOString());

  if (error || !data) {
    return [];
  }

  // Group by player
  const playerMap = new Map<
    string,
    {
      playerId: string;
      playerName: string;
      position: string;
      changes: Array<{ delta: number; explanation: string }>;
    }
  >();

  for (const row of data) {
    if (!playerMap.has(row.player_id)) {
      playerMap.set(row.player_id, {
        playerId: row.player_id,
        playerName: (row.nfl_players as any).full_name,
        position: (row.nfl_players as any).player_position,
        changes: [],
      });
    }

    playerMap.get(row.player_id)!.changes.push({
      delta: row.delta,
      explanation: row.explanation_text,
    });
  }

  // Detect trends (3+ changes in same direction)
  const trending: ReturnType<typeof detectTrendingPlayers> extends Promise<infer T> ? T : never =
    [];

  for (const player of playerMap.values()) {
    if (player.changes.length < 3) {
      continue;
    }

    const totalChange = player.changes.reduce((sum, c) => sum + c.delta, 0);
    const positiveChanges = player.changes.filter((c) => c.delta > 0).length;
    const negativeChanges = player.changes.filter((c) => c.delta < 0).length;

    // Trend if 75%+ changes in same direction
    const hasUpTrend = positiveChanges >= player.changes.length * 0.75;
    const hasDownTrend = negativeChanges >= player.changes.length * 0.75;

    if (hasUpTrend || hasDownTrend) {
      trending.push({
        playerId: player.playerId,
        playerName: player.playerName,
        position: player.position,
        trendDirection: hasUpTrend ? 'up' : 'down',
        totalChange,
        changeCount: player.changes.length,
        latestExplanation: player.changes[player.changes.length - 1].explanation,
      });
    }
  }

  // Sort by total change magnitude
  trending.sort((a, b) => Math.abs(b.totalChange) - Math.abs(a.totalChange));

  return trending.slice(0, 20); // Top 20 trending
}
