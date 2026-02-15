/**
 * Top 1000 Builder
 *
 * Builds the canonical Top 1000 fantasy players list including offense and IDP.
 * Combines calculated values with any scraped market values.
 */

import { supabase } from '../supabase';
import { calculatePlayerValues } from './calculateValues';

export interface Top1000Options {
  format?: string;
  includeIdp?: boolean;
  limit?: number;
}

export interface Top1000Player {
  rank: number;
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  dynasty_value: number;
  redraft_value: number;
  overall_value: number;
  status: string;
  age: number | null;
  source: string;
  captured_at: string;
}

/**
 * Build Top 1000 list and store in database
 * Returns the generated list and storage stats
 */
export async function buildTop1000(
  options: Top1000Options = {}
): Promise<{
  success: boolean;
  list: Top1000Player[];
  stats: {
    total: number;
    offense: number;
    idp: number;
    with_market_values: number;
    calculated_values: number;
  };
  error?: string;
}> {
  const startTime = Date.now();
  const format = options.format || 'dynasty_combined';
  const includeIdp = options.includeIdp !== false; // default true
  const limit = options.limit || 1000;

  try {
    console.log(`Building Top ${limit} list (format: ${format}, IDP: ${includeIdp})...`);

    // Step 1: Load all active/rosterable players
    const { data: players, error: playersError } = await supabase
      .from('nfl_players')
      .select('*')
      .in('status', ['Active', 'IR', 'PUP', 'Practice Squad', 'FA', 'Suspension']);

    if (playersError) throw playersError;
    if (!players || players.length === 0) {
      throw new Error('No players found in database');
    }

    console.log(`Loaded ${players.length} players`);

    // Step 2: Calculate values for all players
    const valuedPlayers = [];
    const offensePositions = ['QB', 'RB', 'WR', 'TE'];
    const idpPositions = ['DL', 'LB', 'DB'];

    for (const player of players) {
      const position = player.player_position;

      // Filter by position based on includeIdp
      if (!offensePositions.includes(position) && !idpPositions.includes(position)) {
        continue; // Skip K, DEF, etc.
      }

      if (!includeIdp && idpPositions.includes(position)) {
        continue; // Skip IDP if not included
      }

      // Calculate values
      const values = calculatePlayerValues({
        id: player.id,
        full_name: player.full_name,
        player_position: position,
        team: player.team,
        status: player.status,
        years_exp: player.years_exp,
        depth_chart_position: player.depth_chart_position,
        injury_status: player.injury_status,
        birthdate: player.birthdate,
        metadata: player.metadata,
      });

      // Calculate overall value (average of dynasty and redraft)
      const overallValue = Math.round((values.dynasty_value + values.redraft_value) / 2);

      valuedPlayers.push({
        player_id: player.id,
        full_name: player.full_name,
        position,
        team: player.team,
        dynasty_value: values.dynasty_value,
        redraft_value: values.redraft_value,
        overall_value: overallValue,
        status: player.status,
        age: calculateAge(player.birthdate, player.metadata),
        source: 'calculated',
        captured_at: new Date().toISOString(),
        notes: values.notes.join('; '),
      });
    }

    console.log(`Calculated values for ${valuedPlayers.length} players`);

    // Step 3: Sort by overall value and rank
    valuedPlayers.sort((a, b) => b.overall_value - a.overall_value);

    const topPlayers: Top1000Player[] = valuedPlayers.slice(0, limit).map((p, idx) => ({
      rank: idx + 1,
      ...p,
    }));

    // Step 4: Insert value snapshots
    const snapshots = topPlayers.map(p => ({
      player_id: p.player_id,
      source: p.source,
      format,
      position: p.position,
      position_rank: null,
      market_value: null,
      fdp_value: p.overall_value,
      dynasty_value: p.dynasty_value,
      redraft_value: p.redraft_value,
      notes: p['notes'] || null,
      captured_at: p.captured_at,
    }));

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < snapshots.length; i += batchSize) {
      const batch = snapshots.slice(i, i + batchSize);
      const { error } = await supabase.from('value_snapshots').insert(batch);
      if (error) {
        console.error('Error inserting value snapshots batch:', error);
      }
    }

    console.log(`Inserted ${snapshots.length} value snapshots`);

    // Step 5: Store in top_1000_current
    const stats = {
      total: topPlayers.length,
      offense: topPlayers.filter(p => offensePositions.includes(p.position)).length,
      idp: topPlayers.filter(p => idpPositions.includes(p.position)).length,
      with_market_values: 0,
      calculated_values: topPlayers.length,
    };

    const { error: top1000Error } = await supabase
      .from('top_1000_current')
      .upsert(
        {
          as_of_date: new Date().toISOString().split('T')[0],
          format,
          items: topPlayers,
          offense_count: stats.offense,
          idp_count: stats.idp,
          total_count: stats.total,
        },
        { onConflict: 'as_of_date,format' }
      );

    if (top1000Error) {
      console.error('Error storing top 1000:', top1000Error);
    }

    const duration = Date.now() - startTime;

    // Record sync status
    await supabase.from('sync_status').insert({
      sync_type: 'build_top1000',
      status: 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      records_processed: valuedPlayers.length,
      records_created: topPlayers.length,
      metadata: { format, includeIdp, stats },
    });

    console.log(`Top ${limit} built in ${duration}ms:`, stats);

    return {
      success: true,
      list: topPlayers,
      stats,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('Build Top 1000 failed:', errorMessage);

    // Record failed sync
    await supabase.from('sync_status').insert({
      sync_type: 'build_top1000',
      status: 'error',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      error_message: errorMessage,
    });

    return {
      success: false,
      list: [],
      stats: { total: 0, offense: 0, idp: 0, with_market_values: 0, calculated_values: 0 },
      error: errorMessage,
    };
  }
}

/**
 * Get current Top 1000 list from database
 */
export async function getTop1000(
  format: string = 'dynasty_combined',
  asOfDate?: string
): Promise<Top1000Player[]> {
  const targetDate = asOfDate || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('top_1000_current')
    .select('items')
    .eq('format', format)
    .eq('as_of_date', targetDate)
    .maybeSingle();

  if (error) {
    console.error('Error fetching Top 1000:', error);
    return [];
  }

  return (data?.items as Top1000Player[]) || [];
}

/**
 * Calculate age from birthdate
 */
function calculateAge(birthdate: string | null, metadata: any): number | null {
  if (metadata?.age) return metadata.age;

  if (!birthdate) return null;

  try {
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch (e) {
    return null;
  }
}

/**
 * Run full sync pipeline: Sleeper players + Build Top 1000
 */
export async function runFullSync(options: Top1000Options = {}): Promise<{
  success: boolean;
  players_sync: any;
  top1000_build: any;
  total_duration_ms: number;
}> {
  const startTime = Date.now();

  console.log('Starting full sync pipeline...');

  // Step 1: Sync Sleeper players
  const { syncSleeperPlayers } = await import('./syncSleeperPlayers');
  const playersSync = await syncSleeperPlayers();

  if (!playersSync.success) {
    console.error('Player sync failed, aborting');
    return {
      success: false,
      players_sync: playersSync,
      top1000_build: null,
      total_duration_ms: Date.now() - startTime,
    };
  }

  // Step 2: Build Top 1000
  const top1000Build = await buildTop1000(options);

  const totalDuration = Date.now() - startTime;

  console.log(`Full sync complete in ${totalDuration}ms`);

  return {
    success: playersSync.success && top1000Build.success,
    players_sync: playersSync,
    top1000_build: top1000Build,
    total_duration_ms: totalDuration,
  };
}
