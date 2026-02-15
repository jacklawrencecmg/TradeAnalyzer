/**
 * Daily Advice Generator
 *
 * Runs every morning to generate fresh advice for all players.
 * Evaluates top 500 players against all advice rules.
 * Updates player_advice table with new recommendations.
 */

import { supabase } from '../supabase';
import {
  evaluatePlayerMarketPosition,
  getReplacementLevelValue,
  type PlayerMarketPosition,
} from './evaluateMarketPosition';
import { detectAllAdvice, type AdviceRecommendation } from './detectAdvice';

export interface AdviceGenerationOptions {
  format: 'dynasty' | 'redraft';
  leagueProfileId?: string | null;
  playerLimit?: number;
  minConfidence?: number;
}

export interface AdviceGenerationResult {
  format: 'dynasty' | 'redraft';
  leagueProfileId: string | null;
  playersEvaluated: number;
  adviceGenerated: number;
  adviceByType: Record<string, number>;
  topOpportunities: Array<{
    adviceType: string;
    playerName: string;
    confidence: number;
  }>;
  duration: number;
  errors: string[];
}

/**
 * Generate daily advice for all players
 *
 * @param options - Generation options
 * @returns Generation result summary
 */
export async function generateDailyAdvice(
  options: AdviceGenerationOptions = {}
): Promise<AdviceGenerationResult> {
  const startTime = Date.now();
  const {
    format = 'dynasty',
    leagueProfileId = null,
    playerLimit = 500,
    minConfidence = 50,
  } = options;

  const errors: string[] = [];
  const adviceByType: Record<string, number> = {
    buy_low: 0,
    sell_high: 0,
    breakout: 0,
    waiver: 0,
    stash: 0,
    avoid: 0,
  };

  console.log(`Starting daily advice generation for ${format}...`);

  // Step 1: Get top players to evaluate
  const playerIds = await getTopPlayers(format, playerLimit);
  console.log(`Evaluating ${playerIds.length} players`);

  if (playerIds.length === 0) {
    return {
      format,
      leagueProfileId,
      playersEvaluated: 0,
      adviceGenerated: 0,
      adviceByType,
      topOpportunities: [],
      duration: Date.now() - startTime,
      errors: ['No players found to evaluate'],
    };
  }

  // Step 2: Get replacement level values for waiver analysis
  const replacementLevels: Record<string, number> = {
    QB: await getReplacementLevelValue('QB', format),
    RB: await getReplacementLevelValue('RB', format),
    WR: await getReplacementLevelValue('WR', format),
    TE: await getReplacementLevelValue('TE', format),
  };

  // Step 3: Clean up expired advice
  await cleanupExpiredAdvice();

  // Step 4: Evaluate players and generate advice
  const allAdvice: Array<{
    playerId: string;
    playerName: string;
    position: string;
    advice: AdviceRecommendation;
  }> = [];

  let playersEvaluated = 0;

  // Process in batches
  const batchSize = 50;
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async (playerId) => {
        try {
          // Evaluate market position
          const position = await evaluatePlayerMarketPosition(playerId, leagueProfileId, format);

          if (!position) {
            return null;
          }

          playersEvaluated++;

          // Detect all applicable advice
          const replacementLevel = replacementLevels[position.position] || 1500;
          const recommendations = detectAllAdvice(position, replacementLevel);

          // Filter by minimum confidence
          const validRecommendations = recommendations.filter(
            (rec) => rec.confidence >= minConfidence
          );

          // Store advice
          return {
            position,
            recommendations: validRecommendations,
          };
        } catch (error) {
          errors.push(`Error evaluating player ${playerId}: ${error}`);
          return null;
        }
      })
    );

    // Process batch results
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        const { position, recommendations } = result.value;

        for (const rec of recommendations) {
          allAdvice.push({
            playerId: position.playerId,
            playerName: position.playerName,
            position: position.position,
            advice: rec,
          });

          adviceByType[rec.adviceType]++;
        }
      }
    }
  }

  // Step 5: Store advice in database
  if (allAdvice.length > 0) {
    try {
      await storeAdvice(allAdvice, format, leagueProfileId);
    } catch (error) {
      errors.push(`Error storing advice: ${error}`);
    }
  }

  // Step 6: Get top opportunities for summary
  const topOpportunities = allAdvice
    .sort((a, b) => b.advice.confidence - a.advice.confidence)
    .slice(0, 10)
    .map((item) => ({
      adviceType: item.advice.adviceType,
      playerName: item.playerName,
      confidence: item.advice.confidence,
    }));

  const duration = Date.now() - startTime;

  console.log(`
Daily advice generation complete:
- Players evaluated: ${playersEvaluated}
- Advice generated: ${allAdvice.length}
- Buy Low: ${adviceByType.buy_low}
- Sell High: ${adviceByType.sell_high}
- Breakout: ${adviceByType.breakout}
- Waiver: ${adviceByType.waiver}
- Stash: ${adviceByType.stash}
- Avoid: ${adviceByType.avoid}
- Duration: ${(duration / 1000).toFixed(1)}s
- Errors: ${errors.length}
  `);

  return {
    format,
    leagueProfileId,
    playersEvaluated,
    adviceGenerated: allAdvice.length,
    adviceByType,
    topOpportunities,
    duration,
    errors,
  };
}

/**
 * Get top players to evaluate
 */
async function getTopPlayers(format: 'dynasty' | 'redraft', limit: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('player_values')
    .select('player_id')
    .eq('format', format)
    .is('league_profile_id', null)
    .order('fdp_value', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error('Error fetching top players:', error);
    return [];
  }

  return data.map((row) => row.player_id);
}

/**
 * Clean up expired advice
 */
async function cleanupExpiredAdvice(): Promise<number> {
  const { data, error } = await supabase.rpc('cleanup_expired_advice');

  if (error) {
    console.error('Error cleaning up expired advice:', error);
    return 0;
  }

  if (data) {
    console.log(`Cleaned up ${data} expired advice records`);
  }

  return data || 0;
}

/**
 * Store advice in database
 */
async function storeAdvice(
  adviceList: Array<{
    playerId: string;
    playerName: string;
    position: string;
    advice: AdviceRecommendation;
  }>,
  format: 'dynasty' | 'redraft',
  leagueProfileId: string | null
): Promise<void> {
  // Get market positions for all players (for storing context)
  const positionsMap = new Map<string, PlayerMarketPosition>();

  const playerIds = [...new Set(adviceList.map((a) => a.playerId))];

  for (const playerId of playerIds) {
    const position = await evaluatePlayerMarketPosition(playerId, leagueProfileId, format);
    if (position) {
      positionsMap.set(playerId, position);
    }
  }

  // Prepare records
  const records = adviceList.map((item) => {
    const position = positionsMap.get(item.playerId);

    return {
      player_id: item.playerId,
      league_profile_id: leagueProfileId,
      format,
      advice_type: item.advice.adviceType,
      confidence: item.advice.confidence,
      score: item.advice.score,
      reason: item.advice.reason,
      supporting_factors: JSON.stringify(item.advice.supportingFactors),
      model_value: position?.modelValue || null,
      market_value: position?.marketValue || null,
      value_delta: position?.valueDelta || null,
      recent_change_7d: position?.recentChange7d || null,
      recent_change_24h: position?.recentChange24h || null,
      usage_trend: position?.usageTrend || null,
      expires_at: item.advice.expiresAt?.toISOString() || null,
    };
  });

  // Upsert in batches
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const { error } = await supabase.from('player_advice').upsert(batch, {
      onConflict: 'player_id,league_profile_id,format,advice_type',
    });

    if (error) {
      console.error(`Error upserting advice batch: ${error.message}`);
      throw error;
    }
  }

  console.log(`Stored ${records.length} advice records`);
}

/**
 * Generate advice for multiple formats/profiles in parallel
 */
export async function generateAllDailyAdvice(
  formats: Array<'dynasty' | 'redraft'> = ['dynasty', 'redraft'],
  leagueProfileIds: string[] = []
): Promise<AdviceGenerationResult[]> {
  const jobs: Promise<AdviceGenerationResult>[] = [];

  // Generate for each format
  for (const format of formats) {
    // Default (no league profile)
    jobs.push(generateDailyAdvice({ format }));

    // League-specific profiles
    for (const leagueProfileId of leagueProfileIds) {
      jobs.push(generateDailyAdvice({ format, leagueProfileId }));
    }
  }

  const results = await Promise.all(jobs);

  // Log summary
  const totalAdvice = results.reduce((sum, r) => sum + r.adviceGenerated, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`
======================================
Daily Advice Generation Complete
======================================
Total jobs: ${results.length}
Total advice: ${totalAdvice}
Total duration: ${(totalDuration / 1000).toFixed(1)}s
======================================
  `);

  return results;
}

/**
 * Get advice generation statistics
 */
export async function getAdviceStats(
  format: 'dynasty' | 'redraft',
  leagueProfileId: string | null = null
): Promise<{
  totalAdvice: number;
  adviceByType: Record<string, number>;
  avgConfidence: number;
  lastGenerated: Date | null;
}> {
  const { data, error } = await supabase
    .from('player_advice')
    .select('advice_type, confidence, created_at')
    .eq('format', format)
    .is('league_profile_id', leagueProfileId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error || !data) {
    return {
      totalAdvice: 0,
      adviceByType: {},
      avgConfidence: 0,
      lastGenerated: null,
    };
  }

  const adviceByType: Record<string, number> = {};
  let totalConfidence = 0;
  let lastGenerated: Date | null = null;

  for (const row of data) {
    adviceByType[row.advice_type] = (adviceByType[row.advice_type] || 0) + 1;
    totalConfidence += row.confidence;

    const createdAt = new Date(row.created_at);
    if (!lastGenerated || createdAt > lastGenerated) {
      lastGenerated = createdAt;
    }
  }

  return {
    totalAdvice: data.length,
    adviceByType,
    avgConfidence: data.length > 0 ? Math.round(totalConfidence / data.length) : 0,
    lastGenerated,
  };
}
