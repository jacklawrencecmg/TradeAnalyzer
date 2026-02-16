import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ValueSnapshot {
  fdp_value: number;
  snapshot_date: string;
}

function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

function interpolateValue(snapshots: ValueSnapshot[], daysAgo: number): number {
  if (snapshots.length === 0) return 0;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  targetDate.setHours(0, 0, 0, 0);

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );

  const exactMatch = sorted.find(s => {
    const snapDate = new Date(s.snapshot_date);
    snapDate.setHours(0, 0, 0, 0);
    return snapDate.getTime() === targetDate.getTime();
  });

  if (exactMatch) return exactMatch.fdp_value;

  let before: ValueSnapshot | null = null;
  let after: ValueSnapshot | null = null;

  for (const snapshot of sorted) {
    const snapDate = new Date(snapshot.snapshot_date);
    snapDate.setHours(0, 0, 0, 0);

    if (snapDate.getTime() <= targetDate.getTime()) {
      before = snapshot;
    } else if (snapDate.getTime() > targetDate.getTime() && !after) {
      after = snapshot;
      break;
    }
  }

  if (before && after) {
    const beforeDate = new Date(before.snapshot_date).getTime();
    const afterDate = new Date(after.snapshot_date).getTime();
    const targetTime = targetDate.getTime();

    const ratio = (targetTime - beforeDate) / (afterDate - beforeDate);
    return before.fdp_value + ratio * (after.fdp_value - before.fdp_value);
  }

  if (before) return before.fdp_value;
  if (after) return after.fdp_value;

  return sorted[sorted.length - 1].fdp_value;
}

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

    console.log('Starting market trends computation...');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: players, error: playersError } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, position, team, adjusted_value');

    if (playersError) {
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    console.log(`Processing ${players?.length || 0} players...`);

    const trends = [];
    const batchSize = 50;

    for (let i = 0; i < (players?.length || 0); i += batchSize) {
      const batch = players!.slice(i, i + batchSize);
      const playerIds = batch.map(p => p.player_id);

      const { data: snapshots, error: snapshotsError } = await supabase
        .from('ktc_value_snapshots')
        .select('player_id, fdp_value, snapshot_date')
        .in('player_id', playerIds)
        .gte('snapshot_date', thirtyDaysAgo.toISOString())
        .order('snapshot_date', { ascending: false });

      if (snapshotsError) {
        console.error('Error fetching snapshots:', snapshotsError);
        continue;
      }

      const snapshotsByPlayer = new Map<string, ValueSnapshot[]>();
      snapshots?.forEach(s => {
        if (!snapshotsByPlayer.has(s.player_id)) {
          snapshotsByPlayer.set(s.player_id, []);
        }
        snapshotsByPlayer.get(s.player_id)!.push({
          fdp_value: s.fdp_value,
          snapshot_date: s.snapshot_date,
        });
      });

      for (const player of batch) {
        const playerSnapshots = snapshotsByPlayer.get(player.player_id) || [];

        if (playerSnapshots.length === 0) continue;

        const sorted = [...playerSnapshots].sort(
          (a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
        );

        const valueNow = sorted.length > 0 ? sorted[0].fdp_value : player.adjusted_value;
        if (valueNow < 500) continue;

        const value7d = interpolateValue(playerSnapshots, 7);
        const value30d = interpolateValue(playerSnapshots, 30);

        const change7d = valueNow - value7d;
        const change30d = valueNow - value30d;

        const change7dPct = value7d > 0 ? (change7d / value7d) * 100 : 0;
        const change30dPct = value30d > 0 ? (change30d / value30d) * 100 : 0;

        const recentValues = sorted.slice(0, Math.min(14, sorted.length)).map(s => s.fdp_value);
        const volatility = calculateVolatility(recentValues);

        const weeklyChanges: number[] = [];
        for (let j = 0; j < sorted.length - 7; j += 7) {
          const current = sorted[j].fdp_value;
          const weekAgo = sorted[Math.min(j + 7, sorted.length - 1)].fdp_value;
          weeklyChanges.push(current - weekAgo);
        }

        const recentWeeklyAvgChange = weeklyChanges.length > 0
          ? weeklyChanges.reduce((sum, c) => sum + c, 0) / weeklyChanges.length
          : 0;

        const volatilityRatio = volatility / Math.max(valueNow, 1);
        const isVolatilityStabilizing = volatilityRatio < 0.15;

        let tag = 'stable';
        let signalStrength = 0;

        if (change30d <= -700 && isVolatilityStabilizing && valueNow >= 1000) {
          tag = 'buy_low';
          signalStrength = Math.min(100, Math.abs(change30d) / 10);
        } else {
          const isSpike = Math.abs(change7d) > Math.abs(recentWeeklyAvgChange) * 2;
          if (change30d >= 900 && isSpike) {
            tag = 'sell_high';
            signalStrength = Math.min(100, change30d / 15);
          } else if (change7d >= 250 && change7d <= 900) {
            tag = 'rising';
            signalStrength = Math.min(100, change7d / 10);
          } else if (change7d <= -250 && change7d >= -900) {
            tag = 'falling';
            signalStrength = Math.min(100, Math.abs(change7d) / 10);
          }
        }

        trends.push({
          player_id: player.player_id,
          player_name: player.player_name,
          player_position: player.position,
          team: player.team,
          value_now: Math.round(valueNow),
          value_7d: Math.round(value7d),
          value_30d: Math.round(value30d),
          change_7d: Math.round(change7d),
          change_30d: Math.round(change30d),
          change_7d_pct: Math.round(change7dPct * 10) / 10,
          change_30d_pct: Math.round(change30dPct * 10) / 10,
          volatility: Math.round(volatility),
          tag,
          signal_strength: Math.round(signalStrength),
          computed_at: new Date().toISOString(),
        });
      }

      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(players!.length / batchSize)}`);
    }

    console.log(`Computed ${trends.length} trends. Storing in database...`);

    if (trends.length > 0) {
      const insertBatchSize = 100;
      for (let i = 0; i < trends.length; i += insertBatchSize) {
        const batch = trends.slice(i, i + insertBatchSize);

        const { error: insertError } = await supabase
          .from('player_market_trends')
          .insert(batch);

        if (insertError) {
          console.error('Error inserting trends batch:', insertError);
        }
      }
    }

    await supabase.rpc('clean_old_market_trends');

    const trendCounts = {
      buy_low: trends.filter(t => t.tag === 'buy_low').length,
      sell_high: trends.filter(t => t.tag === 'sell_high').length,
      rising: trends.filter(t => t.tag === 'rising').length,
      falling: trends.filter(t => t.tag === 'falling').length,
      stable: trends.filter(t => t.tag === 'stable').length,
    };

    console.log('Market trends computation complete!', trendCounts);

    return new Response(
      JSON.stringify({
        ok: true,
        trends_computed: trends.length,
        counts: trendCounts,
        computed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error computing market trends:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
