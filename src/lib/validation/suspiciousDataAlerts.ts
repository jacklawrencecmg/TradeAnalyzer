/**
 * Suspicious Data Alert System
 *
 * Monitors for suspicious patterns in incoming data that could
 * indicate provider outages or data corruption.
 *
 * Triggers alerts for:
 * - 15%+ players changing teams
 * - 25%+ value shift expected
 * - Entire position group spikes
 * - Data source outages
 */

import { supabase } from '../supabase';

interface AlertTrigger {
  triggered: boolean;
  alertType: 'team_change_spike' | 'value_shift_spike' | 'position_spike' | 'data_outage' | 'low_confidence' | 'cross_source_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
}

/**
 * Check for team change spike
 */
export async function checkTeamChangeSpike(batchId: string): Promise<AlertTrigger | null> {
  // Get batch data
  const { data: batchData } = await supabase
    .from('raw_market_ranks')
    .select('player_id, player_name, position')
    .eq('batch_id', batchId);

  if (!batchData || batchData.length === 0) return null;

  // Get current player teams
  const playerIds = batchData.map(p => p.player_id);
  const { data: currentPlayers } = await supabase
    .from('nfl_players')
    .select('player_id, full_name, team')
    .in('player_id', playerIds);

  const currentTeamMap = new Map(
    currentPlayers?.map(p => [p.player_id, p.team]) || []
  );

  // Get previous teams from validated data
  const { data: previousData } = await supabase
    .from('validated_market_ranks')
    .select('player_id, player_name')
    .in('player_id', playerIds)
    .order('validated_at', { ascending: false });

  // Check how many would change teams
  let teamChanges = 0;
  const changedPlayers: string[] = [];

  for (const player of batchData) {
    const currentTeam = currentTeamMap.get(player.player_id);
    const previous = previousData?.find(p => p.player_id === player.player_id);

    if (previous && currentTeam && previous.player_name !== player.player_name) {
      teamChanges++;
      changedPlayers.push(player.player_name);
    }
  }

  const changeRate = teamChanges / batchData.length;

  // Alert if > 15% team changes
  if (changeRate > 0.15) {
    return {
      triggered: true,
      alertType: 'team_change_spike',
      severity: changeRate > 0.3 ? 'critical' : 'high',
      message: `${teamChanges} players (${(changeRate * 100).toFixed(1)}%) appear to have changed teams`,
      details: {
        total_players: batchData.length,
        team_changes: teamChanges,
        change_rate: changeRate,
        sample_players: changedPlayers.slice(0, 10),
      },
    };
  }

  return null;
}

/**
 * Check for value shift spike
 */
export async function checkValueShiftSpike(batchId: string): Promise<AlertTrigger | null> {
  const { data: batchData } = await supabase
    .from('raw_market_ranks')
    .select('player_id, player_name, value, rank_overall')
    .eq('batch_id', batchId)
    .not('value', 'is', null);

  if (!batchData || batchData.length === 0) return null;

  // Get previous values
  const playerIds = batchData.map(p => p.player_id);
  const { data: previousValues } = await supabase
    .from('validated_market_ranks')
    .select('player_id, value')
    .in('player_id', playerIds)
    .not('value', 'is', null)
    .order('validated_at', { ascending: false });

  const previousValueMap = new Map(
    previousValues?.map(p => [p.player_id, p.value]) || []
  );

  // Calculate value shifts
  let significantShifts = 0;
  const shiftedPlayers: Array<{
    name: string;
    old_value: number;
    new_value: number;
    change_pct: number;
  }> = [];

  for (const player of batchData) {
    const previousValue = previousValueMap.get(player.player_id);
    if (!previousValue || !player.value) continue;

    const change = Math.abs(player.value - previousValue);
    const changePct = change / previousValue;

    if (changePct > 0.25) {
      significantShifts++;
      shiftedPlayers.push({
        name: player.player_name,
        old_value: previousValue,
        new_value: player.value,
        change_pct: changePct,
      });
    }
  }

  const shiftRate = significantShifts / batchData.length;

  // Alert if > 25% players have significant value shifts
  if (shiftRate > 0.25) {
    return {
      triggered: true,
      alertType: 'value_shift_spike',
      severity: shiftRate > 0.5 ? 'critical' : 'high',
      message: `${significantShifts} players (${(shiftRate * 100).toFixed(1)}%) have >25% value shifts`,
      details: {
        total_players: batchData.length,
        significant_shifts: significantShifts,
        shift_rate: shiftRate,
        sample_players: shiftedPlayers.slice(0, 10),
      },
    };
  }

  return null;
}

/**
 * Check for position spike
 */
export async function checkPositionSpike(batchId: string): Promise<AlertTrigger | null> {
  const { data: batchData } = await supabase
    .from('raw_market_ranks')
    .select('player_id, player_name, position, rank_overall, value')
    .eq('batch_id', batchId);

  if (!batchData || batchData.length === 0) return null;

  // Group by position
  const positionGroups = new Map<string, Array<{ value: number; rank: number }>>();

  batchData.forEach(player => {
    if (!player.position || !player.value) return;

    if (!positionGroups.has(player.position)) {
      positionGroups.set(player.position, []);
    }

    positionGroups.get(player.position)!.push({
      value: player.value,
      rank: player.rank_overall || 999,
    });
  });

  // Check each position group for spikes
  const suspiciousPositions: Array<{
    position: string;
    avg_value: number;
    player_count: number;
    reason: string;
  }> = [];

  for (const [position, players] of positionGroups.entries()) {
    if (players.length < 5) continue;

    const avgValue = players.reduce((sum, p) => sum + p.value, 0) / players.length;
    const avgRank = players.reduce((sum, p) => sum + p.rank, 0) / players.length;

    // Expected ranges by position
    const expectedRanges: Record<string, { minValue: number; maxValue: number; avgRank: number }> = {
      QB: { minValue: 1000, maxValue: 8000, avgRank: 50 },
      RB: { minValue: 1000, maxValue: 8000, avgRank: 50 },
      WR: { minValue: 1000, maxValue: 8000, avgRank: 50 },
      TE: { minValue: 500, maxValue: 6000, avgRank: 100 },
    };

    const expected = expectedRanges[position];
    if (!expected) continue;

    // Check if entire position group is outside expected range
    if (avgValue < expected.minValue || avgValue > expected.maxValue) {
      suspiciousPositions.push({
        position,
        avg_value: avgValue,
        player_count: players.length,
        reason: `Average value ${avgValue.toFixed(0)} outside expected range ${expected.minValue}-${expected.maxValue}`,
      });
    }
  }

  if (suspiciousPositions.length > 0) {
    return {
      triggered: true,
      alertType: 'position_spike',
      severity: suspiciousPositions.length > 1 ? 'critical' : 'high',
      message: `${suspiciousPositions.length} position groups have suspicious value patterns`,
      details: {
        suspicious_positions: suspiciousPositions,
      },
    };
  }

  return null;
}

/**
 * Check for data source outage
 */
export async function checkDataOutage(source: string, tableName: string): Promise<AlertTrigger | null> {
  const { data: sourceHealth } = await supabase
    .from('data_source_health')
    .select('*')
    .eq('source', source)
    .eq('table_name', tableName)
    .single();

  if (!sourceHealth) return null;

  // Check if source has failed multiple times recently
  if (sourceHealth.status === 'offline' || sourceHealth.status === 'unhealthy') {
    const hoursSinceSuccess = sourceHealth.last_successful_import
      ? (Date.now() - new Date(sourceHealth.last_successful_import).getTime()) / (1000 * 60 * 60)
      : 999;

    if (hoursSinceSuccess > 24) {
      return {
        triggered: true,
        alertType: 'data_outage',
        severity: 'critical',
        message: `Data source ${source} has been offline for ${hoursSinceSuccess.toFixed(1)} hours`,
        details: {
          source,
          table_name: tableName,
          status: sourceHealth.status,
          reliability_score: sourceHealth.reliability_score,
          last_successful_import: sourceHealth.last_successful_import,
          failed_batches: sourceHealth.failed_batches,
        },
      };
    }
  }

  return null;
}

/**
 * Monitor all suspicious patterns for a batch
 */
export async function monitorBatch(
  batchId: string,
  source: string,
  tableName: string
): Promise<AlertTrigger[]> {
  const alerts: AlertTrigger[] = [];

  // Run all checks in parallel
  const [teamChangeAlert, valueShiftAlert, positionSpikeAlert, outageAlert] = await Promise.all([
    checkTeamChangeSpike(batchId),
    checkValueShiftSpike(batchId),
    checkPositionSpike(batchId),
    checkDataOutage(source, tableName),
  ]);

  if (teamChangeAlert) alerts.push(teamChangeAlert);
  if (valueShiftAlert) alerts.push(valueShiftAlert);
  if (positionSpikeAlert) alerts.push(positionSpikeAlert);
  if (outageAlert) alerts.push(outageAlert);

  return alerts;
}

/**
 * Create alert in database
 */
export async function createAlert(batchId: string, alert: AlertTrigger): Promise<void> {
  await supabase.from('data_quality_alerts').insert({
    batch_id: batchId,
    alert_type: alert.alertType,
    severity: alert.severity,
    message: alert.message,
    details: alert.details,
  });
}

/**
 * Send alerts for a batch (create database records)
 */
export async function sendAlertsForBatch(
  batchId: string,
  source: string,
  tableName: string
): Promise<void> {
  const alerts = await monitorBatch(batchId, source, tableName);

  for (const alert of alerts) {
    await createAlert(batchId, alert);
  }

  // If critical alerts, update batch metadata
  const hasCritical = alerts.some(a => a.severity === 'critical');
  if (hasCritical) {
    await supabase
      .from('data_batch_metadata')
      .update({
        processing_status: 'quarantined',
        validation_errors: { alerts: alerts.map(a => a.message) },
      })
      .eq('batch_id', batchId);
  }
}
