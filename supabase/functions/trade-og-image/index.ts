import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateOGImageSVG(
  sideAPlayers: string[],
  sideBPlayers: string[],
  fairness: number,
  winner: string
): string {
  const winnerText = winner === 'side_a' ? 'Team A Wins' : winner === 'side_b' ? 'Team B Wins' : 'Even Trade';
  const winnerColor = winner === 'even' ? '#6B7280' : '#10B981';

  const sideAText = sideAPlayers.slice(0, 3).join(', ') + (sideAPlayers.length > 3 ? '...' : '');
  const sideBText = sideBPlayers.slice(0, 3).join(', ') + (sideBPlayers.length > 3 ? '...' : '');

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
      </defs>

      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bgGradient)"/>

      <!-- Main Container -->
      <rect x="50" y="50" width="1100" height="530" rx="20" fill="white" filter="url(#shadow)"/>

      <!-- Header -->
      <rect x="50" y="50" width="1100" height="100" rx="20" fill="#2563EB"/>
      <text x="600" y="110" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">
        Trade Analysis
      </text>

      <!-- Fairness Badge -->
      <rect x="500" y="170" width="200" height="80" rx="10" fill="#DBEAFE"/>
      <text x="600" y="205" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#1E40AF" text-anchor="middle">
        Fairness
      </text>
      <text x="600" y="235" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#1E3A8A" text-anchor="middle">
        ${fairness}%
      </text>

      <!-- Winner Badge -->
      <rect x="720" y="170" width="200" height="80" rx="10" fill="#D1FAE5"/>
      <text x="820" y="205" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="${winnerColor}" text-anchor="middle">
        Result
      </text>
      <text x="820" y="235" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${winnerColor}" text-anchor="middle">
        ${winnerText}
      </text>

      <!-- Team A Section -->
      <rect x="80" y="280" width="500" height="220" rx="10" fill="#F3F4F6"/>
      <text x="330" y="315" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#1F2937" text-anchor="middle">
        Team A Gives
      </text>
      <text x="330" y="360" font-family="Arial, sans-serif" font-size="18" fill="#4B5563" text-anchor="middle">
        ${sideAText.substring(0, 50)}
      </text>
      ${sideAPlayers.length > 1 ? `
      <text x="330" y="390" font-family="Arial, sans-serif" font-size="18" fill="#4B5563" text-anchor="middle">
        ${sideAPlayers.slice(1, 2).join('')}
      </text>` : ''}
      <text x="330" y="460" font-family="Arial, sans-serif" font-size="16" fill="#6B7280" text-anchor="middle">
        + ${sideAPlayers.length > 2 ? (sideAPlayers.length - 2) + ' more' : ''}
      </text>

      <!-- VS -->
      <text x="600" y="410" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#9CA3AF" text-anchor="middle">
        VS
      </text>

      <!-- Team B Section -->
      <rect x="620" y="280" width="500" height="220" rx="10" fill="#F3F4F6"/>
      <text x="870" y="315" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#1F2937" text-anchor="middle">
        Team B Gives
      </text>
      <text x="870" y="360" font-family="Arial, sans-serif" font-size="18" fill="#4B5563" text-anchor="middle">
        ${sideBText.substring(0, 50)}
      </text>
      ${sideBPlayers.length > 1 ? `
      <text x="870" y="390" font-family="Arial, sans-serif" font-size="18" fill="#4B5563" text-anchor="middle">
        ${sideBPlayers.slice(1, 2).join('')}
      </text>` : ''}
      <text x="870" y="460" font-family="Arial, sans-serif" font-size="16" fill="#6B7280" text-anchor="middle">
        + ${sideBPlayers.length > 2 ? (sideBPlayers.length - 2) + ' more' : ''}
      </text>

      <!-- Footer -->
      <text x="600" y="555" font-family="Arial, sans-serif" font-size="20" font-weight="600" fill="#2563EB" text-anchor="middle">
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

    const { data: trade, error } = await supabase
      .from('shared_trades')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !trade) {
      return new Response('Trade not found', { status: 404 });
    }

    const sideAPlayers = (trade.side_a.players || []).map((p: any) => p.name);
    const sideBPlayers = (trade.side_b.players || []).map((p: any) => p.name);

    if (trade.side_a.picks && trade.side_a.picks.length > 0) {
      sideAPlayers.push(`${trade.side_a.picks.length} pick${trade.side_a.picks.length > 1 ? 's' : ''}`);
    }
    if (trade.side_b.picks && trade.side_b.picks.length > 0) {
      sideBPlayers.push(`${trade.side_b.picks.length} pick${trade.side_b.picks.length > 1 ? 's' : ''}`);
    }

    const svg = generateOGImageSVG(
      sideAPlayers,
      sideBPlayers,
      trade.fairness_percentage,
      trade.winner
    );

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
