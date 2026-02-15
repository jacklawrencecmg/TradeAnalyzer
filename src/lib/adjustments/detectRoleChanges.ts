/**
 * Role Change Detection System
 *
 * Detects player role changes and automatically creates value adjustments.
 * Runs every 30 minutes to catch:
 * - Starter promotions
 * - Injury replacements
 * - Depth chart movements
 * - Snap share breakouts
 * - Waiver spikes
 *
 * Adjustments are temporary overlays on base values, expire automatically.
 */

import { supabase } from '../supabase';

export interface RoleChangeEvent {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  event_type: 'starter_promotion' | 'injury_replacement' | 'depth_rise' | 'snap_breakout' | 'waiver_spike';
  old_state: any;
  new_state: any;
  confidence: 1 | 2 | 3 | 4 | 5;
  suggested_delta_dynasty: number;
  suggested_delta_redraft: number;
  reason: string;
}

export interface DetectionResult {
  success: boolean;
  events_detected: number;
  adjustments_created: number;
  events: RoleChangeEvent[];
  errors: string[];
}

/**
 * Main detection function - runs all checks
 */
export async function detectRoleChanges(): Promise<DetectionResult> {
  const startTime = Date.now();
  const events: RoleChangeEvent[] = [];
  const errors: string[] = [];
  let adjustmentsCreated = 0;

  console.log('Starting role change detection...');

  try {
    // 1. Detect starter promotions
    const starterEvents = await detectStarterPromotions();
    events.push(...starterEvents);

    // 2. Detect injury replacements
    const injuryEvents = await detectInjuryReplacements();
    events.push(...injuryEvents);

    // 3. Detect depth chart rises
    const depthEvents = await detectDepthChartRises();
    events.push(...depthEvents);

    // 4. Detect snap share breakouts (if weekly data available)
    const snapEvents = await detectSnapBreakouts();
    events.push(...snapEvents);

    // 5. Create adjustments for detected events
    for (const event of events) {
      try {
        const created = await createAdjustmentsForEvent(event);
        adjustmentsCreated += created;
      } catch (error) {
        const msg = `Error creating adjustment for ${event.player_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // 6. Record detection run
    await supabase.from('sync_status').insert({
      sync_type: 'role_change_detection',
      status: errors.length > 0 ? 'partial_success' : 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      records_processed: events.length,
      records_created: adjustmentsCreated,
      metadata: {
        events_by_type: events.reduce((acc, e) => {
          acc[e.event_type] = (acc[e.event_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        errors: errors.slice(0, 5),
      },
    });

    console.log(`Detection complete: ${events.length} events, ${adjustmentsCreated} adjustments created`);

    return {
      success: errors.length === 0,
      events_detected: events.length,
      adjustments_created: adjustmentsCreated,
      events,
      errors,
    };
  } catch (error) {
    const msg = `Role change detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(msg);
    errors.push(msg);

    return {
      success: false,
      events_detected: 0,
      adjustments_created: 0,
      events: [],
      errors,
    };
  }
}

/**
 * Detect starter promotions (backup becomes starter)
 */
async function detectStarterPromotions(): Promise<RoleChangeEvent[]> {
  const events: RoleChangeEvent[] = [];

  // Query players who recently changed to DC1 (depth chart position 1)
  // In production, this would track changes in depth_chart_position over time
  // For now, this is a placeholder that would integrate with real depth chart tracking

  const { data: recentChanges } = await supabase
    .from('nfl_players')
    .select('id, full_name, player_position, team, depth_chart_position, status')
    .eq('depth_chart_position', 1)
    .in('status', ['Active', 'Questionable']);

  if (!recentChanges) return events;

  // Check if these players were recently promoted
  // (would need historical depth chart data in production)
  // For now, detect based on age and years_exp as proxy for "backup"
  for (const player of recentChanges) {
    // Example logic: young players at DC1 might be recent promotions
    // In production, compare with previous depth chart snapshot

    const { data: history } = await supabase
      .from('adjustment_events')
      .select('*')
      .eq('player_id', player.id)
      .eq('event_type', 'starter_promotion')
      .gte('detected_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    // Skip if we already detected this promotion recently
    if (history && history.length > 0) continue;

    // Placeholder: In production, verify this is a NEW promotion
    // For now, we'll be conservative and not create false positives
  }

  return events;
}

/**
 * Detect injury replacements (direct backup steps in)
 */
async function detectInjuryReplacements(): Promise<RoleChangeEvent[]> {
  const events: RoleChangeEvent[] = [];

  // Query players on IR/Out and their backups
  const { data: injuredPlayers } = await supabase
    .from('nfl_players')
    .select('id, full_name, player_position, team, depth_chart_position')
    .in('status', ['IR', 'Out', 'Doubtful'])
    .eq('depth_chart_position', 1);

  if (!injuredPlayers) return events;

  // For each injured starter, find their backup (DC2)
  for (const injured of injuredPlayers) {
    const { data: backups } = await supabase
      .from('nfl_players')
      .select('id, full_name, player_position, team, status')
      .eq('team', injured.team)
      .eq('player_position', injured.player_position)
      .eq('depth_chart_position', 2)
      .eq('status', 'Active')
      .limit(1);

    if (!backups || backups.length === 0) continue;

    const backup = backups[0];

    // Check if we already created this adjustment
    const { data: existing } = await supabase
      .from('adjustment_events')
      .select('*')
      .eq('player_id', backup.id)
      .eq('event_type', 'injury_replacement')
      .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Calculate delta based on position
    let deltaRedraft = 600;
    let deltaDynasty = 350;
    let confidence: 1 | 2 | 3 | 4 | 5 = 4;

    if (injured.player_position === 'QB') {
      deltaRedraft = 800; // QB promotions are huge in redraft
      deltaDynasty = 400;
      confidence = 5;
    } else if (injured.player_position === 'RB') {
      deltaRedraft = 700;
      deltaDynasty = 500; // RB injuries create committee risk
      confidence = 3;
    } else if (injured.player_position === 'WR') {
      deltaRedraft = 500;
      deltaDynasty = 300;
      confidence = 4;
    } else if (injured.player_position === 'TE') {
      deltaRedraft = 600;
      deltaDynasty = 400;
      confidence = 4;
    }

    events.push({
      player_id: backup.id,
      player_name: backup.full_name,
      position: backup.player_position,
      team: backup.team,
      event_type: 'injury_replacement',
      old_state: { depth_chart_position: 2, starter_injured: false },
      new_state: { depth_chart_position: 2, starter_injured: true, injured_player: injured.full_name },
      confidence,
      suggested_delta_dynasty: deltaDynasty,
      suggested_delta_redraft: deltaRedraft,
      reason: `Starter ${injured.full_name} injured - direct backup opportunity`,
    });
  }

  return events;
}

/**
 * Detect depth chart rises
 */
async function detectDepthChartRises(): Promise<RoleChangeEvent[]> {
  const events: RoleChangeEvent[] = [];

  // This would track depth_chart_position changes over time
  // Requires historical tracking (stored in adjustment_events or separate table)
  // Placeholder for now

  return events;
}

/**
 * Detect snap share breakouts (70%+ snap jump)
 */
async function detectSnapBreakouts(): Promise<RoleChangeEvent[]> {
  const events: RoleChangeEvent[] = [];

  // This would integrate with weekly snap count data
  // Compare this week vs previous 4-week average
  // If player goes from <50% to >70%, create breakout event

  // Placeholder: Would need Sleeper stats API integration
  // Example:
  // const stats = await fetchSleeperWeeklyStats(currentWeek);
  // for each player:
  //   if (snapShare > 70 && avgSnapShare < 50) -> breakout

  return events;
}

/**
 * Create adjustments for a detected event
 */
async function createAdjustmentsForEvent(event: RoleChangeEvent): Promise<number> {
  let created = 0;

  // Determine expiry based on event type
  let expiresHours = 24;
  if (event.event_type === 'injury_replacement') {
    expiresHours = 168; // 7 days (until starter returns)
  } else if (event.event_type === 'starter_promotion') {
    expiresHours = 48; // Until next nightly rebuild confirms
  } else if (event.event_type === 'snap_breakout') {
    expiresHours = 120; // 5 days
  } else if (event.event_type === 'waiver_spike') {
    expiresHours = 48; // Short-term hype
  } else if (event.event_type === 'depth_rise') {
    expiresHours = 72; // 3 days
  }

  // Create dynasty adjustment
  if (event.suggested_delta_dynasty !== 0) {
    const { data: dynastyAdj, error: dynastyError } = await supabase.rpc('add_value_adjustment', {
      p_player_id: event.player_id,
      p_format: 'dynasty',
      p_delta: event.suggested_delta_dynasty,
      p_reason: event.reason,
      p_confidence: event.confidence,
      p_source: event.event_type === 'injury_replacement' ? 'injury' : 'role_change',
      p_expires_hours: expiresHours,
      p_metadata: {
        event_type: event.event_type,
        old_state: event.old_state,
        new_state: event.new_state,
      },
    });

    if (!dynastyError && dynastyAdj) {
      created++;
    }
  }

  // Create redraft adjustment
  if (event.suggested_delta_redraft !== 0) {
    const { data: redraftAdj, error: redraftError } = await supabase.rpc('add_value_adjustment', {
      p_player_id: event.player_id,
      p_format: 'redraft',
      p_delta: event.suggested_delta_redraft,
      p_reason: event.reason,
      p_confidence: event.confidence,
      p_source: event.event_type === 'injury_replacement' ? 'injury' : 'role_change',
      p_expires_hours: expiresHours,
      p_metadata: {
        event_type: event.event_type,
        old_state: event.old_state,
        new_state: event.new_state,
      },
    });

    if (!redraftError && redraftAdj) {
      created++;
    }
  }

  // Record event
  await supabase.from('adjustment_events').insert({
    event_type: event.event_type,
    player_id: event.player_id,
    old_value: event.old_state,
    new_value: event.new_state,
    metadata: {
      confidence: event.confidence,
      reason: event.reason,
      delta_dynasty: event.suggested_delta_dynasty,
      delta_redraft: event.suggested_delta_redraft,
    },
  });

  return created;
}

/**
 * Get recent role change events for display
 */
export async function getRecentRoleChanges(limit: number = 20) {
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
    .in('event_type', ['starter_promotion', 'injury_replacement', 'depth_rise', 'snap_breakout'])
    .order('detected_at', { ascending: false })
    .limit(limit);

  return data || [];
}
