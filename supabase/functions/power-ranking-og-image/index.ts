import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateSVG(ranking: any): string {
  const trendArrow = ranking.metadata?.trend > 0 ? '↑' : ranking.metadata?.trend < 0 ? '↓' : '→';
  const trendColor = ranking.metadata?.trend > 0 ? '#10b981' : ranking.metadata?.trend < 0 ? '#ef4444' : '#6b7280';

  return `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>

      <!-- Title -->
      <text x="600" y="80" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle">
        League Power Rankings
      </text>

      <!-- Rank Circle -->
      <circle cx="600" cy="220" r="80" fill="white" opacity="0.2"/>
      <text x="600" y="240" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle">
        #${ranking.rank}
      </text>

      <!-- Trend Arrow -->
      <text x="720" y="220" font-family="Arial, sans-serif" font-size="48" fill="${trendColor}" text-anchor="middle">
        ${trendArrow}
      </text>

      <!-- Team Name -->
      <text x="600" y="350" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">
        ${ranking.team_name}
      </text>

      <!-- Power Score -->
      <text x="600" y="420" font-family="Arial, sans-serif" font-size="32" fill="white" opacity="0.9" text-anchor="middle">
        Power Score: ${ranking.power_score.toFixed(2)}
      </text>

      <!-- Reason (truncated) -->
      <text x="600" y="490" font-family="Arial, sans-serif" font-size="24" fill="white" opacity="0.8" text-anchor="middle">
        ${truncateText(ranking.metadata?.reason || 'Competitive team', 60)}
      </text>

      <!-- Branding -->
      <text x="600" y="580" font-family="Arial, sans-serif" font-size="20" fill="white" opacity="0.6" text-anchor="middle">
        Fantasy Draft Pros • Week ${ranking.week}
      </text>
    </svg>
  `;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
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

    const url = new URL(req.url);
    const rankingId = url.searchParams.get('id');

    if (!rankingId) {
      return new Response('Missing ranking ID', {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: ranking, error } = await supabase
      .from('league_power_rankings')
      .select('*')
      .eq('id', rankingId)
      .single();

    if (error || !ranking) {
      return new Response('Ranking not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    const svg = generateSVG(ranking);

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(error.message, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
