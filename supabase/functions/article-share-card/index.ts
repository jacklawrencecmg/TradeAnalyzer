import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const articleId = url.pathname.split('/').pop();

    if (!articleId) {
      return new Response('Article ID required', {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: article, error } = await supabase
      .from('generated_articles')
      .select('headline, article_type, player_ids')
      .eq('article_id', articleId)
      .single();

    if (error || !article) {
      return new Response('Article not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    const playerNames: string[] = [];
    if (article.player_ids && article.player_ids.length > 0) {
      const { data: players } = await supabase
        .rpc('get_latest_player_values', {})
        .in('player_id', article.player_ids.slice(0, 5));

      if (players) {
        playerNames.push(...players.map((p: any) => p.full_name));
      }
    }

    const svg = generateShareCardSVG(article.headline, article.article_type, playerNames);

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating share card:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: corsHeaders,
    });
  }
});

function generateShareCardSVG(headline: string, articleType: string, playerNames: string[]): string {
  const width = 1200;
  const height = 630;

  const getColor = (type: string) => {
    switch (type) {
      case 'riser':
        return '#10b981';
      case 'faller':
        return '#ef4444';
      case 'buy_low':
        return '#3b82f6';
      default:
        return '#f97316';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'riser':
        return '↗';
      case 'faller':
        return '↘';
      case 'buy_low':
        return '🎯';
      default:
        return '📈';
    }
  };

  const accentColor = getColor(articleType);
  const icon = getIcon(articleType);

  const truncatedHeadline = headline.length > 80 ? headline.substring(0, 77) + '...' : headline;
  const playerList = playerNames.slice(0, 3).join(' • ');

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f0f0f;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${accentColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0.7" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Accent bar -->
  <rect x="0" y="0" width="${width}" height="8" fill="url(#accent)"/>

  <!-- Icon badge -->
  <circle cx="100" cy="120" r="50" fill="${accentColor}" opacity="0.2"/>
  <text x="100" y="145" font-size="60" text-anchor="middle" fill="${accentColor}">${icon}</text>

  <!-- Article type badge -->
  <rect x="80" y="200" width="200" height="40" rx="20" fill="${accentColor}" opacity="0.3"/>
  <text x="180" y="228" font-size="18" font-weight="bold" text-anchor="middle" fill="white" text-transform="uppercase">
    ${articleType.replace('_', ' ')}
  </text>

  <!-- Headline -->
  <text x="80" y="300" font-size="48" font-weight="bold" fill="white" font-family="Arial, sans-serif">
    ${wrapText(truncatedHeadline, 900)}
  </text>

  <!-- Player names -->
  ${playerList ? `
  <text x="80" y="500" font-size="24" fill="#888888" font-family="Arial, sans-serif">
    ${playerList}
  </text>` : ''}

  <!-- Branding -->
  <rect x="80" y="550" width="400" height="2" fill="${accentColor}"/>
  <text x="80" y="590" font-size="28" font-weight="bold" fill="white" font-family="Arial, sans-serif">
    Fantasy Draft Pros
  </text>
</svg>`;
}

function wrapText(text: string, maxWidth: number): string {
  return text;
}
