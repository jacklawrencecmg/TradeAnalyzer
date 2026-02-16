import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const playerId = url.searchParams.get('id') || '';
    const format = url.searchParams.get('format') || 'dynasty_sf';
    const daysBack = parseInt(url.searchParams.get('days') || '180', 10);

    console.log('Player detail request:', { playerId, format, daysBack });

    if (!playerId) {
      console.error('No player ID provided');
      return new Response(
        JSON.stringify({ ok: false, error: 'Player ID required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cacheKey = `player_${playerId}_${format}_${daysBack}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(
        JSON.stringify(cached.data),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log('Fetching latest snapshot for player:', playerId);

    const { data: latestSnapshot, error: latestError } = await supabase
      .from('ktc_value_snapshots')
      .select('player_id, full_name, position, team, ktc_value, fdp_value, position_rank, captured_at')
      .eq('player_id', playerId)
      .eq('format', format)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error('Error fetching latest snapshot:', latestError);
      throw latestError;
    }

    console.log('Latest snapshot:', latestSnapshot);

    if (!latestSnapshot) {
      console.error('No snapshot found for player:', playerId);
      return new Response(
        JSON.stringify({ ok: false, error: 'Player not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    console.log('Fetching history data since:', cutoffDate.toISOString());

    const { data: historyData, error: historyError } = await supabase
      .from('ktc_value_snapshots')
      .select('captured_at, ktc_value, fdp_value')
      .eq('player_id', playerId)
      .eq('format', format)
      .gte('captured_at', cutoffDate.toISOString())
      .order('captured_at', { ascending: true });

    if (historyError) {
      console.error('Error fetching history:', historyError);
      throw historyError;
    }

    console.log('History data points:', historyData?.length || 0);

    let history = historyData || [];

    if (history.length === 0) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('ktc_value_snapshots')
        .select('captured_at, ktc_value, fdp_value')
        .eq('player_id', playerId)
        .eq('format', format)
        .order('captured_at', { ascending: false })
        .limit(200);

      if (!fallbackError && fallbackData) {
        history = fallbackData.reverse();
      }
    }

    const formattedHistory = history.map((point) => ({
      date: point.captured_at,
      ktc: point.ktc_value,
      fdp: point.fdp_value,
    }));

    const calculateTrend = (): 'up' | 'down' | 'stable' => {
      if (formattedHistory.length < 2) return 'stable';

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentHistory = formattedHistory.filter(
        (point) => new Date(point.date) >= sevenDaysAgo
      );

      if (recentHistory.length < 2) {
        const oldest = formattedHistory[0];
        const newest = formattedHistory[formattedHistory.length - 1];
        const diff = newest.fdp - oldest.fdp;

        if (diff > 200) return 'up';
        if (diff < -200) return 'down';
        return 'stable';
      }

      const oldest = recentHistory[0];
      const newest = recentHistory[recentHistory.length - 1];
      const diff = newest.fdp - oldest.fdp;

      if (diff > 200) return 'up';
      if (diff < -200) return 'down';
      return 'stable';
    };

    const calculateBadges = () => {
      if (formattedHistory.length < 5) {
        return { breakout: false, fallingKnife: false, volatile: false };
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const last30Days = formattedHistory.filter(
        (point) => new Date(point.date) >= thirtyDaysAgo
      );

      if (last30Days.length < 2) {
        return { breakout: false, fallingKnife: false, volatile: false };
      }

      const oldest = last30Days[0];
      const newest = last30Days[last30Days.length - 1];
      const change = newest.fdp - oldest.fdp;

      const values = last30Days.map((p) => p.fdp);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      return {
        breakout: change > 800,
        fallingKnife: change < -800,
        volatile: stdDev > 500,
      };
    };

    const result = {
      ok: true,
      player: {
        id: latestSnapshot.player_id,
        name: latestSnapshot.full_name,
        position: latestSnapshot.position,
        team: latestSnapshot.team,
      },
      latest: {
        ktc_value: latestSnapshot.ktc_value,
        fdp_value: latestSnapshot.fdp_value,
        rank: latestSnapshot.position_rank,
        updated_at: latestSnapshot.captured_at,
      },
      history: formattedHistory,
      trend: calculateTrend(),
      badges: calculateBadges(),
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in player-detail function:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });

    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
