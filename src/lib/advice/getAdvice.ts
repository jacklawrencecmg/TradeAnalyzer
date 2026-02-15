/**
 * Get Player Advice API
 *
 * Fetch and format player advice for API endpoints and UI.
 */

import { supabase } from '../supabase';

export interface AdviceFilters {
  format: 'dynasty' | 'redraft';
  leagueProfileId?: string | null;
  adviceType?: 'buy_low' | 'sell_high' | 'breakout' | 'waiver' | 'stash' | 'avoid';
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface AdviceResponse {
  playerId: string;
  playerName: string;
  position: string;
  adviceType: string;
  confidence: number;
  score: number;
  reason: string;
  supportingFactors: string[];
  modelValue: number | null;
  marketValue: number | null;
  valueDelta: number | null;
  recentChange7d: number | null;
  recentChange24h: number | null;
  usageTrend: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface GroupedAdvice {
  format: 'dynasty' | 'redraft';
  leagueProfileId: string | null;
  generatedAt: Date;
  buy_low: AdviceResponse[];
  sell_high: AdviceResponse[];
  breakout: AdviceResponse[];
  waiver: AdviceResponse[];
  stash: AdviceResponse[];
  avoid: AdviceResponse[];
  totalCount: number;
}

/**
 * Get player advice with filters
 *
 * @param filters - Query filters
 * @returns Array of advice
 */
export async function getAdvice(filters: AdviceFilters): Promise<AdviceResponse[]> {
  const {
    format,
    leagueProfileId = null,
    adviceType,
    minConfidence = 0,
    limit = 100,
    offset = 0,
  } = filters;

  let query = supabase
    .from('active_player_advice')
    .select('*')
    .eq('format', format)
    .gte('confidence', minConfidence)
    .order('confidence', { ascending: false })
    .order('score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (leagueProfileId) {
    query = query.eq('league_profile_id', leagueProfileId);
  } else {
    query = query.is('league_profile_id', null);
  }

  if (adviceType) {
    query = query.eq('advice_type', adviceType);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching advice:', error);
    return [];
  }

  return data.map((row) => ({
    playerId: row.player_id,
    playerName: row.player_name,
    position: row.player_position,
    adviceType: row.advice_type,
    confidence: row.confidence,
    score: row.score,
    reason: row.reason,
    supportingFactors: parseJSON(row.supporting_factors, []),
    modelValue: row.model_value,
    marketValue: row.market_value,
    valueDelta: row.value_delta,
    recentChange7d: row.recent_change_7d,
    recentChange24h: row.recent_change_24h,
    usageTrend: row.usage_trend,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

/**
 * Get advice grouped by type
 *
 * @param format - Dynasty or redraft
 * @param leagueProfileId - Optional league profile
 * @param limitPerType - Limit per advice type
 * @returns Grouped advice
 */
export async function getGroupedAdvice(
  format: 'dynasty' | 'redraft',
  leagueProfileId: string | null = null,
  limitPerType: number = 10
): Promise<GroupedAdvice> {
  const adviceTypes = ['buy_low', 'sell_high', 'breakout', 'waiver', 'stash', 'avoid'] as const;

  const grouped: GroupedAdvice = {
    format,
    leagueProfileId,
    generatedAt: new Date(),
    buy_low: [],
    sell_high: [],
    breakout: [],
    waiver: [],
    stash: [],
    avoid: [],
    totalCount: 0,
  };

  // Fetch each type
  for (const type of adviceTypes) {
    const advice = await getAdvice({
      format,
      leagueProfileId,
      adviceType: type,
      limit: limitPerType,
    });

    grouped[type] = advice;
    grouped.totalCount += advice.length;
  }

  return grouped;
}

/**
 * Get top opportunity for each advice type
 *
 * @param format - Dynasty or redraft
 * @param leagueProfileId - Optional league profile
 * @returns Top opportunities
 */
export async function getTopOpportunities(
  format: 'dynasty' | 'redraft',
  leagueProfileId: string | null = null
): Promise<AdviceResponse[]> {
  const { data, error } = await supabase.rpc('get_top_opportunities', {
    p_format: format,
    p_league_profile_id: leagueProfileId,
  });

  if (error || !data) {
    console.error('Error fetching top opportunities:', error);
    return [];
  }

  return data.map((row: any) => ({
    playerId: row.player_id,
    playerName: row.player_name,
    position: row.player_position,
    adviceType: 'unknown', // Would need to join to get this
    confidence: row.confidence,
    score: 0,
    reason: row.reason,
    supportingFactors: [],
    modelValue: null,
    marketValue: null,
    valueDelta: row.value_delta,
    recentChange7d: null,
    recentChange24h: null,
    usageTrend: null,
    expiresAt: null,
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Get advice for specific player
 *
 * @param playerId - Player ID
 * @param format - Dynasty or redraft
 * @param leagueProfileId - Optional league profile
 * @returns Player's advice
 */
export async function getPlayerAdvice(
  playerId: string,
  format: 'dynasty' | 'redraft',
  leagueProfileId: string | null = null
): Promise<AdviceResponse[]> {
  let query = supabase
    .from('active_player_advice')
    .select('*')
    .eq('player_id', playerId)
    .eq('format', format)
    .order('confidence', { ascending: false });

  if (leagueProfileId) {
    query = query.eq('league_profile_id', leagueProfileId);
  } else {
    query = query.is('league_profile_id', null);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    playerId: row.player_id,
    playerName: row.player_name,
    position: row.player_position,
    adviceType: row.advice_type,
    confidence: row.confidence,
    score: row.score,
    reason: row.reason,
    supportingFactors: parseJSON(row.supporting_factors, []),
    modelValue: row.model_value,
    marketValue: row.market_value,
    valueDelta: row.value_delta,
    recentChange7d: row.recent_change_7d,
    recentChange24h: row.recent_change_24h,
    usageTrend: row.usage_trend,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

/**
 * Get advice summary statistics
 *
 * @param format - Dynasty or redraft
 * @param leagueProfileId - Optional league profile
 * @returns Summary stats
 */
export async function getAdviceSummary(
  format: 'dynasty' | 'redraft',
  leagueProfileId: string | null = null
): Promise<{
  adviceType: string;
  playerCount: number;
  avgConfidence: number;
  topPlayerName: string;
  topPlayerConfidence: number;
}[]> {
  const { data, error } = await supabase.rpc('get_advice_summary', {
    p_league_profile_id: leagueProfileId,
    p_format: format,
  });

  if (error || !data) {
    console.error('Error fetching advice summary:', error);
    return [];
  }

  return data.map((row: any) => ({
    adviceType: row.advice_type,
    playerCount: Number(row.player_count),
    avgConfidence: Number(row.avg_confidence),
    topPlayerName: row.top_player_name,
    topPlayerConfidence: row.top_player_confidence,
  }));
}

/**
 * Search advice by player name
 *
 * @param searchTerm - Player name search term
 * @param format - Dynasty or redraft
 * @param limit - Result limit
 * @returns Matching advice
 */
export async function searchAdvice(
  searchTerm: string,
  format: 'dynasty' | 'redraft',
  limit: number = 20
): Promise<AdviceResponse[]> {
  const { data, error } = await supabase
    .from('active_player_advice')
    .select('*')
    .eq('format', format)
    .ilike('player_name', `%${searchTerm}%`)
    .order('confidence', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    playerId: row.player_id,
    playerName: row.player_name,
    position: row.player_position,
    adviceType: row.advice_type,
    confidence: row.confidence,
    score: row.score,
    reason: row.reason,
    supportingFactors: parseJSON(row.supporting_factors, []),
    modelValue: row.model_value,
    marketValue: row.market_value,
    valueDelta: row.value_delta,
    recentChange7d: row.recent_change_7d,
    recentChange24h: row.recent_change_24h,
    usageTrend: row.usage_trend,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

/**
 * Get count of advice by type
 *
 * @param format - Dynasty or redraft
 * @param leagueProfileId - Optional league profile
 * @returns Counts by type
 */
export async function getAdviceCounts(
  format: 'dynasty' | 'redraft',
  leagueProfileId: string | null = null
): Promise<Record<string, number>> {
  let query = supabase
    .from('player_advice')
    .select('advice_type')
    .eq('format', format);

  if (leagueProfileId) {
    query = query.eq('league_profile_id', leagueProfileId);
  } else {
    query = query.is('league_profile_id', null);
  }

  // Only active advice
  query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

  const { data, error } = await query;

  if (error || !data) {
    return {};
  }

  const counts: Record<string, number> = {};

  for (const row of data) {
    counts[row.advice_type] = (counts[row.advice_type] || 0) + 1;
  }

  return counts;
}

/**
 * Parse JSON safely
 */
function parseJSON<T>(value: any, defaultValue: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }
  return value || defaultValue;
}
