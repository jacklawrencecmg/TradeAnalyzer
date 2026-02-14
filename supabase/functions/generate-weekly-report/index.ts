import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReportPlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  change_7d: number;
  change_pct: number;
  value_now: number;
  value_7d_ago: number;
  reason?: string;
  trend_tag?: string;
  signal_strength?: number;
}

interface MarketNote {
  category: 'position' | 'picks' | 'trend' | 'general';
  title: string;
  description: string;
  impact?: string;
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

    const { week, season } = await req.json();

    if (!week || !season) {
      throw new Error('Week and season are required');
    }

    console.log(`Generating dynasty report for Week ${week}, ${season}...`);

    const report = await generateDynastyReport(week, season, supabaseUrl, supabaseKey);

    const slug = `dynasty-report-week-${week}-${season}`;

    const { data: existing } = await supabase
      .from('dynasty_reports')
      .select('id')
      .eq('public_slug', slug)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from('dynasty_reports')
        .update({
          title: report.title,
          summary: report.summary,
          content: { sections: report.sections },
          metadata: report.metadata,
          published: true,
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`Failed to update report: ${updateError.message}`);
      }

      console.log(`Updated existing report: ${slug}`);
    } else {
      const { error: insertError } = await supabase
        .from('dynasty_reports')
        .insert({
          week: report.week,
          season: report.season,
          title: report.title,
          summary: report.summary,
          content: { sections: report.sections },
          public_slug: slug,
          metadata: report.metadata,
          published: true,
        });

      if (insertError) {
        throw new Error(`Failed to insert report: ${insertError.message}`);
      }

      console.log(`Created new report: ${slug}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        report: {
          slug,
          week: report.week,
          season: report.season,
          title: report.title,
          metadata: report.metadata,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateDynastyReport(week: number, season: number, supabaseUrl: string, supabaseKey: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  const playerChanges = await analyzePlayerChanges(supabaseUrl, headers, sevenDaysAgo);

  const risers = playerChanges
    .filter(p => p.change_7d >= 500)
    .sort((a, b) => b.change_7d - a.change_7d)
    .slice(0, 5);

  const fallers = playerChanges
    .filter(p => p.change_7d <= -500)
    .sort((a, b) => a.change_7d - b.change_7d)
    .slice(0, 5);

  const marketTrends = await fetchMarketTrends(supabaseUrl, headers);

  const buyLows = marketTrends
    .filter(p => p.trend_tag === 'buy_low' && p.signal_strength && p.signal_strength >= 70)
    .sort((a, b) => (b.signal_strength || 0) - (a.signal_strength || 0))
    .slice(0, 5);

  const sellHighs = marketTrends
    .filter(p => p.trend_tag === 'sell_high' && p.signal_strength && p.signal_strength >= 70)
    .sort((a, b) => (b.signal_strength || 0) - (a.signal_strength || 0))
    .slice(0, 5);

  const marketNotes = await generateMarketNotes(playerChanges);

  const topRiser = risers[0];
  const topFaller = fallers[0];

  const summary = generateSummary(risers, fallers, buyLows, sellHighs, week);

  return {
    week,
    season,
    title: `Dynasty Market Report - Week ${week}, ${season}`,
    summary,
    sections: [
      {
        type: 'risers',
        title: 'Top Risers This Week',
        players: risers,
      },
      {
        type: 'fallers',
        title: 'Top Fallers This Week',
        players: fallers,
      },
      {
        type: 'buy_low',
        title: 'Buy Low Opportunities',
        players: buyLows,
      },
      {
        type: 'sell_high',
        title: 'Sell High Candidates',
        players: sellHighs,
      },
      {
        type: 'market_notes',
        title: 'Market Trends & Insights',
        notes: marketNotes,
      },
    ],
    metadata: {
      top_riser_name: topRiser?.player_name || '',
      top_riser_change: topRiser?.change_7d || 0,
      top_faller_name: topFaller?.player_name || '',
      top_faller_change: topFaller?.change_7d || 0,
      total_players_analyzed: playerChanges.length,
      significant_movers: risers.length + fallers.length,
    },
  };
}

async function analyzePlayerChanges(
  supabaseUrl: string,
  headers: Record<string, string>,
  sevenDaysAgo: Date
): Promise<ReportPlayer[]> {
  const valuesResponse = await fetch(
    `${supabaseUrl}/rest/v1/player_values?select=player_id,full_name,position,team,fdp_value&fdp_value=gt.0&order=fdp_value.desc&limit=500`,
    { headers }
  );

  if (!valuesResponse.ok) {
    throw new Error('Failed to fetch player values');
  }

  const values = await valuesResponse.json();

  const snapshotsResponse = await fetch(
    `${supabaseUrl}/rest/v1/ktc_value_snapshots?snapshot_date=gte.${sevenDaysAgo.toISOString()}&select=player_id,fdp_value,snapshot_date&order=snapshot_date.asc`,
    { headers }
  );

  const snapshots = snapshotsResponse.ok ? await snapshotsResponse.json() : [];

  const snapshotMap = new Map();
  snapshots.forEach((s: any) => {
    if (!snapshotMap.has(s.player_id)) {
      snapshotMap.set(s.player_id, s.fdp_value);
    }
  });

  return values.map((v: any) => {
    const value_now = v.fdp_value || 0;
    const value_7d_ago = snapshotMap.get(v.player_id) || value_now;
    const change_7d = value_now - value_7d_ago;
    const change_pct = value_7d_ago > 0 ? ((change_7d / value_7d_ago) * 100) : 0;

    return {
      player_id: v.player_id,
      player_name: v.full_name,
      position: v.position,
      team: v.team,
      value_now,
      value_7d_ago,
      change_7d,
      change_pct: Math.round(change_pct * 10) / 10,
    };
  });
}

async function fetchMarketTrends(
  supabaseUrl: string,
  headers: Record<string, string>
): Promise<ReportPlayer[]> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/player_market_trends?select=player_id,tag,signal_strength,computed_at&order=computed_at.desc&limit=1000`,
    { headers }
  );

  if (!response.ok) {
    return [];
  }

  const trends = await response.json();

  const latestTrends = new Map();
  trends.forEach((t: any) => {
    if (!latestTrends.has(t.player_id)) {
      latestTrends.set(t.player_id, t);
    }
  });

  const playerIds = Array.from(latestTrends.keys()).slice(0, 100);

  if (playerIds.length === 0) {
    return [];
  }

  const valuesResponse = await fetch(
    `${supabaseUrl}/rest/v1/player_values?player_id=in.(${playerIds.join(',')})&select=player_id,full_name,position,team,fdp_value`,
    { headers }
  );

  if (!valuesResponse.ok) {
    return [];
  }

  const values = await valuesResponse.json();

  return values.map((v: any) => {
    const trend = latestTrends.get(v.player_id);
    return {
      player_id: v.player_id,
      player_name: v.full_name,
      position: v.position,
      team: v.team,
      value_now: v.fdp_value || 0,
      value_7d_ago: v.fdp_value || 0,
      change_7d: 0,
      change_pct: 0,
      trend_tag: trend?.tag,
      signal_strength: trend?.signal_strength,
    };
  });
}

async function generateMarketNotes(playerChanges: ReportPlayer[]): Promise<MarketNote[]> {
  const notes: MarketNote[] = [];

  const byPosition = {
    QB: playerChanges.filter(p => p.position === 'QB'),
    RB: playerChanges.filter(p => p.position === 'RB'),
    WR: playerChanges.filter(p => p.position === 'WR'),
    TE: playerChanges.filter(p => p.position === 'TE'),
  };

  Object.entries(byPosition).forEach(([pos, players]) => {
    if (players.length === 0) return;

    const avgChange = players.reduce((sum, p) => sum + p.change_7d, 0) / players.length;
    const avgChangePct = Math.round(avgChange * 10) / 10;

    if (Math.abs(avgChange) >= 100) {
      const direction = avgChange > 0 ? 'up' : 'down';
      const verb = avgChange > 0 ? 'rising' : 'falling';

      notes.push({
        category: 'position',
        title: `${pos} Market ${verb === 'rising' ? 'Heating Up' : 'Cooling Down'}`,
        description: `Average ${pos} values ${direction} ${Math.abs(avgChangePct).toLocaleString()} points this week`,
        impact: avgChange > 0 ? 'positive' : 'negative',
      });
    }
  });

  const bigRisers = playerChanges.filter(p => p.change_7d >= 1000).length;
  const bigFallers = playerChanges.filter(p => p.change_7d <= -1000).length;

  if (bigRisers > 5) {
    notes.push({
      category: 'trend',
      title: 'High Volatility Week',
      description: `${bigRisers} players gained 1,000+ points this week, indicating strong market movement`,
      impact: 'neutral',
    });
  }

  if (bigFallers > 5) {
    notes.push({
      category: 'trend',
      title: 'Significant Sell-Off',
      description: `${bigFallers} players lost 1,000+ points this week, suggesting market correction`,
      impact: 'neutral',
    });
  }

  if (notes.length === 0) {
    notes.push({
      category: 'general',
      title: 'Stable Market Week',
      description: 'No major market trends detected this week, values remain relatively stable',
      impact: 'neutral',
    });
  }

  return notes;
}

function generateSummary(
  risers: ReportPlayer[],
  fallers: ReportPlayer[],
  buyLows: ReportPlayer[],
  sellHighs: ReportPlayer[],
  week: number
): string {
  const parts: string[] = [];

  parts.push(`Week ${week} brought significant movement in the dynasty market.`);

  if (risers.length > 0) {
    const topRiser = risers[0];
    parts.push(
      `${topRiser.player_name} led all risers with a +${topRiser.change_7d.toLocaleString()} point gain (${topRiser.change_pct > 0 ? '+' : ''}${topRiser.change_pct}%).`
    );
  }

  if (fallers.length > 0) {
    const topFaller = fallers[0];
    parts.push(
      `On the flip side, ${topFaller.player_name} dropped ${topFaller.change_7d.toLocaleString()} points (${topFaller.change_pct}%).`
    );
  }

  if (buyLows.length > 0 || sellHighs.length > 0) {
    parts.push(
      `We've identified ${buyLows.length} strong buy-low candidates and ${sellHighs.length} sell-high opportunities for dynasty managers looking to optimize their rosters.`
    );
  }

  return parts.join(' ');
}
