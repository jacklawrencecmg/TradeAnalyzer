import { supabase } from '../supabase';

/**
 * Get total dynasty adjustments for a player in the last N days
 */
export async function getTotalAdjustments(
  playerId: string,
  days: number = 30
): Promise<number> {
  const { data, error } = await supabase.rpc('calculate_dynasty_adjustment_total', {
    p_player_id: playerId,
    p_days: days,
  });

  if (error) {
    console.error('Error calculating adjustment total:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Apply dynasty adjustments to base value
 */
export async function applyDynastyAdjustments(
  playerId: string,
  baseDynastyValue: number,
  adjustmentWindow: number = 30
): Promise<{
  dynastyValue: number;
  adjustmentTotal: number;
}> {
  const adjustmentTotal = await getTotalAdjustments(playerId, adjustmentWindow);
  const dynastyValue = Math.max(0, Math.min(10000, baseDynastyValue + adjustmentTotal));

  return {
    dynastyValue,
    adjustmentTotal,
  };
}

/**
 * Save dynasty value snapshot for historical tracking
 */
export async function saveDynastySnapshot(
  playerId: string,
  dynastyValue: number,
  baseDynastyValue: number,
  adjustmentTotal: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase.from('dynasty_value_snapshots').upsert(
    {
      player_id: playerId,
      as_of_date: today,
      dynasty_value: dynastyValue,
      base_dynasty_value: baseDynastyValue,
      adjustment_total: adjustmentTotal,
    },
    {
      onConflict: 'player_id,as_of_date',
    }
  );

  if (error) {
    console.error('Error saving dynasty snapshot:', error);
  }
}

/**
 * Get recent adjustment history for a player
 */
export async function getAdjustmentHistory(
  playerId: string,
  days: number = 30
): Promise<
  Array<{
    adjustment_date: string;
    signal_source: string;
    delta: number;
    reason: string;
    confidence: number;
  }>
> {
  const { data, error } = await supabase.rpc('get_recent_dynasty_adjustments', {
    p_player_id: playerId,
    p_days: days,
  });

  if (error) {
    console.error('Error fetching adjustment history:', error);
    return [];
  }

  return data || [];
}

/**
 * Calculate dynasty value changes over time periods
 */
export async function calculateDynastyChanges(
  playerId: string
): Promise<{
  change_7d: number;
  change_30d: number;
}> {
  const { data: snapshots } = await supabase
    .from('dynasty_value_snapshots')
    .select('as_of_date, dynasty_value')
    .eq('player_id', playerId)
    .gte('as_of_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('as_of_date', { ascending: false });

  if (!snapshots || snapshots.length === 0) {
    return { change_7d: 0, change_30d: 0 };
  }

  const currentValue = snapshots[0].dynasty_value;

  // Find value from 7 days ago
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const value7d = snapshots.find(
    (s) => new Date(s.as_of_date) <= sevenDaysAgo
  )?.dynasty_value;

  // Find value from 30 days ago
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const value30d = snapshots.find(
    (s) => new Date(s.as_of_date) <= thirtyDaysAgo
  )?.dynasty_value;

  return {
    change_7d: value7d ? currentValue - value7d : 0,
    change_30d: value30d ? currentValue - value30d : 0,
  };
}
