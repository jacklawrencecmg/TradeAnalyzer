import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type AlertType = 'value_spike' | 'value_drop' | 'buy_low' | 'sell_high' | 'role_change' | 'trending_up' | 'trending_down';
type AlertSeverity = 'low' | 'medium' | 'high';

const VALUE_SPIKE_THRESHOLD = 600;
const VALUE_DROP_THRESHOLD = -600;
const TRENDING_UP_THRESHOLD = 300;
const TRENDING_DOWN_THRESHOLD = -300;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting watchlist alerts computation...');

    const { data: watchlistPlayers, error: playersError } = await supabase
      .from('watchlist_players')
      .select('watchlist_id, player_id');

    if (playersError) {
      throw new Error(`Failed to fetch watchlist players: ${playersError.message}`);
    }

    if (!watchlistPlayers || watchlistPlayers.length === 0) {
      console.log('No players in any watchlists');
      return new Response(
        JSON.stringify({ ok: true, message: 'No players to process', alerts_generated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uniquePlayerIds = [...new Set(watchlistPlayers.map(wp => wp.player_id))];
    console.log(`Processing ${uniquePlayerIds.length} unique players in watchlists...`);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const playerDataPromises = uniquePlayerIds.map(async (playerId) => {
      const [valuesResult, trendsResult, snapshotsResult] = await Promise.all([
        supabase
          .from('latest_player_values')
          .select('player_id, player_name, position, team, adjusted_value, metadata')
          .eq('player_id', playerId)
          .maybeSingle(),

        supabase
          .from('player_market_trends')
          .select('tag, signal_strength')
          .eq('player_id', playerId)
          .order('computed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('ktc_value_snapshots')
          .select('fdp_value, snapshot_date')
          .eq('player_id', playerId)
          .gte('snapshot_date', sevenDaysAgo.toISOString())
          .order('snapshot_date', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (valuesResult.error || !valuesResult.data) return null;

      const player = valuesResult.data;
      const trend = trendsResult.data;
      const snapshot = snapshotsResult.data;

      const value_now = player.adjusted_value || 0;
      const value_7d = snapshot?.fdp_value || value_now;
      const change_7d = value_now - value_7d;
      const change_7d_pct = value_7d > 0 ? ((change_7d / value_7d) * 100) : 0;

      return {
        player_id: player.player_id,
        player_name: player.player_name,
        position: player.position,
        team: player.team,
        value_now,
        value_7d,
        change_7d,
        change_7d_pct: Math.round(change_7d_pct * 10) / 10,
        trend_tag: trend?.tag,
        signal_strength: trend?.signal_strength,
        rb_context: player.rb_context,
      };
    });

    const playerDataResults = await Promise.all(playerDataPromises);
    const playerData = playerDataResults.filter(p => p !== null);

    console.log(`Got data for ${playerData.length} players`);

    const alertsToInsert = [];

    for (const player of playerData) {
      const alerts = computePlayerAlerts(player);

      for (const alert of alerts) {
        const affectedWatchlists = watchlistPlayers
          .filter(wp => wp.player_id === player.player_id)
          .map(wp => wp.watchlist_id);

        for (const watchlistId of affectedWatchlists) {
          const { data: existingAlert } = await supabase
            .from('watchlist_alerts')
            .select('id')
            .eq('watchlist_id', watchlistId)
            .eq('player_id', alert.player_id)
            .eq('alert_type', alert.alert_type)
            .gte('created_at', sevenDaysAgo.toISOString())
            .maybeSingle();

          if (!existingAlert) {
            alertsToInsert.push({
              watchlist_id: watchlistId,
              player_id: alert.player_id,
              alert_type: alert.alert_type,
              message: alert.message,
              severity: alert.severity,
              metadata: alert.metadata,
            });
          }
        }
      }
    }

    console.log(`Inserting ${alertsToInsert.length} alerts...`);

    if (alertsToInsert.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < alertsToInsert.length; i += batchSize) {
        const batch = alertsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('watchlist_alerts')
          .insert(batch);

        if (insertError) {
          console.error('Error inserting alerts batch:', insertError);
        }
      }
    }

    await supabase.rpc('clean_old_alerts');

    console.log('Watchlist alerts computation complete!');

    return new Response(
      JSON.stringify({
        ok: true,
        players_processed: playerData.length,
        alerts_generated: alertsToInsert.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error computing watchlist alerts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function computePlayerAlerts(player: any): any[] {
  const alerts = [];

  if (player.change_7d >= VALUE_SPIKE_THRESHOLD) {
    const severity = player.change_7d >= 1000 ? 'high' : player.change_7d >= 800 ? 'medium' : 'low';

    alerts.push({
      player_id: player.player_id,
      alert_type: 'value_spike',
      message: `${player.player_name} spiked +${player.change_7d.toLocaleString()} (${player.change_7d_pct > 0 ? '+' : ''}${player.change_7d_pct}%) in 7 days!`,
      severity,
      metadata: {
        value_now: player.value_now,
        value_7d: player.value_7d,
        change_7d: player.change_7d,
        change_7d_pct: player.change_7d_pct,
      },
    });
  }

  if (player.change_7d <= VALUE_DROP_THRESHOLD) {
    const severity = player.change_7d <= -1000 ? 'high' : player.change_7d <= -800 ? 'medium' : 'low';

    alerts.push({
      player_id: player.player_id,
      alert_type: 'value_drop',
      message: `${player.player_name} dropped ${player.change_7d.toLocaleString()} (${player.change_7d_pct}%) in 7 days`,
      severity,
      metadata: {
        value_now: player.value_now,
        value_7d: player.value_7d,
        change_7d: player.change_7d,
        change_7d_pct: player.change_7d_pct,
      },
    });
  }

  if (player.change_7d >= TRENDING_UP_THRESHOLD && player.change_7d < VALUE_SPIKE_THRESHOLD) {
    alerts.push({
      player_id: player.player_id,
      alert_type: 'trending_up',
      message: `${player.player_name} is trending up +${player.change_7d.toLocaleString()} this week`,
      severity: 'low',
      metadata: {
        value_now: player.value_now,
        change_7d: player.change_7d,
        change_7d_pct: player.change_7d_pct,
      },
    });
  }

  if (player.change_7d <= TRENDING_DOWN_THRESHOLD && player.change_7d > VALUE_DROP_THRESHOLD) {
    alerts.push({
      player_id: player.player_id,
      alert_type: 'trending_down',
      message: `${player.player_name} is trending down ${player.change_7d.toLocaleString()} this week`,
      severity: 'low',
      metadata: {
        value_now: player.value_now,
        change_7d: player.change_7d,
        change_7d_pct: player.change_7d_pct,
      },
    });
  }

  if (player.trend_tag === 'buy_low') {
    alerts.push({
      player_id: player.player_id,
      alert_type: 'buy_low',
      message: `${player.player_name} is now a BUY LOW opportunity! (Signal: ${player.signal_strength}%)`,
      severity: player.signal_strength && player.signal_strength >= 80 ? 'high' : 'medium',
      metadata: {
        value_now: player.value_now,
        trend_tag: player.trend_tag,
        signal_strength: player.signal_strength,
        change_7d: player.change_7d,
      },
    });
  }

  if (player.trend_tag === 'sell_high') {
    alerts.push({
      player_id: player.player_id,
      alert_type: 'sell_high',
      message: `${player.player_name} is now a SELL HIGH opportunity! (Signal: ${player.signal_strength}%)`,
      severity: player.signal_strength && player.signal_strength >= 80 ? 'high' : 'medium',
      metadata: {
        value_now: player.value_now,
        trend_tag: player.trend_tag,
        signal_strength: player.signal_strength,
        change_7d: player.change_7d,
      },
    });
  }

  return alerts;
}
