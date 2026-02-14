import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateLeagueOGImageSVG(
  leagueName: string,
  week: number,
  topTeams: Array<{ rank: number; owner: string; value: number; change: number | null }>,
  format: string
): string {
  const formatDisplay = format.replace(/_/g, ' ').toUpperCase();

  return `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <!-- Background Gradient -->
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1F2937;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#1E40AF;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1F2937;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
        </filter>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FCD34D;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#F59E0B;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bgGradient)"/>

      <!-- Main Container -->
      <rect x="50" y="50" width="1100" height="530" rx="20" fill="white" filter="url(#shadow)"/>

      <!-- Header -->
      <rect x="50" y="50" width="1100" height="120" rx="20" fill="#2563EB"/>

      <!-- Trophy Icon -->
      <circle cx="130" cy="110" r="35" fill="url(#goldGradient)"/>
      <path d="M 130 95 L 135 105 L 125 105 Z M 128 105 L 132 105 L 132 115 L 128 115 Z M 126 115 L 134 115 L 134 120 L 126 120 Z" fill="#1F2937"/>

      <!-- League Name -->
      <text x="180" y="105" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white">
        ${leagueName.substring(0, 30)}${leagueName.length > 30 ? '...' : ''}
      </text>
      <text x="180" y="135" font-family="Arial, sans-serif" font-size="20" fill="#DBEAFE">
        Week ${week} Power Rankings • ${formatDisplay}
      </text>

      <!-- Top 5 Rankings -->
      ${topTeams.map((team, idx) => {
        const y = 210 + (idx * 70);
        const isFirst = team.rank === 1;
        const bgColor = isFirst ? '#FEF3C7' : '#F9FAFB';
        const rankColor = isFirst ? 'url(#goldGradient)' : '#6B7280';
        const trendIcon = team.change === null ? '—' : team.change > 0 ? '↑' : team.change < 0 ? '↓' : '—';
        const trendColor = team.change === null ? '#9CA3AF' : team.change > 0 ? '#10B981' : team.change < 0 ? '#EF4444' : '#9CA3AF';

        return `
          <!-- Team ${team.rank} -->
          <rect x="80" y="${y}" width="1040" height="60" rx="10" fill="${bgColor}"/>

          <!-- Rank Badge -->
          <circle cx="130" cy="${y + 30}" r="22" fill="${rankColor}"/>
          <text x="130" y="${y + 38}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${isFirst ? '#1F2937' : 'white'}" text-anchor="middle">
            ${team.rank}
          </text>

          <!-- Owner Name -->
          <text x="170" y="${y + 38}" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="#1F2937">
            ${team.owner.substring(0, 25)}${team.owner.length > 25 ? '...' : ''}
          </text>

          <!-- Value -->
          <text x="900" y="${y + 38}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#2563EB">
            ${team.value.toLocaleString()}
          </text>

          <!-- Trend -->
          <text x="1050" y="${y + 38}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${trendColor}" text-anchor="middle">
            ${trendIcon}
          </text>
        `;
      }).join('')}

      <!-- Footer -->
      <text x="600" y="565" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="#2563EB" text-anchor="middle">
        FantasyDraftPros.com
      </text>
    </svg>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const slug = url.pathname.split('/').pop();

    if (!slug) {
      return new Response('Missing slug', { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('*')
      .eq('public_slug', slug)
      .eq('is_public', true)
      .maybeSingle();

    if (leagueError || !league) {
      return new Response('League not found', { status: 404 });
    }

    const { data: rankings, error: rankingsError } = await supabase
      .from('league_rankings')
      .select('*')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (rankingsError || !rankings || rankings.length === 0) {
      return new Response('No rankings found', { status: 404 });
    }

    const latestWeek = Math.max(...rankings.map((r: any) => r.week));
    const latestRankings = rankings
      .filter((r: any) => r.week === latestWeek)
      .sort((a: any, b: any) => a.rank - b.rank)
      .slice(0, 5);

    const topTeams = latestRankings.map((r: any) => ({
      rank: r.rank,
      owner: r.owner_name,
      value: r.total_value,
      change: r.rank_change,
    }));

    const svg = generateLeagueOGImageSVG(
      league.name,
      latestWeek,
      topTeams,
      league.format
    );

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error generating league OG image:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
