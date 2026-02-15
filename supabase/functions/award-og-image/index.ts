import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateSVG(award: any): string {
  const awardColors: Record<string, { bg1: string; bg2: string; icon: string }> = {
    'Best GM': { bg1: '#fbbf24', bg2: '#f59e0b', icon: '👑' },
    'Most Consistent': { bg1: '#3b82f6', bg2: '#2563eb', icon: '🎯' },
    'Dynasty Builder': { bg1: '#10b981', bg2: '#059669', icon: '📈' },
    'Biggest Riser': { bg1: '#a855f7', bg2: '#9333ea', icon: '⚡' },
    'Trade King': { bg1: '#f97316', bg2: '#ea580c', icon: '⭐' },
  };

  const colors = awardColors[award.award] || { bg1: '#6b7280', bg2: '#4b5563', icon: '🏆' };

  return `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colors.bg1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colors.bg2};stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>

      <!-- Trophy Icon -->
      <text x="600" y="140" font-family="Arial, sans-serif" font-size="80" text-anchor="middle">
        ${colors.icon}
      </text>

      <!-- Award Name -->
      <text x="600" y="240" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="white" text-anchor="middle">
        ${award.award}
      </text>

      <!-- Winner Name -->
      <text x="600" y="330" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">
        ${award.team_name || 'Unknown Team'}
      </text>

      <!-- Details Line 1 -->
      <text x="600" y="410" font-family="Arial, sans-serif" font-size="28" fill="white" opacity="0.95" text-anchor="middle">
        ${truncateText(award.details, 70)}
      </text>

      <!-- Stats -->
      ${generateStatsText(award.stats)}

      <!-- Branding -->
      <text x="600" y="580" font-family="Arial, sans-serif" font-size="20" fill="white" opacity="0.7" text-anchor="middle">
        Fantasy Draft Pros • ${award.season} Season Awards
      </text>
    </svg>
  `;
}

function generateStatsText(stats: any): string {
  if (!stats || Object.keys(stats).length === 0) return '';

  const entries = Object.entries(stats).slice(0, 2);
  const y = 470;

  return entries.map(([key, value], index) => {
    const x = 600 + (index === 0 ? -150 : 150);
    const label = formatStatKey(key);
    const val = formatStatValue(value);

    return `
      <text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="20" fill="white" opacity="0.85" text-anchor="middle">
        ${label}: ${val}
      </text>
    `;
  }).join('');
}

function formatStatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatStatValue(value: any): string {
  if (typeof value === 'number') {
    return value.toFixed(1);
  }
  return String(value);
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
    const awardId = url.searchParams.get('id');

    if (!awardId) {
      return new Response('Missing award ID', {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: award, error } = await supabase
      .from('season_awards')
      .select('*')
      .eq('id', awardId)
      .single();

    if (error || !award) {
      return new Response('Award not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    const svg = generateSVG(award);

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
