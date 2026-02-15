/**
 * Effective Value Calculation
 *
 * Calculates player value with real-time adjustments layered on top.
 * Returns base value + active adjustments = effective value.
 *
 * This is the NEW read path for all player values.
 * UI should ALWAYS display effective_value, not base_value.
 */

import { supabase } from '../supabase';

export interface EffectiveValue {
  player_id: string;
  format: 'dynasty' | 'redraft';
  base_value: number;
  adjustment: number;
  effective_value: number;
  adjustments: Array<{
    delta: number;
    reason: string;
    source: string;
    confidence: number;
    expires_at: string;
  }>;
  has_adjustment: boolean;
  trend: 'up' | 'down' | 'neutral';
}

/**
 * Get effective value for a single player
 */
export async function getEffectiveValue(
  playerId: string,
  format: 'dynasty' | 'redraft' = 'dynasty'
): Promise<EffectiveValue | null> {
  // Call database function that calculates effective value
  const { data, error } = await supabase.rpc('calculate_effective_value', {
    p_player_id: playerId,
    p_format: format,
  });

  if (error || !data) {
    console.error('Error calculating effective value:', error);
    return null;
  }

  const result = typeof data === 'string' ? JSON.parse(data) : data;

  const trend =
    result.adjustment > 50 ? 'up' :
    result.adjustment < -50 ? 'down' :
    'neutral';

  return {
    player_id: result.player_id,
    format: result.format,
    base_value: result.base_value || 0,
    adjustment: result.adjustment || 0,
    effective_value: result.effective_value || 0,
    adjustments: result.adjustments || [],
    has_adjustment: (result.adjustment || 0) !== 0,
    trend,
  };
}

/**
 * Get effective values for multiple players (batched)
 */
export async function getEffectiveValues(
  playerIds: string[],
  format: 'dynasty' | 'redraft' = 'dynasty'
): Promise<Map<string, EffectiveValue>> {
  const results = new Map<string, EffectiveValue>();

  // Batch process in groups of 50
  const batchSize = 50;
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);

    const promises = batch.map(id => getEffectiveValue(id, format));
    const values = await Promise.all(promises);

    for (const value of values) {
      if (value) {
        results.set(value.player_id, value);
      }
    }
  }

  return results;
}

/**
 * Get trending players (those with active adjustments)
 */
export async function getTrendingPlayers(limit: number = 50): Promise<any[]> {
  const { data, error } = await supabase
    .from('trending_players')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('Error fetching trending players:', error);
    return [];
  }

  return data || [];
}

/**
 * Get player adjustments with player details
 */
export async function getPlayerAdjustments(playerId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('player_value_adjustments')
    .select('*')
    .eq('player_id', playerId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching adjustments:', error);
    return [];
  }

  return data || [];
}

/**
 * Helper: Format adjustment for display
 */
export function formatAdjustment(delta: number): string {
  if (delta === 0) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}`;
}

/**
 * Helper: Get trend icon
 */
export function getTrendIcon(trend: 'up' | 'down' | 'neutral'): string {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  return '—';
}

/**
 * Helper: Get trend color class
 */
export function getTrendColorClass(trend: 'up' | 'down' | 'neutral'): string {
  if (trend === 'up') return 'text-green-400';
  if (trend === 'down') return 'text-red-400';
  return 'text-gray-400';
}

/**
 * Helper: Get confidence badge
 */
export function getConfidenceBadge(confidence: number): { label: string; colorClass: string } {
  if (confidence >= 5) return { label: 'Very High', colorClass: 'bg-green-900/30 text-green-400' };
  if (confidence >= 4) return { label: 'High', colorClass: 'bg-blue-900/30 text-blue-400' };
  if (confidence >= 3) return { label: 'Medium', colorClass: 'bg-yellow-900/30 text-yellow-400' };
  if (confidence >= 2) return { label: 'Low', colorClass: 'bg-orange-900/30 text-orange-400' };
  return { label: 'Very Low', colorClass: 'bg-red-900/30 text-red-400' };
}

/**
 * Manual adjustment creation (admin only)
 */
export async function createManualAdjustment(
  playerId: string,
  format: 'dynasty' | 'redraft' | 'both',
  delta: number,
  reason: string,
  confidence: number,
  expiresHours: number
): Promise<string | null> {
  const { data, error } = await supabase.rpc('add_value_adjustment', {
    p_player_id: playerId,
    p_format: format,
    p_delta: delta,
    p_reason: reason,
    p_confidence: confidence,
    p_source: 'manual',
    p_expires_hours: expiresHours,
    p_metadata: {
      created_manually: true,
      created_at: new Date().toISOString(),
    },
  });

  if (error) {
    console.error('Error creating manual adjustment:', error);
    return null;
  }

  return data;
}

/**
 * Remove specific adjustment
 */
export async function removeAdjustment(adjustmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('player_value_adjustments')
    .delete()
    .eq('id', adjustmentId);

  if (error) {
    console.error('Error removing adjustment:', error);
    return false;
  }

  return true;
}

/**
 * Get adjustment statistics
 */
export async function getAdjustmentStats() {
  const { data: active, error: activeError } = await supabase
    .from('player_value_adjustments')
    .select('*', { count: 'exact', head: true })
    .gt('expires_at', new Date().toISOString());

  const { data: sources, error: sourcesError } = await supabase
    .from('player_value_adjustments')
    .select('source')
    .gt('expires_at', new Date().toISOString());

  const sourceCount: Record<string, number> = {};
  if (sources) {
    for (const item of sources) {
      sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
    }
  }

  return {
    active_count: active?.count || 0,
    by_source: sourceCount,
  };
}
