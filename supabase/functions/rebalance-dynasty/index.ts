import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    const playerId = url.searchParams.get('player_id');

    // Check authorization
    const authHeader = req.headers.get('Authorization');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');
    const cronSecret = Deno.env.get('CRON_SECRET');

    const isAuthorized =
      (authHeader && authHeader === `Bearer ${adminSecret}`) ||
      (secret && secret === cronSecret);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Single player rebalance
    if (playerId) {
      const result = await rebalanceSinglePlayer(supabase, playerId);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Full weekly rebalance
    const result = await runWeeklyRebalance(supabase);

    return new Response(
      JSON.stringify({
        success: result.success,
        stats_synced: result.stats_synced,
        players_rebalanced: result.players_rebalanced,
        snapshots_saved: result.snapshots_saved,
        errors: result.errors.slice(0, 10), // Limit error output
        message: `Rebalanced ${result.players_rebalanced} players, synced ${result.stats_synced} stats`,
      }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Dynasty rebalance error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getCurrentSeasonWeek(): { season: number; week: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let season = year;
  if (month >= 9) {
    season = year;
  } else if (month <= 2) {
    season = year - 1;
  } else {
    season = year - 1;
  }

  let week = 1;
  if (month === 9) week = Math.min(Math.floor((now.getDate() - 1) / 7) + 1, 4);
  else if (month === 10) week = 5 + Math.min(Math.floor((now.getDate() - 1) / 7), 3);
  else if (month === 11) week = 9 + Math.min(Math.floor((now.getDate() - 1) / 7), 3);
  else if (month === 12) week = 13 + Math.min(Math.floor((now.getDate() - 1) / 7), 3);
  else if (month === 1) week = 17 + Math.min(Math.floor((now.getDate() - 1) / 7), 1);
  else if (month === 2 && now.getDate() <= 14) week = 18;

  return { season, week };
}

function isInSeason(): boolean {
  const month = new Date().getMonth() + 1;
  return month >= 9 || month <= 2;
}

async function runWeeklyRebalance(supabase: any): Promise<any> {
  const result = {
    success: false,
    stats_synced: 0,
    players_rebalanced: 0,
    snapshots_saved: 0,
    errors: [] as string[],
  };

  try {
    const { season, week } = getCurrentSeasonWeek();
    console.log(`Starting rebalance for ${season} week ${week}`);

    // Get top 1000 players
    const { data: players } = await supabase
      .from('player_values')
      .select('player_id, player_name, position, base_value, fdp_value')
      .not('position', 'in', '(K,P,LS)')
      .order('fdp_value', { ascending: false })
      .limit(1000);

    if (!players || players.length === 0) {
      result.errors.push('No players found');
      return result;
    }

    const today = new Date().toISOString().split('T')[0];
    const weights = isInSeason() ? { perf: 0.65, market: 0.35 } : { perf: 0.35, market: 0.65 };

    for (const player of players) {
      try {
        // Simple trend calculation (performance weight only for now)
        const { data: recentStats } = await supabase
          .from('weekly_player_stats')
          .select('fantasy_points')
          .eq('player_id', player.player_id)
          .eq('season', season)
          .order('week', { ascending: false })
          .limit(4);

        let delta = 0;
        let reason = 'No significant change';

        if (recentStats && recentStats.length >= 2) {
          const recent2 = recentStats.slice(0, 2);
          const recent4 = recentStats.slice(0, 4);

          const avg2 = recent2.reduce((s: number, r: any) => s + r.fantasy_points, 0) / recent2.length;
          const avg4 = recent4.reduce((s: number, r: any) => s + r.fantasy_points, 0) / recent4.length;

          if (avg2 > avg4 * 1.35) {
            delta = 400;
            reason = `Breakout: ${avg2.toFixed(1)} vs ${avg4.toFixed(1)} PPG`;
          } else if (avg2 < avg4 * 0.65) {
            delta = -400;
            reason = `Slump: ${avg2.toFixed(1)} vs ${avg4.toFixed(1)} PPG`;
          } else if (avg2 > avg4 * 1.15) {
            delta = 200;
            reason = `Trending up: ${avg2.toFixed(1)} vs ${avg4.toFixed(1)} PPG`;
          } else if (avg2 < avg4 * 0.85) {
            delta = -200;
            reason = `Trending down: ${avg2.toFixed(1)} vs ${avg4.toFixed(1)} PPG`;
          }
        }

        if (delta !== 0) {
          // Save adjustment
          await supabase.from('dynasty_adjustments').upsert({
            player_id: player.player_id,
            as_of_date: today,
            signal_source: 'blended',
            delta,
            reason,
            confidence: 0.7,
          }, { onConflict: 'player_id,as_of_date,signal_source' });

          // Calculate total adjustments (last 30 days)
          const { data: totalData } = await supabase.rpc('calculate_dynasty_adjustment_total', {
            p_player_id: player.player_id,
            p_days: 30,
          });

          const adjustmentTotal = totalData || 0;
          const baseDynastyValue = player.fdp_value || player.base_value || 0;
          const newDynastyValue = Math.max(0, Math.min(10000, baseDynastyValue + adjustmentTotal));

          // Update player value
          await supabase
            .from('player_values')
            .update({ fdp_value: newDynastyValue })
            .eq('player_id', player.player_id);

          // Save snapshot
          await supabase.from('dynasty_value_snapshots').upsert({
            player_id: player.player_id,
            as_of_date: today,
            dynasty_value: newDynastyValue,
            base_dynasty_value: baseDynastyValue,
            adjustment_total: adjustmentTotal,
          }, { onConflict: 'player_id,as_of_date' });

          result.players_rebalanced++;
          result.snapshots_saved++;
        }
      } catch (err) {
        result.errors.push(`Error: ${player.player_name}`);
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown');
    return result;
  }
}

async function rebalanceSinglePlayer(supabase: any, playerId: string): Promise<any> {
  try {
    const { data: player } = await supabase
      .from('player_values')
      .select('player_name, fdp_value, base_value')
      .eq('player_id', playerId)
      .maybeSingle();

    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    const today = new Date().toISOString().split('T')[0];
    const baseDynastyValue = player.fdp_value || player.base_value || 0;

    // Get adjustments
    const { data: totalData } = await supabase.rpc('calculate_dynasty_adjustment_total', {
      p_player_id: playerId,
      p_days: 30,
    });

    const adjustmentTotal = totalData || 0;
    const dynastyValue = Math.max(0, Math.min(10000, baseDynastyValue + adjustmentTotal));

    // Update
    await supabase
      .from('player_values')
      .update({ fdp_value: dynastyValue })
      .eq('player_id', playerId);

    // Snapshot
    await supabase.from('dynasty_value_snapshots').upsert({
      player_id: playerId,
      as_of_date: today,
      dynasty_value: dynastyValue,
      base_dynasty_value: baseDynastyValue,
      adjustment_total: adjustmentTotal,
    }, { onConflict: 'player_id,as_of_date' });

    return {
      success: true,
      dynasty_value: dynastyValue,
      adjustment_total: adjustmentTotal,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown',
    };
  }
}
