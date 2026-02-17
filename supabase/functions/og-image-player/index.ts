const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.pathname.split('/').pop();
    const value = url.searchParams.get('value') || '0';
    const rank = url.searchParams.get('rank') || '0';
    const position = url.searchParams.get('pos') || 'WR';

    const playerName = slug
      ?.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Player';

    const svg = generatePlayerOGImage(playerName, value, rank, position);

    return new Response(svg, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('OG Image Error:', error);
    return new Response('Error generating image', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});

function generatePlayerOGImage(
  name: string,
  value: string,
  rank: string,
  position: string
): string {
  const formattedValue = parseInt(value).toLocaleString();
  const rankNum = parseInt(rank);
  const tierColor = getTierColor(parseInt(value));
  const trendIcon = '→';

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background Gradient -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGradient)"/>

  <!-- Decorative Elements -->
  <circle cx="1100" cy="100" r="200" fill="#1e293b" opacity="0.3"/>
  <circle cx="100" cy="530" r="150" fill="#1e293b" opacity="0.3"/>

  <!-- Top Bar with Logo/Brand -->
  <rect x="0" y="0" width="1200" height="80" fill="#0f172a" opacity="0.8"/>
  <text x="60" y="50" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="url(#accentGradient)">
    FANTASY DRAFT PROS
  </text>
  <text x="1080" y="50" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" fill="#64748b" text-anchor="end">
    Dynasty Values
  </text>

  <!-- Main Content Area -->
  <g transform="translate(60, 150)">
    <!-- Player Name -->
    <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="800" fill="#ffffff">
      ${name}
    </text>

    <!-- Position Badge -->
    <rect x="0" y="30" width="${position.length * 28 + 40}" height="50" rx="8" fill="${tierColor}" opacity="0.2"/>
    <rect x="0" y="30" width="${position.length * 28 + 40}" height="50" rx="8" fill="none" stroke="${tierColor}" stroke-width="2"/>
    <text x="${position.length * 14 + 20}" y="62" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="${tierColor}" text-anchor="middle">
      ${position}
    </text>

    <!-- Dynasty Value Card -->
    <g transform="translate(0, 120)">
      <rect x="0" y="0" width="500" height="180" rx="16" fill="#1e293b" opacity="0.6"/>
      <rect x="0" y="0" width="500" height="180" rx="16" fill="none" stroke="url(#accentGradient)" stroke-width="3"/>

      <text x="30" y="50" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" fill="#94a3b8">
        DYNASTY VALUE
      </text>
      <text x="30" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="url(#accentGradient)">
        ${formattedValue}
      </text>
      <text x="460" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="48" fill="#64748b" text-anchor="end">
        ${trendIcon}
      </text>
    </g>

    <!-- Rank Card -->
    <g transform="translate(540, 120)">
      <rect x="0" y="0" width="320" height="180" rx="16" fill="#1e293b" opacity="0.6"/>
      <rect x="0" y="0" width="320" height="180" rx="16" fill="none" stroke="#475569" stroke-width="2"/>

      <text x="30" y="50" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" fill="#94a3b8">
        OVERALL RANK
      </text>
      <text x="30" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="#3b82f6">
        #${rankNum > 0 ? rank : '—'}
      </text>
    </g>
  </g>

  <!-- Attribution Watermark (Subtle but Visible) -->
  <g transform="translate(60, 570)">
    <rect x="0" y="0" width="300" height="40" rx="8" fill="#0f172a" opacity="0.9"/>
    <text x="20" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#64748b">
      Data via FDP Dynasty Values
    </text>
  </g>

  <!-- Update Badge -->
  <g transform="translate(950, 570)">
    <rect x="0" y="0" width="190" height="40" rx="8" fill="#1e293b" opacity="0.9"/>
    <text x="95" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="#94a3b8" text-anchor="middle">
      Updated Today
    </text>
  </g>
</svg>`;
}

function getTierColor(value: number): string {
  if (value >= 4500) return '#10b981';
  if (value >= 3000) return '#3b82f6';
  if (value >= 1800) return '#8b5cf6';
  return '#64748b';
}
