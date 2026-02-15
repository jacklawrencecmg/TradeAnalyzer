/**
 * Daily Digest Generator
 *
 * Runs every morning to create personalized daily reports for users.
 * This is the key retention engine that creates daily habits.
 *
 * Generates digest containing:
 * - Buy Low opportunities for watched players
 * - Sell High alerts
 * - Breakout candidates
 * - Waiver upgrades (league-aware)
 * - Value changes
 * - Team-specific recommendations
 *
 * Morning Message Example:
 * "Your Team Today: 2 Buy Lows, 1 Sell High, 1 Waiver Upgrade, 3 Value Changes"
 */

import { supabase } from '../supabase';
import { getPlayerAdvice } from '../advice/getAdvice';
import { dispatchDailyDigest } from './dispatchAlerts';

export interface DigestSummary {
  userId: string;
  buyLows: number;
  sellHighs: number;
  breakouts: number;
  waiverTargets: number;
  valueChanges: number;
  teamAlerts: number;
  watchedPlayers: string[];
  topOpportunities: Array<{
    type: string;
    playerName: string;
    message: string;
  }>;
}

/**
 * Generate daily digest for a single user
 */
export async function generateUserDailyDigest(userId: string): Promise<DigestSummary | null> {
  try {
    // Get user's watched players
    const watchedPlayers = await getUserWatchedPlayers(userId);

    if (watchedPlayers.length === 0) {
      // User not watching anyone, skip digest
      return null;
    }

    // Get user's leagues for team-aware insights
    const userLeagues = await getUserLeagues(userId);

    // Initialize counters
    let buyLows = 0;
    let sellHighs = 0;
    let breakouts = 0;
    let waiverTargets = 0;
    let valueChanges = 0;
    let teamAlerts = 0;

    const topOpportunities: Array<{
      type: string;
      playerName: string;
      message: string;
    }> = [];

    // Check for advice on watched players
    for (const playerId of watchedPlayers.slice(0, 50)) {
      // Limit to 50 watched players
      const advice = await getPlayerAdvice(playerId, 'dynasty', null);

      for (const rec of advice) {
        switch (rec.adviceType) {
          case 'buy_low':
            buyLows++;
            if (topOpportunities.length < 5) {
              topOpportunities.push({
                type: 'buy_low',
                playerName: rec.playerName,
                message: rec.reason,
              });
            }
            break;
          case 'sell_high':
            sellHighs++;
            if (topOpportunities.length < 5) {
              topOpportunities.push({
                type: 'sell_high',
                playerName: rec.playerName,
                message: rec.reason,
              });
            }
            break;
          case 'breakout':
            breakouts++;
            if (topOpportunities.length < 5) {
              topOpportunities.push({
                type: 'breakout',
                playerName: rec.playerName,
                message: rec.reason,
              });
            }
            break;
          case 'waiver':
            waiverTargets++;
            break;
        }
      }
    }

    // Check for value changes (last 24 hours)
    valueChanges = await getRecentValueChanges(watchedPlayers);

    // Check for league-specific opportunities
    for (const leagueId of userLeagues) {
      const leagueAlerts = await generateLeagueAlerts(userId, leagueId);
      teamAlerts += leagueAlerts;
    }

    const summary: DigestSummary = {
      userId,
      buyLows,
      sellHighs,
      breakouts,
      waiverTargets,
      valueChanges,
      teamAlerts,
      watchedPlayers,
      topOpportunities,
    };

    return summary;
  } catch (error) {
    console.error(`Error generating digest for user ${userId}:`, error);
    return null;
  }
}

/**
 * Generate and dispatch daily digests for all active users
 */
export async function generateAllDailyDigests(): Promise<{
  total: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const startTime = Date.now();

  console.log('Starting daily digest generation...');

  // Get all users with watchlists
  const activeUsers = await getActiveUsers();

  console.log(`Found ${activeUsers.length} active users`);

  let total = activeUsers.length;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  const batchSize = 50;
  for (let i = 0; i < activeUsers.length; i += batchSize) {
    const batch = activeUsers.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (userId) => {
        const summary = await generateUserDailyDigest(userId);

        if (!summary) {
          return { sent: false, reason: 'No watched players' };
        }

        const totalUpdates =
          summary.buyLows +
          summary.sellHighs +
          summary.breakouts +
          summary.waiverTargets +
          summary.valueChanges +
          summary.teamAlerts;

        if (totalUpdates === 0) {
          return { sent: false, reason: 'No updates' };
        }

        // Dispatch digest
        const result = await dispatchDailyDigest(userId, {
          buyLows: summary.buyLows,
          sellHighs: summary.sellHighs,
          breakouts: summary.breakouts,
          waiverTargets: summary.waiverTargets,
          valueChanges: summary.valueChanges,
        });

        return { sent: result.success, reason: result.reason };
      })
    );

    // Count results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.sent) {
          sent++;
        } else {
          skipped++;
        }
      } else {
        errors++;
      }
    }
  }

  const duration = Date.now() - startTime;

  console.log(`
Daily digest generation complete:
- Total users: ${total}
- Digests sent: ${sent}
- Skipped: ${skipped}
- Errors: ${errors}
- Duration: ${(duration / 1000).toFixed(1)}s
  `);

  return { total, sent, skipped, errors };
}

/**
 * Get active users (users with watchlists)
 */
async function getActiveUsers(): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_watchlists')
    .select('user_id')
    .not('user_id', 'is', null);

  if (error || !data) {
    console.error('Error fetching active users:', error);
    return [];
  }

  // Deduplicate
  const uniqueUsers = [...new Set(data.map((row) => row.user_id).filter((id) => id !== null))];

  return uniqueUsers;
}

/**
 * Get user's watched players
 */
async function getUserWatchedPlayers(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_watchlists')
    .select('id')
    .eq('user_id', userId);

  if (error || !data || data.length === 0) {
    return [];
  }

  const watchlistIds = data.map((row) => row.id);

  const { data: players, error: playersError } = await supabase
    .from('watchlist_players')
    .select('player_id')
    .in('watchlist_id', watchlistIds);

  if (playersError || !players) {
    return [];
  }

  return players.map((p) => p.player_id);
}

/**
 * Get user's leagues
 */
async function getUserLeagues(userId: string): Promise<string[]> {
  // TODO: Implement league membership query
  // For now, return empty array
  return [];
}

/**
 * Get recent value changes for watched players
 */
async function getRecentValueChanges(playerIds: string[]): Promise<number> {
  if (playerIds.length === 0) {
    return 0;
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('player_value_explanations')
    .select('player_id, delta')
    .in('player_id', playerIds)
    .gte('generated_at', yesterday.toISOString())
    .gte('delta', 300); // Only significant changes

  if (error || !data) {
    return 0;
  }

  // Count unique players with changes
  const uniquePlayers = new Set(data.map((row) => row.player_id));
  return uniquePlayers.size;
}

/**
 * Generate league-specific alerts
 */
async function generateLeagueAlerts(userId: string, leagueId: string): Promise<number> {
  // TODO: Implement league-specific logic
  // - Check for waiver upgrades
  // - Check for trade opportunities
  // - Check for lineup optimizations
  return 0;
}

/**
 * Get digest preview for user (for UI)
 */
export async function getDigestPreview(userId: string): Promise<DigestSummary | null> {
  return generateUserDailyDigest(userId);
}

/**
 * Schedule daily digest generation
 *
 * Should be called by cron job every morning at 6 AM
 */
export async function scheduleDailyDigest(): Promise<void> {
  console.log('Daily digest scheduled for 6:00 AM');

  const now = new Date();
  const targetHour = 6; // 6 AM
  const targetMinute = 0;

  // Calculate time until next 6 AM
  let timeUntilDigest = new Date();
  timeUntilDigest.setHours(targetHour, targetMinute, 0, 0);

  if (timeUntilDigest <= now) {
    // If 6 AM has passed today, schedule for tomorrow
    timeUntilDigest.setDate(timeUntilDigest.getDate() + 1);
  }

  const msUntilDigest = timeUntilDigest.getTime() - now.getTime();

  console.log(`Next digest in ${(msUntilDigest / 1000 / 60 / 60).toFixed(1)} hours`);

  setTimeout(async () => {
    await generateAllDailyDigests();
    // Schedule next one
    scheduleDailyDigest();
  }, msUntilDigest);
}
